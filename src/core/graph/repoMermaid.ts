import { CodeGraph, GraphNode } from './types';
import { GraphInsightRef, GraphInsights } from './graphInsights';
import { buildMainFlowMermaid, mainFlowStageId, uniqueMainFlowStages } from './flowMermaid';

const MAX_ENTRY = 5;
const MAX_HUB = 5;
const MAX_SUPPORT = 6;
const MAX_MODULE_FOLDERS = 10;

export type MermaidGraphView = 'architecture' | 'modules' | 'flow' | 'functions';

export interface MermaidNodeMeta {
  id: string;
  mermaidId: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  summary?: string;
}

export interface RepoMermaidBundle {
  architecture: string;
  modules: string;
  flow: string;
  /** Call graph fungsi dalam satu file (+ callee eksternal terbatas). */
  functions: string;
  nodeIndex: Record<string, MermaidNodeMeta>;
  stats: {
    fileCount: number;
    shownFiles: number;
    edgeCount: number;
    truncated: boolean;
  };
}

export interface DiagramNodeTarget {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  role: string;
  startLine: number;
  endLine: number;
}

function escapeLabel(value: string, max = 52): string {
  return value
    .replace(/&/g, '#amp;')
    .replace(/"/g, '#quot;')
    .replace(/[[\]]/g, '')
    .replace(/[{}]/g, '')
    .replace(/[<>]/g, '')
    .replace(/;/g, ',')
    .replace(/\\/g, '/')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'node';
}

function toMermaidId(raw: string, prefix: string, used: Set<string>): string {
  let base = raw.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!base || /^\d/.test(base)) {
    base = `${prefix}_${base || 'n'}`;
  }
  base = base.slice(0, 40);
  let candidate = base;
  let i = 1;
  while (used.has(candidate)) {
    candidate = `${base}_${i}`;
    i += 1;
  }
  used.add(candidate);
  return candidate;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function folderOf(filePath: string): string {
  const normalized = normalizePath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx) : '.';
}

function shortPath(filePath: string): string {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 3) {
    return normalized;
  }
  return parts.slice(-3).join('/');
}

function topFolder(filePath: string, depth = 1): string {
  const folder = folderOf(filePath);
  if (folder === '.') {
    return 'root';
  }
  const parts = folder.split('/').filter(Boolean);
  const meaningful = parts.filter(
    (part) => !/^[A-Za-z]:$/.test(part) && part !== 'home' && part !== 'Users' && part !== 'app'
  );
  const slice = meaningful.slice(-depth);
  return slice.length > 0 ? slice.join('/') : parts.slice(-1)[0] || 'root';
}

function fileNodes(graph: CodeGraph): GraphNode[] {
  return graph.nodes.filter((node) => node.kind === 'file');
}

function resolveFileId(graph: CodeGraph, nodeId: string): string | null {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return null;
  }
  if (node.kind === 'file') {
    return node.id;
  }
  const file = graph.nodes.find((item) => item.kind === 'file' && item.filePath === node.filePath);
  return file?.id ?? null;
}

function buildFileDegrees(graph: CodeGraph): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const node of fileNodes(graph)) {
    degrees.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    if (edge.kind === 'defines') {
      continue;
    }
    const fromFile = resolveFileId(graph, edge.from);
    const toFile = resolveFileId(graph, edge.to);
    if (!fromFile || !toFile || fromFile === toFile) {
      continue;
    }
    degrees.set(fromFile, (degrees.get(fromFile) ?? 0) + 1);
    degrees.set(toFile, (degrees.get(toFile) ?? 0) + 1);
  }
  return degrees;
}

function registerMeta(
  nodeIndex: Record<string, MermaidNodeMeta>,
  mermaidId: string,
  ref: { id: string; name: string; kind: string; filePath: string; startLine: number; endLine: number },
  summaries?: Record<string, string>
): void {
  nodeIndex[mermaidId] = {
    id: ref.id,
    mermaidId,
    name: ref.name,
    kind: ref.kind,
    filePath: ref.filePath,
    startLine: ref.startLine,
    endLine: ref.endLine,
    summary: lookupSummary(summaries, ref)
  };
}

