import * as vscode from 'vscode';
import { createLlmProvider } from '../core/llm/llmClient';
import { buildExplainPrompt } from '../core/llm/promptBuilder';
import { buildScopedExplainPrompt, type ExplainGraphView } from '../core/llm/explainNodeContext';
import { completeWithOptionalStream } from '../core/llm/streamComplete';
import { buildContextFromFile } from '../core/context/contextBuilder';
import { getLanguage, getLlmTemperature } from '../utils/config';
import { Logger } from '../utils/logger';
import { showDocumentInActiveColumn } from '../utils/editorLayout';
import { runLoggedLlmCall, summarizeExplainResult, withCompletionUsageSummary } from '../utils/llmActivity';
import { classifyLlmError, formatLlmErrorForUser, notifyLlmIssue } from '../utils/llmUserNotice';
import { prepareLlmSession } from '../utils/llmSession';
import { t } from '../i18n';
import { setGraphPanelNodeExplain } from '../ui/webview/graphPanel';
import { getCachedCodeGraph } from '../utils/codeGraphCache';
import { getLatestRepoAnalysis } from '../utils/repoAnalysis';
import { lookupSensitivity, type NodeSensitivity, type SensitivityLevel } from '../core/graph/sensitivity';

export interface ExplainNodeTarget {
  id?: string;
  filePath?: string;
  name?: string;
  kind?: string;
  startLine?: number;
  endLine?: number;
  expandKey?: string;
  view?: ExplainGraphView | string;
  sensitivityLevel?: string;
  sensitivityReason?: string;
}

function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true;
    if (/aborted|abort/i.test(err.message)) return true;
  }
  return false;
}

async function runPromptCompletion(
  context: vscode.ExtensionContext,
  prompt: string,
  taskLabel: string,
  options: {
    showProgressNotification?: boolean;
    onProgressMessage?: (message: string) => void;
    /** Live token deltas (chunk). Accumulated text is caller-owned. */
    onToken?: (chunk: string) => void;
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
  const live = typeof options.onToken === 'function';

  try {
    const run = async (
      progress: { report: (value: { message?: string }) => void },
      token: vscode.CancellationToken
    ): Promise<{ text: string; thinking?: string } | null> => {
      const progressMsg = live ? t('explain.modal.streaming') : t('explain.progress');
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

      const abort = new AbortController();
      const cancelSub = token.onCancellationRequested(() => abort.abort());

      try {
        const completion = await runLoggedLlmCall(
          {
            task: live ? `${taskLabel} (live)` : taskLabel,
            provider: session.providerLabel,
            model: session.model
          },
          () =>
            live
              ? completeWithOptionalStream(
                  provider,
                  prompt,
                  { onToken: options.onToken! },
                  {
                    think: session.provider === 'ollama' ? true : undefined,
                    signal: abort.signal
                  }
                )
              : provider.complete(prompt, {
                  think: session.provider === 'ollama' ? true : undefined,
                  signal: abort.signal
                }),
          withCompletionUsageSummary(summarizeExplainResult)
        );
        if (token.isCancellationRequested) {
          return null;
        }
        return { text: completion.text, thinking: completion.thinking };
      } catch (err) {
        if (token.isCancellationRequested || isAbortError(err)) {
          return null;
        }
        throw err;
      } finally {
        cancelSub.dispose();
      }
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
            title: live ? t('explain.modal.streaming') : t('explain.progress'),
            cancellable: true
          },
          run
        );

    if (answer === null) {
      return { cancelled: true };
    }
    return answer;
  } catch (err) {
    if (isAbortError(err)) {
      return { cancelled: true };
    }
    Logger.error(`explain gagal: ${err}`);
    const message = formatLlmErrorForUser(err);
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
    // Selection → markdown doc: keep one-shot (bukan modal Live).
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

/** Explain symbol/file/module dari klik node graph — hasil ke modal webview (Live stream). */
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
        const sensitivity: NodeSensitivity | undefined =
          lookupSensitivity(getLatestRepoAnalysis(context)?.insights?.nodeSensitivity, {
            id: target?.id,
            name: target?.name,
            filePath: target?.filePath
          }) ??
          (target?.sensitivityLevel
            ? {
                level: target.sensitivityLevel as SensitivityLevel,
                reason: target.sensitivityReason || '',
                signals: [],
                score: 0
              }
            : undefined);
        const isSensitiveView = (target?.view || '').trim() === 'sensitive';

        const built = await buildScopedExplainPrompt({
          meta: {
            id: target?.id,
            name: target?.name,
            kind: target?.kind,
            filePath: target?.filePath,
            startLine: target?.startLine,
            endLine: target?.endLine,
            expandKey: target?.expandKey,
            view: target?.view,
            sensitivityLevel: sensitivity?.level || target?.sensitivityLevel,
            sensitivityReason: sensitivity?.reason || target?.sensitivityReason,
            sensitivitySignals: sensitivity?.signals ?? []
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
              : built.scope === 'sensitivity'
                ? t('explain.scope.sensitivity')
                : t('explain.scope.file');

        await setGraphPanelNodeExplain({
          status: 'loading',
          title: built.title,
          filePath: target?.filePath,
          scope: built.scope,
          message: t('explain.modal.loadingScope', { scope: scopeLabel })
        });

        let acc = '';
        let lastPost = 0;
        let flushTimer: ReturnType<typeof setTimeout> | null = null;
        const sensitivityForUi = isSensitiveView ? sensitivity : undefined;

        const postStream = () => {
          void setGraphPanelNodeExplain({
            status: 'streaming',
            title: built.title,
            filePath: target?.filePath,
            scope: built.scope,
            text: acc,
            message: t('explain.modal.streaming'),
            sensitivityLevel: sensitivityForUi?.level,
            sensitivityReason: sensitivityForUi?.reason
          });
        };

        const result = await runPromptCompletion(context, built.prompt, built.taskLabel, {
          showProgressNotification: false,
          onProgressMessage: (message) => {
            if (acc) return;
            void setGraphPanelNodeExplain({
              status: 'loading',
              title: built.title,
              filePath: target?.filePath,
              scope: built.scope,
              message
            });
          },
          onToken: (chunk) => {
            acc += chunk;
            const now = Date.now();
            if (now - lastPost >= 70) {
              lastPost = now;
              if (flushTimer) {
                clearTimeout(flushTimer);
                flushTimer = null;
              }
              postStream();
              return;
            }
            if (!flushTimer) {
              flushTimer = setTimeout(() => {
                flushTimer = null;
                lastPost = Date.now();
                postStream();
              }, 70);
            }
          }
        });

        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }

        if ('cancelled' in result) {
          await setGraphPanelNodeExplain({
            status: 'cancelled',
            title: built.title,
            filePath: target?.filePath,
            scope: built.scope,
            text: acc || undefined,
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
            text: acc || undefined,
            message: t('explain.failed', { error: result.error })
          });
          return;
        }

        await setGraphPanelNodeExplain({
          status: 'ready',
          title: built.title,
          filePath: target?.filePath,
          scope: built.scope,
          text: result.text || acc,
          thinking: result.thinking,
          sensitivityLevel: sensitivityForUi?.level,
          sensitivityReason: sensitivityForUi?.reason
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
