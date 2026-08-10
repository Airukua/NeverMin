import type { NeverminLanguage } from '../../i18n/types';
import type { GitHistoryInsights } from '../git/gitHistoryInsights';
import type { GraphInsights } from './graphInsights';
import type { CodeGraph } from './types';
import { detectExtraContributionGaps } from './contributionGapDetectorsExtra';
import {
  makeGap,
  normalizePath,
  normKey,
  riskForPath,
  type GapConfidence,
  type GapType,
  type RiskBadge
} from './contributionGapShared';

export { makeGap, normalizePath, normKey, riskForPath } from './contributionGapShared';
export type { RiskBadge, GapConfidence, GapType } from './contributionGapShared';

export type GapExplainStatus = 'idle' | 'loading' | 'streaming' | 'ready' | 'error';
export type GapExplainEffort = 'low' | 'medium' | 'high';

export interface GapExplainOption {
  title: string;
  detail: string;
  effort: GapExplainEffort;
}

/** On-demand LLM detail for a single gap (lazy — not built at analyze time). */
export interface GapExplainDetail {
  whyItMatters: string;
  concreteExample: string;
  contributionOptions: GapExplainOption[];
  confidenceJustification: string;
  generatedAt: string;
}

export interface ContributionGap {
  id: string;
  title: string;
  type: GapType;
  evidence: string[];
  opportunity: string;
  riskBadge: RiskBadge;
  confidence: GapConfidence;
  /** 0–1 */
  evidenceStrength: number;
  /** 0–1 */
  value: number;
  /** 0–1 higher = harder */
  effort: number;
  /** evidenceStrength * value / max(effort, 0.15) */
  priorityScore: number;
  filePath?: string;
  name?: string;
  kind?: string;
  startLine?: number;
  endLine?: number;
  llmExplanation?: string;
  /** LLM marked as intentional / false positive */
  dismissed?: boolean;
  explainStatus?: GapExplainStatus;
  explainDetail?: GapExplainDetail;
  /** Live draft text while LLM streams (cleared when ready). */
  explainDraft?: string;
  explainError?: string;
}

export interface GapDetectionInput {
  insights: GraphInsights;
  graph?: CodeGraph | null;
  git?: GitHistoryInsights | null;
  docsText?: string;
  fileContents?: Array<{ path: string; content: string }>;
  lang?: NeverminLanguage;
}

/** Extract feature-like claims from README/docs. */
export function extractDocClaims(docsText: string): string[] {
  if (!docsText.trim()) return [];
  const claims: string[] = [];
  const lines = docsText.replace(/\r\n/g, '\n').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length < 8 || line.length > 160) continue;
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      const t = heading[1].replace(/[`*_]/g, '').trim();
      if (t && !/^(table of contents|toc|license|changelog|install|installation|getting started|contributing)$/i.test(t)) {
        claims.push(t);
      }
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(?:\[[ xX]\]\s+)?(.+)$/);
    if (bullet) {
      const t = bullet[1].replace(/[`*_]/g, '').trim();
      if (
        t &&
        /\b(support|feature|enable|provide|allow|api|auth|login|payment|search|export|import|dashboard|webhook|rate.?limit|cache|queue|worker|realtime|upload|download)\b/i.test(
          t
        )
      ) {
        claims.push(t);
      }
    }
  }
  // de-dupe
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of claims) {
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= 24) break;
  }
  return out;
}

function claimTokens(claim: string): string[] {
  return claim
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .filter(
      (t) =>
        ![
          'with',
          'from',
          'that',
          'this',
          'your',
          'have',
          'will',
          'into',
          'using',
          'support',
          'feature',
          'features',
          'simple',
          'easy',
          'built',
          'based'
        ].includes(t)
    );
}

function corpusHasTokens(
  tokens: string[],
  corpus: string
): { hit: boolean; matched: string[] } {
  const lower = corpus.toLowerCase();
  const matched = tokens.filter((t) => lower.includes(t));
  // need at least 2 tokens or 1 strong token length>=6
  const strong = matched.filter((t) => t.length >= 6);
  const hit = matched.length >= 2 || strong.length >= 1;
  return { hit, matched };
}

