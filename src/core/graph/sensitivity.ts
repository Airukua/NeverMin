import type { NeverminLanguage } from '../../i18n/types';
import type { GitHistoryInsights } from '../git/gitHistoryInsights';
import { inferNodeIcon, type NodeCardIcon } from './nodeCardIcons';
import type { CodeGraph } from './types';
import type { GraphInsights } from './graphInsights';

export type SensitivityLevel = 'critical' | 'high' | 'medium' | 'low';

export type SensitivitySignal =
  | 'hub'
  | 'entry'
  | 'pipeline'
  | 'mainFlow'
  | 'auth'
  | 'config'
  | 'api'
  | 'data'
  | 'secrets'
  | 'payment'
  | 'frozen'
  | 'coupled';

export interface NodeSensitivity {
  level: SensitivityLevel;
  reason: string;
  signals: SensitivitySignal[];
  /** Skor internal (untuk sorting / debug). */
  score: number;
}

const SECRETS_PATH =
  /(^|\/)(\.env(\.|$)|.*credentials.*|.*secrets?.*|.*service.?account.*|.*private.?key.*)\b/i;
const PAYMENT_PATH =
  /\b(payment|billing|invoice|checkout|stripe|paypal|midtrans|xendit|payout|refund)\b/i;
const AUTH_PATH = /\b(auth|login|oauth|session|permission|rbac|jwt)\b/i;
const CONFIG_PATH = /\b(config|settings?|\.env|environment)\b/i;

const SIGNAL_WEIGHT: Record<SensitivitySignal, number> = {
  secrets: 5,
  payment: 4,
  auth: 4,
  hub: 3,
  config: 3,
  frozen: 2,
  coupled: 2,
  entry: 2,
  pipeline: 2,
  mainFlow: 2,
  api: 2,
  data: 2
};

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function pathTail(filePath: string): string {
  const n = normalizePath(filePath);
  const parts = n.split('/').filter(Boolean);
  return parts.slice(-3).join('/');
}

