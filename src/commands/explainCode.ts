import * as vscode from 'vscode';
import { buildContextFromFile } from '../core/context/contextBuilder';
import { buildExplainPrompt } from '../core/llm/promptBuilder';
import { createLlmProvider } from '../core/llm/llmClient';
import {
  getApiKey,
  getLanguage,
  getLlmModel,
  getLlmTemperature,
  getOllamaBaseUrl,
  getProviderLabel,
  getProviderName,
  hasApiKey
} from '../utils/config';
import { Logger } from '../utils/logger';
import { showDocumentInActiveColumn } from '../utils/editorLayout';
import { runLoggedLlmCall, summarizeExplainResult } from '../utils/llmActivity';
import { classifyLlmError, notifyLlmIssue } from '../utils/llmUserNotice';
import { t } from '../i18n';

export function registerExplainCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('nevermin.explainSelection', async () => {
    const { ensurePrivacyModeChosen } = await import('../utils/privacyGuards');
    if (!(await ensurePrivacyModeChosen(context))) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(t('explain.noEditor'));
      return;
    }

    const selection = editor.selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(editor.selection);

    if (!selection.trim()) {
      vscode.window.showWarningMessage(t('explain.noSelection'));
      return;
    }

    if (!(await hasApiKey(context))) {
      Logger.warn(`LLM lewati · explain · API key belum ada untuk ${getProviderLabel()}`);
      vscode.window.showWarningMessage(t('msg.apiKeyMissing', { label: getProviderLabel() }));
      return;
    }

    try {
      const answer = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('explain.progress'),
          cancellable: true
        },
        async (progress, token) => {
          progress.report({ message: t('explain.progress') });
          if (token.isCancellationRequested) {
            return null;
          }

          const chunks = await buildContextFromFile(
            editor.document.fileName,
            editor.document.getText(),
            selection
          );
          if (token.isCancellationRequested) {
            return null;
          }

          const providerName = getProviderName();
          const model = getLlmModel() || undefined;
          const provider = createLlmProvider(providerName, await getApiKey(context), {
            model,
            temperature: getLlmTemperature(),
            baseUrl: providerName === 'ollama' ? getOllamaBaseUrl() : undefined
          });
          const prompt = buildExplainPrompt(t('explain.question'), chunks, getLanguage());
          return runLoggedLlmCall(
            {
              task: 'explain selection',
              provider: getProviderLabel(providerName),
              model
            },
            () => provider.complete(prompt),
            summarizeExplainResult
          );
        }
      );

      if (answer === null) {
        vscode.window.showInformationMessage(t('analyze.cancelled'));
        return;
      }

      const doc = await vscode.workspace.openTextDocument({
        content: answer,
        language: 'markdown'
      });
      await showDocumentInActiveColumn(doc, { preview: true });
      vscode.window.showInformationMessage(t('explain.done'));
    } catch (err) {
      Logger.error(`explainSelection gagal: ${err}`);
      const message = err instanceof Error ? err.message : String(err);
      const kind = classifyLlmError(err);
      if (kind === 'quota' || kind === 'auth') {
        void notifyLlmIssue({
          kind,
          providerLabel: getProviderLabel(),
          detail: message
        });
      } else {
        vscode.window.showErrorMessage(t('explain.failed', { error: message }));
      }
    }
  });
}