function lookupSummary(
  summaries: Record<string, string> | undefined,
  ref: { id: string; name: string }
): string | undefined {
  if (!summaries) {
    return undefined;
  }
  const direct = summaries[ref.id] || summaries[ref.name];
  if (direct) {
    return direct;
  }
  return undefined;
}

function nodeCard(name: string, filePath: string, summary?: string): string {
  const title = escapeLabel(name, 28);
  const pathLabel = escapeLabel(shortPath(filePath), 36);
  if (summary) {
    return `${title}<br>${pathLabel}<br>${escapeLabel(summary, 78)}`;
  }
  return `${title}<br>${pathLabel}`;
}

function pickUniqueRefs(refs: GraphInsightRef[], limit: number, seen: Set<string>): GraphInsightRef[] {
  const out: GraphInsightRef[] = [];
  for (const ref of refs) {
    const key = normalizePath(ref.filePath) + '#' + ref.name;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(ref);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

/**
 * Daftar node yang akan muncul di diagram arsitektur — untuk diisi penjelasan LLM.
 */
export function collectDiagramSummaryTargets(
  graph: CodeGraph,
  insights?: GraphInsights | null
): DiagramNodeTarget[] {
  const degrees = buildFileDegrees(graph);
  const seen = new Set<string>();
  const targets: DiagramNodeTarget[] = [];

  const push = (
    ref: { id: string; name: string; kind: string; filePath: string; startLine: number; endLine: number },
    role: string
  ): void => {
    const key = normalizePath(ref.filePath) + '#' + ref.name;
    if (seen.has(key) || !ref.filePath) {
      return;
    }
    seen.add(key);
    targets.push({
      id: ref.id,
      name: ref.name,
      kind: ref.kind,
      filePath: ref.filePath,
      role,
      startLine: ref.startLine,
      endLine: ref.endLine
    });
  };

  for (const ref of insights?.entryPoints ?? []) {
    if (targets.filter((item) => item.role === 'entry').length >= MAX_ENTRY) {
      break;
    }
    push(ref, 'entry');
  }

  for (const ref of insights?.hubs ?? []) {
    if (targets.filter((item) => item.role === 'hub').length >= MAX_HUB) {
      break;
    }
    push(ref, 'hub');
  }

  const stages = insights?.mainFlow ? uniqueMainFlowStages(insights.mainFlow).slice(0, 6) : [];
  for (const stage of stages) {
    push(
      {
        id: stage.nodeId,
        name: stage.name,
        kind: 'function',
        filePath: stage.filePath,
        startLine: stage.startLine,
        endLine: stage.endLine
      },
      `pipeline:${stage.role}`
    );
  }

  if (targets.filter((item) => item.role === 'entry').length === 0) {
    for (const file of fileNodes(graph)
      .slice()
      .sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))
      .slice(0, 3)) {
      push(file, 'entry');
    }
  }

  for (const file of fileNodes(graph)
    .slice()
    .sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))) {
    if (targets.filter((item) => item.role === 'support').length >= MAX_SUPPORT) {
      break;
    }
    push(file, 'support');
  }

  return targets;
}

/**
 * Diagram arsitektur berlapis (bukan hairball file):
 * Entry → Core hubs → Main flow → Supporting modules
 */
