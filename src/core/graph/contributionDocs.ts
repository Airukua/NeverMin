/**
 * Kumpulkan cuplikan README / CONTRIBUTING / docs untuk agen Contribution Compass.
 */

export interface ContributionDocSnippet {
  path: string;
  content: string;
}

export interface CollectContributionDocsOptions {
  /** Max total karakter gabungan cuplikan. */
  maxTotalChars?: number;
  /** Max karakter per file. */
  maxPerFileChars?: number;
  /** Max jumlah file docs tambahan (selain README/CONTRIBUTING). */
  maxDocFiles?: number;
}

const DEFAULTS = {
  maxTotalChars: 10_000,
  maxPerFileChars: 4_000,
  maxDocFiles: 4
};

const NOISE =
  /(^|\/)(node_modules|dist|out|build|coverage|\.git|\.next|\.nuxt|vendor)(\/|$)/i;

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function baseName(filePath: string): string {
  const n = normalizePath(filePath);
  const i = n.lastIndexOf('/');
  return i >= 0 ? n.slice(i + 1) : n;
}

function isNoise(filePath: string): boolean {
  return NOISE.test(normalizePath(filePath));
}

function priority(filePath: string): number {
  const n = normalizePath(filePath).toLowerCase();
  const base = baseName(n).toLowerCase();
  if (base === 'readme.md' || base === 'readme.rst' || base === 'readme.txt' || base === 'readme') {
    // Prefer root README
    if (!n.includes('/')) return 100;
    return 90;
  }
  if (base === 'contributing.md' || base === 'contributing.rst' || base === 'contributing') {
    return 80;
  }
  if (n.includes('/docs/') || n.startsWith('docs/')) {
    if (base.includes('index') || base.includes('getting') || base.includes('start')) return 70;
    if (base.includes('contribut')) return 75;
    return 50;
  }
  return 0;
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\r\n/g, '\n').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n/* … truncated … */`;
}

/**
 * Dari daftar path workspace, pilih file docs relevan lalu baca lewat `readFile`.
 */
export async function collectContributionDocs(
  candidatePaths: string[],
  readFile: (filePath: string) => Promise<string>,
  options: CollectContributionDocsOptions = {}
): Promise<{ snippets: ContributionDocSnippet[]; usedPaths: string[] }> {
  const maxTotal = options.maxTotalChars ?? DEFAULTS.maxTotalChars;
  const maxPer = options.maxPerFileChars ?? DEFAULTS.maxPerFileChars;
  const maxDocs = options.maxDocFiles ?? DEFAULTS.maxDocFiles;

  const ranked = candidatePaths
    .filter((p) => p && !isNoise(p) && priority(p) > 0)
    .map((p) => ({ path: p, score: priority(p) }))
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length);

  const chosen: string[] = [];
  let extraDocs = 0;
  for (const row of ranked) {
    const base = baseName(row.path).toLowerCase();
    const isPrimary =
      base.startsWith('readme') || base.startsWith('contributing');
    if (!isPrimary) {
      if (extraDocs >= maxDocs) continue;
      extraDocs += 1;
    }
    // Dedupe by basename preference: keep first (highest score)
    const norm = normalizePath(row.path).toLowerCase();
    if (chosen.some((c) => normalizePath(c).toLowerCase() === norm)) continue;
    chosen.push(row.path);
    if (chosen.length >= maxDocs + 3) break;
  }

  const snippets: ContributionDocSnippet[] = [];
  const usedPaths: string[] = [];
  let used = 0;

  for (const filePath of chosen) {
    if (used >= maxTotal) break;
    try {
      const raw = await readFile(filePath);
      const room = Math.min(maxPer, maxTotal - used);
      if (room < 200) break;
      const content = truncate(raw, room);
      if (!content.trim()) continue;
      snippets.push({ path: normalizePath(filePath), content });
      usedPaths.push(normalizePath(filePath));
      used += content.length;
    } catch {
      // skip unreadable
    }
  }

  return { snippets, usedPaths };
}

/** Format cuplikan untuk prompt LLM. */
export function formatContributionDocsBlock(
  snippets: ContributionDocSnippet[],
  lang: 'id' | 'en' = 'id'
): string {
  if (snippets.length === 0) {
    return lang === 'en' ? '(no README/docs found)' : '(README/docs tidak ditemukan)';
  }
  return snippets
    .map((s) => [`=== DOC: ${s.path} ===`, s.content].join('\n'))
    .join('\n\n');
}

/** Heuristik path kandidat dari list file analisis / workspace. */
export function filterDocCandidatePaths(paths: string[]): string[] {
  return paths.filter((p) => priority(p) > 0 && !isNoise(p));
}
