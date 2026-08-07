import { CodeGraph, EdgeKind, GraphNode } from './types';

const RELATION_KINDS: ReadonlySet<EdgeKind> = new Set(['calls', 'imports', 'uses', 'extends']);

export interface CentralityScores {
  /** Forward PageRank: node yang sering dituju edge (utility/fondasi). */
  pageRank: Map<string, number>;
  /** Reverse PageRank: node yang banyak menjangkau node penting (entry-like). */
  reversePageRank: Map<string, number>;
  /** Betweenness: jembatan antar jalur (sering controller/handler). */
  betweenness: Map<string, number>;
}

function relationEdges(graph: CodeGraph): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = [];
  for (const edge of graph.edges) {
    if (!RELATION_KINDS.has(edge.kind)) {
      continue;
    }
    if (edge.from === edge.to) {
      continue;
    }
    edges.push({ from: edge.from, to: edge.to });
  }
  return edges;
}

/**
 * PageRank iteratif (damping 0.85).
 * `reverse=true` membalik arah edge → cocok untuk entry detection.
 */
export function computePageRank(
  nodeIds: string[],
  edges: Array<{ from: string; to: string }>,
  options: { reverse?: boolean; damping?: number; iterations?: number } = {}
): Map<string, number> {
  const damping = options.damping ?? 0.85;
  const iterations = options.iterations ?? 20;
  const n = nodeIds.length;
  const scores = new Map<string, number>();
  if (n === 0) {
    return scores;
  }

  const idSet = new Set(nodeIds);
  for (const id of nodeIds) {
    scores.set(id, 1 / n);
  }

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const id of nodeIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }

  for (const edge of edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) {
      continue;
    }
    const from = options.reverse ? edge.to : edge.from;
    const to = options.reverse ? edge.from : edge.to;
    outgoing.get(from)!.push(to);
    incoming.get(to)!.push(from);
  }

  for (let iter = 0; iter < iterations; iter += 1) {
    const next = new Map<string, number>();
    let danglingMass = 0;
    for (const id of nodeIds) {
      if ((outgoing.get(id) ?? []).length === 0) {
        danglingMass += scores.get(id) ?? 0;
      }
    }

    const base = (1 - damping) / n + (damping * danglingMass) / n;
    for (const id of nodeIds) {
      let inbound = 0;
      for (const src of incoming.get(id) ?? []) {
        const outCount = (outgoing.get(src) ?? []).length || 1;
        inbound += (scores.get(src) ?? 0) / outCount;
      }
      next.set(id, base + damping * inbound);
    }

    for (const id of nodeIds) {
      scores.set(id, next.get(id) ?? 0);
    }
  }

  return scores;
}

/**
 * Betweenness centrality (Brandes, unweighted) pada subgraph symbol.
 * Untuk graph besar, sample seed dibatasi agar analisis tetap responsif.
 */
