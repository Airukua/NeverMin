import * as vscode from 'vscode';
import { clearPromptCache } from '../core/llm/promptCache';
import { t } from '../i18n';
import { clearCachedCodeGraph } from '../utils/codeGraphCache';
import { clearGitHistory, getLatestGitHistory } from '../utils/gitHistoryAnalysis';
import { setGraphPanelGitHistory } from '../ui/webview/graphPanel';
import {
  clearRepoAnalysis,
  getLastAnalysisMode,
  getLatestRepoAnalysis
} from '../utils/repoAnalysis';
import { Logger } from '../utils/logger';
import { wipeNeverminWorkspaceData } from '../utils/wipeWorkspace';

export function registerClearRerunCommands(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand('nevermin.clearAnalysisResults', async () => {
      if (!getLatestRepoAnalysis(context)) {
        vscode.window.showInformationMessage(t('results.alreadyEmpty'));
        return;
      }
      clearPromptCache();
      await clearRepoAnalysis(context);
      await clearCachedCodeGraph(context);
      Logger.info('Hasil analisis dihapus · prompt cache dikosongkan');
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
      vscode.window.showInformationMessage(t('results.cleared'));
    }),

    vscode.commands.registerCommand('nevermin.rerunAnalysis', async () => {
      clearPromptCache();
      await clearRepoAnalysis(context);
      await clearCachedCodeGraph(context);
      Logger.info('Rerun analisis · hasil lama + prompt cache dibuang');
      await vscode.commands.executeCommand('nevermin.refreshSidebar');

      const mode = getLastAnalysisMode(context);
      if (mode === 'selected') {
        await vscode.commands.executeCommand('nevermin.analyzeSelectedFiles');
      } else {
        await vscode.commands.executeCommand('nevermin.analyzeRepo');
      }
    }),

    vscode.commands.registerCommand('nevermin.clearGitHistoryResults', async () => {
      if (!getLatestGitHistory(context)) {
        vscode.window.showInformationMessage(t('git.alreadyEmpty'));
        return;
      }
      clearPromptCache();
      await clearGitHistory(context);
      await setGraphPanelGitHistory(null, { gitLlmStatus: 'idle' });
      Logger.info('Hasil Git History dihapus · prompt cache dikosongkan');
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
      vscode.window.showInformationMessage(t('git.cleared'));
    }),

    vscode.commands.registerCommand('nevermin.rerunGitHistory', async () => {
      clearPromptCache();
      await clearGitHistory(context);
      await setGraphPanelGitHistory(null, { gitLlmStatus: 'idle' });
      Logger.info('Rerun Git History · hasil lama + prompt cache dibuang');
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
      await vscode.commands.executeCommand('nevermin.analyzeGitHistory');
    }),

    vscode.commands.registerCommand('nevermin.wipeWorkspaceData', async () => {
      const wipeData = t('wipe.choice.data');
      const wipeFull = t('wipe.choice.full');
      const picked = await vscode.window.showWarningMessage(
        t('wipe.confirm'),
        { modal: true, detail: t('wipe.confirmDetail') },
        wipeData,
        wipeFull
      );

      if (!picked) {
        return;
      }

      const resetPrivacyMode = picked === wipeFull;
      await wipeNeverminWorkspaceData(context, { resetPrivacyMode });
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
      vscode.window.showInformationMessage(
        resetPrivacyMode ? t('wipe.doneFull') : t('wipe.doneData')
      );
    })
  );
}
