import type { NeverminLanguage } from '../../i18n/types';
import type { GitHistoryInsights } from '../git/gitHistoryInsights';
import type { GraphInsights } from './graphInsights';
import type { CodeGraph } from './types';
import {
  detectContributionGaps,
  type ContributionGap,
  type GapType,
  type RiskBadge
} from './contributionGaps';

export type { ContributionGap, GapType, RiskBadge };
export type CompassLlmStatus = 'idle' | 'pending' | 'ready' | 'skipped' | 'error';

/** Kept for read-first orientation cards. */
export interface CompassItem {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  score: number;
  reasons: string[];
  llmReason?: string;
  tier: 'read' | 'safe' | 'caution' | 'avoid';
}

export interface CompassStep {
  id: string;
  title: string;
  detail: string;
  action?: 'openMindMap' | 'runGitHistory' | 'openNode';
  targetId?: string;
  targetName?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  kind?: string;
}

export interface ContributionCompassModel {
  generatedAt: string;
  hasGit: boolean;
  llmStatus: CompassLlmStatus;
  summary: {
    gaps: number;
    highPriority: number;
    byType: Partial<Record<GapType, number>>;
    /** @deprecated legacy counters for older UI; derived from risk badges */
    safe: number;
    caution: number;
    avoid: number;
  };
  agentAdvice?: string;
  docsUsed?: string[];
  gaps: ContributionGap[];
  readFirst: CompassItem[];
  firstSteps: CompassStep[];
  /** @deprecated legacy lists — empty, kept for type compat during transition */
  safeToTouch: CompassItem[];
  caution: CompassItem[];
  avoid: CompassItem[];
}

export interface ContributionCompassLlmPayload {
  advice?: string;
  gaps?: Array<{
    id: string;
    keep?: boolean;
    explanation?: string;
    opportunity?: string;
  }>;
  firstSteps?: Array<{ title: string; detail: string; target?: string }>;
}

export interface BuildContributionCompassOptions {
  insights: GraphInsights | null | undefined;
  graph?: CodeGraph | null;
  git?: GitHistoryInsights | null;
  docsText?: string;
  docsPaths?: string[];
  fileContents?: Array<{ path: string; content: string }>;
  lang?: NeverminLanguage;
  llmStatus?: CompassLlmStatus;
}

function defaultFirstSteps(
  lang: NeverminLanguage,
  hasGit: boolean,
  readFirst: CompassItem[],
  topGap?: ContributionGap
): CompassStep[] {
  const steps: CompassStep[] = [
    {
      id: 'mindmap',
      title: lang === 'en' ? 'Open the Learning Mind Map' : 'Buka Learning Mind Map',
      detail:
        lang === 'en'
          ? 'Orient on start → flow → hubs before closing gaps.'
          : 'Orientasi start → flow → hubs sebelum menutup gap.',
      action: 'openMindMap'
    }
  ];
  const entry = readFirst[0];
  if (entry) {
    steps.push({
      id: 'read-entry',
      title: lang === 'en' ? `Read entry: ${entry.name}` : `Baca entry: ${entry.name}`,
      detail:
        lang === 'en'
          ? 'Understand the system entry before filling a gap.'
          : 'Pahami entry sistem sebelum mengisi gap.',
      action: 'openNode',
      targetId: entry.id,
      targetName: entry.name,
      filePath: entry.filePath,
      startLine: entry.startLine,
      endLine: entry.endLine,
      kind: entry.kind
    });
  }
  if (topGap) {
    steps.push({
      id: 'close-gap',
      title: topGap.title.slice(0, 100),
      detail: topGap.opportunity,
      action: topGap.filePath ? 'openNode' : undefined,
      targetName: topGap.name,
      filePath: topGap.filePath,
      startLine: topGap.startLine,
      endLine: topGap.endLine,
      kind: topGap.kind
    });
  }
  if (!hasGit) {
    steps.push({
      id: 'git',
      title: lang === 'en' ? 'Run Git History' : 'Jalankan Git History',
      detail:
        lang === 'en'
          ? 'Coupling and churn improve gap value scoring.'
          : 'Coupling dan churn memperbaiki skor value gap.',
      action: 'runGitHistory'
    });
  }
  return steps;
}

function heuristicAdvice(lang: NeverminLanguage, gaps: ContributionGap[], hasGit: boolean): string {
  const top = gaps.filter((g) => !g.dismissed)[0];
  if (lang === 'en') {
    return [
      top
        ? `Highest-priority gap: ${top.title} (${top.type}).`
        : 'No strong gaps detected yet — re-run analysis with README/docs included.',
      'Gaps are ranked by evidence × value / effort (quick wins first).',
      hasGit
        ? 'Git coupling/churn signals are included.'
        : 'Run Git History to strengthen coupling and activity evidence.'
    ].join(' ');
  }
  return [
    top
      ? `Gap prioritas tertinggi: ${top.title} (${top.type}).`
      : 'Belum ada gap kuat — jalankan ulang analisis dengan README/docs.',
    'Gap diurutkan evidence × value / effort (quick win dulu).',
    hasGit
      ? 'Sinyal coupling/churn Git sudah dipakai.'
      : 'Jalankan Git History untuk memperkuat bukti coupling dan aktivitas.'
  ].join(' ');
}

/**
 * Bangun Contribution Compass berbasis deteksi gap (bukan peta bahaya).
 */
