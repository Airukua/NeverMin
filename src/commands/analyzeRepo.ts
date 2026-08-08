import * as vscode from 'vscode';
import path from 'path';
import { buildRepoGraph } from '../core/graph/graphBuilder';
import { buildGraphInsights } from '../core/graph/graphInsights';
import { analyzeRepoFiles, RepoFileSnapshot } from '../core/analysis/repoAnalyzer';
import { buildGraphInsightsPrompt, buildNodeSummariesPrompt, parseNodeSummariesResponse, parseGraphInsightsLlmResponse, applyGraphInsightsLlmPayload } from '../core/llm/promptBuilder';
import { createLlmProvider } from '../core/llm/llmClient';
import { collectDiagramSummaryTargets } from '../core/graph/repoMermaid';
import { Logger } from '../utils/logger';
import {
  getLanguage,
  getLlmTemperature,
  getMaxAnalysisFiles
} from '../utils/config';
import { t } from '../i18n';
import {
  runLoggedLlmCall,
  summarizeNarrativeResult,
  summarizeNodeSummariesResult,
  withCompletionUsageSummary
} from '../utils/llmActivity';
import {
  accumulateCompletionUsage,
  addTokenUsage,
  formatTokenUsageForLog
} from '../core/llm/tokenUsage';
import {
  logSemanticRetry,
  semanticRetryDelayMs,
  semanticRetryPlanFor,
  semanticRetryPromptSuffix,
  semanticRetryTemperature,
  shouldAbortSemanticRetry,
  shouldAbortSemanticRetryFromError,
  sleepMs
} from '../core/llm/semanticRetry';
import { setCachedPromptResponse } from '../core/llm/promptCache';
import type { LlmTokenUsage } from '../types';
import {
  LlmIssue,
  classifyLlmError,
  notifyLlmIssue,
  pickPrimaryLlmIssue
} from '../utils/llmUserNotice';
import { prepareLlmSession, type LlmSession } from '../utils/llmSession';
import { isIgnoredWorkspacePath, hasWorkspaceFolders } from '../utils/workspace';
import { setCachedCodeGraph } from '../utils/codeGraphCache';
import { saveRepoAnalysis, setLastAnalysisMode, setRepoAnalysisStatus } from '../utils/repoAnalysis';
import { getSelectedAnalysisFileUris } from '../utils/repoAnalysisSelection';
import { createGraphPanel, setGraphPanelState, setGraphPanelLlmStatus, updateGraphPanel } from '../ui/webview/graphPanel';
import { getLatestGitHistory } from '../utils/gitHistoryAnalysis';
import { planLocalLlmRun } from '../utils/localLlmCapacity';
import { normalizeMarkdownSource } from '../ui/webview/markdownLite';
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
  tokenUsage?: LlmTokenUsage;
};

