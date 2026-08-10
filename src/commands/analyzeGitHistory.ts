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
import { getLanguage, getLlmTemperature } from '../utils/config';
import { isGitRepository, resolveGitRoot, runGit } from '../utils/gitCli';
import {
  getLatestGitHistory,
  saveGitHistory,
  setGitHistoryStatus
} from '../utils/gitHistoryAnalysis';
import { getLatestRepoAnalysis, saveRepoAnalysis } from '../utils/repoAnalysis';
import { getCachedCodeGraph } from '../utils/codeGraphCache';
import { attachNodeSensitivity } from '../core/graph/sensitivity';
import {
  LlmInsightsStatus,
  setGraphPanelGitHistory
} from '../ui/webview/graphPanel';
import {
  runLoggedLlmCall,
  summarizeNarrativeResult,
  withCompletionUsageSummary
} from '../utils/llmActivity';
import { accumulateCompletionUsage, addTokenUsage } from '../core/llm/tokenUsage';
import {
  logSemanticRetry,
  semanticRetryDelayMs,
  semanticRetryPlanFor,
  semanticRetryPromptSuffix,
  semanticRetryTemperature,
  shouldAbortSemanticRetryFromError,
  sleepMs
} from '../core/llm/semanticRetry';
import { setCachedPromptResponse } from '../core/llm/promptCache';
import type { LlmTokenUsage } from '../types';
import { classifyLlmError, notifyLlmIssue } from '../utils/llmUserNotice';
import { prepareLlmSession } from '../utils/llmSession';
import { Logger } from '../utils/logger';
import { showDocumentInActiveColumn } from '../utils/editorLayout';
import { hasWorkspaceFolders } from '../utils/workspace';
import { normalizeMarkdownSource } from '../ui/webview/markdownLite';