function buildLayeredArchitectureMermaid(
  graph: CodeGraph,
  insights: GraphInsights | null | undefined,
  nodeIndex: Record<string, MermaidNodeMeta>,
  summaries?: Record<string, string>
): { mermaid: string; shown: number; edges: number } {
  const used = new Set<string>();
  const degrees = buildFileDegrees(graph);
  const seen = new Set<string>();

  const entries = pickUniqueRefs(insights?.entryPoints ?? [], MAX_ENTRY, seen);
  const hubs = pickUniqueRefs(insights?.hubs ?? [], MAX_HUB, seen);

  const supportFiles = fileNodes(graph)
    .filter((node) => !seen.has(normalizePath(node.filePath) + '#' + node.name))
    .sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))
    .slice(0, MAX_SUPPORT);

  const flow = insights?.mainFlow ?? null;
  const stages = flow ? uniqueMainFlowStages(flow).slice(0, 6) : [];

  const lines: string[] = [
    'flowchart TB',
    '  classDef entry fill:#1e3a5f,stroke:#38bdf8,color:#e0f2fe',
    '  classDef hub fill:#134e4a,stroke:#2dd4bf,color:#ecfeff',
    '  classDef layer fill:#0c4a6e,stroke:#7dd3fc,color:#e0f2fe',
    '  classDef support fill:#1f2937,stroke:#94a3b8,color:#e2e8f0',
    '  classDef gate fill:#78350f,stroke:#fbbf24,color:#fffbeb'
  ];

  let shown = 0;
  let edgeCount = 0;
  const entryIds: string[] = [];
  const hubIds: string[] = [];
  const stageIds: string[] = [];
  const supportIds: string[] = [];

  lines.push('  subgraph SG_ENTRY["1 · Entry Points"]');
  lines.push('    direction TB');
  if (entries.length === 0) {
    const fallback = fileNodes(graph)
      .slice()
      .sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))
      .slice(0, 3);
    for (const file of fallback) {
      const mid = toMermaidId(file.name, 'E', used);
      const summary = lookupSummary(summaries, file);
      entryIds.push(mid);
      lines.push(`    ${mid}["${nodeCard(file.name, file.filePath, summary)}"]`);
      lines.push(`    class ${mid} entry`);
      registerMeta(nodeIndex, mid, file, summaries);
      shown += 1;
    }
  } else {
    for (const ref of entries) {
      const mid = toMermaidId(ref.name, 'E', used);
      const summary = lookupSummary(summaries, ref);
      entryIds.push(mid);
      lines.push(`    ${mid}["${nodeCard(ref.name, ref.filePath, summary)}"]`);
      lines.push(`    class ${mid} entry`);
      registerMeta(nodeIndex, mid, ref, summaries);
      shown += 1;
    }
  }
  lines.push('  end');

  lines.push('  subgraph SG_CORE["2 · Core Hubs"]');
  lines.push('    direction TB');
  if (hubs.length === 0) {
    lines.push('    H_NONE["No dominant hub detected"]');
    lines.push('    class H_NONE support');
  } else {
    for (const ref of hubs) {
      const mid = toMermaidId(ref.name, 'H', used);
      const summary = lookupSummary(summaries, ref);
      hubIds.push(mid);
      lines.push(`    ${mid}["${nodeCard(ref.name, ref.filePath, summary)}"]`);
      lines.push(`    class ${mid} hub`);
      registerMeta(nodeIndex, mid, ref, summaries);
      shown += 1;
    }
  }
  lines.push('  end');

  lines.push('  subgraph SG_FLOW["3 · Main Pipeline"]');
  lines.push('    direction LR');
  if (stages.length === 0) {
    lines.push('    P_NONE["Run analysis to detect Input → Process → Output"]');
    lines.push('    class P_NONE support');
  } else {
    stages.forEach((stage, index) => {
      const mid = mainFlowStageId(stage, index);
      used.add(mid);
      stageIds.push(mid);
      const role =
        stage.role === 'input' ? 'Input' : stage.role === 'output' ? 'Output' : `Step ${index}`;
      const summary = lookupSummary(summaries, { id: stage.nodeId, name: stage.name });
      const label = summary
        ? `${escapeLabel(role + ' · ' + stage.name, 40)}<br/>${escapeLabel(shortPath(stage.filePath || stage.name), 34)}<br/>${escapeLabel(summary, 78)}`
        : `${escapeLabel(role + ' · ' + stage.name, 40)}<br/>${escapeLabel(shortPath(stage.filePath || stage.name), 34)}`;
      lines.push(`    ${mid}["${label}"]`);
      lines.push(`    class ${mid} layer`);
      if (stage.filePath) {
        registerMeta(
          nodeIndex,
          mid,
          {
            id: stage.nodeId,
            name: stage.name,
            kind: 'function',
            filePath: stage.filePath,
            startLine: stage.startLine,
            endLine: stage.endLine
          },
          summaries
        );
      }
      shown += 1;
    });
    for (let i = 0; i < stageIds.length - 1; i += 1) {
      lines.push(`    ${stageIds[i]} --> ${stageIds[i + 1]}`);
      edgeCount += 1;
    }
  }
  lines.push('  end');

  lines.push('  subgraph SG_SUPPORT["4 · Supporting Modules"]');
  lines.push('    direction TB');
  if (supportFiles.length === 0) {
    lines.push('    S_NONE["—"]');
    lines.push('    class S_NONE support');
  } else {
    for (const file of supportFiles) {
      const mid = toMermaidId(file.name, 'S', used);
      const summary = lookupSummary(summaries, file);
      supportIds.push(mid);
      lines.push(`    ${mid}["${nodeCard(file.name, file.filePath, summary)}"]`);
      lines.push(`    class ${mid} support`);
      registerMeta(nodeIndex, mid, file, summaries);
      shown += 1;
    }
  }
  lines.push('  end');

  if (entryIds.length && hubIds.length) {
    lines.push(`  ${entryIds[0]} ==> ${hubIds[0]}`);
    edgeCount += 1;
  }
  if (hubIds.length && stageIds.length) {
    lines.push(`  ${hubIds[0]} ==> ${stageIds[0]}`);
    edgeCount += 1;
  } else if (entryIds.length && stageIds.length) {
    lines.push(`  ${entryIds[0]} ==> ${stageIds[0]}`);
    edgeCount += 1;
  }
  if (stageIds.length && supportIds.length) {
    lines.push(`  ${stageIds[stageIds.length - 1]} -.-> ${supportIds[0]}`);
    edgeCount += 1;
  } else if (hubIds.length && supportIds.length) {
    lines.push(`  ${hubIds[0]} -.-> ${supportIds[0]}`);
    edgeCount += 1;
  }

  return { mermaid: lines.join('\n'), shown, edges: edgeCount };
}