async function enrichInsightsWithNarrative(
  _context: vscode.ExtensionContext,
  insights: ReturnType<typeof buildGraphInsights>,
  session: LlmSession
): Promise<EnrichOutcome> {
  const providerLabel = session.providerLabel;
  const task = getLanguage() === 'en' ? 'insights narrative' : 'narasi insights';
  const plan = semanticRetryPlanFor(session.provider);
  const basePrompt = buildGraphInsightsPrompt(insights, getLanguage());
  const baseTemp = getLlmTemperature();
  let tokenUsage: LlmTokenUsage | undefined;
  let lastIssue: LlmIssue | undefined;

  for (let attempt = 0; attempt < plan.maxAttempts; attempt++) {
    if (attempt > 0) {
      logSemanticRetry(task, attempt + 1, plan.maxAttempts, lastIssue?.detail || lastIssue?.kind || 'empty');
      await sleepMs(semanticRetryDelayMs(plan.baseDelayMs, attempt - 1));
    }

    const prompt = `${basePrompt}${semanticRetryPromptSuffix(attempt, getLanguage())}`;
    const provider = createLlmProvider(session.provider, session.apiKey, {
      model: session.model,
      temperature: semanticRetryTemperature(baseTemp, attempt),
      baseUrl: session.baseUrl
    });

    try {
      const completion = await runLoggedLlmCall(
        {
          task: attempt > 0 ? `${task} (retry ${attempt + 1}/${plan.maxAttempts})` : task,
          provider: providerLabel,
          model: session.model
        },
        () =>
          provider.complete(prompt, {
            skipCache: attempt > 0,
            cacheResponse: false
          }),
        withCompletionUsageSummary(summarizeNarrativeResult)
      );
      tokenUsage = addTokenUsage(
        tokenUsage,
        accumulateCompletionUsage(undefined, { ...completion, fromCache: false })
      );

      const payload = parseGraphInsightsLlmResponse(completion.text);
      if (!payload?.narrative?.trim() && !payload?.purpose?.trim()) {
        lastIssue = { kind: 'empty', providerLabel, detail: 'unparseable narrative' };
        continue;
      }
      const normalizedNarrative = normalizeMarkdownNarrative(
        payload.narrative || payload.purpose || ''
      );
      if (!normalizedNarrative) {
        lastIssue = { kind: 'empty', providerLabel, detail: 'empty after normalize' };
        continue;
      }

      setCachedPromptResponse(basePrompt, completion.text, {
        namespace: session.provider,
        usage: completion.usage
      });
      if (attempt > 0) {
        Logger.info(`LLM retry · ${task} · sukses pada percobaan ${attempt + 1}/${plan.maxAttempts}`);
      }
      return {
        insights: applyGraphInsightsLlmPayload(insights, {
          ...payload,
          narrative: normalizedNarrative
        }),
        tokenUsage
      };
    } catch (error) {
      lastIssue = {
        kind: classifyLlmError(error),
        providerLabel,
        detail: error instanceof Error ? error.message : String(error)
      };
      if (shouldAbortSemanticRetryFromError(error)) {
        break;
      }
    }
  }

  Logger.warn(`LLM hasil · ${task} · gagal setelah ${plan.maxAttempts} percobaan`);
  return {
    insights,
    issue: lastIssue ?? { kind: 'empty', providerLabel },
    tokenUsage
  };
}

