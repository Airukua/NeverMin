import * as vscode from 'vscode';
import { getCachedCodeGraph } from '../utils/codeGraphCache';
import { getLatestRepoAnalysis } from '../utils/repoAnalysis';
import { getLatestGitHistory } from '../utils/gitHistoryAnalysis';
import { t } from '../i18n';
import { createGraphPanel, updateGraphPanel } from '../ui/webview/graphPanel';
import { preferredViewColumn } from '../utils/editorLayout';

export async function openFileFunctionGraph(
  context: vscode.ExtensionContext,
  args: { filePath: string; nodeId?: string; name?: string }
): Promise<void> {
  const graph = getCachedCodeGraph(context);
  if (!graph || graph.nodes.length === 0) {
    vscode.window.showWarningMessage(t('structure.needAnalyze'));
    return;
  }

  const insights = getLatestRepoAnalysis(context)?.insights;
  const fileLabel = args.filePath.replace(/\\/g, '/').split('/').pop() || args.filePath;
  const message =
    args.name != null
      ? t('structure.focusSymbol', { name: args.name })
      : t('structure.focusFile', { file: fileLabel });

  const panel = createGraphPanel(context.extensionUri, graph, undefined, {
    state: 'ready',
    insights,
    gitHistory: getLatestGitHistory(context) ?? null,
    view: 'functions',
    functionFilePath: args.filePath,
    focusNodeId: args.nodeId,
    message
  });

  await updateGraphPanel(panel, graph, {
    state: 'ready',
    insights,
    gitHistory: getLatestGitHistory(context) ?? null,
    view: 'functions',
    functionFilePath: args.filePath,
    focusNodeId: args.nodeId,
    message
  });

  panel.reveal(panel.viewColumn ?? preferredViewColumn(), false);
}

export function registerStructureCommands(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand(
    'nevermin.openFileFunctionGraph',
    async (args?: { filePath?: string; nodeId?: string; name?: string }) => {
      if (!args?.filePath) {
        vscode.window.showWarningMessage(t('msg.insightNoPath'));
        return;
      }
      await openFileFunctionGraph(context, {
        filePath: args.filePath,
        nodeId: args.nodeId,
        name: args.name
      });
    }
  );
}
