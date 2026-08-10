import type { NeverminLanguage } from '../../i18n/types';
import type {
  ContributionGap,
  GapExplainDetail,
  GapExplainEffort,
  GapExplainOption
} from '../graph/contributionGaps';

export interface GapExplainCommitExample {
  hash: string;
  subject: string;
  author: string;
  date: string;
  files: string[];
}

export interface GapExplainContext {
  gap: ContributionGap;
  codeSnippet?: string;
  commits?: GapExplainCommitExample[];
  relatedPaths?: string[];
  lang?: NeverminLanguage;
}

function formatCommits(commits: GapExplainCommitExample[] | undefined): string {
  if (!commits?.length) return '- (none available)';
  return commits
    .slice(0, 8)
    .map((c, i) => {
      const files = c.files.slice(0, 8).join(', ');
      return `${i + 1}. ${c.hash.slice(0, 8)} · ${c.date} · ${c.author}\n   ${c.subject}\n   files: ${files}`;
    })
    .join('\n');
}

/** On-demand gap explain: 4 required sections. Do not invent unsupported facts. */
export function buildGapExplainPrompt(ctx: GapExplainContext): string {
  const lang = ctx.lang ?? 'id';
  const g = ctx.gap;
  const jsonShape = [
    '{',
    '  "whyItMatters": "why this gap matters for maintainability/onboarding — do NOT only restate metrics",',
    '  "concreteExample": "one representative co-change commit OR exact code location/pattern from evidence",',
    '  "contributionOptions": [',
    '    {"title":"...", "detail":"...", "effort":"low"},',
    '    {"title":"...", "detail":"...", "effort":"medium"},',
    '    {"title":"...", "detail":"...", "effort":"high"}',
    '  ],',
    '  "confidenceJustification": "justify the confidence label using the evidence — not just repeat low/medium/high"',
    '}'
  ].join('\n');

  const common = [
    `GAP id=${g.id}`,
    `type=${g.type}`,
    `title=${g.title}`,
    `confidence=${g.confidence}`,
    `risk=${g.riskBadge}`,
    `priority=${g.priorityScore.toFixed(2)}`,
    `file=${g.filePath || '(none)'}`,
    `lines=${g.startLine ?? '?'}-${g.endLine ?? '?'}`,
    `evidence=${g.evidence.join(' | ')}`,
    `opportunity_seed=${g.opportunity}`,
    `related_paths=${(ctx.relatedPaths || []).join(' | ') || '(none)'}`,
    '',
    '=== CODE SNIPPET ===',
    (ctx.codeSnippet || '').trim() || '(none)',
    '',
    '=== CANDIDATE COMMITS (co-change / related) ===',
    formatCommits(ctx.commits)
  ].join('\n');

  if (lang === 'en') {
    return [
      'You explain ONE contribution gap on demand. Return ONE JSON object only.',
      'Required fields:',
      '1) whyItMatters — semantic why, not a restatement of numbers',
      '2) concreteExample — pick the single most representative commit from the list (hash+subject+why), OR cite the exact code location if no commits',
      '3) contributionOptions — 2 or 3 options ordered low → high effort',
      '4) confidenceJustification — defend the confidence label with evidence',
      'Do not invent commits, paths, or code that are not in the context.',
      '',
      'JSON schema:',
      jsonShape,
      '',
      common
    ].join('\n');
  }

  return [
    'Kamu menjelaskan SATU contribution gap on-demand. Kembalikan SATU objek JSON saja.',
    'Field wajib:',
    '1) whyItMatters — kenapa penting secara semantik, jangan hanya mengulang angka',
    '2) concreteExample — pilih SATU commit paling representatif dari daftar (hash+subject+alasan), ATAU kutip lokasi kode jika tidak ada commit',
    '3) contributionOptions — 2 atau 3 opsi, urut effort low → high',
    '4) confidenceJustification — justifikasi label confidence dari evidence',
    'Jangan mengarang commit, path, atau kode yang tidak ada di konteks.',
    '',
    'JSON schema:',
    jsonShape,
    '',
    common
  ].join('\n');
}

function asEffort(value: unknown): GapExplainEffort | null {
  const s = String(value || '').toLowerCase();
  if (s === 'low' || s === 'medium' || s === 'high') return s;
  return null;
}

export function parseGapExplainResponse(raw: string): GapExplainDetail | null {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const whyItMatters = typeof obj.whyItMatters === 'string' ? obj.whyItMatters.trim() : '';
  const concreteExample =
    typeof obj.concreteExample === 'string' ? obj.concreteExample.trim() : '';
  const confidenceJustification =
    typeof obj.confidenceJustification === 'string'
      ? obj.confidenceJustification.trim()
      : '';
  if (!whyItMatters || !concreteExample || !confidenceJustification) return null;

  const contributionOptions: GapExplainOption[] = [];
  if (Array.isArray(obj.contributionOptions)) {
    for (const row of obj.contributionOptions) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const detail = typeof item.detail === 'string' ? item.detail.trim() : '';
      const effort = asEffort(item.effort);
      if (!title || !detail || !effort) continue;
      contributionOptions.push({
        title: title.slice(0, 120),
        detail: detail.slice(0, 400),
        effort
      });
    }
  }
  if (contributionOptions.length < 2) return null;

  const effortRank: Record<GapExplainEffort, number> = { low: 0, medium: 1, high: 2 };
  contributionOptions.sort((a, b) => effortRank[a.effort] - effortRank[b.effort]);

  return {
    whyItMatters: whyItMatters.slice(0, 800),
    concreteExample: concreteExample.slice(0, 600),
    contributionOptions: contributionOptions.slice(0, 3),
    confidenceJustification: confidenceJustification.slice(0, 500),
    generatedAt: new Date().toISOString()
  };
}
