import { traceFrom } from './graphBuilder';
import { CodeGraph, EdgeKind, GraphNode, NodeKind } from './types';

const ENTRY_LIMIT = 6;
const HUB_LIMIT = 6;
const FLOW_LIMIT = 5;
const FLOW_DEPTH = 4;
const ORPHAN_LIMIT = 6;

export type FlowStageRole = 'input' | 'process' | 'output';

export interface GraphInsightRef {
  id: string;
  name: string;
  kind: NodeKind;
  filePath: string;
  startLine: number;
  endLine: number;
  score: number;
  reason: string;
}

export interface GraphInsightFlowStage {
  role: FlowStageRole;
  name: string;
  nodeId: string;
  filePath: string;
}

export interface GraphInsightFlow {
  id: string;
  label: string;
  nodeIds: string[];
  steps: string[];
  /** Nama node yang berperan sebagai input data. */
  input: string;
  /** Node di tengah alur (transform / service / helper). */
  process: string[];
  /** Nama node yang berperan sebagai output / hasil. */
  output: string;
  stages: GraphInsightFlowStage[];
  /** Skor seberapa jelas ini terlihat seperti alur data I/O. */
  ioScore: number;
}

export interface GraphInsightStats {
  nodeCount: number;
  edgeCount: number;
  nodesByKind: Partial<Record<NodeKind, number>>;
  edgesByKind: Partial<Record<EdgeKind, number>>;
}

export interface GraphInsights {
  generatedAt: string;
  entryPoints: GraphInsightRef[];
  hubs: GraphInsightRef[];
  /** Flow data utama: Input → Proses → Output. */
  mainFlow: GraphInsightFlow | null;
  keyFlows: GraphInsightFlow[];
  orphanFiles: GraphInsightRef[];
  stats: GraphInsightStats;
  summaryBullets: string[];
  narrative?: string;
}

interface DegreeInfo {
  inDegree: number;
  outDegree: number;
  inCalls: number;
  outCalls: number;
  inImports: number;
  outImports: number;
  inUses: number;
  outUses: number;
}

const INPUT_PATTERN =
  /\b(input|form|picker|upload|login|signup|sign-?in|search|filter|textarea|checkbox|slider|select|request|payload|query|param|submit|editor|create|edit|wizard|modal|drawer|field|button|handler|webhook|controller|route)\b/i;
const OUTPUT_PATTERN =
  /\b(table|list|grid|chart|display|badge|card|toast|alert|notification|export|download|render|view|page|dashboard|result|response|preview|detail|summary|report|panel|screen|output)\b/i;
const PROCESS_PATTERN =
  /\b(service|util|utils|helper|api|fetch|store|reducer|mapper|transform|format|validat|middleware|provider|hook|mutation|parse|build|adapter|client|repo|repository|usecase|use-case)\b/i;

function emptyDegree(): DegreeInfo {
  return {
    inDegree: 0,
    outDegree: 0,
    inCalls: 0,
    outCalls: 0,
    inImports: 0,
    outImports: 0,
    inUses: 0,
    outUses: 0
  };
}

function toRef(node: GraphNode, score: number, reason: string): GraphInsightRef {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    filePath: node.filePath,
    startLine: node.startLine,
    endLine: node.endLine,
    score,
    reason
  };
}

function buildDegreeMap(graph: CodeGraph): Map<string, DegreeInfo> {
  const degrees = new Map<string, DegreeInfo>();
  for (const node of graph.nodes) {
    degrees.set(node.id, emptyDegree());
  }

  for (const edge of graph.edges) {
    if (edge.kind === 'defines') {
      continue;
    }

    const from = degrees.get(edge.from) ?? emptyDegree();
    const to = degrees.get(edge.to) ?? emptyDegree();
    from.outDegree += 1;
    to.inDegree += 1;

    if (edge.kind === 'calls') {
      from.outCalls += 1;
      to.inCalls += 1;
    } else if (edge.kind === 'imports') {
      from.outImports += 1;
      to.inImports += 1;
    } else if (edge.kind === 'uses') {
      from.outUses += 1;
      to.inUses += 1;
    }

    degrees.set(edge.from, from);
    degrees.set(edge.to, to);
  }

  return degrees;
}

