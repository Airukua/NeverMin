import * as vscode from 'vscode';
import path from 'path';
import { buildRepoGraph } from '../core/graph/graphBuilder';
import { buildGraphInsights } from '../core/graph/graphInsights';
import { analyzeRepoFiles, RepoFileSnapshot } from '../core/analysis/repoAnalyzer';
import { buildGraphInsightsPrompt, buildNodeSummariesPrompt, parseNodeSummariesResponse } from '../core/llm/promptBuilder';
import { createLlmProvider } from '../core/llm/llmClient';
import { collectDiagramSummaryTargets } from '../core/graph/repoMermaid';
import { Logger } from '../utils/logger';
import {
  getApiKey,
  getLanguage,
  getLlmModel,
  getLlmTemperature,
  getMaxAnalysisFiles,
  getOllamaBaseUrl,
  getProviderLabel,
  getProviderName,
  hasApiKey
} from '../utils/config';
import { t } from '../i18n';
import {
  runLoggedLlmCall,
  summarizeNarrativeResult,
  summarizeNodeSummariesResult
} from '../utils/llmActivity';
import {
  LlmIssue,
  classifyLlmError,
  notifyLlmIssue,
  pickPrimaryLlmIssue
} from '../utils/llmUserNotice';
import { isIgnoredWorkspacePath, hasWorkspaceFolders } from '../utils/workspace';
import { setCachedCodeGraph } from '../utils/codeGraphCache';
import { saveRepoAnalysis, setLastAnalysisMode, setRepoAnalysisStatus } from '../utils/repoAnalysis';
import { getSelectedAnalysisFileUris } from '../utils/repoAnalysisSelection';
import { createGraphPanel, setGraphPanelState, updateGraphPanel } from '../ui/webview/graphPanel';
import { clearSymbolCache } from '../core/parser/symbolCache';

/** Batas aman agar analisis full-repo tidak OOM di workspace besar. */
export const MAX_ANALYSIS_FILES = 500;

export function limitAnalysisFiles<T>(files: readonly T[], max = MAX_ANALYSIS_FILES): {
  capped: T[];
  truncated: boolean;
} {
  return {
    capped: files.slice(0, max),
    truncated: files.length > max
  };
}

/** Gate setelah baca file: cancel token, kosong, atau lanjut pipeline. */
export type AnalysisProgressGate = 'cancelled' | 'empty' | 'ready';

export function gateAnalysisProgress(cancelled: boolean, snapshotCount: number): AnalysisProgressGate {
  if (cancelled) {
    return 'cancelled';
  }
  if (snapshotCount <= 0) {
    return 'empty';
  }
  return 'ready';
}

const WORKSPACE_CODE_GLOB =
  '**/*.{ts,tsx,js,jsx,mjs,cjs,py,go,java,kt,kts,rs,rb,php,sh,c,cc,cpp,h,hpp,cs,swift,md,json,yml,yaml,toml,txt}';
const WORKSPACE_IGNORE_GLOB =
  '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.vscode-test/**,**/build/**,**/coverage/**,**/vendor/**,**/.next/**,**/.nuxt/**,**/.svelte-kit/**,**/.cache/**,**/.turbo/**,**/tmp/**,**/temp/**}';

async function readSnapshots(files: vscode.Uri[], token: vscode.CancellationToken): Promise<RepoFileSnapshot[]> {
  const snapshots: RepoFileSnapshot[] = [];
  const decoder = new TextDecoder('utf-8');

  for (let index = 0; index < files.length; index += 1) {
    if (token.isCancellationRequested) {
      break;
    }

    const uri = files[index];
    if (isIgnoredWorkspacePath(uri.fsPath)) {
      Logger.info(`Lewati file library/build saat analisis: ${uri.fsPath}`);
      continue;
    }

    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const content = decoder.decode(await vscode.workspace.fs.readFile(uri));
      snapshots.push({
        filePath: uri.fsPath,
        workspaceRoot: workspaceFolder?.uri.fsPath ?? path.dirname(uri.fsPath),
        content
      });
    } catch (error) {
      Logger.warn(`Gagal membaca file saat analisis repo ${uri.fsPath}: ${error}`);
    }
  }

  return snapshots;
}

type EnrichOutcome = {
  insights: ReturnType<typeof buildGraphInsights>;
  issue?: LlmIssue;
};

