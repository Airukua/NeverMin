import path from 'path';
import * as vscode from 'vscode';
import {
  buildGitHistoryInsightsFromCommits,
  GitHistoryInsights,
  parseGitLogNameOnly
} from '../core/git/gitHistoryInsights';
import { buildGitHistoryExplainPrompt } from '../core/llm/promptBuilder';
import { createLlmProvider } from '../core/llm/llmClient';
import { t } from '../i18n';
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
import { isGitRepository, resolveGitRoot, runGit } from '../utils/gitCli';
import {
  getLatestGitHistory,
  saveGitHistory,
  setGitHistoryStatus
} from '../utils/gitHistoryAnalysis';
import { runLoggedLlmCall, summarizeNarrativeResult } from '../utils/llmActivity';
import { classifyLlmError, notifyLlmIssue } from '../utils/llmUserNotice';
import { Logger } from '../utils/logger';
import { showDocumentInActiveColumn } from '../utils/editorLayout';
import { hasWorkspaceFolders } from '../utils/workspace';

const WINDOW_DAYS = 180;
const MAX_COMMITS = 250;

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function normalizeMarkdownNarrative(raw: string): string {
  let text = raw.trim();
  if (!text) {
    return '';
  }
  const fenced = text.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  if (fenced) {
    text = fenced[1].trim();
  }
  return text;
}

async function loadCommits(repoRoot: string): Promise<ReturnType<typeof parseGitLogNameOnly>> {
  const raw = await runGit(
    repoRoot,
    [
      'log',
      `--since=${WINDOW_DAYS}.days`,
      `--max-count=${MAX_COMMITS}`,
      '--date=iso-strict',
      '--pretty=format:COMMIT\t%H\t%an\t%aI\t%s',
      '--name-only'
    ],
    { timeoutMs: 60_000, maxBuffer: 12 * 1024 * 1024 }
  );
  return parseGitLogNameOnly(raw);
}

async function enrichWithNarrative(
  context: vscode.ExtensionContext,
  insights: GitHistoryInsights
): Promise<GitHistoryInsights> {
  const providerLabel = getProviderLabel();
  if (!(await hasApiKey(context))) {
    Logger.info('LLM lewati · git history · API key belum ada');
    void notifyLlmIssue({ kind: 'no_key', providerLabel });
    return insights;
  }

  try {
    const providerName = getProviderName();
    const model = getLlmModel() || undefined;
    const provider = createLlmProvider(providerName, await getApiKey(context), {
      model,
      temperature: Math.min(getLlmTemperature(), 0.5),
      baseUrl: providerName === 'ollama' ? getOllamaBaseUrl() : undefined
    });
    const narrative = await runLoggedLlmCall(
      {
        task: getLanguage() === 'en' ? 'git history narrative' : 'narasi git history',
        provider: getProviderLabel(providerName),
        model
      },
      () => provider.complete(buildGitHistoryExplainPrompt(insights, getLanguage())),
      summarizeNarrativeResult
    );
    const normalized = normalizeMarkdownNarrative(narrative);
    if (!normalized) {
      void notifyLlmIssue({ kind: 'empty', providerLabel });
      return insights;
    }
    return { ...insights, narrative: normalized };
  } catch (error) {
    void notifyLlmIssue({
      kind: classifyLlmError(error),
      providerLabel,
      detail: error instanceof Error ? error.message : String(error)
    });
    return insights;
  }
}

export async function runGitHistoryWorkflow(context: vscode.ExtensionContext): Promise<void> {
  if (!hasWorkspaceFolders()) {
    vscode.window.showWarningMessage(t('sidebar.action.openFolderRequired'));
    return;
  }

  const folder = workspaceRoot();
  if (!folder) {
    vscode.window.showWarningMessage(t('sidebar.action.openFolderRequired'));
    return;
  }

  await setGitHistoryStatus(context, 'loading');
  await vscode.commands.executeCommand('nevermin.refreshSidebar');

  try {
    const inside = await isGitRepository(folder);
    if (!inside) {
      await setGitHistoryStatus(context, 'error');
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
      vscode.window.showWarningMessage(t('git.notRepo'));
      return;
    }

    const repoRoot = (await resolveGitRoot(folder)) || folder;
    Logger.info(`Git history · scan ${repoRoot} · ${WINDOW_DAYS} hari · max ${MAX_COMMITS} commit`);

    const commits = await loadCommits(repoRoot);
    if (commits.length === 0) {
      await setGitHistoryStatus(context, 'error');
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
      vscode.window.showWarningMessage(t('git.noCommits'));
      return;
    }

    let insights = buildGitHistoryInsightsFromCommits(repoRoot, commits, {
      windowDays: WINDOW_DAYS,
      maxCommits: MAX_COMMITS,
      language: getLanguage()
    });
    await saveGitHistory(context, insights);
    await vscode.commands.executeCommand('nevermin.refreshSidebar');

    insights = await enrichWithNarrative(context, insights);
    await saveGitHistory(context, insights);
    await setGitHistoryStatus(context, 'ready');
    await vscode.commands.executeCommand('nevermin.refreshSidebar');

    Logger.info(
      `Git history selesai · ${insights.commitCountSampled} commit · hidup ${insights.aliveFiles.length} · beku ${insights.frozenFiles.length} · coupling ${insights.couplings.length}`
    );
    vscode.window.showInformationMessage(
      t('git.done', {
        commits: insights.commitCountSampled,
        alive: insights.aliveFiles.length,
        frozen: insights.frozenFiles.length
      })
    );
  } catch (error) {
    await setGitHistoryStatus(context, 'error');
    await vscode.commands.executeCommand('nevermin.refreshSidebar');
    Logger.error(`Git history gagal: ${error}`);
    vscode.window.showErrorMessage(
      t('git.error', { error: error instanceof Error ? error.message : String(error) })
    );
  }
}

export function registerAnalyzeGitHistoryCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand('nevermin.analyzeGitHistory', async () => {
    const { ensurePrivacyModeChosen } = await import('../utils/privacyGuards');
    if (!(await ensurePrivacyModeChosen(context))) {
      return;
    }
    await runGitHistoryWorkflow(context);
  });
}

export function registerOpenGitHistoryNarrativeCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'nevermin.openGitHistoryNarrative',
    async (narrative?: string) => {
      const text = (narrative || getLatestGitHistory(context)?.narrative || '').trim();
      if (!text) {
        vscode.window.showWarningMessage(t('git.noNarrative'));
        return;
      }
      const doc = await vscode.workspace.openTextDocument({
        content: text,
        language: 'markdown'
      });
      await showDocumentInActiveColumn(doc, { preview: true });
      try {
        await vscode.commands.executeCommand('markdown.showPreview', doc.uri);
      } catch {
        // preview optional
      }
    }
  );
}

export function registerOpenGitFileCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    'nevermin.openGitHistoryFile',
    async (repoRoot?: string, relativePath?: string) => {
      if (!repoRoot || !relativePath) {
        vscode.window.showWarningMessage(t('msg.insightNoPath'));
        return;
      }
      const absolute = path.isAbsolute(relativePath)
        ? relativePath
        : path.join(repoRoot, relativePath);
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absolute));
        await showDocumentInActiveColumn(doc, { preview: true });
      } catch (error) {
        vscode.window.showErrorMessage(
          t('msg.insightOpenFail', {
            name: relativePath,
            error: error instanceof Error ? error.message : String(error)
          })
        );
      }
    }
  );
}
