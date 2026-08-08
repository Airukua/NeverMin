import * as vscode from 'vscode';
import { createLlmProvider } from '../core/llm/llmClient';
import { buildExplainPrompt } from '../core/llm/promptBuilder';
import { buildScopedExplainPrompt, type ExplainGraphView } from '../core/llm/explainNodeContext';
import { buildContextFromFile } from '../core/context/contextBuilder';
import { getLanguage, getLlmTemperature } from '../utils/config';
import { Logger } from '../utils/logger';
import { showDocumentInActiveColumn } from '../utils/editorLayout';
import { runLoggedLlmCall, summarizeExplainResult, withCompletionUsageSummary } from '../utils/llmActivity';
import { classifyLlmError, notifyLlmIssue } from '../utils/llmUserNotice';
import { prepareLlmSession } from '../utils/llmSession';
import { t } from '../i18n';
import { setGraphPanelNodeExplain } from '../ui/webview/graphPanel';
import { getCachedCodeGraph } from '../utils/codeGraphCache';

export interface ExplainNodeTarget {
  id?: string;
  filePath?: string;
  name?: string;
  kind?: string;
  startLine?: number;
  endLine?: number;
  expandKey?: string;
  view?: ExplainGraphView | string;
}

async function runPromptCompletion(
  context: vscode.ExtensionContext,
  prompt: string,
  taskLabel: string,
  options: {
    showProgressNotification?: boolean;
    onProgressMessage?: (message: string) => void;
  } = {}
): Promise<{ text: string; thinking?: string } | { cancelled: true } | { error: string; providerLabel: string }> {
  const prepared = await prepareLlmSession(context);
  if (!prepared.ok) {
    void notifyLlmIssue(prepared.issue);
    return {
      error: prepared.issue.detail || prepared.issue.kind,
      providerLabel: prepared.issue.providerLabel || 'LLM'
    };
  }
  const providerLabel = prepared.session.providerLabel;
  const showNotification = options.showProgressNotification !== false;

  try {
    const run = async (
      progress: { report: (value: { message?: string }) => void },
      token: vscode.CancellationToken
    ): Promise<{ text: string; thinking?: string } | null> => {
      const progressMsg = t('explain.progress');
      progress.report({ message: progressMsg });
      options.onProgressMessage?.(progressMsg);
      if (token.isCancellationRequested) {
        return null;
      }

      const { session } = prepared;
      const provider = createLlmProvider(session.provider, session.apiKey, {
        model: session.model,
        temperature: getLlmTemperature(),
        baseUrl: session.baseUrl
      });
      const completion = await runLoggedLlmCall(
        {
          task: taskLabel,
          provider: session.providerLabel,
          model: session.model
        },
        () =>
          provider.complete(prompt, {
            // Tampilkan reasoning Qwen3/Ollama di modal Explain.
            think: session.provider === 'ollama' ? true : undefined
          }),
        withCompletionUsageSummary(summarizeExplainResult)
      );
      return { text: completion.text, thinking: completion.thinking };
    };

    const answer = showNotification
      ? await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: t('explain.progress'),
            cancellable: true
          },
          run
        )
      : await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Window,
            title: t('explain.progress'),
            cancellable: true
          },
          run
        );

    if (answer === null) {
      return { cancelled: true };
    }
    return answer;
  } catch (err) {
    Logger.error(`explain gagal: ${err}`);
    const message = err instanceof Error ? err.message : String(err);
    void notifyLlmIssue({
      kind: classifyLlmError(err),
      providerLabel,
      detail: message
    });
    return { error: message, providerLabel };
  }
}

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

    const chunks = await buildContextFromFile(
      editor.document.fileName,
      editor.document.getText(),
      selection
    );
    const prompt = buildExplainPrompt(t('explain.question'), chunks, getLanguage());
    const result = await runPromptCompletion(context, prompt, 'explain selection');

    if ('cancelled' in result) {
      vscode.window.showInformationMessage(t('analyze.cancelled'));
      return;
    }
    if ('error' in result) {
      return;
    }

    const doc = await vscode.workspace.openTextDocument({
      content: formatExplainDocument(result.text, result.thinking),
      language: 'markdown'
    });
    await showDocumentInActiveColumn(doc, { preview: true });
    vscode.window.showInformationMessage(t('explain.done'));
  });
}