async function enrichInsightsWithNodeSummaries(
  _context: vscode.ExtensionContext,
  graph: Parameters<typeof collectDiagramSummaryTargets>[0],
  insights: ReturnType<typeof buildGraphInsights>,
  session: LlmSession,
  options: { batchSize?: number } = {}
): Promise<EnrichOutcome> {
  const providerLabel = session.providerLabel;
  const targets = collectDiagramSummaryTargets(graph, insights);
  if (targets.length === 0) {
    Logger.info('LLM lewati · ringkas fungsi · tidak ada target node di diagram');
    return { insights };
  }

  const batchSize = Math.max(1, options.batchSize ?? targets.length);
  const batches: (typeof targets)[] = [];
  for (let i = 0; i < targets.length; i += batchSize) {
    batches.push(targets.slice(i, i + batchSize));
  }

  let mergedSummaries: Record<string, string> = { ...(insights.nodeSummaries ?? {}) };
  let mergedIcons: Record<string, string> = { ...(insights.nodeIcons ?? {}) };
  let tokenUsage: LlmTokenUsage | undefined;
  let lastIssue: LlmIssue | undefined;
  let filledBatches = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const task =
      batches.length > 1
        ? getLanguage() === 'en'
          ? `function summaries (${batch.length} nodes, batch ${batchIndex + 1}/${batches.length})`
          : `ringkas fungsi (${batch.length} node, batch ${batchIndex + 1}/${batches.length})`
        : getLanguage() === 'en'
          ? `function summaries (${batch.length} nodes)`
          : `ringkas fungsi (${batch.length} node)`;

    const plan = semanticRetryPlanFor(session.provider);
    const basePrompt = buildNodeSummariesPrompt(
      batch.map((item) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        filePath: item.filePath,
        role: item.role
      })),
      getLanguage()
    );
    const baseTemp = Math.min(getLlmTemperature(), 0.4);
    let batchOk = false;

    for (let attempt = 0; attempt < plan.maxAttempts; attempt++) {
      if (attempt > 0) {
        logSemanticRetry(
          task,
          attempt + 1,
          plan.maxAttempts,
          lastIssue?.detail || lastIssue?.kind || 'empty'
        );
        await sleepMs(semanticRetryDelayMs(plan.baseDelayMs, attempt - 1));
      }

      const prompt = `${basePrompt}${semanticRetryPromptSuffix(attempt, getLanguage())}`;
      const provider = createLlmProvider(session.provider, session.apiKey, {
        model: session.model,
        temperature: semanticRetryTemperature(baseTemp, attempt),
        baseUrl: session.baseUrl
      });

      try {
        let parsed = {
          summaries: {} as Record<string, string>,
          icons: {} as Record<string, string>
        };
        const completion = await runLoggedLlmCall(
          {
            task: attempt > 0 ? `${task} (retry ${attempt + 1}/${plan.maxAttempts})` : task,
            provider: providerLabel,
            model: session.model
          },
          async () => {
            const result = await provider.complete(prompt, {
              skipCache: attempt > 0,
              cacheResponse: false,
              // Thinking models (qwen3) harus OFF untuk JSON ketat — thinking menghabiskan
              // token dan sering menghasilkan key/JSON invalid.
              think: false
            });
            parsed = parseNodeSummariesResponse(result.text, batch);
            return result;
          },
          withCompletionUsageSummary(() =>
            summarizeNodeSummariesResult(parsed.summaries, batch.length)
          )
        );

        tokenUsage = addTokenUsage(
          tokenUsage,
          accumulateCompletionUsage(undefined, { ...completion, fromCache: false })
        );

        if (Object.keys(parsed.summaries).length === 0 && Object.keys(parsed.icons).length === 0) {
          lastIssue = {
            kind: 'empty',
            providerLabel,
            detail: `0/${batch.length} parsed · ${completion.text.trim().slice(0, 80) || '(empty)'}`
          };
          continue;
        }

        setCachedPromptResponse(basePrompt, completion.text, {
          namespace: session.provider,
          usage: completion.usage
        });
        mergedSummaries = { ...mergedSummaries, ...parsed.summaries };
        mergedIcons = { ...mergedIcons, ...parsed.icons };
        filledBatches += 1;
        batchOk = true;
        if (attempt > 0) {
          Logger.info(
            `LLM retry · ${task} · sukses pada percobaan ${attempt + 1}/${plan.maxAttempts}`
          );
        }
        break;
      } catch (error) {
        lastIssue = {
          kind: classifyLlmError(error),
          providerLabel,
          detail: error instanceof Error ? error.message : String(error)
        };
        if (shouldAbortSemanticRetryFromError(error) || shouldAbortSemanticRetry(lastIssue.kind)) {
          return {
            insights: {
              ...insights,
              nodeSummaries: mergedSummaries,
              nodeIcons: mergedIcons
            },
            issue: lastIssue,
            tokenUsage
          };
        }
      }
    }

    if (!batchOk) {
      Logger.warn(
        `LLM hasil · ${task} · gagal setelah ${plan.maxAttempts} percobaan · lanjut batch berikutnya`
      );
    }
  }

  if (filledBatches === 0) {
    Logger.warn(`LLM hasil · ringkas fungsi · gagal semua batch (${batches.length})`);
    return {
      insights,
      issue: lastIssue ?? { kind: 'empty', providerLabel },
      tokenUsage
    };
  }

  const summaryCount = Object.keys(mergedSummaries).length;
  return {
    insights: {
      ...insights,
      nodeSummaries: mergedSummaries,
      nodeIcons: mergedIcons
    },
    issue:
      filledBatches < batches.length
        ? {
            kind: 'partial',
            providerLabel,
            detail: `${filledBatches}/${batches.length} batch ok · ${summaryCount} summaries`
          }
        : undefined,
    tokenUsage
  };
}

