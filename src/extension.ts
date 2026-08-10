import * as vscode from 'vscode';
import path from 'path';
import { registerExplainCommand, registerExplainNodeCommand } from './commands/explainCode';
import { registerExplainContributionGapCommand } from './commands/explainContributionGap';
import { registerOpenNodeFlowCommand } from './commands/openNodeFlow';
import { registerAnalyzeRepoCommand, registerAnalyzeSelectedFilesCommand } from './commands/analyzeRepo';
import {
  registerAnalyzeGitHistoryCommand,
  registerOpenGitFileCommand,
  registerOpenGitHistoryNarrativeCommand
} from './commands/analyzeGitHistory';
import { registerSelectOllamaModelCommand, pickAndSetOllamaModel } from './commands/selectOllamaModel';
import { registerPrivacyModeCommands } from './commands/privacyMode';
import { registerClearRerunCommands } from './commands/clearRerun';
import { registerStructureCommands } from './commands/openStructureGraph';
import { AnalysisFileItem, CodeExplorerProvider, FolderItem } from './ui/sidebar/treeDataProvider';
import {
  enforceOllamaNoApiKeys,
  getLanguage,
  getLanguageLabel,
  getProviderLabel,
  getProviderName,
  isWritingProviderSetting,
  listProviders,
  migrateLegacyApiKey,
  setApiKey,
  setLanguage,
  setProviderName
} from './utils/config';
import { ensurePrivacyModeChosen } from './utils/privacyGuards';
import { hasChosenPrivacyMode, isPrivateCodebase } from './utils/privacyMode';
import { ensureCloudProviderForPublic } from './utils/pickCloudProvider';
import { ensureCloudAllowedOrOfferPublic } from './utils/privacyUnlock';
import { ProviderName } from './types';
import { Logger } from './utils/logger';
import { clearActivity, onActivityChange } from './utils/activityLog';
import { getWorkspaceAnalysisFiles } from './utils/workspace';
import {
  clearSelectedAnalysisFilePaths,
  getSelectedAnalysisFilePaths,
  setSelectedAnalysisFilePaths
} from './utils/repoAnalysisSelection';
import { disposeExternalGraphServers } from './ui/webview/standaloneGraphHtml';
import { createGraphPanel, setGraphPanelView, updateGraphPanel } from './ui/webview/graphPanel';
import { openLearningMindMap } from './ui/webview/mindMapPanel';
import { configureAstParser } from './core/parser/astParser';
import { GraphInsights } from './core/graph/graphInsights';
import { NEVERMIN_LANGUAGES, languageDisplayName, t } from './i18n';
import { showDocumentInActiveColumn, preferredViewColumn } from './utils/editorLayout';
import { getCachedCodeGraph } from './utils/codeGraphCache';
import { getLatestRepoAnalysis } from './utils/repoAnalysis';
import { getLatestGitHistory } from './utils/gitHistoryAnalysis';

// extension.ts sengaja "bodoh" - cuma nyambungin command ke logic di ./commands
// Semua business logic hidup di src/core, TIDAK boleh import 'vscode' di sana.