export function buildContributionCompass(
  insightsOrOptions: GraphInsights | null | undefined | BuildContributionCompassOptions,
  gitMaybe?: GitHistoryInsights | null,
  langMaybe?: NeverminLanguage,
  llmStatusMaybe?: CompassLlmStatus
): ContributionCompassModel {
  const opts: BuildContributionCompassOptions =
    insightsOrOptions && typeof insightsOrOptions === 'object' && 'insights' in (insightsOrOptions as object)
      ? (insightsOrOptions as BuildContributionCompassOptions)
      : {
          insights: insightsOrOptions as GraphInsights | null | undefined,
          git: gitMaybe,
          lang: langMaybe,
          llmStatus: llmStatusMaybe
        };

  const lang = opts.lang ?? 'id';
  const git = opts.git ?? null;
  const llmStatus = opts.llmStatus ?? 'idle';
  const generatedAt = new Date().toISOString();
  const insights = opts.insights;

  const empty: ContributionCompassModel = {
    generatedAt,
    hasGit: Boolean(git),
    llmStatus,
    summary: { gaps: 0, highPriority: 0, byType: {}, safe: 0, caution: 0, avoid: 0 },
    gaps: [],
    readFirst: [],
    firstSteps: defaultFirstSteps(lang, Boolean(git), []),
    safeToTouch: [],
    caution: [],
    avoid: [],
    docsUsed: opts.docsPaths
  };

  if (!insights) return empty;

  const gaps = detectContributionGaps({
    insights,
    graph: opts.graph,
    git,
    docsText: opts.docsText,
    fileContents: opts.fileContents,
    lang
  });

  const readFirst: CompassItem[] = (insights.entryPoints ?? []).slice(0, 3).map((ref) => ({
    id: ref.id,
    name: ref.name,
    kind: ref.kind,
    filePath: ref.filePath,
    startLine: ref.startLine,
    endLine: ref.endLine,
    score: ref.score,
    reasons: [lang === 'en' ? 'Entry point — read first' : 'Entry point — baca dulu'],
    tier: 'read'
  }));

  const byType: Partial<Record<GapType, number>> = {};
  for (const g of gaps) {
    byType[g.type] = (byType[g.type] ?? 0) + 1;
  }
  const highPriority = gaps.filter((g) => g.priorityScore >= 1.2).length;
  const safe = gaps.filter((g) => g.riskBadge === 'safe').length;
  const caution = gaps.filter((g) => g.riskBadge === 'needs-review').length;
  const avoid = gaps.filter((g) => g.riskBadge === 'critical-zone').length;

  return {
    generatedAt,
    hasGit: Boolean(git),
    llmStatus,
    summary: {
      gaps: gaps.length,
      highPriority,
      byType,
      safe,
      caution,
      avoid
    },
    agentAdvice: heuristicAdvice(lang, gaps, Boolean(git)),
    docsUsed: opts.docsPaths,
    gaps,
    readFirst,
    firstSteps: defaultFirstSteps(lang, Boolean(git), readFirst, gaps[0]),
    safeToTouch: [],
    caution: [],
    avoid: []
  };
}

/**
 * Merge LLM: explain gaps, drop false positives (keep:false), refine opportunities.
 */
export function applyContributionCompassLlmPayload(
  base: ContributionCompassModel,
  payload: ContributionCompassLlmPayload | null | undefined,
  lang: NeverminLanguage = 'id'
): ContributionCompassModel {
  if (!payload) {
    return { ...base, llmStatus: 'error' };
  }

  let gaps = base.gaps.map((g) => ({ ...g }));
  if (payload.gaps?.length) {
    const byId = new Map(gaps.map((g) => [g.id, g]));
    for (const row of payload.gaps) {
      const id = (row.id || '').trim();
      const hit = byId.get(id);
      if (!hit) continue;
      if (row.keep === false) {
        hit.dismissed = true;
      }
      if (row.explanation?.trim()) {
        hit.llmExplanation = row.explanation.trim().slice(0, 400);
      }
      if (row.opportunity?.trim()) {
        hit.opportunity = row.opportunity.trim().slice(0, 280);
      }
    }
    gaps = gaps
      .filter((g) => !g.dismissed)
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }

  let firstSteps = base.firstSteps;
  if (payload.firstSteps && payload.firstSteps.length > 0) {
    const pool = gaps;
    firstSteps = payload.firstSteps.slice(0, 5).map((step, index) => {
      const target = (step.target || '').trim().toLowerCase();
      const match = target
        ? pool.find(
            (g) =>
              g.id.toLowerCase() === target ||
              (g.filePath || '').toLowerCase().includes(target) ||
              (g.name || '').toLowerCase() === target
          )
        : undefined;
      return {
        id: `llm-step-${index}`,
        title: (step.title || '').trim().slice(0, 120) || `Step ${index + 1}`,
        detail:
          (step.detail || '').trim().slice(0, 240) ||
          (lang === 'en' ? 'Suggested next action.' : 'Aksi berikutnya yang disarankan.'),
        action: match?.filePath ? ('openNode' as const) : undefined,
        targetName: match?.name,
        filePath: match?.filePath,
        startLine: match?.startLine,
        endLine: match?.endLine,
        kind: match?.kind
      };
    });
  }

  const byType: Partial<Record<GapType, number>> = {};
  for (const g of gaps) {
    byType[g.type] = (byType[g.type] ?? 0) + 1;
  }

  return {
    ...base,
    llmStatus: 'ready',
    agentAdvice: payload.advice?.trim() || base.agentAdvice,
    gaps,
    firstSteps,
    summary: {
      gaps: gaps.length,
      highPriority: gaps.filter((g) => g.priorityScore >= 1.2).length,
      byType,
      safe: gaps.filter((g) => g.riskBadge === 'safe').length,
      caution: gaps.filter((g) => g.riskBadge === 'needs-review').length,
      avoid: gaps.filter((g) => g.riskBadge === 'critical-zone').length
    }
  };
}
