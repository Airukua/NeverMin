import type { LlmTokenUsage } from '../../types';

export interface GitCommitRecord {
  hash: string;
  author: string;
  date: string;
  subject: string;
  files: string[];
}

export interface GitFileChurn {
  path: string;
  commits: number;
  lastCommitAt: string;
  daysSinceChange: number;
  authors: string[];
}

export interface GitOwnerInsight {
  path: string;
  author: string;
  commits: number;
  share: number;
}

export interface GitCouplingInsight {
  a: string;
  b: string;
  together: number;
  /** together / commits involving either file (kasar). */
  support: number;
}

export interface GitHistoryInsights {
  generatedAt: string;
  repoRoot: string;
  windowDays: number;
  commitCountSampled: number;
  aliveFiles: GitFileChurn[];
  frozenFiles: GitFileChurn[];
  recentCommits: Array<{
    hash: string;
    subject: string;
    author: string;
    date: string;
    files: string[];
  }>;
  owners: GitOwnerInsight[];
  couplings: GitCouplingInsight[];
  summaryBullets: string[];
  narrative?: string;
  /** Agregat token usage dari call LLM untuk Git Insights ini. */
  tokenUsage?: LlmTokenUsage;
}

export interface BuildGitHistoryOptions {
  windowDays?: number;
  maxCommits?: number;
  aliveLimit?: number;
  frozenLimit?: number;
  couplingLimit?: number;
  ownerLimit?: number;
  /** Hari tanpa commit → dianggap beku. */
  frozenAfterDays?: number;
  /** Minimal commit bareng untuk coupling. */
  minCoupling?: number;
  /** Skip commit yang menyentuh terlalu banyak file (merge/noise). */
  maxFilesPerCommit?: number;
  now?: Date;
  language?: 'id' | 'en';
}

const DEFAULTS = {
  windowDays: 180,
  maxCommits: 250,
  aliveLimit: 8,
  frozenLimit: 8,
  couplingLimit: 8,
  ownerLimit: 8,
  frozenAfterDays: 60,
  minCoupling: 2,
  maxFilesPerCommit: 18
};

const NOISE_PATH =
  /(^|\/)(node_modules|dist|out|build|coverage|\.git|\.next|\.nuxt|vendor|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)(\/|$)/i;

export function shouldIgnoreGitPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').trim();
  if (!normalized || normalized.endsWith('/')) {
    return true;
  }
  return NOISE_PATH.test(normalized);
}

/**
 * Parse output `git log --pretty=format:'COMMIT\t%H\t%an\t%aI\t%s' --name-only`.
 */
export function parseGitLogNameOnly(raw: string): GitCommitRecord[] {
  const commits: GitCommitRecord[] = [];
  let current: GitCommitRecord | undefined;

  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('COMMIT\t')) {
      const parts = line.split('\t');
      current = {
        hash: parts[1] || '',
        author: parts[2] || 'unknown',
        date: parts[3] || '',
        subject: parts.slice(4).join('\t') || '(no subject)',
        files: []
      };
      if (current.hash) {
        commits.push(current);
      }
      continue;
    }

    if (!current) {
      continue;
    }
    const file = line.trim();
    if (!file || shouldIgnoreGitPath(file)) {
      continue;
    }
    if (!current.files.includes(file)) {
      current.files.push(file);
    }
  }

  return commits;
}

function daysBetween(isoDate: string, now: Date): number {
  const then = Date.parse(isoDate);
  if (Number.isNaN(then)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000)));
}

export function buildFileChurn(
  commits: GitCommitRecord[],
  now: Date
): Map<string, GitFileChurn> {
  const map = new Map<string, GitFileChurn>();

  for (const commit of commits) {
    const authorsForCommit = commit.author;
    for (const file of commit.files) {
      const existing = map.get(file);
      if (!existing) {
        map.set(file, {
          path: file,
          commits: 1,
          lastCommitAt: commit.date,
          daysSinceChange: daysBetween(commit.date, now),
          authors: [authorsForCommit]
        });
        continue;
      }
      existing.commits += 1;
      if (commit.date > existing.lastCommitAt) {
        existing.lastCommitAt = commit.date;
        existing.daysSinceChange = daysBetween(commit.date, now);
      }
      if (!existing.authors.includes(authorsForCommit)) {
        existing.authors.push(authorsForCommit);
      }
    }
  }

  return map;
}