function buildSymbolCorpus(insights: GraphInsights, graph?: CodeGraph | null): string {
  const parts: string[] = [];
  for (const n of graph?.nodes ?? []) {
    parts.push(n.name, n.filePath);
  }
  for (const ref of [
    ...(insights.entryPoints ?? []),
    ...(insights.hubs ?? []),
    ...(insights.orphanFiles ?? [])
  ]) {
    parts.push(ref.name, ref.filePath);
  }
  for (const stage of insights.mainFlow?.stages ?? []) {
    parts.push(stage.name, stage.filePath);
  }
  return parts.join('\n').toLowerCase();
}

function detectOrphanPromises(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const claims = extractDocClaims(input.docsText || '');
  if (claims.length === 0) return [];
  const corpus = buildSymbolCorpus(input.insights, input.graph);
  const gaps: ContributionGap[] = [];
  for (const claim of claims.slice(0, 16)) {
    const tokens = claimTokens(claim);
    if (tokens.length === 0) continue;
    const { hit, matched } = corpusHasTokens(tokens, corpus);
    if (hit) continue;
    gaps.push(
      makeGap({
        id: `orphan-promise:${claim.slice(0, 48).toLowerCase().replace(/\s+/g, '-')}`,
        title:
          lang === 'en'
            ? `Docs promise “${claim.slice(0, 72)}” but code graph has no clear match`
            : `Docs menjanjikan “${claim.slice(0, 72)}” tapi graph tidak punya match jelas`,
        type: 'orphan-promise',
        evidence: [
          lang === 'en'
            ? `Claim extracted from README/docs: “${claim}”`
            : `Klaim dari README/docs: “${claim}”`,
          lang === 'en'
            ? `No symbol/path match for tokens: ${tokens.slice(0, 6).join(', ')}`
            : `Tidak ada match simbol/path untuk token: ${tokens.slice(0, 6).join(', ')}`,
          ...(matched.length
            ? []
            : [
                lang === 'en'
                  ? 'Cross-check: docs present + code inventory miss'
                  : 'Cross-check: docs ada + inventori kode miss'
              ])
        ],
        opportunity:
          lang === 'en'
            ? 'Implement the missing feature, or update docs to remove the orphan promise.'
            : 'Implementasikan fitur yang hilang, atau perbarui docs agar janji tidak orphan.',
        riskBadge: 'safe',
        evidenceStrength: 0.72,
        value: 0.7,
        effort: 0.55
      })
    );
  }
  return gaps.slice(0, 8);
}

