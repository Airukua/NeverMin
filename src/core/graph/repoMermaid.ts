import { CodeGraph, GraphNode } from './types';
import { GraphInsightRef, GraphInsights } from './graphInsights';
import { buildMainFlowMermaid, mainFlowStageId, uniqueMainFlowStages } from './flowMermaid';
import {
  inferNodeIcon,
  isNodeCardIcon,
  NodeCardIcon
} from './nodeCardIcons';
import { t } from '../../i18n';
import { getLanguage } from '../../utils/config';

export type { NodeCardIcon } from './nodeCardIcons';
export { inferNodeIcon, isNodeCardIcon, NODE_CARD_ICONS } from './nodeCardIcons';

const MAX_ENTRY = 5;
const MAX_HUB = 5;
const MAX_SUPPORT = 6;
const MAX_MODULE_FOLDERS = 10;

export type MermaidGraphView = 'architecture' | 'modules' | 'flow' | 'functions' | 'git';

export interface MermaidNodeMeta {
  id: string;
  mermaidId: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  summary?: string;
  expandKey?: string;
}

export type GraphCardRole = 'entry' | 'hub' | 'pipeline' | 'support';

export interface GraphViewNode {
  id: string;
  name: string;
  filePath: string;
  kind: string;
  role: GraphCardRole;
  summary?: string;
  iconKey?: string;
  startLine: number;
  endLine: number;
  row: number;
  col: number;
  /** Bila diisi: klik di tab Functions membuka grup file ini (bukan editor). */
  expandKey?: string;
}

export interface GraphViewEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
}

/** Label baris/grup di canvas (Entry / Hub / Pipeline, …). */
export interface GraphViewSection {
  row: number;
  label: string;
  hint?: string;
  role?: GraphCardRole;
}

export interface GraphViewModel {
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
  emptyMessage?: string;
  sections?: GraphViewSection[];
}

export interface RepoMermaidBundle {
  architecture: string;
  modules: string;
  flow: string;
  /** Call graph fungsi dalam satu file (+ callee eksternal terbatas). */
  functions: string;
  nodeIndex: Record<string, MermaidNodeMeta>;
  /** Structured React Flow views (kartu node yang sama di semua tab). */
  views: {
    architecture: GraphViewModel;
    modules: GraphViewModel;
    flow: GraphViewModel;
    /** Overview file tertutup — klik kartu untuk buka isi fungsi. */
    functions: GraphViewModel;
  };
  /** Detail fungsi per file (key = normalized file path). */
  functionGroups: Record<string, GraphViewModel>;
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

/** Teks di dalam HTML card — aman untuk htmlLabels Mermaid (tanpa kutip / tag). */
function escapeCardText(value: string, max = 96): string {
  return escapeLabel(value, max);
}

function fileBaseName(filePath: string): string {
  const normalized = normalizePath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function folderBadge(filePath: string): string {
  const folder = folderOf(filePath);
  if (!folder || folder === '.') {
    return 'root';
  }
  const parts = folder.split('/').filter(Boolean);
  return parts.slice(-2).join('/') || 'root';
}

function displayTitle(name: string, filePath: string): string {
  const raw = name.includes('/') || name.includes('\\') ? fileBaseName(name) : name;
  const stripped = raw.replace(/\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|cs)$/i, '');
  if (stripped) {
    return stripped;
  }
  return fileBaseName(filePath).replace(/\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|cs)$/i, '') || raw;
}

function resolveCardIcon(
  name: string,
  filePath: string,
  options?: { role?: string; kind?: string; icon?: string }
): NodeCardIcon {
  if (options?.icon && isNodeCardIcon(options.icon)) {
    return options.icon;
  }
  return inferNodeIcon(name, { kind: options?.kind, filePath });
}

/**
 * Kartu horizontal. Ikon = data-icon (hydrate Lucide di webview —
 * Mermaid memotong SVG mentah di htmlLabels).
 */
function fallbackCardSummary(name: string, filePath: string, options?: { role?: string; kind?: string }): string {
  const title = displayTitle(name, filePath);
  const role = (options?.role || '').toLowerCase();
  const lang = getLanguage();
  if (role === 'entry' || role === 'input') {
    return t('graph.card.entry', { name: title }, lang);
  }
  if (role === 'hub') {
    return t('graph.card.hub', { name: title }, lang);
  }
  if (role === 'output') {
    return t('graph.card.output', { name: title }, lang);
  }
  if (role.startsWith('step') || role === 'support') {
    return t('graph.card.step', { name: title }, lang);
  }
  if ((options?.kind || '').toLowerCase() === 'file') {
    return t('graph.card.file', { name: title }, lang);
  }
  return t('graph.card.component', { name: title }, lang);
}