function normalizeMarkdownNarrative(raw: string): string {
  return normalizeMarkdownSource(raw);
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
      message: loadingMessage,
      gitHistory: getLatestGitHistory(context) ?? null
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
          insights,
          gitHistory: getLatestGitHistory(context) ?? null,
          llmStatus: 'inspecting',
          llmMessage:
            getLanguage() === 'en'
              ? 'LLM inspecting codebase insights…'
              : 'LLM sedang memeriksa insights codebase…'
        });
        Logger.info('Diagram Mermaid ditampilkan');

        const prepared = await prepareLlmSession(context);
        if (!prepared.ok) {
          Logger.warn(`LLM lewati · preflight · ${prepared.issue.detail || prepared.issue.kind}`);
          await setGraphPanelLlmStatus(graphPanel, 'skipped', prepared.issue.detail);
          void notifyLlmIssue(prepared.issue);
        } else {
          progress.report({ message: t('analyze.progressLlm'), increment: 70 });
          const { session } = prepared;
          const providerLabel = session.providerLabel;
          const runPlan = await planLocalLlmRun(session.provider);
          Logger.info(
            `LLM kapasitas · ${runPlan.capacity.reason} · mode=${
              runPlan.sequential ? 'sequential' : 'parallel'
            }`
          );
          Logger.info(
            `LLM mulai · provider=${providerLabel} · model=${session.model} · ${
              runPlan.sequential ? '2 call sequential' : '2 call paralel'
            }`
          );
          await setGraphPanelLlmStatus(
            graphPanel,
            'inspecting',
            getLanguage() === 'en'
              ? 'LLM inspecting codebase insights…'
              : 'LLM sedang memeriksa insights codebase…'
          );
          try {
            let narrativeOutcome: EnrichOutcome;
            let summariesOutcome: EnrichOutcome;
            if (runPlan.sequential) {
              narrativeOutcome = await enrichInsightsWithNarrative(context, insights, session);
              // Pakai insights terbaru dari narasi supaya summaries selaras.
              const baseForSummaries = narrativeOutcome.insights;
              summariesOutcome = await enrichInsightsWithNodeSummaries(
                context,
                graph,
                baseForSummaries,
                session,
                { batchSize: runPlan.nodeSummaryBatchSize }
              );
            } else {
              [narrativeOutcome, summariesOutcome] = await Promise.all([
                enrichInsightsWithNarrative(context, insights, session),
                enrichInsightsWithNodeSummaries(context, graph, insights, session, {
                  batchSize: runPlan.nodeSummaryBatchSize
                })
              ]);
            }
            insights = {
              ...narrativeOutcome.insights,
              nodeSummaries: {
                ...(narrativeOutcome.insights.nodeSummaries ?? {}),
                ...(summariesOutcome.insights.nodeSummaries ?? {})
              },
              nodeIcons: {
                ...(narrativeOutcome.insights.nodeIcons ?? {}),
                ...(summariesOutcome.insights.nodeIcons ?? {})
              },
              tokenUsage: addTokenUsage(
                narrativeOutcome.tokenUsage,
                summariesOutcome.tokenUsage
              )
            };
            const enrichedAnalysis = {
              ...analysisResult,
              insights
            };
            await saveRepoAnalysis(context, enrichedAnalysis);
            const narrativeOk = Boolean(
              insights.narrative?.trim() || insights.panel?.purpose?.trim()
            );
            const summaryCount = Object.keys(insights.nodeSummaries ?? {}).length;
            const issues = [narrativeOutcome.issue, summariesOutcome.issue].filter(
              (item): item is LlmIssue => Boolean(item)
            );

            await updateGraphPanel(graphPanel, graph, {
              state: graph.nodes.length > 0 ? 'ready' : 'empty',
              insights,
              gitHistory: getLatestGitHistory(context) ?? null,
              llmStatus: narrativeOk ? 'ready' : 'error',
              llmMessage: narrativeOk
                ? undefined
                : getLanguage() === 'en'
                  ? 'LLM finished without Insights narrative.'
                  : 'LLM selesai tanpa narasi Insights.'
            });
            await vscode.commands.executeCommand('nevermin.refreshSidebar');

            if (narrativeOk && summaryCount > 0) {
              const usageLog = formatTokenUsageForLog(insights.tokenUsage);
              Logger.info(
                `LLM selesai · OK · narasi=${summarizeNarrativeResult(insights.narrative || '')} · summaries=${summaryCount}${
                  usageLog ? ` · ${usageLog}` : ''
                }`
              );
            } else if (narrativeOk || summaryCount > 0) {
              const usageLog = formatTokenUsageForLog(insights.tokenUsage);
              Logger.warn(
                `LLM selesai · SEBAGIAN · narasi=${narrativeOk ? 'ya' : 'tidak'} · summaries=${summaryCount}${
                  usageLog ? ` · ${usageLog}` : ''
                }`
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
            await setGraphPanelLlmStatus(
              graphPanel,
              'error',
              llmError instanceof Error ? llmError.message : String(llmError)
            );
            void notifyLlmIssue({
              kind: classifyLlmError(llmError),
              providerLabel,
              detail: llmError instanceof Error ? llmError.message : String(llmError)
            });
          }
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