function buildModulesMermaid(
  graph: CodeGraph,
  nodeIndex: Record<string, MermaidNodeMeta>
): { mermaid: string; shown: number; edges: number } {
  const used = new Set<string>();
  const degrees = buildFileDegrees(graph);
  const folderFiles = new Map<string, GraphNode[]>();

  for (const node of fileNodes(graph)) {
    const folder = topFolder(node.filePath, 1);
    if (!folderFiles.has(folder)) {
      folderFiles.set(folder, []);
    }
    folderFiles.get(folder)!.push(node);
  }

  const ranked = Array.from(folderFiles.entries())
    .map(([folder, files]) => ({
      folder,
      files,
      score: files.reduce((sum, file) => sum + (degrees.get(file.id) ?? 0), 0) + files.length
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MODULE_FOLDERS);

  const lines: string[] = [
    'flowchart TB',
    '  classDef mod fill:#111827,stroke:#94a3b8,color:#e2e8f0',
    '  classDef hot fill:#134e4a,stroke:#2dd4bf,color:#ecfeff',
    '  subgraph SG_MOD["Module Map"]',
    '    direction LR'
  ];

  const folderId = new Map<string, string>();
  ranked.forEach((item, index) => {
    const mid = toMermaidId(item.folder, 'M', used);
    folderId.set(item.folder, mid);
    const label = `${escapeLabel(item.folder, 24)}<br/>${item.files.length} files`;
    lines.push(`    ${mid}["${label}"]`);
    lines.push(`    class ${mid} ${index < 3 ? 'hot' : 'mod'}`);
    registerMeta(nodeIndex, mid, {
      id: item.files[0].id,
      name: item.folder,
      kind: 'file',
      filePath: item.files[0].filePath,
      startLine: 1,
      endLine: 1
    });
  });
  lines.push('  end');

  let edges = 0;
  const linkWeight = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.kind === 'defines') {
      continue;
    }
    const fromFile = resolveFileId(graph, edge.from);
    const toFile = resolveFileId(graph, edge.to);
    if (!fromFile || !toFile) {
      continue;
    }
    const fromNode = graph.nodes.find((n) => n.id === fromFile);
    const toNode = graph.nodes.find((n) => n.id === toFile);
    if (!fromNode || !toNode) {
      continue;
    }
    const fromFolder = topFolder(fromNode.filePath, 1);
    const toFolder = topFolder(toNode.filePath, 1);
    if (fromFolder === toFolder || !folderId.has(fromFolder) || !folderId.has(toFolder)) {
      continue;
    }
    const key = `${fromFolder}=>${toFolder}`;
    linkWeight.set(key, (linkWeight.get(key) ?? 0) + 1);
  }

  for (const [key, weight] of Array.from(linkWeight.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)) {
    const [fromFolder, toFolder] = key.split('=>');
    const from = folderId.get(fromFolder);
    const to = folderId.get(toFolder);
    if (!from || !to) {
      continue;
    }
    lines.push(`  ${from} -->|${weight}| ${to}`);
    edges += 1;
  }

  return { mermaid: lines.join('\n'), shown: ranked.length, edges };
}