function nodeCard(
  name: string,
  filePath: string,
  summary?: string,
  options?: { role?: string; kind?: string; icon?: string }
): string {
  const title = escapeCardText(displayTitle(name, filePath), 36);
  const file = escapeCardText(fileBaseName(filePath || name), 42);
  const badge = escapeCardText(folderBadge(filePath || name), 22);
  const icon = resolveCardIcon(name, filePath, options);
  const hasLlmSummary = Boolean(summary?.trim());
  const body = escapeCardText(
    hasLlmSummary ? summary!.trim() : fallbackCardSummary(name, filePath, options),
    110
  );

  return (
    `<div class=nm-card>` +
    `<div class=nm-card-row>` +
    `<div class=nm-card-icon-col>` +
    `<span class=nm-ico-wrap data-icon=${icon}></span>` +
    `</div>` +
    `<div class=nm-card-main>` +
    `<div class=nm-card-head>` +
    `<div class=nm-card-title>${title}</div>` +
    `<div class=nm-card-badge><span class=nm-badge-ico data-icon=folder></span><span class=nm-card-badge-text>${badge}</span></div>` +
    `</div>` +
    `<div class=nm-card-file>${file}</div>` +
    `<div class=nm-card-rule></div>` +
    (hasLlmSummary
      ? `<div class=nm-card-body>${body}</div>`
      : `<div class=nm-card-body-pending>${body}</div>`) +
    `</div>` +
    `</div>` +
    `</div>`
  );
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

/** Kunci folder yang sama dengan kartu Modules (topFolder depth 1). */
export function moduleFolderKey(filePath: string): string {
  return topFolder(filePath, 1);
}

export interface ModuleFolderFileInfo {
  filePath: string;
  name: string;
  symbols: Array<{
    id: string;
    name: string;
    kind: string;
    startLine: number;
    endLine: number;
  }>;
}

/** Semua file (+ simbol AST/WASM) di dalam folder module yang sama. */
export function collectModuleFolderFiles(
  graph: CodeGraph,
  folderKey: string
): ModuleFolderFileInfo[] {
  const key = folderKey.trim() || 'root';
  const files = fileNodes(graph).filter((node) => moduleFolderKey(node.filePath) === key);
  return files
    .map((file) => {
      const symbols = graph.nodes
        .filter(
          (node) =>
            (node.kind === 'function' || node.kind === 'class' || node.kind === 'method') &&
            normalizePath(node.filePath) === normalizePath(file.filePath)
        )
        .map((node) => ({
          id: node.id,
          name: node.name,
          kind: node.kind,
          startLine: node.startLine,
          endLine: node.endLine
        }))
        .sort((a, b) => a.startLine - b.startLine);
      return {
        filePath: normalizePath(file.filePath),
        name: file.name,
        symbols
      };
    })
    .sort((a, b) => a.filePath.localeCompare(b.filePath));
}

/**
 * Mermaid flowchart folder: subgraph per file + fungsi di dalamnya + edge calls/uses.
 * Untuk konteks Explain Modules.
 */
export function buildModuleFolderMermaid(
  graph: CodeGraph,
  folderKey: string,
  options: { maxFiles?: number; maxSymbolsPerFile?: number; maxEdges?: number } = {}
): string {
  const maxFiles = options.maxFiles ?? 12;
  const maxSymbolsPerFile = options.maxSymbolsPerFile ?? 16;
  const maxEdges = options.maxEdges ?? 48;
  const files = collectModuleFolderFiles(graph, folderKey).slice(0, maxFiles);
  if (files.length === 0) {
    return [
      'flowchart TB',
      `  empty["No files in ${escapeLabel(folderKey || 'module', 40)}"]`
    ].join('\n');
  }

  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();
  const localIds = new Set<string>();
  const lines: string[] = [
    'flowchart TB',
    `  subgraph mod["${escapeLabel(folderKey, 48)}"]`,
    '    direction TB'
  ];

  for (const file of files) {
    const fileMid = toMermaidId(file.name || shortPath(file.filePath), 'f', usedIds);
    lines.push(`    subgraph ${fileMid}["${escapeLabel(shortPath(file.filePath), 40)}"]`);
    lines.push('      direction TB');
    const symbols = file.symbols.slice(0, maxSymbolsPerFile);
    if (symbols.length === 0) {
      const emptyMid = toMermaidId(`${file.name}_empty`, 'e', usedIds);
      lines.push(`      ${emptyMid}["(no symbols)"]`);
    } else {
      for (const symbol of symbols) {
        const mid = toMermaidId(symbol.name || symbol.id, 'fn', usedIds);
        idMap.set(symbol.id, mid);
        localIds.add(symbol.id);
        const shape =
          symbol.kind === 'class'
            ? `["${escapeLabel(symbol.name)}"]`
            : `("${escapeLabel(symbol.name)}")`;
        lines.push(`      ${mid}${shape}`);
      }
    }
    lines.push('    end');
  }
  lines.push('  end');

  const relationKinds = new Set(['calls', 'uses', 'extends']);
  let edges = 0;
  for (const edge of graph.edges) {
    if (edges >= maxEdges) break;
    if (!relationKinds.has(edge.kind)) continue;
    if (!localIds.has(edge.from) || !localIds.has(edge.to)) continue;
    const fromId = idMap.get(edge.from);
    const toId = idMap.get(edge.to);
    if (!fromId || !toId || fromId === toId) continue;
    const label = edge.kind === 'calls' ? '' : `|${edge.kind}|`;
    lines.push(`  ${fromId} -->${label} ${toId}`);
    edges += 1;
  }

  if (edges === 0) {
    lines.push('  note["Files & symbols listed · no internal call edges"]');
  }

  return lines.join('\n');
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

function lookupIcon(
  icons: Record<string, string> | undefined,
  ref: { id: string; name: string; kind?: string; filePath?: string }
): string | undefined {
  if (icons) {
    const raw = icons[ref.id] || icons[ref.name];
    if (raw && isNodeCardIcon(raw)) {
      return raw;
    }
  }
  return undefined;
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
  summaries?: Record<string, string>,
  icons?: Record<string, string>
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
  const stages = flow ? uniqueMainFlowStages(flow).slice(0, 4) : [];

  const lines: string[] = [
    'flowchart TB',
    '  classDef entry fill:#121A2B,stroke:#2DD4BF,color:#E8ECF4,stroke-width:1.5px',
    '  classDef hub fill:#121A2B,stroke:#F0B429,color:#E8ECF4,stroke-width:1.5px',
    '  classDef layer fill:#121A2B,stroke:#3B82F6,color:#E8ECF4,stroke-width:1.5px',
    '  classDef support fill:#121A2B,stroke:#64748B,color:#E8ECF4,stroke-width:1.5px',
    '  classDef gate fill:#121A2B,stroke:#F0B429,color:#E8ECF4,stroke-width:1.5px'
  ];

  let shown = 0;
  let edgeCount = 0;
  const entryIds: string[] = [];
  const hubIds: string[] = [];
  const stageIds: string[] = [];
  const supportIds: string[] = [];

  lines.push(`  subgraph SG_ENTRY["${t('graph.arch.section.entry')}"]`);
  lines.push('    direction LR');
  if (entries.length === 0) {
    const fallback = fileNodes(graph)
      .slice()
      .sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))
      .slice(0, 3);
    for (const file of fallback) {
      const mid = toMermaidId(file.name, 'E', used);
      const summary = lookupSummary(summaries, file);
      entryIds.push(mid);
      lines.push(
        `    ${mid}["${nodeCard(file.name, file.filePath, summary, {
          role: 'Entry',
          kind: file.kind,
          icon: lookupIcon(icons, file)
        })}"]`
      );
      lines.push(`    class ${mid} entry`);
      registerMeta(nodeIndex, mid, file, summaries);
      shown += 1;
    }
  } else {
    for (const ref of entries) {
      const mid = toMermaidId(ref.name, 'E', used);
      const summary = lookupSummary(summaries, ref);
      entryIds.push(mid);
      lines.push(
        `    ${mid}["${nodeCard(ref.name, ref.filePath, summary, {
          role: 'Entry',
          kind: ref.kind,
          icon: lookupIcon(icons, ref)
        })}"]`
      );
      lines.push(`    class ${mid} entry`);
      registerMeta(nodeIndex, mid, ref, summaries);
      shown += 1;
    }
  }
  lines.push('  end');

  lines.push(`  subgraph SG_CORE["${t('graph.arch.section.hub')}"]`);
  lines.push('    direction LR');
  if (hubs.length === 0) {
    lines.push('    H_NONE["No dominant hub detected"]');
    lines.push('    class H_NONE support');
  } else {
    for (const ref of hubs) {
      const mid = toMermaidId(ref.name, 'H', used);
      const summary = lookupSummary(summaries, ref);
      hubIds.push(mid);
      lines.push(
        `    ${mid}["${nodeCard(ref.name, ref.filePath, summary, {
          role: 'Hub',
          kind: ref.kind,
          icon: lookupIcon(icons, ref)
        })}"]`
      );
      lines.push(`    class ${mid} hub`);
      registerMeta(nodeIndex, mid, ref, summaries);
      shown += 1;
    }
  }
  lines.push('  end');

  lines.push(`  subgraph SG_FLOW["${t('graph.arch.section.pipeline')}"]`);
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
      lines.push(
        `    ${mid}["${nodeCard(stage.name, stage.filePath || stage.name, summary, {
          role,
          kind: 'function',
          icon: lookupIcon(icons, {
            id: stage.nodeId,
            name: stage.name,
            kind: 'function',
            filePath: stage.filePath
          })
        })}"]`
      );
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

  lines.push(`  subgraph SG_SUPPORT["${t('graph.arch.section.support')}"]`);
  lines.push('    direction LR');
  if (supportFiles.length === 0) {
    lines.push('    S_NONE["—"]');
    lines.push('    class S_NONE support');
  } else {
    for (const file of supportFiles) {
      const mid = toMermaidId(file.name, 'S', used);
      const summary = lookupSummary(summaries, file);
      supportIds.push(mid);
      lines.push(
        `    ${mid}["${nodeCard(file.name, file.filePath, summary, {
          role: 'Support',
          kind: file.kind,
          icon: lookupIcon(icons, file)
        })}"]`
      );
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
    '  classDef mod fill:#1A2438,stroke:#64748B,color:#E8ECF4,stroke-width:3px',
    '  classDef hot fill:#1A2438,stroke:#2DD4BF,color:#E8ECF4,stroke-width:3px',
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

function emptyView(message: string): GraphViewModel {
  return { nodes: [], edges: [], emptyMessage: message };
}

export function emptyGraphViews(message = 'No graph'): RepoMermaidBundle['views'] {
  const empty = emptyView(message);
  return {
    architecture: empty,
    modules: empty,
    flow: empty,
    functions: empty
  };
}

function cardFromRef(
  id: string,
  ref: { id: string; name: string; kind: string; filePath: string; startLine: number; endLine: number },
  role: GraphCardRole,
  row: number,
  col: number,
  summaries?: Record<string, string>,
  icons?: Record<string, string>
): GraphViewNode {
  return {
    id,
    name: ref.name,
    filePath: ref.filePath,
    kind: ref.kind,
    role,
    summary: lookupSummary(summaries, ref),
    iconKey: lookupIcon(icons, ref) || inferNodeIcon(ref.name, { kind: ref.kind, filePath: ref.filePath }),
    startLine: ref.startLine,
    endLine: ref.endLine,
    row,
    col
  };
}

function buildArchitectureView(
  insights?: GraphInsights | null,
  summaries?: Record<string, string>,
  icons?: Record<string, string>
): GraphViewModel {
  if (!insights) {
    return emptyView(t('graph.arch.empty'));
  }
  const nodes: GraphViewNode[] = [];
  const edges: GraphViewEdge[] = [];
  const entries = (insights.entryPoints ?? []).slice(0, MAX_ENTRY);
  const hubs = (insights.hubs ?? []).slice(0, MAX_HUB);
  const stages = insights.mainFlow ? uniqueMainFlowStages(insights.mainFlow).slice(0, 4) : [];

  const entryIds = entries.map((ref, i) => {
    const id = `E-${i}-${ref.id}`;
    nodes.push(cardFromRef(id, ref, 'entry', 0, i, summaries, icons));
    return id;
  });
  const hubIds = hubs.map((ref, i) => {
    const id = `H-${i}-${ref.id}`;
    nodes.push(cardFromRef(id, ref, 'hub', 1, i, summaries, icons));
    return id;
  });
  const stageIds = stages.map((stage, i) => {
    const id = `P-${i}-${stage.nodeId}`;
    nodes.push(
      cardFromRef(
        id,
        {
          id: stage.nodeId,
          name: stage.name,
          kind: 'function',
          filePath: stage.filePath,
          startLine: stage.startLine,
          endLine: stage.endLine
        },
        'pipeline',
        2,
        i,
        summaries,
        icons
      )
    );
    return id;
  });

  const link = (from?: string, to?: string, dashed = false) => {
    if (!from || !to) return;
    edges.push({ id: `${from}->${to}`, source: from, target: to, dashed });
  };
  link(entryIds[0], hubIds[0]);
  link(hubIds[0] || entryIds[0], stageIds[0]);
  for (let i = 0; i < stageIds.length - 1; i += 1) {
    link(stageIds[i], stageIds[i + 1]);
  }

  if (nodes.length === 0) {
    return emptyView(t('graph.arch.empty'));
  }

  const sections: GraphViewSection[] = [];
  if (entryIds.length > 0) {
    sections.push({
      row: 0,
      label: t('graph.arch.section.entry'),
      hint: t('graph.arch.section.entryHint'),
      role: 'entry'
    });
  }
  if (hubIds.length > 0) {
    sections.push({
      row: 1,
      label: t('graph.arch.section.hub'),
      hint: t('graph.arch.section.hubHint'),
      role: 'hub'
    });
  }
  if (stageIds.length > 0) {
    sections.push({
      row: 2,
      label: t('graph.arch.section.pipeline'),
      hint: t('graph.arch.section.pipelineHint'),
      role: 'pipeline'
    });
  }

  return { nodes, edges, sections };
}

function buildFlowView(
  insights?: GraphInsights | null,
  summaries?: Record<string, string>,
  icons?: Record<string, string>
): GraphViewModel {
  const stages = insights?.mainFlow ? uniqueMainFlowStages(insights.mainFlow).slice(0, 8) : [];
  if (stages.length === 0) {
    return emptyView(t('graph.flow.empty'));
  }
  const nodes: GraphViewNode[] = [];
  const edges: GraphViewEdge[] = [];
  const ids: string[] = [];
  stages.forEach((stage, i) => {
    const role: GraphCardRole =
      stage.role === 'input' ? 'entry' : stage.role === 'output' ? 'hub' : 'pipeline';
    const id = `F-${i}-${stage.nodeId}`;
    ids.push(id);
    nodes.push(
      cardFromRef(
        id,
        {
          id: stage.nodeId,
          name: stage.name,
          kind: 'function',
          filePath: stage.filePath,
          startLine: stage.startLine,
          endLine: stage.endLine
        },
        role,
        0,
        i,
        summaries,
        icons
      )
    );
  });
  for (let i = 0; i < ids.length - 1; i += 1) {
    edges.push({ id: `${ids[i]}->${ids[i + 1]}`, source: ids[i], target: ids[i + 1] });
  }
  return { nodes, edges };
}

function buildModulesView(
  graph: CodeGraph,
  _summaries?: Record<string, string>,
  icons?: Record<string, string>
): GraphViewModel {
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

  if (ranked.length === 0) {
    return emptyView(t('graph.modules.empty'));
  }

  const nodes: GraphViewNode[] = [];
  const edges: GraphViewEdge[] = [];
  const folderId = new Map<string, string>();

  ranked.forEach((item, index) => {
    const id = `M-${index}-${item.folder}`;
    folderId.set(item.folder, id);
    const sample = item.files[0];
    const role: GraphCardRole = index < 3 ? 'entry' : 'support';
    nodes.push({
      id,
      name: item.folder,
      filePath: sample.filePath,
      kind: 'module',
      role,
      summary: t('graph.modules.summary', { count: item.files.length, score: item.score }),
      iconKey: lookupIcon(icons, sample) || inferNodeIcon(item.folder, { kind: 'file', filePath: sample.filePath }),
      startLine: 1,
      endLine: 1,
      row: Math.floor(index / 5),
      col: index % 5
    });
  });

  const linkWeight = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.kind === 'defines') continue;
    const fromFile = resolveFileId(graph, edge.from);
    const toFile = resolveFileId(graph, edge.to);
    if (!fromFile || !toFile) continue;
    const fromNode = graph.nodes.find((n) => n.id === fromFile);
    const toNode = graph.nodes.find((n) => n.id === toFile);
    if (!fromNode || !toNode) continue;
    const fromFolder = topFolder(fromNode.filePath, 1);
    const toFolder = topFolder(toNode.filePath, 1);
    if (fromFolder === toFolder || !folderId.has(fromFolder) || !folderId.has(toFolder)) continue;
    const key = `${fromFolder}=>${toFolder}`;
    linkWeight.set(key, (linkWeight.get(key) ?? 0) + 1);
  }

  for (const [key, weight] of Array.from(linkWeight.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)) {
    const [fromFolder, toFolder] = key.split('=>');
    const from = folderId.get(fromFolder);
    const to = folderId.get(toFolder);
    if (!from || !to) continue;
    edges.push({
      id: `${from}->${to}`,
      source: from,
      target: to,
      label: String(weight),
      dashed: weight < 2
    });
  }

  return { nodes, edges };
}

function collectFunctionFileCounts(
  graph: CodeGraph
): Array<{ filePath: string; count: number; sample: GraphNode }> {
  const counts = new Map<string, { count: number; sample: GraphNode }>();
  for (const node of graph.nodes) {
    if (node.kind !== 'function' && node.kind !== 'class' && node.kind !== 'method') {
      continue;
    }
    const filePath = normalizePath(node.filePath);
    if (!filePath) continue;
    const prev = counts.get(filePath);
    if (prev) {
      prev.count += 1;
    } else {
      counts.set(filePath, { count: 1, sample: node });
    }
  }

  return [...counts.entries()]
    .map(([filePath, info]) => ({ filePath, count: info.count, sample: info.sample }))
    .sort((a, b) => b.count - a.count || a.filePath.localeCompare(b.filePath));
}

function buildFunctionsOverviewView(
  graph: CodeGraph,
  icons?: Record<string, string>
): GraphViewModel {
  const files = collectFunctionFileCounts(graph).slice(0, 36);

  if (files.length === 0) {
    return emptyView(t('graph.functions.empty'));
  }

  const nodes: GraphViewNode[] = files.map((info, i) => {
    const base = shortPath(info.filePath);
    const name = base.includes('/') ? base.split('/').pop() || base : base;
    return {
      id: `FG-${i}`,
      name,
      filePath: info.filePath,
      kind: 'file-group',
      role: info.count >= 8 ? 'hub' : info.count >= 3 ? 'pipeline' : 'support',
      summary: t('graph.functions.openHint', { count: info.count }),
      iconKey: lookupIcon(icons, info.sample) || inferNodeIcon(name, { kind: 'file', filePath: info.filePath }),
      startLine: 1,
      endLine: 1,
      row: Math.floor(i / 4),
      col: i % 4,
      expandKey: info.filePath
    };
  });

  return { nodes, edges: [] };
}

function buildFunctionsFileDetail(
  graph: CodeGraph,
  filePath: string | undefined,
  focusId: string | undefined,
  summaries?: Record<string, string>,
  icons?: Record<string, string>
): GraphViewModel {
  if (!filePath) {
    return emptyView(t('graph.functions.pickFile'));
  }
  const target = resolveGraphFilePath(graph, filePath, focusId);
  const locals = graph.nodes.filter(
    (node) =>
      (node.kind === 'function' || node.kind === 'class' || node.kind === 'method') &&
      normalizePath(node.filePath) === target
  );
  if (locals.length === 0) {
    return emptyView(t('graph.functions.noneInFile', { file: shortPath(target) }));
  }

  const nodes: GraphViewNode[] = [];
  const edges: GraphViewEdge[] = [];
  const idMap = new Map<string, string>();
  const shown = locals.slice(0, 24);

  shown.forEach((node, i) => {
    const id = `FN-${i}-${node.id}`;
    idMap.set(node.id, id);
    const role: GraphCardRole =
      focusId && node.id === focusId ? 'entry' : node.kind === 'class' ? 'hub' : 'pipeline';
    nodes.push(cardFromRef(id, node, role, Math.floor(i / 4), i % 4, summaries, icons));
  });

  const localIds = new Set(shown.map((n) => n.id));
  let edgeCount = 0;
  for (const edge of graph.edges) {
    if (edge.kind !== 'calls' && edge.kind !== 'uses' && edge.kind !== 'extends') continue;
    if (!localIds.has(edge.from) || !localIds.has(edge.to)) continue;
    const from = idMap.get(edge.from);
    const to = idMap.get(edge.to);
    if (!from || !to) continue;
    edges.push({
      id: `${from}->${to}-${edge.kind}`,
      source: from,
      target: to,
      label: edge.kind === 'calls' ? undefined : edge.kind,
      dashed: edge.kind !== 'calls'
    });
    edgeCount += 1;
    if (edgeCount >= 40) break;
  }

  return { nodes, edges };
}

/** Resolve path klik node → path yang dipakai di graph (absolute/relative). */
function resolveGraphFilePath(
  graph: CodeGraph,
  filePath: string,
  focusId?: string
): string {
  if (focusId) {
    const focused = graph.nodes.find((node) => node.id === focusId);
    if (focused?.filePath) {
      return normalizePath(focused.filePath);
    }
  }
  const target = normalizePath(filePath);
  for (const node of graph.nodes) {
    const path = normalizePath(node.filePath);
    if (path === target) {
      return path;
    }
  }
  for (const node of graph.nodes) {
    const path = normalizePath(node.filePath);
    if (path.endsWith(target) || target.endsWith(path)) {
      return path;
    }
  }
  return target;
}

/**
 * Flow Chart kartu: layout berlapis mengikuti arah calls,
 * baris 0 = START (titik masuk), lalu langkah berikutnya.
 */
export function buildFileFlowView(
  graph: CodeGraph,
  filePath: string,
  options: {
    focusId?: string;
    summaries?: Record<string, string>;
    icons?: Record<string, string>;
  } = {}
): GraphViewModel {
  if (!filePath) {
    return emptyView(t('graph.functions.pickFile'));
  }
  const focusId = options.focusId;
  const target = resolveGraphFilePath(graph, filePath, focusId);
  const locals = graph.nodes.filter(
    (node) =>
      (node.kind === 'function' || node.kind === 'class' || node.kind === 'method') &&
      normalizePath(node.filePath) === target
  );
  if (locals.length === 0) {
    return emptyView(t('graph.functions.noneInFile', { file: shortPath(target) }));
  }

  const shown = locals.slice(0, 24);
  const localIds = new Set(shown.map((n) => n.id));

  const isFocus = (node: GraphNode): boolean => {
    if (!focusId) return false;
    if (node.id === focusId) return true;
    if (focusId.endsWith(node.id) || focusId.includes(`-${node.id}`)) return true;
    return false;
  };

  // Adjacency calls saja (arah alur).
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const id of localIds) {
    outgoing.set(id, []);
    incoming.set(id, 0);
  }
  for (const edge of graph.edges) {
    if (edge.kind !== 'calls') continue;
    if (!localIds.has(edge.from) || !localIds.has(edge.to) || edge.from === edge.to) continue;
    outgoing.get(edge.from)!.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const focused = shown.find(isFocus);
  const roots: GraphNode[] = [];
  if (focused) {
    roots.push(focused);
  }
  for (const node of shown) {
    if ((incoming.get(node.id) ?? 0) === 0 && !roots.some((r) => r.id === node.id)) {
      roots.push(node);
    }
  }
  // Jika semua saling call (cycle) dan tanpa focus — ambil yang paling awal di file.
  if (roots.length === 0) {
    roots.push([...shown].sort((a, b) => a.startLine - b.startLine)[0]);
  }

  // BFS layer dari roots mengikuti calls.
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const root of roots) {
    depth.set(root.id, 0);
    queue.push(root.id);
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = depth.get(cur) ?? 0;
    for (const next of outgoing.get(cur) ?? []) {
      if (depth.has(next)) continue;
      depth.set(next, d + 1);
      queue.push(next);
    }
  }

  // Node tak terjangkau → baris setelah layer terakhir.
  let maxReachable = 0;
  for (const d of depth.values()) {
    maxReachable = Math.max(maxReachable, d);
  }
  const orphanRow = maxReachable + 1;
  for (const node of shown) {
    if (!depth.has(node.id)) {
      depth.set(node.id, orphanRow);
    }
  }

  const byRow = new Map<number, GraphNode[]>();
  for (const node of shown) {
    const row = depth.get(node.id) ?? orphanRow;
    const list = byRow.get(row) ?? [];
    list.push(node);
    byRow.set(row, list);
  }
  for (const list of byRow.values()) {
    list.sort((a, b) => {
      if (isFocus(a) !== isFocus(b)) return isFocus(a) ? -1 : 1;
      return a.startLine - b.startLine || a.name.localeCompare(b.name);
    });
  }

  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const lastFlowRow = rows.filter((r) => r < orphanRow).pop() ?? 0;

  const nodes: GraphViewNode[] = [];
  const idMap = new Map<string, string>();
  let seq = 0;
  for (const row of rows) {
    const list = byRow.get(row) ?? [];
    list.forEach((node, col) => {
      const id = `FL-${seq}-${node.id}`;
      seq += 1;
      idMap.set(node.id, id);
      const isRoot = row === 0;
      const isLeaf =
        row === lastFlowRow && row > 0 && (outgoing.get(node.id) ?? []).length === 0;
      const role: GraphCardRole = isRoot
        ? 'entry'
        : isLeaf
          ? 'hub'
          : node.kind === 'class'
            ? 'hub'
            : 'pipeline';
      const card = cardFromRef(id, node, role, row, col, options.summaries, options.icons);
      if (!card.summary) {
        if (isRoot) {
          card.summary = t('graph.flow.card.start', { name: node.name });
        } else if (isLeaf) {
          card.summary = t('graph.flow.card.end', { name: node.name });
        } else {
          card.summary = t('graph.flow.card.step', { name: node.name });
        }
      }
      nodes.push(card);
    });
  }

  const edges: GraphViewEdge[] = [];
  let edgeCount = 0;
  for (const edge of graph.edges) {
    if (edge.kind !== 'calls' && edge.kind !== 'uses' && edge.kind !== 'extends') continue;
    if (!localIds.has(edge.from) || !localIds.has(edge.to)) continue;
    const from = idMap.get(edge.from);
    const to = idMap.get(edge.to);
    if (!from || !to || from === to) continue;
    edges.push({
      id: `${from}->${to}-${edge.kind}`,
      source: from,
      target: to,
      label: edge.kind === 'calls' ? undefined : edge.kind,
      dashed: edge.kind !== 'calls'
    });
    edgeCount += 1;
    if (edgeCount >= 48) break;
  }

  const sections: GraphViewSection[] = [];
  if (byRow.has(0)) {
    sections.push({
      row: 0,
      label: t('graph.flow.section.start'),
      hint: t('graph.flow.section.startHint'),
      role: 'entry'
    });
  }
  for (const row of rows) {
    if (row === 0) continue;
    if (row === orphanRow) {
      sections.push({
        row,
        label: t('graph.flow.section.other'),
        hint: t('graph.flow.section.otherHint'),
        role: 'support'
      });
      continue;
    }
    if (row === lastFlowRow && lastFlowRow > 0) {
      sections.push({
        row,
        label: t('graph.flow.section.end'),
        hint: t('graph.flow.section.endHint'),
        role: 'hub'
      });
      continue;
    }
    sections.push({
      row,
      label: t('graph.flow.section.step', { n: row }),
      hint: t('graph.flow.section.stepHint'),
      role: 'pipeline'
    });
  }

  return { nodes, edges, sections };
}

