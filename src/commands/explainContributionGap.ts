import * as vscode from 'vscode';
import type { ContributionGap } from '../core/graph/contributionGaps';
import {
  parseGitLogNameOnly,
  type GitHistoryInsights
} from '../core/git/gitHistoryInsights';
import {
  buildGapExplainPrompt,
  parseGapExplainResponse,
  type GapExplainCommitExample
} from '../core/llm/gapExplainPrompt';
import { createLlmProvider } from '../core/llm/llmClient';
import { setCachedPromptResponse } from '../core/llm/promptCache';
import { resolveOllamaThinkOption } from '../core/llm/thinkingModel';
import { t } from '../i18n';
import { getLanguage, getLlmTemperature } from '../utils/config';
import { isGitRepository, resolveGitRoot, runGit } from '../utils/gitCli';
import { getLatestGitHistory } from '../utils/gitHistoryAnalysis';
import { runLoggedLlmCall, withCompletionUsageSummary } from '../utils/llmActivity';
import { Logger } from '../utils/logger';
import { prepareLlmSession } from '../utils/llmSession';
import { classifyLlmError, notifyLlmIssue } from '../utils/llmUserNotice';
import {
  getActiveGraphPanelCompass,
  patchActiveGraphPanelGapExplain
} from '../ui/webview/graphPanel';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function pathsFromGap(gap: ContributionGap): string[] {
  const out: string[] = [];
  if (gap.filePath) out.push(gap.filePath);
  for (const ev of gap.evidence) {
    const m = ev.match(/([\w./\\-]+\.(?:py|ts|tsx|js|jsx|mjs|cjs|go|rs|java))\s*↔\s*([\w./\\-]+\.(?:py|ts|tsx|js|jsx|mjs|cjs|go|rs|java))/i);
    if (m) {
      out.push(m[1], m[2]);
    }
  }
  // title pattern: a.py ↔ b.py
  const titlePair = gap.title.match(
    /([\w./\\-]+\.\w+)\s*↔\s*([\w./\\-]+\.\w+)/
  );
  if (titlePair) {
    out.push(titlePair[1], titlePair[2]);
  }
  const uniq = new Map<string, string>();
  for (const p of out) {
    const n = normalizePath(p);
    if (!uniq.has(n)) uniq.set(n, p.replace(/\\/g, '/'));
  }
  return [...uniq.values()];
}

function commitTouches(files: string[], targets: string[]): boolean {
  const set = new Set(files.map(normalizePath));
  return targets.some((t) => {
    const nt = normalizePath(t);
    const base = nt.split('/').pop() || nt;
    for (const f of set) {
      if (f === nt || f.endsWith('/' + nt) || f.endsWith('/' + base) || f.includes(base)) {
        return true;
      }
    }
    return false;
  });
}

function commitTouchesBoth(files: string[], a: string, b: string): boolean {
  return commitTouches(files, [a]) && commitTouches(files, [b]);
}

function fromRecent(
  git: GitHistoryInsights | undefined,
  related: string[]
): GapExplainCommitExample[] {
  if (!git?.recentCommits?.length || related.length === 0) return [];
  const both =
    related.length >= 2
      ? git.recentCommits.filter((c) => commitTouchesBoth(c.files, related[0], related[1]))
      : [];
  const either = git.recentCommits.filter((c) => commitTouches(c.files, related));
  const picked = (both.length > 0 ? both : either).slice(0, 8);
  return picked.map((c) => ({
    hash: c.hash,
    subject: c.subject,
    author: c.author,
    date: c.date,
    files: c.files
  }));
}

async function loadCoChangeCommits(
  related: string[],
  git: GitHistoryInsights | undefined
): Promise<GapExplainCommitExample[]> {
  const fromCache = fromRecent(git, related);
  if (fromCache.length > 0 || related.length === 0) return fromCache;

  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder || !(await isGitRepository(folder))) return [];
  const repoRoot = (await resolveGitRoot(folder)) || folder;

  try {
    const args = [
      'log',
      '--since=180.days',
      '--max-count=120',
      '--date=iso-strict',
      '--pretty=format:COMMIT\t%H\t%an\t%aI\t%s',
      '--name-only',
      '--',
      ...related.slice(0, 4)
    ];
    const raw = await runGit(repoRoot, args, {
      timeoutMs: 45_000,
      maxBuffer: 8 * 1024 * 1024
    });
    const commits = parseGitLogNameOnly(raw);
    const filtered =
      related.length >= 2
        ? commits.filter((c) => commitTouchesBoth(c.files, related[0], related[1]))
        : commits.filter((c) => commitTouches(c.files, related));
    return (filtered.length > 0 ? filtered : commits)
      .slice(0, 8)
      .map((c) => ({
        hash: c.hash,
        subject: c.subject,
        author: c.author,
        date: c.date,
        files: c.files
      }));
  } catch (err) {
    Logger.warn(`gap explain · git log gagal: ${err}`);
    return [];
  }
}