async function enrichInsightsWithNarrative(
  context: vscode.ExtensionContext,
  insights: ReturnType<typeof buildGraphInsights>
): Promise<EnrichOutcome> {
  const providerLabel = getProviderLabel();
  if (!(await hasApiKey(context))) {
    Logger.info('LLM lewati · narasi insights · API key belum ada');
    return {
      insights,
      issue: { kind: 'no_key', providerLabel }
    };
  }

  try {
    const providerName = getProviderName();
    const model = getLlmModel() || undefined;
    const provider = createLlmProvider(providerName, await getApiKey(context), {
      model,
      temperature: getLlmTemperature(),
      baseUrl: providerName === 'ollama' ? getOllamaBaseUrl() : undefined
    });
    const narrative = await runLoggedLlmCall(
      {
        task: getLanguage() === 'en' ? 'insights narrative' : 'narasi insights',
        provider: getProviderLabel(providerName),
        model
      },
      () => provider.complete(buildGraphInsightsPrompt(insights, getLanguage())),
      summarizeNarrativeResult
    );
    const normalized = normalizeMarkdownNarrative(narrative);
    if (!normalized) {
      Logger.warn('LLM hasil · narasi insights · kosong setelah normalisasi');
      return {
        insights,
        issue: { kind: 'empty', providerLabel }
      };
    }
    return {
      insights: {
        ...insights,
        narrative: normalized
      }
    };
  } catch (error) {
    // Detail gagal sudah di-log oleh runLoggedLlmCall
    return {
      insights,
      issue: {
        kind: classifyLlmError(error),
        providerLabel,
        detail: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

async function enrichInsightsWithNodeSummaries(
  context: vscode.ExtensionContext,
  graph: Parameters<typeof collectDiagramSummaryTargets>[0],
  insights: ReturnType<typeof buildGraphInsights>
): Promise<EnrichOutcome> {
  const providerLabel = getProviderLabel();
  if (!(await hasApiKey(context))) {
    Logger.info('LLM lewati · ringkas fungsi · API key belum ada');
    return {
      insights,
      issue: { kind: 'no_key', providerLabel }
    };
  }

  const targets = collectDiagramSummaryTargets(graph, insights);
  if (targets.length === 0) {
    Logger.info('LLM lewati · ringkas fungsi · tidak ada target node di diagram');
    return { insights };
  }

  try {
    const providerName = getProviderName();
    const model = getLlmModel() || undefined;
    const provider = createLlmProvider(providerName, await getApiKey(context), {
      model,
      temperature: Math.min(getLlmTemperature(), 0.4),
      baseUrl: providerName === 'ollama' ? getOllamaBaseUrl() : undefined
    });
    let parsed: Record<string, string> = {};
    await runLoggedLlmCall(
      {
        task:
          getLanguage() === 'en'
            ? `function summaries (${targets.length} nodes)`
            : `ringkas fungsi (${targets.length} node)`,
        provider: getProviderLabel(providerName),
        model
      },
      async () => {
        const raw = await provider.complete(
          buildNodeSummariesPrompt(
            targets.map((item) => ({
              id: item.id,
              name: item.name,
              kind: item.kind,
              filePath: item.filePath,
              role: item.role
            })),
            getLanguage()
          )
        );
        parsed = parseNodeSummariesResponse(raw, targets);
        if (Object.keys(parsed).length === 0) {
          Logger.warn(
            `LLM hasil · ringkas fungsi · 0/${targets.length} ter-parse · cuplikan: ${raw.trim().slice(0, 80) || '(kosong)'}`
          );
        }
        return raw;
      },
      () => summarizeNodeSummariesResult(parsed, targets.length)
    );
    if (Object.keys(parsed).length === 0) {
      return {
        insights,
        issue: { kind: 'empty', providerLabel }
      };
    }
    return {
      insights: {
        ...insights,
        nodeSummaries: {
          ...(insights.nodeSummaries ?? {}),
          ...parsed
        }
      }
    };
  } catch (error) {
    // Detail gagal sudah di-log oleh runLoggedLlmCall
    return {
      insights,
      issue: {
        kind: classifyLlmError(error),
        providerLabel,
        detail: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

function normalizeMarkdownNarrative(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return text;
}

async function runAnalysisWorkflow(
  context: vscode.ExtensionContext,
  files: vscode.Uri[],
  loadingMessage: string,
  summaryPhrase: string,
  mode: 'repo' | 'selected'
): Promise<void> {
  const maxFiles = getMaxAnalysisFiles();
  const { capped: cappedFiles, truncated } = limitAnalysisFiles(files, maxFiles);
  if (truncated) {
    vscode.window.showWarningMessage(
      t('analyze.fileCap', { max: maxFiles, total: files.length })
    );
  }

  await setLastAnalysisMode(context, mode);
  await setRepoAnalysisStatus(context, 'loading');
  await vscode.commands.executeCommand('nevermin.refreshSidebar');
  clearSymbolCache();
  Logger.info(`Analisis dimulai (${mode}) · ${cappedFiles.length} file`);

  const graphPanel = createGraphPanel(
    context.extensionUri,
    { nodes: [], edges: [] },
    undefined,
    {
      state: 'loading',
      message: loadingMessage
    }
  );

  try {
    let cancelled = false;
    const snapshots = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('analyze.progressCollect'),
        cancellable: true
      },
      async (progress, token) => {
        progress.report({ message: t('analyze.progressCollecting'), increment: 0 });
        Logger.info('Mengumpulkan isi file…');
        const result = await readSnapshots(cappedFiles, token);
        if (token.isCancellationRequested) {
          cancelled = true;
        }
        progress.report({ message: `File terkumpul: ${result.length}`, increment: 35 });
        Logger.info(`File terkumpul: ${result.length}`);
        return result;
      }
    );

    const progressGate = gateAnalysisProgress(cancelled, snapshots.length);
    if (progressGate === 'cancelled') {
      await setRepoAnalysisStatus(context, 'idle');
      await setGraphPanelState(graphPanel, 'empty', t('analyze.cancelled'));
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
      Logger.warn('Analisis dibatalkan pengguna');
      vscode.window.showInformationMessage(t('analyze.cancelled'));
      return;
    }

    if (progressGate === 'empty') {
      await setRepoAnalysisStatus(context, 'idle');
      await setGraphPanelState(graphPanel, 'empty', t('analyze.noValidFiles'));
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
      Logger.warn('Tidak ada file valid untuk dianalisis');
      vscode.window.showWarningMessage(t('analyze.noValidFiles'));
      return;
    }

    const analysis = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('analyze.progressSummary'),
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: t('analyze.progressAnalyzing', { count: snapshots.length }), increment: 0 });
        Logger.info(`Membangun graph dari ${snapshots.length} file…`);
        const [analysisResult, graph] = await Promise.all([
          analyzeRepoFiles(snapshots),
          buildRepoGraph(
            snapshots.map((snapshot) => ({
              path: snapshot.filePath,
              content: snapshot.content,
              workspaceRoot: snapshot.workspaceRoot
            }))
          )
        ]);

        progress.report({ message: t('analyze.progressInsights'), increment: 40 });
        Logger.info(`Graph siap · ${graph.nodes.length} node · ${graph.edges.length} edge`);
        await setCachedCodeGraph(context, graph);
        let insights = buildGraphInsights(graph, getLanguage());

        // Tampilkan Mermaid SEGERA — jangan ditahan 2x call LLM (bisa stuck bermenit-menit)
        const baseAnalysis = {
          ...analysisResult,
          insights
        };
        progress.report({ message: t('analyze.progressDiagram'), increment: 55 });
        Logger.info('Menampilkan diagram Mermaid…');
        await saveRepoAnalysis(context, baseAnalysis);
        await updateGraphPanel(graphPanel, graph, {
          state: graph.nodes.length > 0 ? 'ready' : 'empty',
          message: graph.nodes.length > 0 ? undefined : t('analyze.emptyGraph'),
          insights
        });
        Logger.info('Diagram Mermaid ditampilkan');

        if (await hasApiKey(context)) {
          progress.report({ message: t('analyze.progressLlm'), increment: 70 });
          const providerLabel = getProviderLabel();
          const model = getLlmModel() || '(default provider)';
          Logger.info(`LLM mulai · provider=${providerLabel} · model=${model} · 2 call paralel`);
          try {
            const [narrativeOutcome, summariesOutcome] = await Promise.all([
              enrichInsightsWithNarrative(context, insights),
              enrichInsightsWithNodeSummaries(context, graph, insights)
            ]);
            insights = {
              ...insights,
              narrative: narrativeOutcome.insights.narrative ?? insights.narrative,
              nodeSummaries: {
                ...(insights.nodeSummaries ?? {}),
                ...(summariesOutcome.insights.nodeSummaries ?? {})
              }
            };
            const enrichedAnalysis = {
              ...analysisResult,
              insights
            };
            await saveRepoAnalysis(context, enrichedAnalysis);
            await updateGraphPanel(graphPanel, graph, {
              state: graph.nodes.length > 0 ? 'ready' : 'empty',
              insights
            });
            await vscode.commands.executeCommand('nevermin.refreshSidebar');
            const narrativeOk = Boolean(insights.narrative?.trim());
            const summaryCount = Object.keys(insights.nodeSummaries ?? {}).length;
            const issues = [narrativeOutcome.issue, summariesOutcome.issue].filter(
              (item): item is LlmIssue => Boolean(item)
            );

            if (narrativeOk && summaryCount > 0) {
              Logger.info(
                `LLM selesai · OK · narasi=${summarizeNarrativeResult(insights.narrative || '')} · summaries=${summaryCount}`
              );
            } else if (narrativeOk || summaryCount > 0) {
              Logger.warn(
                `LLM selesai · SEBAGIAN · narasi=${narrativeOk ? 'ya' : 'tidak'} · summaries=${summaryCount}`
              );
              const primary =
                pickPrimaryLlmIssue(issues) ??
                ({ kind: 'partial', providerLabel } satisfies LlmIssue);
              void notifyLlmIssue(primary);
            } else {
              Logger.warn('LLM selesai · GAGAL · narasi dan summaries kosong (cek log LLM gagal di atas)');
              const primary =
                pickPrimaryLlmIssue(issues) ??
                ({ kind: 'empty', providerLabel } satisfies LlmIssue);
              void notifyLlmIssue(primary);
            }
            return enrichedAnalysis;
          } catch (llmError) {
            Logger.error(`LLM batch gagal (diagram tetap tampil): ${llmError}`);
            void notifyLlmIssue({
              kind: classifyLlmError(llmError),
              providerLabel,
              detail: llmError instanceof Error ? llmError.message : String(llmError)
            });
          }
        } else {
          Logger.warn(
            `LLM lewati · API key belum ada untuk ${getProviderLabel()} — set key di Pengaturan`
          );
          void notifyLlmIssue({
            kind: 'no_key',
            providerLabel: getProviderLabel()
          });
        }

        return baseAnalysis;
      }
    );

    await setRepoAnalysisStatus(context, 'ready');
    await vscode.commands.executeCommand('nevermin.refreshSidebar');
    Logger.info(`Analisis selesai · ${analysis.fileCount} file · ${analysis.symbolCount} symbol`);

    vscode.window.showInformationMessage(
      getLanguage() === 'en'
        ? `NeverMIN analyzed ${analysis.fileCount} files ${summaryPhrase} and found ${analysis.symbolCount} symbols. See Insights in the sidebar and graph.`
        : `NeverMIN menganalisis ${analysis.fileCount} file ${summaryPhrase} dan menemukan ${analysis.symbolCount} symbol. Lihat Insights di sidebar dan graph.`
    );
  } catch (error) {
    await setRepoAnalysisStatus(context, 'error');
    try {
      await setGraphPanelState(
        graphPanel,
        'error',
        error instanceof Error ? error.message : t('analyze.error', { error: String(error) })
      );
    } catch {
      // Panel mungkin sudah ditutup
    }
    await vscode.commands.executeCommand('nevermin.refreshSidebar');
    Logger.error(`analyzeRepo gagal: ${error}`);
    vscode.window.showErrorMessage(t('analyze.error', { error: String(error) }));
  }
}

export function registerAnalyzeRepoCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('nevermin.analyzeRepo', async () => {
    const { ensurePrivacyModeChosen } = await import('../utils/privacyGuards');
    if (!(await ensurePrivacyModeChosen(context))) {
      return;
    }
    if (!hasWorkspaceFolders()) {
      vscode.window.showWarningMessage(t('sidebar.action.openFolderRequired'));
      return;
    }

    const maxFiles = getMaxAnalysisFiles();
    const files = await vscode.workspace.findFiles(
      WORKSPACE_CODE_GLOB,
      WORKSPACE_IGNORE_GLOB,
      maxFiles
    );

    if (files.length === 0) {
      vscode.window.showWarningMessage(t('analyze.noValidFiles'));
      return;
    }

    Logger.info(`analyzeRepo dipanggil untuk ${files.length} file`);
    await runAnalysisWorkflow(
      context,
      files,
      getLanguage() === 'en'
        ? 'Reading workspace and preparing the analysis graph...'
        : 'Membaca workspace dan menyiapkan graph analisis...',
      getLanguage() === 'en' ? 'in this workspace' : 'di workspace ini',
      'repo'
    );
  });
}

export function registerAnalyzeSelectedFilesCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('nevermin.analyzeSelectedFiles', async () => {
    const { ensurePrivacyModeChosen } = await import('../utils/privacyGuards');
    if (!(await ensurePrivacyModeChosen(context))) {
      return;
    }
    if (!hasWorkspaceFolders()) {
      vscode.window.showWarningMessage(t('sidebar.action.openFolderRequired'));
      return;
    }

    const files = getSelectedAnalysisFileUris(context).filter((uri) => !isIgnoredWorkspacePath(uri.fsPath));
    if (files.length === 0) {
      vscode.window.showWarningMessage(t('sidebar.action.checkFirst'));
      return;
    }

    Logger.info(`analyzeSelectedFiles dipanggil untuk ${files.length} file`);
    await runAnalysisWorkflow(
      context,
      files,
      getLanguage() === 'en'
        ? 'Reading selected files and preparing the analysis graph...'
        : 'Membaca file terpilih dan menyiapkan graph analisis...',
      getLanguage() === 'en' ? 'from selected files' : 'dari file terpilih',
      'selected'
    );
  });
}