export function activate(context: vscode.ExtensionContext): { context: vscode.ExtensionContext } {
  configureAstParser({ extensionPath: context.extensionPath });
  Logger.init(vscode.window.createOutputChannel('NeverMIN'));
  Logger.info('NeverMIN activated');
  Logger.info(`Tree-sitter WASM root: ${context.extensionPath}`);

  context.subscriptions.push(registerExplainCommand(context));
  context.subscriptions.push(registerExplainNodeCommand(context));
  context.subscriptions.push(registerExplainContributionGapCommand(context));
  context.subscriptions.push(registerOpenNodeFlowCommand(context));
  context.subscriptions.push(registerAnalyzeRepoCommand(context));
  context.subscriptions.push(registerAnalyzeSelectedFilesCommand(context));
  context.subscriptions.push(registerAnalyzeGitHistoryCommand(context));
  context.subscriptions.push(registerOpenGitHistoryNarrativeCommand(context));
  context.subscriptions.push(registerOpenGitFileCommand());
  context.subscriptions.push(registerSelectOllamaModelCommand(context));
  context.subscriptions.push(registerPrivacyModeCommands(context));
  context.subscriptions.push(registerClearRerunCommands(context));
  context.subscriptions.push(registerStructureCommands(context));

  const explorerProvider = new CodeExplorerProvider(context);
  const explorerView = vscode.window.createTreeView('nevermin.explorer', {
    treeDataProvider: explorerProvider,
    showCollapseAll: true,
    manageCheckboxStateManually: true
  });
  context.subscriptions.push(explorerView);

  const refreshSelectionMessage = (): void => {
    if (!hasChosenPrivacyMode(context)) {
      explorerView.message = t('privacy.gate.banner');
      return;
    }
    const selectedCount = getSelectedAnalysisFilePaths(context).length;
    explorerView.message =
      selectedCount > 0
        ? t('sidebar.selection.count', { count: selectedCount })
        : isPrivateCodebase(context)
          ? t('privacy.mode.privateBanner')
          : undefined;
  };

  refreshSelectionMessage();
  context.subscriptions.push(onActivityChange(() => explorerProvider.refresh()));

  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.refreshSidebar', () => {
      explorerProvider.refresh();
      refreshSelectionMessage();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.openOutputLogs', () => {
      Logger.show();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.clearActivityLogs', () => {
      clearActivity();
      explorerProvider.refresh();
      vscode.window.showInformationMessage(t('msg.logsCleared'));
    })
  );

  context.subscriptions.push(
    explorerView.onDidChangeCheckboxState(async (event) => {
      const selected = new Set(getSelectedAnalysisFilePaths(context));
      for (const [item, state] of event.items) {
        if (item instanceof FolderItem) {
          for (const uri of item.files) {
            const normalized = uri.fsPath.replace(/\\/g, '/');
            if (state === vscode.TreeItemCheckboxState.Checked) {
              selected.add(normalized);
            } else {
              selected.delete(normalized);
            }
          }
          continue;
        }

        if (!(item instanceof AnalysisFileItem)) {
          continue;
        }
        if (state === vscode.TreeItemCheckboxState.Checked) {
          selected.add(item.filePath.replace(/\\/g, '/'));
        } else {
          selected.delete(item.filePath.replace(/\\/g, '/'));
        }
      }
      await setSelectedAnalysisFilePaths(context, [...selected]);
      explorerProvider.refresh();
      refreshSelectionMessage();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.selectAllAnalysisFiles', async () => {
      const files = await getWorkspaceAnalysisFiles(200);
      if (files.length === 0) {
        vscode.window.showWarningMessage(t('msg.noFilesToCheck'));
        return;
      }
      await setSelectedAnalysisFilePaths(
        context,
        files.map((uri) => uri.fsPath.replace(/\\/g, '/'))
      );
      explorerProvider.refresh();
      refreshSelectionMessage();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.clearAnalysisSelection', async () => {
      await clearSelectedAnalysisFilePaths(context);
      explorerProvider.refresh();
      refreshSelectionMessage();
      vscode.window.showInformationMessage(t('msg.selectionCleared'));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.openInsightsNarrative', async (narrative?: string) => {
      if (!narrative || !narrative.trim()) {
        vscode.window.showWarningMessage(t('msg.noInsights'));
        return;
      }
      const doc = await vscode.workspace.openTextDocument({
        content: narrative.trim(),
        language: 'markdown'
      });
      await showDocumentInActiveColumn(doc, { preview: true });
      try {
        await vscode.commands.executeCommand('markdown.showPreview', doc.uri);
      } catch {
        // Preview optional
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.openMainFlowDiagram', async () => {
      const switched = await setGraphPanelView('flow');
      if (switched) {
        return;
      }

      const graph = getCachedCodeGraph(context);
      if (!graph || graph.nodes.length === 0) {
        vscode.window.showWarningMessage(t('msg.noMainFlow'));
        return;
      }

      const insights = getLatestRepoAnalysis(context)?.insights;
      const gitHistory = getLatestGitHistory(context) ?? null;
      const panel = createGraphPanel(context.extensionUri, graph, undefined, {
        state: 'ready',
        insights,
        gitHistory,
        view: 'flow'
      });
      await updateGraphPanel(panel, graph, {
        state: 'ready',
        insights,
        gitHistory,
        view: 'flow'
      });
      panel.reveal(panel.viewColumn ?? preferredViewColumn(), false);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.openLearningMindMap', (insights?: GraphInsights) => {
      if (!insights || (!insights.entryPoints?.length && !insights.hubs?.length && !insights.mainFlow)) {
        vscode.window.showWarningMessage(t('msg.noMindMap'));
        return;
      }
      openLearningMindMap(context.extensionUri, insights, { context });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'nevermin.openGraphInsight',
      async (ref?: {
        filePath?: string;
        startLine?: number;
        endLine?: number;
        name?: string;
      }) => {
        if (!ref?.filePath) {
          vscode.window.showWarningMessage(t('msg.insightNoPath'));
          return;
        }
        try {
          const uri = path.isAbsolute(ref.filePath)
            ? vscode.Uri.file(ref.filePath)
            : vscode.Uri.file(
                path.resolve(
                  vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
                  ref.filePath
                )
              );
          const document = await vscode.workspace.openTextDocument(uri);
          const editor = await showDocumentInActiveColumn(document, { preview: true });
          const lineCount = Math.max(1, document.lineCount);
          const startLine = Math.max(0, Math.min(lineCount - 1, (ref.startLine ?? 1) - 1));
          const endLine = Math.max(
            startLine,
            Math.min(lineCount - 1, (ref.endLine ?? ref.startLine ?? 1) - 1)
          );
          const start = new vscode.Position(startLine, 0);
          const end = new vscode.Position(endLine, document.lineAt(endLine).text.length);
          editor.selection = new vscode.Selection(start, end);
          editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
        } catch (error) {
          vscode.window.showErrorMessage(
            t('msg.insightOpenFail', {
              name: ref.name ?? ref.filePath,
              error: String(error)
            })
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.setApiKey', async () => {
      if (!(await ensurePrivacyModeChosen(context))) {
        return;
      }
      if (!(await ensureCloudAllowedOrOfferPublic(context))) {
        vscode.window.showWarningMessage(t('privacy.cloudBlocked'));
        return;
      }

      let provider = getProviderName();
      if (provider === 'ollama') {
        const switched = await ensureCloudProviderForPublic(context, { forcePick: true });
        if (!switched) {
          vscode.window.showWarningMessage(t('privacy.public.needCloudFirst'));
          return;
        }
        provider = switched;
      }

      const label = getProviderLabel(provider);
      const apiKey = await vscode.window.showInputBox({
        title: t('msg.saveApiKeyTitle', { label }),
        prompt:
          getLanguage() === 'en'
            ? `Key is stored in SecretStorage for ${label}. settings.json is only a temporary fallback.`
            : `Key disimpan di SecretStorage untuk provider ${label}. Settings.json hanya fallback sementara.`,
        password: true,
        ignoreFocusOut: true,
        placeHolder: `API key ${label}`
      });

      if (apiKey === undefined) {
        return;
      }

      try {
        await setApiKey(context, apiKey, provider);
        explorerProvider.refresh();
        vscode.window.showInformationMessage(t('msg.apiKeySaved', { label }));
      } catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.selectLanguage', async () => {
      const active = getLanguage();
      const picked = await vscode.window.showQuickPick(
        NEVERMIN_LANGUAGES.map((id) => ({
          label: languageDisplayName(id),
          description: id === active ? t('lang.active') : id,
          language: id
        })),
        {
          title: t('lang.pickTitle'),
          ignoreFocusOut: true
        }
      );
      if (!picked) {
        return;
      }
      await setLanguage(picked.language);
      explorerProvider.refresh();
      refreshSelectionMessage();
      const { pushGraphPanelI18n } = await import('./ui/webview/graphPanel');
      await pushGraphPanelI18n();
      vscode.window.showInformationMessage(t('lang.changed', { name: getLanguageLabel(picked.language) }));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.selectProvider', async () => {
      if (!(await ensurePrivacyModeChosen(context))) {
        return;
      }

      // Private → hanya Ollama. Tawarkan ganti Public; jangan force-pick model Ollama.
      if (isPrivateCodebase(context)) {
        const unlocked = await ensureCloudAllowedOrOfferPublic(context);
        if (!unlocked) {
          vscode.window.showWarningMessage(t('privacy.providerLocked'));
          explorerProvider.refresh();
          refreshSelectionMessage();
          return;
        }
      }

      const active = getProviderName();
      const privacyPublic = !isPrivateCodebase(context);
      const picked = await vscode.window.showQuickPick(
        listProviders().map((entry) => ({
          label: entry.label,
          description: entry.id === active ? t('lang.active') : entry.id,
          detail: entry.description,
          provider: entry.id as ProviderName
        })),
        {
          title: t('msg.pickProvider'),
          placeHolder: privacyPublic
            ? 'Gemini, OpenAI, Anthropic, OpenRouter, Ollama, …'
            : 'Ollama (Private)',
          ignoreFocusOut: true
        }
      );

      if (!picked) {
        return;
      }

      // Guard: Private tidak boleh cloud
      if (isPrivateCodebase(context) && picked.provider !== 'ollama') {
        vscode.window.showWarningMessage(t('privacy.cloudBlocked'));
        return;
      }

      await setProviderName(picked.provider);
      Logger.info(
        `Provider dipilih · ${picked.provider} · privacy=${isPrivateCodebase(context) ? 'private' : 'public'}`
      );

      if (picked.provider === 'ollama') {
        // Private: hapus cloud keys. Public: jangan hapus — user mungkin balik ke Gemini.
        if (isPrivateCodebase(context)) {
          const removed = await enforceOllamaNoApiKeys(context);
          Logger.info(`Ollama aktif (Private) · API key cloud dihapus (${removed})`);
          vscode.window.showInformationMessage(
            t('ollama.keysCleared', { label: picked.label, count: removed })
          );
        } else {
          Logger.info('Ollama aktif (Public) · API key cloud tetap disimpan');
        }
        const model = await pickAndSetOllamaModel(context, { switchProvider: false });
        if (!model) {
          vscode.window.showWarningMessage(t('ollama.pickRequired'));
        }
        explorerProvider.refresh();
        refreshSelectionMessage();
        return;
      }

      explorerProvider.refresh();
      refreshSelectionMessage();
      vscode.window.showInformationMessage(t('msg.providerSet', { label: picked.label }));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.useGemini', async () => {
      if (!(await ensurePrivacyModeChosen(context))) {
        return;
      }
      if (!(await ensureCloudAllowedOrOfferPublic(context))) {
        return;
      }
      await setProviderName('gemini');
      explorerProvider.refresh();
      vscode.window.showInformationMessage(t('msg.usingGemini'));
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.useDeepSeek', async () => {
      if (!(await ensurePrivacyModeChosen(context))) {
        return;
      }
      if (!(await ensureCloudAllowedOrOfferPublic(context))) {
        return;
      }
      await setProviderName('deepseek');
      explorerProvider.refresh();
      vscode.window.showInformationMessage(t('msg.usingDeepSeek'));
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'nevermin');
    })
  );

  /** Private → kunci Ollama. Public → jangan sentuh provider sama sekali. */
  let applyingProviderPolicy = false;
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!event.affectsConfiguration('nevermin.provider')) {
        if (event.affectsConfiguration('nevermin')) {
          explorerProvider.refresh();
          refreshSelectionMessage();
        }
        return;
      }

      if (applyingProviderPolicy || isWritingProviderSetting()) {
        return;
      }

      // PUBLIC / unset: biarkan apa pun yang user pilih (Gemini, OpenAI, …).
      if (!isPrivateCodebase(context)) {
        explorerProvider.refresh();
        refreshSelectionMessage();
        return;
      }

      // PRIVATE: hanya Ollama yang boleh.
      if (getProviderName() !== 'ollama') {
        applyingProviderPolicy = true;
        try {
          await setProviderName('ollama');
          await enforceOllamaNoApiKeys(context);
          vscode.window.showWarningMessage(t('privacy.cloudBlocked'));
        } finally {
          setTimeout(() => {
            applyingProviderPolicy = false;
          }, 750);
        }
      }
      explorerProvider.refresh();
      refreshSelectionMessage();
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      explorerProvider.refresh();
    })
  );

  void migrateLegacyApiKey(context)
    .then((changed) => {
      if (changed && getProviderName() === 'ollama') {
        Logger.info('Ollama aktif saat start · API key cloud dibersihkan');
      }
    })
    .catch((err) => {
      Logger.warn(`Migrasi API key lama gagal: ${err}`);
    });

  return { context };
}

export function deactivate(): void {
  disposeExternalGraphServers();
  Logger.info('NeverMIN deactivated');
}