/**
 * Graph penghubung fungsi di dalam satu file (+ callee eksternal terbatas).
 * Dipakai untuk struktur Folder → File → Fungsi + fondasi blast radius.
 */
export function buildFileFunctionMermaid(
  graph: CodeGraph,
  filePath: string,
  nodeIndex: Record<string, MermaidNodeMeta>,
  options: { focusId?: string; maxExternal?: number; summaries?: Record<string, string> } = {}
): { mermaid: string; shown: number; edges: number } {
  const target = normalizePath(filePath);
  const maxExternal = options.maxExternal ?? 12;
  const usedIds = new Set<string>();
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const locals = graph.nodes.filter(
    (node) =>
      (node.kind === 'function' || node.kind === 'class' || node.kind === 'method') &&
      normalizePath(node.filePath) === target
  );

  if (locals.length === 0) {
    return {
      mermaid: [
        'flowchart TB',
        `  empty["No functions in ${escapeLabel(shortPath(target), 40)}"]`
      ].join('\n'),
      shown: 0,
      edges: 0
    };
  }

  const localIds = new Set(locals.map((n) => n.id));
  const idMap = new Map<string, string>();
  const lines: string[] = [
    'flowchart TB',
    `  subgraph file["${escapeLabel(shortPath(target), 48)}"]`,
    '    direction TB'
  ];

  for (const node of locals.slice(0, 40)) {
    const mid = toMermaidId(node.name || node.id, 'fn', usedIds);
    idMap.set(node.id, mid);
    const shape =
      options.focusId && node.id === options.focusId
        ? `{{"${escapeLabel(node.name)}"}}`
        : node.kind === 'class'
          ? `["${escapeLabel(node.name)}"]`
          : `("${escapeLabel(node.name)}")`;
    lines.push(`    ${mid}${shape}`);
    registerMeta(nodeIndex, mid, node, options.summaries);
  }
  lines.push('  end');

  const relationKinds = new Set(['calls', 'uses', 'extends']);
  let edges = 0;
  let externalCount = 0;

  for (const edge of graph.edges) {
    if (!relationKinds.has(edge.kind)) {
      continue;
    }
    const fromLocal = localIds.has(edge.from);
    const toLocal = localIds.has(edge.to);
    if (!fromLocal && !toLocal) {
      continue;
    }
    if (!fromLocal || !toLocal) {
      // external hop — only if one side is local
      if (externalCount >= maxExternal) {
        continue;
      }
    }

    let fromId = idMap.get(edge.from);
    let toId = idMap.get(edge.to);

    if (!fromId) {
      const node = nodeById.get(edge.from);
      if (!node || node.kind === 'file') {
        continue;
      }
      fromId = toMermaidId(`ext_${node.name}`, 'ex', usedIds);
      idMap.set(edge.from, fromId);
      lines.push(`  ${fromId}(["${escapeLabel(node.name)}"])`);
      registerMeta(nodeIndex, fromId, node, options.summaries);
      externalCount += 1;
    }
    if (!toId) {
      const node = nodeById.get(edge.to);
      if (!node || node.kind === 'file') {
        continue;
      }
      toId = toMermaidId(`ext_${node.name}`, 'ex', usedIds);
      idMap.set(edge.to, toId);
      lines.push(`  ${toId}(["${escapeLabel(node.name)}"])`);
      registerMeta(nodeIndex, toId, node, options.summaries);
      externalCount += 1;
    }

    const label = edge.kind === 'calls' ? '' : `|${edge.kind}|`;
    lines.push(`  ${fromId} -->${label} ${toId}`);
    edges += 1;
  }

  if (edges === 0) {
    lines.push('  note["Functions listed · no call/use edges detected"]');
  }

  return { mermaid: lines.join('\n'), shown: locals.length, edges };
}