function buildAllFunctionGroups(
  graph: CodeGraph,
  focusId: string | undefined,
  summaries?: Record<string, string>,
  icons?: Record<string, string>
): Record<string, GraphViewModel> {
  // Harus sama dengan overview: top file by symbol count, bukan urutan Set mentah.
  const files = collectFunctionFileCounts(graph).slice(0, 36);
  const groups: Record<string, GraphViewModel> = {};
  for (const file of files) {
    groups[file.filePath] = buildFunctionsFileDetail(
      graph,
      file.filePath,
      focusId,
      summaries,
      icons
    );
  }
  return groups;
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
  const icons = insights?.nodeIcons;

  const architecture =
    totalFiles > 0
      ? buildLayeredArchitectureMermaid(graph, insights, nodeIndex, summaries, icons)
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

  const views = {
    architecture: buildArchitectureView(insights, summaries, icons),
    modules: buildModulesView(graph, summaries, icons),
    flow: buildFlowView(insights, summaries, icons),
    functions: buildFunctionsOverviewView(graph, icons)
  };
  const functionGroups = buildAllFunctionGroups(graph, options.focusNodeId, summaries, icons);

  return {
    architecture: architecture.mermaid,
    modules: modules.mermaid,
    flow,
    functions,
    nodeIndex,
    views,
    functionGroups,
    stats: {
      fileCount: totalFiles,
      shownFiles: architecture.shown,
      edgeCount: architecture.edges,
      truncated: totalFiles > architecture.shown
    }
  };
}