const WIP_NAME = /(_wip|_temp|_tmp|_new|_v2|_old|TODO|FIXME|stub|placeholder)/i;
const NOT_IMPL =
  /\b(not\s+implemented|coming\s+soon|throw\s+new\s+Error\(\s*['"]Not implemented|TODO:|FIXME:|XXX:)\b/i;
const SKELETON_TEST =
  /\b(assert\s+True\b|expect\(true\)\s*\.toBe\(true\)|it\(\s*['"][^'"]+['"]\s*,\s*\(\)\s*=>\s*\{\s*\}\s*\)|def\s+test_\w+\([^)]*\):\s*\n\s*(pass|assert True))/i;
const SILENT_CATCH =
  /(except\s+(\w+\s+as\s+\w+|\w+)?\s*:\s*\n\s*pass\b|catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\{\s*\})/i;
const ENV_ASSIGN =
  /\b([A-Z][A-Z0-9_]{3,})\s*=\s*['"`]?[^'"`\n]+|process\.env\.([A-Z][A-Z0-9_]{3,})|os\.environ(?:\.get)?\(\s*['"]([A-Z][A-Z0-9_]{3,})['"]/g;

function detectIncompleteAndBugPatterns(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const gaps: ContributionGap[] = [];
  const insights = input.insights;

  for (const file of files.slice(0, 400)) {
    const path = normalizePath(file.path);
    if (/(^|\/)(node_modules|dist|out|build|\.git)\//i.test(path)) continue;
    const content = file.content || '';
    const base = path.split('/').pop() || path;
    const risk = riskForPath(insights, path);

    if (WIP_NAME.test(path) || WIP_NAME.test(base)) {
      gaps.push(
        makeGap({
          id: `incomplete:path:${normKey(path)}`,
          title:
            lang === 'en'
              ? `Incomplete naming still on path: ${base}`
              : `Nama incomplete masih di path: ${base}`,
          type: 'incomplete-feature',
          evidence: [
            lang === 'en'
              ? `Path/name matches WIP pattern: ${path}`
              : `Path/nama cocok pola WIP: ${path}`
          ],
          opportunity:
            lang === 'en'
              ? 'Finish or remove the WIP path from production call graph.'
              : 'Selesaikan atau hapus path WIP dari call graph produksi.',
          riskBadge: risk,
          filePath: path,
          name: base,
          kind: 'file',
          startLine: 1,
          endLine: 1,
          evidenceStrength: 0.65,
          value: risk === 'critical-zone' ? 0.85 : 0.55,
          effort: 0.4
        })
      );
    }

    if (NOT_IMPL.test(content)) {
      const lineIdx = content.split(/\n/).findIndex((l) => NOT_IMPL.test(l));
      gaps.push(
        makeGap({
          id: `incomplete:stub:${normKey(path)}`,
          title:
            lang === 'en'
              ? `Stub / not-implemented signal in ${base}`
              : `Sinyal stub / not-implemented di ${base}`,
          type: 'incomplete-feature',
          evidence: [
            lang === 'en'
              ? `File contains TODO/FIXME/Not implemented markers`
              : `File berisi penanda TODO/FIXME/Not implemented`,
            `L${Math.max(1, lineIdx + 1)}`
          ],
          opportunity:
            lang === 'en'
              ? 'Implement the stub or keep it out of reachable production routes.'
              : 'Implementasikan stub atau pastikan tidak ada di route produksi.',
          riskBadge: risk,
          filePath: path,
          name: base,
          kind: 'file',
          startLine: Math.max(1, lineIdx + 1),
          endLine: Math.max(1, lineIdx + 1),
          evidenceStrength: 0.8,
          value: 0.7,
          effort: 0.45
        })
      );
    }

    if (/(\.test\.|\.spec\.|__tests__|\/tests?\/)/i.test(path) && SKELETON_TEST.test(content)) {
      gaps.push(
        makeGap({
          id: `test-gap:skeleton:${normKey(path)}`,
          title:
            lang === 'en'
              ? `Skeleton test file: ${base}`
              : `File test masih skeleton: ${base}`,
          type: 'test-gap',
          evidence: [
            lang === 'en'
              ? 'Test file matches skeleton patterns (pass / assert True / empty it())'
              : 'File test cocok pola skeleton (pass / assert True / it kosong)'
          ],
          opportunity:
            lang === 'en'
              ? 'Replace placeholders with real assertions for happy + error paths.'
              : 'Ganti placeholder dengan assertion nyata untuk happy + error path.',
          riskBadge: 'safe',
          filePath: path,
          name: base,
          kind: 'file',
          startLine: 1,
          endLine: 1,
          evidenceStrength: 0.78,
          value: 0.6,
          effort: 0.35
        })
      );
    }

    if (SILENT_CATCH.test(content)) {
      const lineIdx = content.split(/\n/).findIndex((l) => /except.*:|catch\s*\(/.test(l));
      gaps.push(
        makeGap({
          id: `bug-pattern:silent-catch:${normKey(path)}`,
          title:
            lang === 'en'
              ? `Silent failure swallow in ${base}`
              : `Silent failure (catch kosong) di ${base}`,
          type: 'bug-pattern',
          evidence: [
            lang === 'en'
              ? 'Detected empty/pass catch or except: pass'
              : 'Terdeteksi catch kosong atau except: pass'
          ],
          opportunity:
            lang === 'en'
              ? 'Log, rethrow, or handle the error explicitly.'
              : 'Log, rethrow, atau tangani error secara eksplisit.',
          riskBadge: risk,
          filePath: path,
          name: base,
          kind: 'file',
          startLine: Math.max(1, lineIdx + 1),
          endLine: Math.max(1, lineIdx + 1),
          evidenceStrength: 0.7,
          value: 0.65,
          effort: 0.25
        })
      );
    }
  }

  return gaps;
}

function detectDeadConfig(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  if (files.length === 0) return [];
  const defined = new Map<string, { path: string; line: number }>();
  const allText = files.map((f) => f.content).join('\n');

  for (const file of files) {
    const path = normalizePath(file.path);
    if (!/(config|\.env|settings)/i.test(path) && !/^[A-Z0-9_]{6,}=/.test(file.content.slice(0, 200))) {
      // still scan .env* and *config*
      if (!/(^|\/)\.env|config|settings/i.test(path)) continue;
    }
    const lines = file.content.split(/\n/);
    lines.forEach((line, idx) => {
      ENV_ASSIGN.lastIndex = 0;
      let m: RegExpExecArray | null;
      const re = new RegExp(ENV_ASSIGN.source, 'g');
      while ((m = re.exec(line))) {
        const key = (m[1] || m[2] || m[3] || '').trim();
        if (!key || key.length < 4) continue;
        if (/^(TRUE|FALSE|NULL|NONE|HTTP|HTTPS|UTF|JSON)$/i.test(key)) continue;
        if (!defined.has(key)) {
          defined.set(key, { path, line: idx + 1 });
        }
      }
    });
  }

  const gaps: ContributionGap[] = [];
  for (const [key, loc] of defined) {
    const usageRe = new RegExp(`\\b${key}\\b`, 'g');
    const matches = allText.match(usageRe) || [];
    // definition counts as 1+; need near-zero other usages
    if (matches.length <= 2) {
      gaps.push(
        makeGap({
          id: `dead-config:${key}`,
          title:
            lang === 'en'
              ? `Config/env “${key}” defined but barely used`
              : `Config/env “${key}” didefinisikan tapi hampir tidak dipakai`,
          type: 'dead-config',
          evidence: [
            lang === 'en'
              ? `Defined in ${loc.path}:${loc.line}`
              : `Didefinisikan di ${loc.path}:${loc.line}`,
            lang === 'en'
              ? `Occurrences in scanned corpus: ${matches.length}`
              : `Kemunculan di korpus yang di-scan: ${matches.length}`
          ],
          opportunity:
            lang === 'en'
              ? 'Wire the setting into runtime logic, or remove/document why it is unused.'
              : 'Hubungkan setting ke runtime, atau hapus/dokumentasikan mengapa tidak dipakai.',
          riskBadge: riskForPath(input.insights, loc.path),
          filePath: loc.path,
          name: key,
          kind: 'variable',
          startLine: loc.line,
          endLine: loc.line,
          evidenceStrength: 0.62,
          value: 0.55,
          effort: 0.3
        })
      );
    }
    if (gaps.length >= 8) break;
  }
  return gaps;
}

function detectTestGapsForHubs(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const testPaths = new Set(
    files
      .map((f) => normKey(f.path))
      .filter((p) => /(\.test\.|\.spec\.|__tests__|\/tests?\/)/i.test(p))
  );
  const gaps: ContributionGap[] = [];
  for (const hub of (input.insights.hubs ?? []).slice(0, 8)) {
    const base = normalizePath(hub.filePath).split('/').pop() || hub.name;
    const stem = base.replace(/\.(tsx?|jsx?|mjs|cjs|py)$/i, '');
    const hasTest = [...testPaths].some(
      (p) => p.includes(stem.toLowerCase()) || p.includes(hub.name.toLowerCase())
    );
    if (hasTest) continue;
    const alive = (input.git?.aliveFiles ?? []).some(
      (f) => normKey(f.path) === normKey(hub.filePath) && f.commits >= 3
    );
    gaps.push(
      makeGap({
        id: `test-gap:hub:${hub.id}`,
        title:
          lang === 'en'
            ? `Hub “${hub.name}” has no nearby test file`
            : `Hub “${hub.name}” belum punya file test dekatnya`,
        type: 'test-gap',
        evidence: [
          lang === 'en' ? `Hub file: ${hub.filePath}` : `File hub: ${hub.filePath}`,
          lang === 'en'
            ? 'No matching *.test/*.spec/__tests__ path found in analysis set'
            : 'Tidak ketemu path *.test/*.spec/__tests__ yang cocok di set analisis',
          ...(alive
            ? [
                lang === 'en'
                  ? 'Git: file is relatively active (churn)'
                  : 'Git: file relatif aktif (churn)'
              ]
            : [])
        ],
        opportunity:
          lang === 'en'
            ? 'Add focused tests for the hub’s public API (happy + failure paths).'
            : 'Tambah test fokus untuk API publik hub (happy + failure path).',
        riskBadge: 'needs-review',
        filePath: hub.filePath,
        name: hub.name,
        kind: hub.kind,
        startLine: hub.startLine,
        endLine: hub.endLine,
        evidenceStrength: alive ? 0.8 : 0.6,
        value: 0.75,
        effort: 0.5
      })
    );
  }
  return gaps;
}

function detectCouplingGaps(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const couplings = input.git?.couplings ?? [];
  if (couplings.length === 0) return [];
  const gaps: ContributionGap[] = [];
  for (const pair of couplings.slice(0, 6)) {
    if (pair.together < 3 && pair.support < 0.35) continue;
    const a = normalizePath(pair.a);
    const b = normalizePath(pair.b);
    gaps.push(
      makeGap({
        id: `coupling:${normKey(a)}::${normKey(b)}`,
        title:
          lang === 'en'
            ? `Tight co-change without explicit contract: ${a.split('/').pop()} ↔ ${b.split('/').pop()}`
            : `Co-change ketat tanpa kontrak eksplisit: ${a.split('/').pop()} ↔ ${b.split('/').pop()}`,
        type: 'coupling',
        evidence: [
          lang === 'en'
            ? `Git coupling together=${pair.together}, support=${pair.support.toFixed(2)}`
            : `Coupling git together=${pair.together}, support=${pair.support.toFixed(2)}`,
          `${a} ↔ ${b}`
        ],
        opportunity:
          lang === 'en'
            ? 'Introduce a shared interface/schema or document the implicit contract.'
            : 'Tambahkan interface/schema bersama atau dokumentasikan kontrak implisit.',
        riskBadge: 'needs-review',
        filePath: a,
        name: a.split('/').pop(),
        kind: 'file',
        startLine: 1,
        endLine: 1,
        evidenceStrength: 0.68,
        value: 0.6,
        effort: 0.5
      })
    );
  }
  return gaps;
}

function detectYagniLite(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const graph = input.graph;
  if (!graph) return [];
  // Interfaces/abstract-looking names with a single implementor via extends
  const extendsEdges = graph.edges.filter((e) => e.kind === 'extends');
  const byParent = new Map<string, string[]>();
  for (const e of extendsEdges) {
    const list = byParent.get(e.to) ?? [];
    list.push(e.from);
    byParent.set(e.to, list);
  }
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const gaps: ContributionGap[] = [];
  for (const [parentId, children] of byParent) {
    if (children.length !== 1) continue;
    const parent = nodeById.get(parentId);
    if (!parent) continue;
    if (!/^(I[A-Z]|Abstract|Base|Protocol)/.test(parent.name) && !/Interface|Abstract|Protocol/.test(parent.name)) {
      continue;
    }
    gaps.push(
      makeGap({
        id: `yagni:${parent.id}`,
        title:
          lang === 'en'
            ? `Abstraction “${parent.name}” has only one implementation`
            : `Abstraksi “${parent.name}” hanya punya satu implementasi`,
        type: 'yagni',
        evidence: [
          lang === 'en'
            ? `Extends fan-out = 1 (${nodeById.get(children[0])?.name || children[0]})`
            : `Extends fan-out = 1 (${nodeById.get(children[0])?.name || children[0]})`
        ],
        opportunity:
          lang === 'en'
            ? 'Collapse the unused variation point, or document why the abstraction must stay.'
            : 'Ciutkan variation point yang tidak dipakai, atau dokumentasikan mengapa abstraksi harus tetap.',
        riskBadge: riskForPath(input.insights, parent.filePath, parent.name),
        filePath: parent.filePath,
        name: parent.name,
        kind: parent.kind,
        startLine: parent.startLine,
        endLine: parent.endLine,
        evidenceStrength: 0.55,
        value: 0.35,
        effort: 0.4
      })
    );
    if (gaps.length >= 5) break;
  }
  return gaps;
}

/**
 * Jalankan semua detector gap (deterministik). LLM tidak dipanggil di sini.
 */
export function detectContributionGaps(input: GapDetectionInput): ContributionGap[] {
  if (!input.insights) return [];
  const all = [
    ...detectOrphanPromises(input),
    ...detectIncompleteAndBugPatterns(input),
    ...detectDeadConfig(input),
    ...detectTestGapsForHubs(input),
    ...detectCouplingGaps(input),
    ...detectYagniLite(input),
    ...detectExtraContributionGaps(input)
  ];

  // de-dupe by id
  const byId = new Map<string, ContributionGap>();
  for (const g of all) {
    const prev = byId.get(g.id);
    if (!prev || g.priorityScore > prev.priorityScore) {
      byId.set(g.id, g);
    }
  }

  return [...byId.values()].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 40);
}