const WINDOW_DAYS = 180;
const MAX_COMMITS = 250;

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function normalizeMarkdownNarrative(raw: string): string {
  let text = normalizeMarkdownSource(raw);
  if (!text) return '';

  // LLM often ignores ## and writes **Alive** / **Frozen** walls of prose.
  // Promote those into real headings so Open narrative + the panel parser both work.
  const hasStructuredAlive = /^#{1,3}\s+.*(alive|hidup)/im.test(text);
  if (!hasStructuredAlive && /\*\*(Alive|Hidup|Frozen|Beku)\*\*/i.test(text)) {
    text = text
      .replace(/\*\*Alive\*\*/gi, '\n\n## What is alive vs frozen\n\n')
      .replace(/\*\*Hidup\*\*/gi, '\n\n## Mana yang hidup vs beku\n\n')
      .replace(/\*\*Frozen\*\*/gi, '\n\n### Frozen\n\n')
      .replace(/\*\*Beku\*\*/gi, '\n\n### Beku\n\n');
  }

  // Paths alone on a line → backticks (chips / markdown)
  text = text.replace(
    /^(?![#`*\-\d])((?:[\w.-]+\/)+[\w.*-]+(?:\.[\w*]+)?)\s*$/gm,
    '`$1`'
  );

  return text.replace(/\n{3,}/g, '\n\n').trim();
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
): Promise<{ insights: GitHistoryInsights; llmStatus: LlmInsightsStatus }> {
  const prepared = await prepareLlmSession(context);
  if (!prepared.ok) {
    void notifyLlmIssue(prepared.issue);
    return { insights, llmStatus: 'skipped' };
  }

  const { session } = prepared;
  const task = getLanguage() === 'en' ? 'git history narrative' : 'narasi git history';
  const plan = semanticRetryPlanFor(session.provider);
  const basePrompt = buildGitHistoryExplainPrompt(insights, getLanguage());
  const baseTemp = Math.min(getLlmTemperature(), 0.5);
  let tokenUsage: LlmTokenUsage | undefined;
  let lastDetail = '';

  for (let attempt = 0; attempt < plan.maxAttempts; attempt++) {
    if (attempt > 0) {
      logSemanticRetry(task, attempt + 1, plan.maxAttempts, lastDetail || 'empty');
      await sleepMs(semanticRetryDelayMs(plan.baseDelayMs, attempt - 1));
    }

    const prompt = `${basePrompt}${semanticRetryPromptSuffix(attempt, getLanguage())}`;
    const provider = createLlmProvider(session.provider, session.apiKey, {
      model: session.model,
      temperature: semanticRetryTemperature(baseTemp, attempt),
      baseUrl: session.baseUrl
    });

    try {
      const completion = await runLoggedLlmCall(
        {
          task: attempt > 0 ? `${task} (retry ${attempt + 1}/${plan.maxAttempts})` : task,
          provider: session.providerLabel,
          model: session.model
        },
        () =>
          provider.complete(prompt, {
            skipCache: attempt > 0,
            cacheResponse: false
          }),
        withCompletionUsageSummary(summarizeNarrativeResult)
      );
      tokenUsage = addTokenUsage(
        tokenUsage,
        accumulateCompletionUsage(undefined, { ...completion, fromCache: false })
      );
      const normalized = normalizeMarkdownNarrative(completion.text);
      if (!normalized) {
        lastDetail = 'empty narrative';
        continue;
      }

      setCachedPromptResponse(basePrompt, completion.text, {
        namespace: session.provider,
        usage: completion.usage
      });
      if (attempt > 0) {
        Logger.info(`LLM retry · ${task} · sukses pada percobaan ${attempt + 1}/${plan.maxAttempts}`);
      }
      return {
        insights: { ...insights, narrative: normalized, tokenUsage },
        llmStatus: 'ready'
      };
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
      if (shouldAbortSemanticRetryFromError(error)) {
        void notifyLlmIssue({
          kind: classifyLlmError(error),
          providerLabel: session.providerLabel,
          detail: lastDetail
        });
        return { insights, llmStatus: 'error' };
      }
    }
  }

  Logger.warn(`LLM hasil · ${task} · gagal setelah ${plan.maxAttempts} percobaan`);
  void notifyLlmIssue({ kind: 'empty', providerLabel: session.providerLabel, detail: lastDetail });
  return { insights: { ...insights, tokenUsage }, llmStatus: 'error' };
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
    await setGraphPanelGitHistory(insights, {
      gitLlmStatus: 'inspecting',
      gitLlmMessage:
        getLanguage() === 'en'
          ? 'LLM is writing Git Insights…'
          : 'LLM sedang menulis Git Insights…'
    });
    await vscode.commands.executeCommand('nevermin.refreshSidebar');

    const enriched = await enrichWithNarrative(context, insights);
    insights = enriched.insights;
    await saveGitHistory(context, insights);
    await setGitHistoryStatus(context, 'ready');
    await setGraphPanelGitHistory(insights, { gitLlmStatus: enriched.llmStatus });

    // Refresh sensitivity dengan sinyal git baru (frozen/coupling).
    const graph = getCachedCodeGraph(context);
    const analysis = getLatestRepoAnalysis(context);
    if (graph && analysis?.insights) {
      const nextInsights = attachNodeSensitivity(
        analysis.insights,
        graph,
        insights,
        getLanguage()
      );
      await saveRepoAnalysis(context, { ...analysis, insights: nextInsights });
      const { refreshOpenGraphPanelInsights } = await import('../ui/webview/graphPanel');

      let compassOverride: import('../core/graph/contributionCompass').ContributionCompassModel | undefined;
      const prepared = await prepareLlmSession(context);
      if (prepared.ok) {
        try {
          const { enrichContributionCompassWithLlm } = await import('./contributionCompassLlm');
          const docGlobs = await vscode.workspace.findFiles(
            '{README,README.md,README.rst,CONTRIBUTING,CONTRIBUTING.md,docs/**/*.md}',
            '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**}',
            40
          );
          const candidateDocPaths = docGlobs.map((u) => u.fsPath);
          const compassOutcome = await enrichContributionCompassWithLlm({
            insights: nextInsights,
            graph,
            gitHistory: insights,
            session: prepared.session,
            candidateDocPaths
          });
          compassOverride = compassOutcome.compass;
        } catch (err) {
          Logger.warn(`Contribution compass LLM setelah git gagal: ${err}`);
        }
      }
      await refreshOpenGraphPanelInsights(graph, nextInsights, insights, {
        compass: compassOverride
      });
    }

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
      const text = normalizeMarkdownNarrative(
        narrative || getLatestGitHistory(context)?.narrative || ''
      );
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