/** Pilih file default untuk tab Fungsi bila user belum klik Struktur. */
export function pickDefaultFunctionFile(
  graph: CodeGraph,
  insights?: GraphInsights | null
): string | undefined {
  const fromEntry = insights?.entryPoints?.find((entry) => entry.filePath?.trim())?.filePath;
  if (fromEntry) {
    return normalizePath(fromEntry);
  }

  const fromFlow = insights?.mainFlow?.stages?.find((stage) => stage.filePath?.trim())?.filePath;
  if (fromFlow) {
    return normalizePath(fromFlow);
  }

  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.kind !== 'function' && node.kind !== 'class' && node.kind !== 'method') {
      continue;
    }
    const filePath = normalizePath(node.filePath);
    if (!filePath) {
      continue;
    }
    counts.set(filePath, (counts.get(filePath) ?? 0) + 1);
  }

  let best: string | undefined;
  let bestCount = 0;
  for (const [filePath, count] of counts) {
    if (count > bestCount) {
      best = filePath;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Susun paket diagram Mermaid informatif (layered architecture, bukan file hairball).
 */
export function buildRepoMermaidBundle(
  graph: CodeGraph,
  insights?: GraphInsights | null,
  options: { functionFilePath?: string; focusNodeId?: string } = {}
): RepoMermaidBundle {
  const nodeIndex: Record<string, MermaidNodeMeta> = {};
  const totalFiles = fileNodes(graph).length;
  const summaries = insights?.nodeSummaries;

  const architecture =
    totalFiles > 0
      ? buildLayeredArchitectureMermaid(graph, insights, nodeIndex, summaries)
      : {
          mermaid: ['flowchart TB', '  empty["No files to diagram yet"]'].join('\n'),
          shown: 0,
          edges: 0
        };

  const modules =
    totalFiles > 0
      ? buildModulesMermaid(graph, nodeIndex)
      : {
          mermaid: ['flowchart TB', '  empty["No modules"]'].join('\n'),
          shown: 0,
          edges: 0
        };

  const flow =
    insights?.mainFlow?.mermaid?.trim() ||
    (insights?.mainFlow ? buildMainFlowMermaid(insights.mainFlow) : '') ||
    ['flowchart LR', '  empty["Main flow not detected yet"]'].join('\n');

  if (insights?.mainFlow) {
    uniqueMainFlowStages(insights.mainFlow).forEach((stage, index) => {
      const mid = mainFlowStageId(stage, index);
      if (stage.filePath && !nodeIndex[mid]) {
        registerMeta(
          nodeIndex,
          mid,
          {
            id: stage.nodeId,
            name: stage.name,
            kind: 'function',
            filePath: stage.filePath,
            startLine: stage.startLine,
            endLine: stage.endLine
          },
          summaries
        );
      }
    });
  }

  const functionFilePath = options.functionFilePath ?? pickDefaultFunctionFile(graph, insights);
  const functions = functionFilePath
    ? buildFileFunctionMermaid(graph, functionFilePath, nodeIndex, {
        focusId: options.focusNodeId,
        summaries
      }).mermaid
    : [
        'flowchart TB',
        '  tip["Pilih file/fungsi di sidebar Struktur"]'
      ].join('\n');

  return {
    architecture: architecture.mermaid,
    modules: modules.mermaid,
    flow,
    functions,
    nodeIndex,
    stats: {
      fileCount: totalFiles,
      shownFiles: architecture.shown,
      edgeCount: architecture.edges,
      truncated: totalFiles > architecture.shown
    }
  };
}