function formatExplainDocument(text: string, thinking?: string): string {
  const body = text.trim();
  const think = thinking?.trim();
  if (!think) {
    return body;
  }
  return [
    '<details>',
    `<summary>${t('explain.modal.thinking')}</summary>`,
    '',
    '```',
    think,
    '```',
    '',
    '</details>',
    '',
    body
  ].join('\n');
}

async function readWorkspaceFile(filePath: string): Promise<string> {
  const uri = vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  return doc.getText();
}

/** Explain symbol/file/module dari klik node graph — hasil ke modal webview. */
export function registerExplainNodeCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand(
    'nevermin.explainNode',
    async (target?: ExplainNodeTarget) => {
      const { ensurePrivacyModeChosen } = await import('../utils/privacyGuards');
      if (!(await ensurePrivacyModeChosen(context))) {
        await setGraphPanelNodeExplain({
          status: 'error',
          title: target?.name,
          filePath: target?.filePath,
          message: t('explain.modal.error')
        });
        return;
      }

      const titleHint =
        target?.name?.trim() ||
        target?.filePath?.replace(/\\/g, '/').split('/').pop() ||
        'node';

      await setGraphPanelNodeExplain({
        status: 'loading',
        title: titleHint,
        filePath: target?.filePath,
        message: t('explain.modal.loading')
      });

      try {
        const graph = getCachedCodeGraph(context);
        const built = await buildScopedExplainPrompt({
          meta: {
            id: target?.id,
            name: target?.name,
            kind: target?.kind,
            filePath: target?.filePath,
            startLine: target?.startLine,
            endLine: target?.endLine,
            expandKey: target?.expandKey,
            view: target?.view
          },
          graph,
          lang: getLanguage(),
          readFile: readWorkspaceFile
        });

        const scopeLabel =
          built.scope === 'module'
            ? t('explain.scope.module')
            : built.scope === 'function'
              ? t('explain.scope.function')
              : t('explain.scope.file');

        await setGraphPanelNodeExplain({
          status: 'loading',
          title: built.title,
          filePath: target?.filePath,
          scope: built.scope,
          message: t('explain.modal.loadingScope', { scope: scopeLabel })
        });

        const result = await runPromptCompletion(context, built.prompt, built.taskLabel, {
          showProgressNotification: false,
          onProgressMessage: (message) => {
            void setGraphPanelNodeExplain({
              status: 'loading',
              title: built.title,
              filePath: target?.filePath,
              scope: built.scope,
              message
            });
          }
        });

        if ('cancelled' in result) {
          await setGraphPanelNodeExplain({
            status: 'cancelled',
            title: built.title,
            filePath: target?.filePath,
            scope: built.scope,
            message: t('explain.modal.cancelled')
          });
          return;
        }
        if ('error' in result) {
          await setGraphPanelNodeExplain({
            status: 'error',
            title: built.title,
            filePath: target?.filePath,
            scope: built.scope,
            message: t('explain.failed', { error: result.error })
          });
          return;
        }

        await setGraphPanelNodeExplain({
          status: 'ready',
          title: built.title,
          filePath: target?.filePath,
          scope: built.scope,
          text: result.text,
          thinking: result.thinking
        });
      } catch (err) {
        Logger.error(`explainNode gagal: ${err}`);
        const message = err instanceof Error ? err.message : String(err);
        await setGraphPanelNodeExplain({
          status: 'error',
          title: titleHint,
          filePath: target?.filePath,
          message: t('msg.insightOpenFail', {
            name: titleHint,
            error: message
          })
        });
      }
    }
  );
}
