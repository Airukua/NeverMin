import * as vscode from 'vscode';
import { buildFileFlowView } from '../core/graph/repoMermaid';
import { t } from '../i18n';
import { getCachedCodeGraph } from '../utils/codeGraphCache';
import { Logger } from '../utils/logger';
import { setGraphPanelNodeFlow } from '../ui/webview/graphPanel';

export interface NodeFlowTarget {
  id?: string;
  name?: string;
  filePath?: string;
  kind?: string;
}

export function registerOpenNodeFlowCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand(
    'nevermin.openNodeFlow',
    async (target?: NodeFlowTarget) => {
      const filePath = typeof target?.filePath === 'string' ? target.filePath.trim() : '';
      if (!filePath) {
        vscode.window.showWarningMessage(t('msg.insightNoPath'));
        return;
      }

      const graph = getCachedCodeGraph(context);
      if (!graph || graph.nodes.length === 0) {
        vscode.window.showWarningMessage(t('analyze.emptyGraph'));
        return;
      }

      try {
        const focusId = typeof target?.id === 'string' ? target.id : undefined;
        const model = buildFileFlowView(graph, filePath, { focusId });
        if (!model.nodes.length) {
          vscode.window.showWarningMessage(
            t('graph.functions.noneInFile', {
              file: filePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
            })
          );
          return;
        }

        const name = target?.name?.trim() || filePath.replace(/\\/g, '/').split('/').pop() || 'node';
        const ok = await setGraphPanelNodeFlow({
          title: name,
          filePath,
          model
        });
        if (!ok) {
          vscode.window.showWarningMessage(t('graph.panelMissing'));
        }
      } catch (error) {
        Logger.error(`openNodeFlow gagal: ${error}`);
        vscode.window.showErrorMessage(
          t('msg.insightOpenFail', {
            name: target?.name || filePath,
            error: error instanceof Error ? error.message : String(error)
          })
        );
      }
    }
  );
}
