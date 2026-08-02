import * as vscode from 'vscode';
import path from 'path';
import { buildRepoGraph } from '../core/graph/graphBuilder';
import { buildGraphInsights } from '../core/graph/graphInsights';
import { analyzeRepoFiles, RepoFileSnapshot } from '../core/analysis/repoAnalyzer';
import { buildGraphInsightsPrompt } from '../core/llm/promptBuilder';
import { createLlmProvider } from '../core/llm/llmClient';
import { Logger } from '../utils/logger';
import { getApiKey, getProviderName, hasApiKey } from '../utils/config';
import { isIgnoredWorkspacePath, hasWorkspaceFolders } from '../utils/workspace';
import { saveRepoAnalysis, setRepoAnalysisStatus } from '../utils/repoAnalysis';
import { getSelectedAnalysisFileUris } from '../utils/repoAnalysisSelection';
import { createGraphPanel, setGraphPanelState, updateGraphPanel } from '../ui/webview/graphPanel';

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

async function enrichInsightsWithNarrative(
  context: vscode.ExtensionContext,
  insights: ReturnType<typeof buildGraphInsights>
): Promise<ReturnType<typeof buildGraphInsights>> {
  if (!(await hasApiKey(context))) {
    return insights;
  }

  try {
    const provider = createLlmProvider(getProviderName(), await getApiKey(context));
    const narrative = await provider.complete(buildGraphInsightsPrompt(insights));
    return {
      ...insights,
      narrative: normalizeMarkdownNarrative(narrative)
    };
  } catch (error) {
    Logger.warn(`Gagal membuat narasi insights LLM: ${error}`);
    return insights;
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
  summaryPhrase: string
): Promise<void> {
  await setRepoAnalysisStatus(context, 'loading');
  await vscode.commands.executeCommand('nevermin.refreshSidebar');

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
    const snapshots = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'NeverMIN: menganalisis file',
        cancellable: true
      },
      async (progress, token) => {
        progress.report({ message: 'Mengumpulkan file terpilih', increment: 0 });
        const result = await readSnapshots(files, token);
        progress.report({ message: `File terkumpul: ${result.length}`, increment: 35 });
        return result;
      }
    );

    if (snapshots.length === 0) {
      await setRepoAnalysisStatus(context, 'idle');
      await setGraphPanelState(graphPanel, 'empty', 'Tidak ada file valid untuk dianalisis.');
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
      vscode.window.showWarningMessage('Tidak ada file valid yang bisa dianalisis.');
      return;
    }

    const analysis = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'NeverMIN: menyusun ringkasan',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: `Menganalisis ${snapshots.length} file`, increment: 0 });
        const [analysisResult, graph] = await Promise.all([
          analyzeRepoFiles(snapshots),
          buildRepoGraph(
            snapshots.map((snapshot) => ({
              path: snapshot.filePath,
              content: snapshot.content
            }))
          )
        ]);

        progress.report({ message: 'Menyusun insights dari graph', increment: 40 });
        let insights = buildGraphInsights(graph);
        insights = await enrichInsightsWithNarrative(context, insights);

        const enrichedAnalysis = {
          ...analysisResult,
          insights
        };

        progress.report({ message: 'Mengirim hasil ke sidebar dan graph', increment: 60 });
        await saveRepoAnalysis(context, enrichedAnalysis);
        await updateGraphPanel(graphPanel, graph, {
          state: graph.nodes.length > 0 ? 'ready' : 'empty',
          message:
            graph.nodes.length > 0
              ? undefined
              : 'Graph kosong karena file yang dipilih belum punya symbol yang bisa divisualkan.',
          insights
        });

        return enrichedAnalysis;
      }
    );

    await setRepoAnalysisStatus(context, 'ready');
    await vscode.commands.executeCommand('nevermin.refreshSidebar');

    vscode.window.showInformationMessage(
      `NeverMIN menganalisis ${analysis.fileCount} file ${summaryPhrase} dan menemukan ${analysis.symbolCount} symbol. Lihat Insights di sidebar dan graph.`
    );
  } catch (error) {
    await setRepoAnalysisStatus(context, 'error');
    await setGraphPanelState(
      graphPanel,
      'error',
      error instanceof Error ? error.message : 'Analisis repo gagal dijalankan.'
    );
    await vscode.commands.executeCommand('nevermin.refreshSidebar');
    Logger.error(`analyzeRepo gagal: ${error}`);
    vscode.window.showErrorMessage(`NeverMIN gagal menganalisis repo: ${error}`);
  }
}

export function registerAnalyzeRepoCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('nevermin.analyzeRepo', async () => {
    if (!hasWorkspaceFolders()) {
      vscode.window.showWarningMessage('Buka folder project dulu sebelum menjalankan NeverMIN.');
      return;
    }

    const files = await vscode.workspace.findFiles(
      '**/*.{ts,tsx,js,jsx,mjs,cjs,py,go,java,kt,kts,rs,rb,php,sh,c,cc,cpp,h,hpp,cs,swift,md,json,yml,yaml,toml,txt}',
      '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.vscode-test/**,**/build/**,**/coverage/**,**/vendor/**,**/lib/**,**/libs/**,**/.next/**,**/.nuxt/**,**/.svelte-kit/**,**/.cache/**,**/.turbo/**,**/tmp/**,**/temp/**}'
    );

    if (files.length === 0) {
      vscode.window.showWarningMessage('Workspace ini belum berisi file yang bisa dianalisis.');
      return;
    }

    Logger.info(`analyzeRepo dipanggil untuk ${files.length} file`);
    await runAnalysisWorkflow(context, files, 'Membaca workspace dan menyiapkan graph analisis...', 'di workspace ini');
  });
}

export function registerAnalyzeSelectedFilesCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('nevermin.analyzeSelectedFiles', async () => {
    if (!hasWorkspaceFolders()) {
      vscode.window.showWarningMessage('Buka folder project dulu sebelum memilih file di sidebar.');
      return;
    }

    const files = getSelectedAnalysisFileUris(context).filter((uri) => !isIgnoredWorkspacePath(uri.fsPath));
    if (files.length === 0) {
      vscode.window.showWarningMessage('Centang file yang mau dianalisis di sidebar dulu.');
      return;
    }

    Logger.info(`analyzeSelectedFiles dipanggil untuk ${files.length} file`);
    await runAnalysisWorkflow(context, files, 'Membaca file terpilih dan menyiapkan graph analisis...', 'dari file terpilih');
  });
}