function levelFromScore(score: number): SensitivityLevel {
  if (score >= 8) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function signalLabel(signal: SensitivitySignal, lang: NeverminLanguage): string {
  const id: Record<SensitivitySignal, string> = {
    hub: 'hub inti',
    entry: 'entry point',
    pipeline: 'alur utama',
    mainFlow: 'main flow',
    auth: 'auth/session',
    config: 'config/env',
    api: 'API/service',
    data: 'data/DB',
    secrets: 'file rahasia',
    payment: 'payment/billing',
    frozen: 'jarang berubah (beku)',
    coupled: 'sering ikut berubah bareng file lain'
  };
  const en: Record<SensitivitySignal, string> = {
    hub: 'core hub',
    entry: 'entry point',
    pipeline: 'main pipeline',
    mainFlow: 'main flow',
    auth: 'auth/session',
    config: 'config/env',
    api: 'API/service',
    data: 'data/DB',
    secrets: 'secrets file',
    payment: 'payment/billing',
    frozen: 'rarely changed (frozen)',
    coupled: 'often co-changed with other files'
  };
  return (lang === 'en' ? en : id)[signal];
}

function buildReason(signals: SensitivitySignal[], lang: NeverminLanguage): string {
  const top = signals.slice(0, 3).map((s) => signalLabel(s, lang));
  if (top.length === 0) {
    return lang === 'en' ? 'Low change risk from current signals.' : 'Risiko ubah rendah dari sinyal saat ini.';
  }
  const joined = top.join(' · ');
  return lang === 'en'
    ? `${joined} — changing this wrongly can have wide impact.`
    : `${joined} — salah ubah bisa berdampak luas.`;
}

interface GitIndex {
  frozen: Set<string>;
  coupled: Set<string>;
}

function buildGitIndex(git?: GitHistoryInsights | null): GitIndex {
  const frozen = new Set<string>();
  const coupled = new Set<string>();
  if (!git) {
    return { frozen, coupled };
  }
  for (const file of git.frozenFiles ?? []) {
    frozen.add(normalizePath(file.path));
  }
  for (const pair of git.couplings ?? []) {
    if (pair.together >= 3 || pair.support >= 0.35) {
      coupled.add(normalizePath(pair.a));
      coupled.add(normalizePath(pair.b));
    }
  }
  return { frozen, coupled };
}

function pathMatchesGit(filePath: string, set: Set<string>): boolean {
  const full = normalizePath(filePath);
  if (set.has(full)) return true;
  const tail = pathTail(filePath);
  for (const entry of set) {
    if (entry.endsWith(tail) || full.endsWith(entry) || entry.endsWith(full)) {
      return true;
    }
  }
  return false;
}

function collectPathSignals(filePath: string, name: string): SensitivitySignal[] {
  const text = `${name} ${filePath}`;
  const signals: SensitivitySignal[] = [];
  if (SECRETS_PATH.test(filePath) || SECRETS_PATH.test(name)) {
    signals.push('secrets');
  }
  if (PAYMENT_PATH.test(text)) {
    signals.push('payment');
  }
  if (AUTH_PATH.test(text)) {
    signals.push('auth');
  }
  if (CONFIG_PATH.test(text)) {
    signals.push('config');
  }
  return signals;
}

function signalsFromIcon(icon: NodeCardIcon): SensitivitySignal[] {
  switch (icon) {
    case 'auth':
      return ['auth'];
    case 'config':
      return ['config'];
    case 'api':
      return ['api'];
    case 'data':
      return ['data'];
    default:
      return [];
  }
}

function roleSignals(role: string): SensitivitySignal[] {
  if (role === 'hub') return ['hub'];
  if (role === 'entry') return ['entry'];
  if (role.startsWith('pipeline')) return ['pipeline', 'mainFlow'];
  return [];
}

export function scoreNodeSensitivity(input: {
  name: string;
  filePath: string;
  kind?: string;
  role?: string;
  iconKey?: string;
  inMainFlow?: boolean;
  git?: GitIndex;
  lang?: NeverminLanguage;
}): NodeSensitivity {
  const lang = input.lang ?? 'id';
  const signals = new Set<SensitivitySignal>();

  for (const s of roleSignals(input.role || '')) {
    signals.add(s);
  }
  if (input.inMainFlow) {
    signals.add('mainFlow');
    signals.add('pipeline');
  }
  for (const s of collectPathSignals(input.filePath, input.name)) {
    signals.add(s);
  }
  const icon =
    (input.iconKey as NodeCardIcon | undefined) ||
    inferNodeIcon(input.name, { kind: input.kind, filePath: input.filePath });
  for (const s of signalsFromIcon(icon)) {
    signals.add(s);
  }
  if (input.git && pathMatchesGit(input.filePath, input.git.frozen)) {
    signals.add('frozen');
  }
  if (input.git && pathMatchesGit(input.filePath, input.git.coupled)) {
    signals.add('coupled');
  }

  const list = [...signals];
  let score = list.reduce((sum, s) => sum + (SIGNAL_WEIGHT[s] || 0), 0);
  if (signals.has('hub') && (signals.has('auth') || signals.has('secrets') || signals.has('payment'))) {
    score += 2;
  }
  if (signals.has('frozen') && (signals.has('hub') || signals.has('auth'))) {
    score += 1;
  }

  const level = levelFromScore(score);
  return {
    level,
    score,
    signals: list,
    reason: buildReason(list, lang)
  };
}

/**
 * Bangun peta sensitivity untuk entry/hub/pipeline + file berisiko tinggi.
 * Key = node id dan name (lookup longgar di UI).
 */
export function buildNodeSensitivityMap(
  graph: CodeGraph,
  insights: GraphInsights,
  git?: GitHistoryInsights | null,
  lang: NeverminLanguage = 'id'
): Record<string, NodeSensitivity> {
  const gitIndex = buildGitIndex(git);
  const icons = insights.nodeIcons ?? {};
  const mainFlowIds = new Set(
    (insights.mainFlow?.stages ?? []).map((s) => s.nodeId).filter(Boolean)
  );
  const out: Record<string, NodeSensitivity> = {};
  const seen = new Set<string>();

  const assign = (
    id: string,
    name: string,
    filePath: string,
    kind: string,
    role: string
  ): void => {
    const key = `${normalizePath(filePath)}#${name}`;
    if (seen.has(key) || !filePath) return;
    seen.add(key);
    const iconKey = icons[id] || icons[name];
    const scored = scoreNodeSensitivity({
      name,
      filePath,
      kind,
      role,
      iconKey,
      inMainFlow: mainFlowIds.has(id),
      git: gitIndex,
      lang
    });
    if (scored.level === 'low' && scored.score < 3) {
      return;
    }
    out[id] = scored;
    if (name && name !== id) {
      out[name] = scored;
    }
  };

  for (const ref of insights.entryPoints ?? []) {
    assign(ref.id, ref.name, ref.filePath, ref.kind, 'entry');
  }
  for (const ref of insights.hubs ?? []) {
    assign(ref.id, ref.name, ref.filePath, ref.kind, 'hub');
  }
  for (const stage of insights.mainFlow?.stages ?? []) {
    assign(stage.nodeId, stage.name, stage.filePath, 'function', `pipeline:${stage.role}`);
  }

  for (const node of graph.nodes) {
    if (node.kind !== 'file') continue;
    const pathSignals = collectPathSignals(node.filePath, node.name);
    if (!pathSignals.some((s) => s === 'secrets' || s === 'payment' || s === 'auth' || s === 'config')) {
      continue;
    }
    assign(node.id, node.name, node.filePath, node.kind, 'support');
  }

  return out;
}

export function attachNodeSensitivity(
  insights: GraphInsights,
  graph: CodeGraph,
  git?: GitHistoryInsights | null,
  lang: NeverminLanguage = 'id'
): GraphInsights {
  return {
    ...insights,
    nodeSensitivity: buildNodeSensitivityMap(graph, insights, git, lang)
  };
}

export function lookupSensitivity(
  map: Record<string, NodeSensitivity> | undefined,
  ref: { id?: string; name?: string; filePath?: string }
): NodeSensitivity | undefined {
  if (!map) return undefined;
  if (ref.id && map[ref.id]) return map[ref.id];
  if (ref.id) {
    const stripped = ref.id.match(/^S-(?:critical|high|medium|low)-\d+-(.+)$/);
    if (stripped?.[1] && map[stripped[1]]) return map[stripped[1]];
  }
  if (ref.name && map[ref.name]) return map[ref.name];
  return undefined;
}

export function listHighSensitivityEntries(
  insights: GraphInsights,
  limit = 8
): Array<{
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  sensitivity: NodeSensitivity;
}> {
  const map = insights.nodeSensitivity;
  if (!map) return [];

  type Row = {
    id: string;
    name: string;
    kind: string;
    filePath: string;
    startLine: number;
    endLine: number;
    sensitivity: NodeSensitivity;
  };
  const rows: Row[] = [];
  const seen = new Set<string>();

  const pushRef = (
    ref: { id: string; name: string; kind: string; filePath: string; startLine: number; endLine: number },
    sensitivity: NodeSensitivity
  ): void => {
    if (sensitivity.level !== 'critical' && sensitivity.level !== 'high') return;
    const key = normalizePath(ref.filePath) + '#' + ref.name;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ ...ref, sensitivity });
  };

  for (const ref of insights.entryPoints ?? []) {
    const s = map[ref.id] || map[ref.name];
    if (s) pushRef(ref, s);
  }
  for (const ref of insights.hubs ?? []) {
    const s = map[ref.id] || map[ref.name];
    if (s) pushRef(ref, s);
  }
  for (const stage of insights.mainFlow?.stages ?? []) {
    const s = map[stage.nodeId] || map[stage.name];
    if (s) {
      pushRef(
        {
          id: stage.nodeId,
          name: stage.name,
          kind: 'function',
          filePath: stage.filePath,
          startLine: stage.startLine,
          endLine: stage.endLine
        },
        s
      );
    }
  }

  rows.sort((a, b) => b.sensitivity.score - a.sensitivity.score);
  return rows.slice(0, limit);
}