export function pickAliveAndFrozen(
  churn: Map<string, GitFileChurn>,
  options: { aliveLimit: number; frozenLimit: number; frozenAfterDays: number }
): { alive: GitFileChurn[]; frozen: GitFileChurn[] } {
  const all = [...churn.values()];
  const alive = all
    .filter((item) => item.daysSinceChange < options.frozenAfterDays)
    .sort(
      (a, b) =>
        b.commits - a.commits || a.daysSinceChange - b.daysSinceChange || a.path.localeCompare(b.path)
    )
    .slice(0, options.aliveLimit);

  const aliveSet = new Set(alive.map((item) => item.path));
  const frozen = all
    .filter((item) => !aliveSet.has(item.path) && item.daysSinceChange >= options.frozenAfterDays)
    .sort(
      (a, b) =>
        b.daysSinceChange - a.daysSinceChange || a.commits - b.commits || a.path.localeCompare(b.path)
    )
    .slice(0, options.frozenLimit);

  return { alive, frozen };
}

export function buildCouplings(
  commits: GitCommitRecord[],
  options: { minCoupling: number; maxFilesPerCommit: number; limit: number }
): GitCouplingInsight[] {
  const pairCount = new Map<string, number>();
  const fileCommitCount = new Map<string, number>();

  for (const commit of commits) {
    const files = [...new Set(commit.files)].filter((f) => !shouldIgnoreGitPath(f));
    if (files.length < 2 || files.length > options.maxFilesPerCommit) {
      continue;
    }
    for (const file of files) {
      fileCommitCount.set(file, (fileCommitCount.get(file) ?? 0) + 1);
    }
    for (let i = 0; i < files.length; i += 1) {
      for (let j = i + 1; j < files.length; j += 1) {
        const left = files[i];
        const right = files[j];
        const key = left < right ? `${left}\0${right}` : `${right}\0${left}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  const couplings: GitCouplingInsight[] = [];
  for (const [key, together] of pairCount) {
    if (together < options.minCoupling) {
      continue;
    }
    const [a, b] = key.split('\0');
    const either = (fileCommitCount.get(a) ?? 0) + (fileCommitCount.get(b) ?? 0);
    const support = either > 0 ? together / either : 0;
    couplings.push({ a, b, together, support: Math.round(support * 1000) / 1000 });
  }

  return couplings
    .sort((x, y) => y.together - x.together || y.support - x.support || x.a.localeCompare(y.a))
    .slice(0, options.limit);
}

export function buildOwnersFromCommits(
  commits: GitCommitRecord[],
  focusPaths: string[],
  limit: number
): GitOwnerInsight[] {
  const focus = new Set(focusPaths);
  const counts = new Map<string, Map<string, number>>();

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!focus.has(file)) {
        continue;
      }
      let byAuthor = counts.get(file);
      if (!byAuthor) {
        byAuthor = new Map();
        counts.set(file, byAuthor);
      }
      byAuthor.set(commit.author, (byAuthor.get(commit.author) ?? 0) + 1);
    }
  }

  const owners: GitOwnerInsight[] = [];
  for (const path of focusPaths) {
    const byAuthor = counts.get(path);
    if (!byAuthor || byAuthor.size === 0) {
      continue;
    }
    let bestAuthor = '';
    let bestCount = 0;
    let total = 0;
    for (const [author, count] of byAuthor) {
      total += count;
      if (count > bestCount || (count === bestCount && author.localeCompare(bestAuthor) < 0)) {
        bestAuthor = author;
        bestCount = count;
      }
    }
    owners.push({
      path,
      author: bestAuthor,
      commits: bestCount,
      share: total > 0 ? Math.round((bestCount / total) * 100) / 100 : 0
    });
  }

  return owners
    .sort((a, b) => b.commits - a.commits || b.share - a.share || a.path.localeCompare(b.path))
    .slice(0, limit);
}

export function buildSummaryBullets(
  insights: Omit<GitHistoryInsights, 'summaryBullets' | 'narrative' | 'generatedAt'>,
  lang: 'id' | 'en'
): string[] {
  if (lang === 'en') {
    const bullets = [
      `Sampled ${insights.commitCountSampled} commits in the last ${insights.windowDays} days.`
    ];
    if (insights.aliveFiles[0]) {
      bullets.push(
        `Most active: ${insights.aliveFiles[0].path} (${insights.aliveFiles[0].commits} commits).`
      );
    }
    if (insights.frozenFiles[0]) {
      bullets.push(
        `Most frozen: ${insights.frozenFiles[0].path} (${insights.frozenFiles[0].daysSinceChange}d since last change).`
      );
    }
    if (insights.couplings[0]) {
      bullets.push(
        `Hidden coupling: ${insights.couplings[0].a} ↔ ${insights.couplings[0].b} (${insights.couplings[0].together}x together).`
      );
    }
    if (insights.owners[0]) {
      bullets.push(
        `Top owner signal: ${insights.owners[0].author} on ${insights.owners[0].path}.`
      );
    }
    return bullets;
  }

  const bullets = [
    `Sampel ${insights.commitCountSampled} commit dalam ${insights.windowDays} hari terakhir.`
  ];
  if (insights.aliveFiles[0]) {
    bullets.push(
      `Paling hidup: ${insights.aliveFiles[0].path} (${insights.aliveFiles[0].commits} commit).`
    );
  }
  if (insights.frozenFiles[0]) {
    bullets.push(
      `Paling beku: ${insights.frozenFiles[0].path} (${insights.frozenFiles[0].daysSinceChange} hari sejak ubah terakhir).`
    );
  }
  if (insights.couplings[0]) {
    bullets.push(
      `Coupling tersembunyi: ${insights.couplings[0].a} ↔ ${insights.couplings[0].b} (${insights.couplings[0].together}x bareng).`
    );
  }
  if (insights.owners[0]) {
    bullets.push(
      `Sinyal owner: ${insights.owners[0].author} di ${insights.owners[0].path}.`
    );
  }
  return bullets;
}

export function buildGitHistoryInsightsFromCommits(
  repoRoot: string,
  commits: GitCommitRecord[],
  options: BuildGitHistoryOptions = {}
): GitHistoryInsights {
  const cfg = { ...DEFAULTS, ...options };
  const now = options.now ?? new Date();
  const lang = options.language ?? 'id';

  const churn = buildFileChurn(commits, now);
  const { alive, frozen } = pickAliveAndFrozen(churn, {
    aliveLimit: cfg.aliveLimit,
    frozenLimit: cfg.frozenLimit,
    frozenAfterDays: cfg.frozenAfterDays
  });
  const couplings = buildCouplings(commits, {
    minCoupling: cfg.minCoupling,
    maxFilesPerCommit: cfg.maxFilesPerCommit,
    limit: cfg.couplingLimit
  });
  const ownerFocus = [
    ...alive.map((item) => item.path),
    ...frozen.slice(0, 3).map((item) => item.path)
  ];
  const owners = buildOwnersFromCommits(commits, ownerFocus, cfg.ownerLimit);
  const recentCommits = commits.slice(0, 12).map((commit) => ({
    hash: commit.hash.slice(0, 8),
    subject: commit.subject,
    author: commit.author,
    date: commit.date.slice(0, 10),
    files: commit.files.slice(0, 8)
  }));

  const base = {
    repoRoot,
    windowDays: cfg.windowDays,
    commitCountSampled: commits.length,
    aliveFiles: alive,
    frozenFiles: frozen,
    recentCommits,
    owners,
    couplings
  };

  return {
    generatedAt: now.toISOString(),
    ...base,
    summaryBullets: buildSummaryBullets(base, lang)
  };
}