async function readCodeSnippet(gap: ContributionGap): Promise<string | undefined> {
  if (!gap.filePath) return undefined;
  try {
    const uri = vscode.Uri.file(gap.filePath);
    // absolute or resolve against workspace
    let doc: vscode.TextDocument;
    try {
      doc = await vscode.workspace.openTextDocument(uri);
    } catch {
      const found = await vscode.workspace.findFiles(
        `**/${gap.filePath.replace(/\\/g, '/').split('/').slice(-3).join('/')}`,
        '**/node_modules/**',
        1
      );
      if (!found[0]) return undefined;
      doc = await vscode.workspace.openTextDocument(found[0]);
    }
    const lines = doc.getText().split(/\r?\n/);
    const start = Math.max(0, (gap.startLine ?? 1) - 8);
    const end = Math.min(lines.length, (gap.endLine ?? gap.startLine ?? 1) + 12);
    const slice = lines.slice(start, end);
    if (slice.length === 0) return undefined;
    return slice
      .map((line, i) => `${String(start + i + 1).padStart(4, ' ')}| ${line}`)
      .join('\n')
      .slice(0, 3500);
  } catch {
    return undefined;
  }
}

export function registerExplainContributionGapCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'nevermin.explainContributionGap',
    async (gapId?: string) => {
      const id = (gapId || '').trim();
      if (!id) return;

      const compass = getActiveGraphPanelCompass();
      const gap = compass?.gaps.find((g) => g.id === id);
      if (!gap) {
        Logger.warn(`gap explain · gap tidak ditemukan: ${id}`);
        return;
      }

      const { ensurePrivacyModeChosen } = await import('../utils/privacyGuards');
      if (!(await ensurePrivacyModeChosen(context))) {
        await patchActiveGraphPanelGapExplain(id, {
          status: 'error',
          message: t('explain.modal.error')
        });
        return;
      }

      await patchActiveGraphPanelGapExplain(id, { status: 'loading' });

      try {
        const related = pathsFromGap(gap);
        const git = getLatestGitHistory(context);
        const [codeSnippet, commits] = await Promise.all([
          readCodeSnippet(gap),
          loadCoChangeCommits(related, git)
        ]);

        const prepared = await prepareLlmSession(context);
        if (!prepared.ok) {
          void notifyLlmIssue(prepared.issue);
          await patchActiveGraphPanelGapExplain(id, {
            status: 'error',
            message: prepared.issue.detail || prepared.issue.kind
          });
          return;
        }

        const lang = getLanguage();
        const task = lang === 'en' ? 'gap explain' : 'jelaskan gap';
        const prompt = buildGapExplainPrompt({
          gap,
          codeSnippet,
          commits,
          relatedPaths: related,
          lang
        });

        const { session } = prepared;
        const provider = createLlmProvider(session.provider, session.apiKey, {
          model: session.model,
          temperature: Math.min(getLlmTemperature(), 0.4),
          baseUrl: session.baseUrl
        });

        const completion = await runLoggedLlmCall(
          {
            task,
            provider: session.providerLabel,
            model: session.model
          },
          () =>
            provider.complete(prompt, {
              skipCache: false,
              cacheResponse: false,
              think: resolveOllamaThinkOption(session.provider, session.model, 'prefer-off')
            }),
          withCompletionUsageSummary((text) =>
            text.trim() ? `gapExplain ${Math.min(text.trim().length, 9999)}c` : 'empty'
          )
        );

        const detail = parseGapExplainResponse(completion.text);
        if (!detail) {
          await patchActiveGraphPanelGapExplain(id, {
            status: 'error',
            message: lang === 'en' ? 'Could not parse gap explanation.' : 'Gagal parse penjelasan gap.'
          });
          return;
        }

        setCachedPromptResponse(prompt, completion.text, {
          namespace: session.provider,
          usage: completion.usage
        });

        await patchActiveGraphPanelGapExplain(id, {
          status: 'ready',
          detail
        });
      } catch (err) {
        const detailMsg = err instanceof Error ? err.message : String(err);
        Logger.warn(`gap explain · gagal · ${detailMsg}`);
        void notifyLlmIssue({
          kind: classifyLlmError(err),
          providerLabel: 'LLM',
          detail: detailMsg
        });
        await patchActiveGraphPanelGapExplain(id, {
          status: 'error',
          message: detailMsg
        });
      }
    }
  );
}