const LEVEL_RANK: Record<SensitivityLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

/** Daftar item untuk tab Sensitive code (critical / high / medium). */
export function listSensitivityItems(
  insights: GraphInsights,
  graph?: CodeGraph | null,
  limit = 36
): Array<{
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  sensitivity: NodeSensitivity;
}> {
  const map = insights.nodeSensitivity;
  if (!map) return [];

  type Row = {
    id: string;
    name: string;
    kind: string;
    filePath: string;
    startLine: number;
    endLine: number;
    sensitivity: NodeSensitivity;
  };
  const rows: Row[] = [];
  const seen = new Set<string>();

  const pushRef = (
    ref: { id: string; name: string; kind: string; filePath: string; startLine: number; endLine: number },
    sensitivity: NodeSensitivity
  ): void => {
    if (sensitivity.level === 'low') return;
    const key = normalizePath(ref.filePath) + '#' + ref.name;
    if (seen.has(key) || !ref.filePath) return;
    seen.add(key);
    rows.push({ ...ref, sensitivity });
  };

  for (const ref of insights.entryPoints ?? []) {
    const s = map[ref.id] || map[ref.name];
    if (s) pushRef(ref, s);
  }
  for (const ref of insights.hubs ?? []) {
    const s = map[ref.id] || map[ref.name];
    if (s) pushRef(ref, s);
  }
  for (const stage of insights.mainFlow?.stages ?? []) {
    const s = map[stage.nodeId] || map[stage.name];
    if (s) {
      pushRef(
        {
          id: stage.nodeId,
          name: stage.name,
          kind: 'function',
          filePath: stage.filePath,
          startLine: stage.startLine,
          endLine: stage.endLine
        },
        s
      );
    }
  }

  if (graph) {
    for (const node of graph.nodes) {
      if (node.kind !== 'file') continue;
      const s = map[node.id] || map[node.name];
      if (!s || s.level === 'low') continue;
      pushRef(
        {
          id: node.id,
          name: node.name,
          kind: 'file',
          filePath: node.filePath,
          startLine: node.startLine ?? 1,
          endLine: node.endLine ?? 1
        },
        s
      );
    }
  }

  rows.sort((a, b) => {
    const levelDiff = LEVEL_RANK[b.sensitivity.level] - LEVEL_RANK[a.sensitivity.level];
    if (levelDiff !== 0) return levelDiff;
    return b.sensitivity.score - a.sensitivity.score;
  });
  return rows.slice(0, limit);
}
