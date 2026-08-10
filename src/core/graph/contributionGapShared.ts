import type { GraphInsights } from './graphInsights';
import { lookupSensitivity } from './sensitivity';

export type RiskBadge = 'safe' | 'needs-review' | 'critical-zone';
export type GapConfidence = 'low' | 'medium' | 'high';

export type GapType =
  | 'orphan-promise'
  | 'bug-pattern'
  | 'yagni'
  | 'incomplete-feature'
  | 'coupling'
  | 'test-gap'
  | 'dead-config'
  | 'misleading-contract'
  | 'duplicate-logic'
  | 'silent-fallback'
  | 'missing-observability'
  | 'unbounded-resource'
  | 'missing-idempotency'
  | 'schema-api-drift'
  | 'dependency-risk'
  | 'feature-flag-graveyard'
  | 'ownership-gap'
  | 'convention-drift'
  | 'migration-incomplete'
  | 'naming-mismatch'
  | 'circular-dependency'
  | 'magic-value'
  | 'inconsistent-error-handling'
  | 'copy-pasted-config';

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function normKey(filePath: string): string {
  return normalizePath(filePath).toLowerCase();
}

function scorePriority(evidenceStrength: number, value: number, effort: number): number {
  return (evidenceStrength * value) / Math.max(effort, 0.15);
}

function confidenceFromEvidence(strength: number): GapConfidence {
  if (strength >= 0.75) return 'high';
  if (strength >= 0.45) return 'medium';
  return 'low';
}

export function riskForPath(
  insights: GraphInsights,
  filePath: string,
  name?: string
): RiskBadge {
  const sens = lookupSensitivity(insights.nodeSensitivity, {
    name,
    filePath
  });
  if (sens?.level === 'critical' || sens?.level === 'high') return 'critical-zone';
  const hubs = insights.hubs ?? [];
  if (hubs.some((h) => normKey(h.filePath) === normKey(filePath) || h.name === name)) {
    return 'needs-review';
  }
  if (sens?.level === 'medium') return 'needs-review';
  if (/(^|\/)(auth|payment|billing|secret|\.env)/i.test(filePath)) return 'needs-review';
  return 'safe';
}

/** Input for building a scored gap card. */
export interface GapBuildInput {
  id: string;
  title: string;
  type: GapType;
  evidence: string[];
  opportunity: string;
  riskBadge: RiskBadge;
  evidenceStrength: number;
  value: number;
  effort: number;
  confidence?: GapConfidence;
  filePath?: string;
  name?: string;
  kind?: string;
  startLine?: number;
  endLine?: number;
  llmExplanation?: string;
  dismissed?: boolean;
}

export type BuiltGap = GapBuildInput & {
  confidence: GapConfidence;
  priorityScore: number;
};

export function makeGap(partial: GapBuildInput): BuiltGap {
  const priorityScore = scorePriority(
    partial.evidenceStrength,
    partial.value,
    partial.effort
  );
  return {
    ...partial,
    confidence: partial.confidence ?? confidenceFromEvidence(partial.evidenceStrength),
    priorityScore
  };
}
