import * as vscode from 'vscode';
import path from 'path';
import { registerExplainCommand } from './commands/explainCode';
import { registerAnalyzeRepoCommand, registerAnalyzeSelectedFilesCommand } from './commands/analyzeRepo';
import { AnalysisFileItem, CodeExplorerProvider } from './ui/sidebar/treeDataProvider';
import { migrateLegacyApiKey, setApiKey, setProviderName } from './utils/config';
import { Logger } from './utils/logger';
import { getWorkspaceAnalysisFiles } from './utils/workspace';
import { getSelectedAnalysisFilePaths, setSelectedAnalysisFilePaths } from './utils/repoAnalysisSelection';
import { disposeExternalGraphServers } from './ui/webview/standaloneGraphHtml';
import { configureAstParser } from './core/parser/astParser';

// extension.ts sengaja "bodoh" - cuma nyambungin command ke logic di ./commands
// Semua business logic hidup di src/core, TIDAK boleh import 'vscode' di sana.
// Ini biar core/ bisa di-unit-test tanpa VS Code runtime.

export function activate(context: vscode.ExtensionContext): void {
  configureAstParser({ extensionPath: context.extensionPath });
  Logger.init(vscode.window.createOutputChannel('NeverMIN'));
  Logger.info('NeverMIN activated');
  Logger.info(`Tree-sitter WASM root: ${context.extensionPath}`);

  context.subscriptions.push(registerExplainCommand(context));
  context.subscriptions.push(registerAnalyzeRepoCommand(context));
  context.subscriptions.push(registerAnalyzeSelectedFilesCommand(context));

  const explorerProvider = new CodeExplorerProvider(context);
  const explorerView = vscode.window.createTreeView('nevermin.explorer', {
    treeDataProvider: explorerProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(explorerView);
  const refreshSelectionMessage = (): void => {
    const selectedCount = getSelectedAnalysisFilePaths(context).length;
    explorerView.message =
      selectedCount > 0
        ? `${selectedCount} file dicentang → buka "2. Jalankan" lalu pilih analisis file terpilih.`
        : 'Alur: cek Status → centang file → Jalankan analisis. Graph bisa dibuka di browser.';
  };

  refreshSelectionMessage();
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.refreshSidebar', () => {
      explorerProvider.refresh();
      refreshSelectionMessage();
    })
  );
  context.subscriptions.push(
    explorerView.onDidChangeCheckboxState(async (event) => {
      const selected = new Set(getSelectedAnalysisFilePaths(context));

      for (const [item, state] of event.items) {
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
        vscode.window.showWarningMessage('Workspace belum punya file yang bisa dicentang.');
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
    vscode.commands.registerCommand('nevermin.openInsightsNarrative', async (narrative?: string) => {
      if (!narrative || !narrative.trim()) {
        vscode.window.showWarningMessage('Belum ada ringkasan insights untuk ditampilkan.');
        return;
      }

      const doc = await vscode.workspace.openTextDocument({
        content: narrative.trim(),
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
      try {
        await vscode.commands.executeCommand('markdown.showPreviewToSide', doc.uri);
      } catch {
        // Preview command may be unavailable in some hosts; text document is enough.
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.openGraphInsight', async (ref?: {
      filePath?: string;
      startLine?: number;
      endLine?: number;
      name?: string;
    }) => {
      if (!ref?.filePath) {
        vscode.window.showWarningMessage('Insight tidak punya file path.');
        return;
      }

      try {
        const uri = path.isAbsolute(ref.filePath)
          ? vscode.Uri.file(ref.filePath)
          : vscode.Uri.file(path.resolve(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(), ref.filePath));
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document, { preview: true });
        const lineCount = Math.max(1, document.lineCount);
        const startLine = Math.max(0, Math.min(lineCount - 1, (ref.startLine ?? 1) - 1));
        const endLine = Math.max(startLine, Math.min(lineCount - 1, (ref.endLine ?? ref.startLine ?? 1) - 1));
        const start = new vscode.Position(startLine, 0);
        const end = new vscode.Position(endLine, document.lineAt(endLine).text.length);
        editor.selection = new vscode.Selection(start, end);
        editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
      } catch (error) {
        vscode.window.showErrorMessage(`Gagal membuka insight ${ref.name ?? ref.filePath}: ${error}`);
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        title: 'Simpan API Key NeverMIN',
        prompt: 'API key akan disimpan di SecretStorage VS Code dan settings.json hanya sebagai fallback.',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'Masukkan API key'
      });

      if (apiKey === undefined) {
        return;
      }

      await setApiKey(context, apiKey);
      explorerProvider.refresh();
      vscode.window.showInformationMessage('API key NeverMIN disimpan dengan aman di SecretStorage.');
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.useGemini', async () => {
      await setProviderName('gemini');
      explorerProvider.refresh();
      vscode.window.showInformationMessage('NeverMIN sekarang memakai Gemini.');
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.useDeepSeek', async () => {
      await setProviderName('deepseek');
      explorerProvider.refresh();
      vscode.window.showInformationMessage('NeverMIN sekarang memakai DeepSeek.');
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('nevermin.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'nevermin');
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('nevermin')) {
        explorerProvider.refresh();
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      explorerProvider.refresh();
    })
  );

  void migrateLegacyApiKey(context).catch((err) => {
    Logger.warn(`Migrasi API key lama gagal: ${err}`);
  });
}

export function deactivate(): void {
  disposeExternalGraphServers();
  Logger.info('NeverMIN deactivated');
}