export function computeBetweenness(
  nodeIds: string[],
  edges: Array<{ from: string; to: string }>,
  options: { maxSeeds?: number } = {}
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const id of nodeIds) {
    scores.set(id, 0);
  }
  if (nodeIds.length < 3) {
    return scores;
  }

  const outgoing = new Map<string, string[]>();
  for (const id of nodeIds) {
    outgoing.set(id, []);
  }
  for (const edge of edges) {
    if (!scores.has(edge.from) || !scores.has(edge.to)) {
      continue;
    }
    outgoing.get(edge.from)!.push(edge.to);
  }

  const maxSeeds = options.maxSeeds ?? Math.min(nodeIds.length, 180);
  const seeds =
    nodeIds.length <= maxSeeds
      ? nodeIds
      : pickSpreadSeeds(nodeIds, outgoing, maxSeeds);

  for (const source of seeds) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    for (const id of nodeIds) {
      pred.set(id, []);
      sigma.set(id, 0);
      dist.set(id, -1);
    }
    sigma.set(source, 1);
    dist.set(source, 0);

    const queue: string[] = [source];
    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of outgoing.get(v) ?? []) {
        if ((dist.get(w) ?? -1) < 0) {
          dist.set(w, (dist.get(v) ?? 0) + 1);
          queue.push(w);
        }
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          pred.get(w)!.push(v);
        }
      }
    }

    const delta = new Map<string, number>();
    for (const id of nodeIds) {
      delta.set(id, 0);
    }
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w) ?? []) {
        const share =
          ((sigma.get(v) ?? 0) / Math.max(1, sigma.get(w) ?? 1)) * (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + share);
      }
      if (w !== source) {
        scores.set(w, (scores.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  // Normalisasi kasar 0..1
  let max = 0;
  for (const value of scores.values()) {
    if (value > max) {
      max = value;
    }
  }
  if (max > 0) {
    for (const [id, value] of scores) {
      scores.set(id, value / max);
    }
  }
  return scores;
}

function pickSpreadSeeds(
  nodeIds: string[],
  outgoing: Map<string, string[]>,
  limit: number
): string[] {
  const ranked = nodeIds
    .map((id) => ({ id, out: (outgoing.get(id) ?? []).length }))
    .sort((a, b) => b.out - a.out || a.id.localeCompare(b.id));
  const seeds: string[] = [];
  const step = Math.max(1, Math.floor(ranked.length / limit));
  for (let i = 0; i < ranked.length && seeds.length < limit; i += step) {
    seeds.push(ranked[i].id);
  }
  // pastikan node paling “aktif” ikut
  for (const item of ranked.slice(0, Math.min(20, ranked.length))) {
    if (seeds.length >= limit) {
      break;
    }
    if (!seeds.includes(item.id)) {
      seeds.push(item.id);
    }
  }
  return seeds;
}

export function computeCentrality(graph: CodeGraph, symbolNodes: GraphNode[]): CentralityScores {
  const nodeIds = symbolNodes.map((node) => node.id);
  const edges = relationEdges(graph);
  return {
    pageRank: computePageRank(nodeIds, edges, { reverse: false }),
    reversePageRank: computePageRank(nodeIds, edges, { reverse: true }),
    betweenness: computeBetweenness(nodeIds, edges)
  };
}

/** Nama/path util generik yang sering overvalue di hub ranking. */
export function isGenericUtilityNode(node: GraphNode): boolean {
  const text = `${node.name} ${node.filePath}`.replace(/\\/g, '/');
  if (/\/(utils?|helpers?|common|shared|lib)\//i.test(text)) {
    return true;
  }
  return /\b(util|utils|helper|helpers|format\w*|parse\w*|logger|log|compare|clamp|noop|identity|trim|stringify|toString|debounce|throttle)\b/i.test(
    text
  );
}

export function folderKey(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return parts[0] || '.';
  }
  return parts.slice(0, -1).slice(-2).join('/');
}

/** Rasio caller dari folder berbeda / total in-edges (0..1). */
export function callerModuleDiversity(
  nodeId: string,
  graph: CodeGraph,
  nodeById: Map<string, GraphNode>
): number {
  const callers = new Set<string>();
  let inbound = 0;
  for (const edge of graph.edges) {
    if (!RELATION_KINDS.has(edge.kind) || edge.to !== nodeId) {
      continue;
    }
    inbound += 1;
    const caller = nodeById.get(edge.from);
    if (caller) {
      callers.add(folderKey(caller.filePath));
    }
  }
  if (inbound === 0) {
    return 0;
  }
  return callers.size / inbound;
}

export function kindWeight(node: GraphNode): number {
  switch (node.kind) {
    case 'class':
      return 1.15;
    case 'function':
    case 'method':
      return 1;
    case 'variable':
      return 0.35;
    case 'file':
      return 0.2;
    default:
      return 1;
  }
}

export function normalizeScoreMap(scores: Map<string, number>): Map<string, number> {
  let max = 0;
  for (const value of scores.values()) {
    if (value > max) {
      max = value;
    }
  }
  const out = new Map<string, number>();
  if (max <= 0) {
    for (const id of scores.keys()) {
      out.set(id, 0);
    }
    return out;
  }
  for (const [id, value] of scores) {
    out.set(id, value / max);
  }
  return out;
}
