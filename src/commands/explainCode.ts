import * as vscode from 'vscode';
import { buildContextFromFile } from '../core/context/contextBuilder';
import { buildExplainPrompt } from '../core/llm/promptBuilder';
import { createLlmProvider } from '../core/llm/llmClient';
import { getApiKey, getProviderName } from '../utils/config';
import { Logger } from '../utils/logger';

export function registerExplainCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('nevermin.explainSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Buka file dulu sebelum pakai NeverMIN.');
      return;
    }

    const selection = editor.selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(editor.selection);

    try {
      const chunks = await buildContextFromFile(editor.document.fileName, selection, selection);
      const provider = createLlmProvider(getProviderName(), await getApiKey(context));
      const prompt = buildExplainPrompt('Jelaskan kode ini dengan singkat.', chunks);
      const answer = await provider.complete(prompt);

      const doc = await vscode.workspace.openTextDocument({
        content: answer,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (err) {
      Logger.error(`explainSelection gagal: ${err}`);
      vscode.window.showErrorMessage(`NeverMIN gagal menjelaskan kode: ${err}`);
    }
  });
}