function countByKind<T extends string>(items: T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

function nodeText(node: GraphNode): string {
  return `${node.name} ${node.filePath}`;
}

function classifyHint(node: GraphNode): FlowStageRole | null {
  const text = nodeText(node);
  if (INPUT_PATTERN.test(text)) {
    return 'input';
  }
  if (OUTPUT_PATTERN.test(text)) {
    return 'output';
  }
  if (PROCESS_PATTERN.test(text)) {
    return 'process';
  }
  return null;
}

/**
 * Tetapkan peran Input / Proses / Output pada path graph.
 * Aturan: ujung kiri = input, ujung kanan = output, tengah = proses —
 * lalu override dengan hint nama/path bila jelas.
 */
function assignStages(pathNodes: GraphNode[]): GraphInsightFlowStage[] {
  if (pathNodes.length === 0) {
    return [];
  }

  if (pathNodes.length === 1) {
    const hint = classifyHint(pathNodes[0]) ?? 'process';
    return [
      {
        role: hint,
        name: pathNodes[0].name,
        nodeId: pathNodes[0].id,
        filePath: pathNodes[0].filePath
      }
    ];
  }

  const roles: FlowStageRole[] = pathNodes.map((node, index) => {
    const hint = classifyHint(node);
    if (hint) {
      return hint;
    }
    if (index === 0) {
      return 'input';
    }
    if (index === pathNodes.length - 1) {
      return 'output';
    }
    return 'process';
  });

  // Pastikan ujung tetap terbaca sebagai I/O untuk onboarding
  if (roles[0] === 'output') {
    roles[0] = 'input';
  }
  if (roles[roles.length - 1] === 'input') {
    roles[roles.length - 1] = 'output';
  }

  return pathNodes.map((node, index) => ({
    role: roles[index],
    name: node.name,
    nodeId: node.id,
    filePath: node.filePath
  }));
}

function scoreIoFlow(stages: GraphInsightFlowStage[]): number {
  if (stages.length < 2) {
    return 0;
  }

  const first = stages[0];
  const last = stages[stages.length - 1];
  const hasProcess = stages.some((stage) => stage.role === 'process');
  let score = stages.length * 2;

  if (first.role === 'input') {
    score += 10;
  }
  if (last.role === 'output') {
    score += 10;
  }
  if (first.role === 'input' && last.role === 'output') {
    score += 8;
  }
  if (hasProcess) {
    score += 4;
  }
  if (INPUT_PATTERN.test(`${first.name} ${first.filePath}`)) {
    score += 6;
  }
  if (OUTPUT_PATTERN.test(`${last.name} ${last.filePath}`)) {
    score += 6;
  }

  return score;
}

function toFlow(pathNodes: GraphNode[]): GraphInsightFlow {
  const stages = assignStages(pathNodes);
  const inputStage = stages.find((stage) => stage.role === 'input') ?? stages[0];
  const outputStage = [...stages].reverse().find((stage) => stage.role === 'output') ?? stages[stages.length - 1];
  const processNames = stages
    .filter((stage) => stage.role === 'process')
    .map((stage) => stage.name)
    .filter((name) => name !== inputStage.name && name !== outputStage.name);

  const steps = pathNodes.map((node) => node.name);
  const label = `Input: ${inputStage.name} → Output: ${outputStage.name}`;

  return {
    id: `flow:${pathNodes.map((node) => node.id).join('>')}`,
    label,
    nodeIds: pathNodes.map((node) => node.id),
    steps,
    input: inputStage.name,
    process: processNames,
    output: outputStage.name,
    stages,
    ioScore: scoreIoFlow(stages)
  };
}

function pickEntryPoints(graph: CodeGraph, degrees: Map<string, DegreeInfo>): GraphInsightRef[] {
  const candidates = graph.nodes
    .filter((node) => node.kind !== 'file')
    .map((node) => {
      const degree = degrees.get(node.id) ?? emptyDegree();
      const hint = classifyHint(node);
      const score =
        degree.outCalls * 3 +
        degree.outUses * 2 +
        degree.outImports +
        Math.max(0, 2 - degree.inDegree) +
        (node.name === 'main' || /^(app|index|page|layout|bootstrap|Sidebar)$/i.test(node.name) ? 4 : 0) +
        (hint === 'input' ? 5 : 0);
      return { node, degree, score };
    })
    .filter((item) => item.score > 0 && (item.degree.outDegree > 0 || item.degree.outCalls > 0 || item.degree.outUses > 0))
    .sort((left, right) => right.score - left.score || left.node.name.localeCompare(right.node.name));

  return candidates.slice(0, ENTRY_LIMIT).map((item) =>
    toRef(
      item.node,
      item.score,
      `${item.degree.outCalls} call, ${item.degree.outUses} use, ${item.degree.inDegree} incoming`
    )
  );
}

function pickHubs(graph: CodeGraph, degrees: Map<string, DegreeInfo>): GraphInsightRef[] {
  const candidates = graph.nodes
    .map((node) => {
      const degree = degrees.get(node.id) ?? emptyDegree();
      const score = degree.inImports * 3 + degree.inCalls * 3 + degree.inUses * 2 + degree.inDegree;
      return { node, degree, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.node.name.localeCompare(right.node.name));

  return candidates.slice(0, HUB_LIMIT).map((item) =>
    toRef(
      item.node,
      item.score,
      `di-import ${item.degree.inImports}x, dipanggil ${item.degree.inCalls}x, dipakai ${item.degree.inUses}x`
    )
  );
}

function pickOrphanFiles(graph: CodeGraph, degrees: Map<string, DegreeInfo>): GraphInsightRef[] {
  return graph.nodes
    .filter((node) => node.kind === 'file')
    .filter((node) => {
      const degree = degrees.get(node.id) ?? emptyDegree();
      return degree.inDegree === 0 && degree.outDegree === 0;
    })
    .slice(0, ORPHAN_LIMIT)
    .map((node) => toRef(node, 0, 'Tidak punya relasi imports/calls/uses ke file lain'));
}

function pickKeyFlows(graph: CodeGraph, entryPoints: GraphInsightRef[]): GraphInsightFlow[] {
  const flows: GraphInsightFlow[] = [];
  const seenLabels = new Set<string>();
  const seenKeys = new Set<string>();

  const seeds = [
    ...entryPoints.map((entry) => entry.id),
    ...graph.nodes
      .filter((node) => node.kind !== 'file' && classifyHint(node) === 'input')
      .map((node) => node.id)
  ];

  for (const seedId of [...new Set(seeds)]) {
    const paths = traceFrom(graph, seedId, FLOW_DEPTH)
      .filter((path) => path.length >= 2)
      .sort(
        (left, right) =>
          right.length - left.length ||
          left
            .map((n) => n.name)
            .join('>')
            .localeCompare(right.map((n) => n.name).join('>'))
      );

    for (const path of paths) {
      const flow = toFlow(path);
      const key = flow.nodeIds.join('>');
      const ioKey = `${flow.input}|${flow.output}`;
      if (seenKeys.has(key) || seenLabels.has(ioKey)) {
        continue;
      }
      seenKeys.add(key);
      seenLabels.add(ioKey);
      flows.push(flow);
    }
  }

  return flows
    .sort((left, right) => right.ioScore - left.ioScore || right.steps.length - left.steps.length)
    .slice(0, FLOW_LIMIT);
}

function buildSummaryBullets(
  insights: Omit<GraphInsights, 'summaryBullets' | 'narrative' | 'generatedAt'>
): string[] {
  const bullets: string[] = [];
  bullets.push(
    `Graph punya ${insights.stats.nodeCount} node dan ${insights.stats.edgeCount} edge` +
      ` (${insights.stats.edgesByKind.imports ?? 0} imports, ${insights.stats.edgesByKind.calls ?? 0} calls, ${insights.stats.edgesByKind.uses ?? 0} uses).`
  );

  if (insights.mainFlow) {
    const processPart =
      insights.mainFlow.process.length > 0 ? ` lewat ${insights.mainFlow.process.join(', ')}` : '';
    bullets.push(
      `Flow utama data: Input ${insights.mainFlow.input}${processPart} → Output ${insights.mainFlow.output}.`
    );
  } else if (insights.keyFlows.length > 0) {
    bullets.push(`Alur utama: ${insights.keyFlows[0].label}.`);
  }

  if (insights.entryPoints.length > 0) {
    bullets.push(
      `Titik masuk yang menonjol: ${insights.entryPoints
        .slice(0, 3)
        .map((item) => item.name)
        .join(', ')}.`
    );
  }

  if (insights.hubs.length > 0) {
    bullets.push(
      `Hub yang sering dipakai: ${insights.hubs
        .slice(0, 3)
        .map((item) => item.name)
        .join(', ')}.`
    );
  }

  if (insights.orphanFiles.length > 0) {
    bullets.push(
      `${insights.orphanFiles.length} file terlihat terisolasi (tanpa relasi antar-file), misalnya ${insights.orphanFiles[0].name}.`
    );
  }

  return bullets;
}

/**
 * Infer entry points, hubs, dan alur utama (Input → Output) dari CodeGraph.
 */
export function buildGraphInsights(graph: CodeGraph): GraphInsights {
  const degrees = buildDegreeMap(graph);
  const entryPoints = pickEntryPoints(graph, degrees);
  const hubs = pickHubs(graph, degrees);
  const orphanFiles = pickOrphanFiles(graph, degrees);
  const keyFlows = pickKeyFlows(graph, entryPoints);
  const mainFlow = keyFlows.length > 0 ? keyFlows[0] : null;

  const stats: GraphInsightStats = {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodesByKind: countByKind(graph.nodes.map((node) => node.kind)),
    edgesByKind: countByKind(graph.edges.map((edge) => edge.kind))
  };

  const partial = { entryPoints, hubs, mainFlow, keyFlows, orphanFiles, stats };
  return {
    generatedAt: new Date().toISOString(),
    ...partial,
    summaryBullets: buildSummaryBullets(partial)
  };
}
