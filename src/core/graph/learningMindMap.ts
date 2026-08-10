import { GraphInsights } from './graphInsights';
import { NeverminLanguage } from '../../i18n/types';
import { t } from '../../i18n';
import { uniqueMainFlowStages } from './flowMermaid';
import type { CodeGraph, GraphNode } from './types';

function sanitizeMindLabel(value: string, max = 36): string {
  return value
    .replace(/[()[\]{}]/g, '')
    .replace(/["'`]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'item';
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function normPath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

/** Stable identity for mind-map leaves (graph id, or path+name+line). */
export function mindLeafKey(leaf: {
  id?: string;
  name?: string;
  filePath?: string;
  startLine?: number;
}): string {
  const id = (leaf.id || '').trim();
  if (id && !id.startsWith('folder:')) {
    return `id:${id}`;
  }
  const path = leaf.filePath ? normPath(leaf.filePath) : '';
  const name = (leaf.name || '').trim().toLowerCase();
  const line = leaf.startLine ?? 0;
  if (path && name) return `sym:${path}::${name}::${line}`;
  if (name) return `name:${name}`;
  if (id) return `id:${id}`;
  return `row:${path}:${line}`;
}

/** Drop duplicate leaves; prefers first occurrence. */
export function dedupeMindLeaves(leaves: LearningMindMapLeaf[]): LearningMindMapLeaf[] {
  const seen = new Set<string>();
  const seenNames = new Set<string>();
  const out: LearningMindMapLeaf[] = [];
  for (const leaf of leaves) {
    if (!leaf?.name?.trim()) continue;
    const key = mindLeafKey(leaf);
    if (seen.has(key)) continue;
    // Same display name under one parent → keep first (avoid "foo, foo, foo")
    const nameKey = leaf.name.trim().toLowerCase();
    if (seenNames.has(nameKey)) continue;
    seen.add(key);
    seenNames.add(nameKey);
    out.push(leaf);
  }
  return out;
}

function foldersFromInsights(insights: GraphInsights, limit = 8): string[] {
  const counts = new Map<string, number>();
  const bump = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2) {
      return;
    }
    const folder = parts.slice(0, -1).slice(-2).join('/');
    if (!folder) {
      return;
    }
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  };

  for (const ref of [...insights.entryPoints, ...insights.hubs]) {
    if (ref.filePath) {
      bump(ref.filePath);
    }
  }
  for (const stage of insights.mainFlow?.stages ?? []) {
    if (stage.filePath) {
      bump(stage.filePath);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([folder]) => folder);
}

export type MindMapBranchKind = 'start' | 'flow' | 'hubs' | 'modules' | 'later';

export interface LearningMindMapLeaf {
  id: string;
  name: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  role?: string;
  kind?: string;
  /** Breakdown lebih dalam — kosong/undefined = tidak dipecah lagi. */
  children?: LearningMindMapLeaf[];
}

export interface LearningMindMapBranch {
  id: MindMapBranchKind;
  label: string;
  accent: 'entry' | 'pipeline' | 'hub' | 'modules' | 'later';
  children: LearningMindMapLeaf[];
}

export interface LearningMindMapModel {
  rootTitle: string;
  subtitle: string;
  branches: LearningMindMapBranch[];
  mermaid: string;
  stats: {
    entryCount: number;
    hubCount: number;
    stageCount: number;
    moduleCount: number;
  };
}

export interface LearningMindMapOptions {
  lang?: NeverminLanguage;
  folders?: string[];
  rootTitle?: string;
}

function branchLabels(lang: NeverminLanguage) {
  return {
    root: t('mindmap.root', undefined, lang),
    start: t('mindmap.start', undefined, lang),
    flow: t('mindmap.flow', undefined, lang),
    hubs: t('mindmap.hubs', undefined, lang),
    modules: t('mindmap.modules', undefined, lang),
    later: t('mindmap.later', undefined, lang),
    empty: t('structure.needAnalyze', undefined, lang),
    subtitle: (e: number, h: number) => t('mindmap.subtitle', { entries: e, hubs: h }, lang)
  };
}

type ClaimedIds = Set<string>;

function tryClaim(
  claimed: ClaimedIds,
  id: string,
  filePath?: string,
  name?: string,
  startLine?: number
): boolean {
  const key = mindLeafKey({ id, filePath, name, startLine });
  if (claimed.has(key)) return false;
  claimed.add(key);
  return true;
}

/**
 * Structured learning mind map for the React webview.
 */
export function buildLearningMindMapModel(
  insights: GraphInsights,
  options: LearningMindMapOptions = {}
): LearningMindMapModel {
  const lang = options.lang ?? 'id';
  const labels = branchLabels(lang);
  const rootTitle = options.rootTitle || labels.root;
  const claimed: ClaimedIds = new Set();

  const entries = insights.entryPoints
    .slice(0, 8)
    .filter((entry) => tryClaim(claimed, entry.id, entry.filePath, entry.name, entry.startLine))
    .slice(0, 5);
  const stages = (insights.mainFlow ? uniqueMainFlowStages(insights.mainFlow) : [])
    .slice(0, 10)
    .filter((stage) =>
      tryClaim(claimed, stage.nodeId, stage.filePath, stage.name, stage.startLine)
    )
    .slice(0, 6);
  const hubs = insights.hubs
    .slice(0, 8)
    .filter((hub) => tryClaim(claimed, hub.id, hub.filePath, hub.name, hub.startLine))
    .slice(0, 5);
  const folders = (options.folders?.length ? options.folders : foldersFromInsights(insights)).slice(
    0,
    8
  );
  const orphans = (insights.orphanFiles ?? [])
    .slice(0, 8)
    .filter((orphan) => tryClaim(claimed, orphan.id, orphan.filePath, orphan.name, orphan.startLine))
    .slice(0, 4);

  const branches: LearningMindMapBranch[] = [];

  if (entries.length > 0) {
    branches.push({
      id: 'start',
      label: labels.start,
      accent: 'entry',
      children: dedupeMindLeaves(
        entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          filePath: entry.filePath,
          startLine: entry.startLine,
          endLine: entry.endLine,
          kind: entry.kind,
          role: 'entry'
        }))
      )
    });
  }

  if (stages.length > 0) {
    branches.push({
      id: 'flow',
      label: labels.flow,
      accent: 'pipeline',
      children: dedupeMindLeaves(
        stages.map((stage) => ({
          id: stage.nodeId,
          name: stage.name,
          filePath: stage.filePath || undefined,
          startLine: stage.startLine,
          endLine: stage.endLine,
          role: stage.role
        }))
      )
    });
  }

  if (hubs.length > 0) {
    branches.push({
      id: 'hubs',
      label: labels.hubs,
      accent: 'hub',
      children: dedupeMindLeaves(
        hubs.map((hub) => ({
          id: hub.id,
          name: hub.name,
          filePath: hub.filePath,
          startLine: hub.startLine,
          endLine: hub.endLine,
          kind: hub.kind,
          role: 'hub'
        }))
      )
    });
  }

  if (folders.length > 0) {
    const seenFolders = new Set<string>();
    const folderLeaves: LearningMindMapLeaf[] = [];
    folders.forEach((folder, index) => {
      const key = folder.replace(/\\/g, '/').toLowerCase();
      if (seenFolders.has(key)) return;
      seenFolders.add(key);
      folderLeaves.push({
        id: `folder:${folder}:${index}`,
        name: folder,
        role: 'module'
      });
    });
    branches.push({
      id: 'modules',
      label: labels.modules,
      accent: 'modules',
      children: folderLeaves
    });
  }

  if (orphans.length > 0) {
    branches.push({
      id: 'later',
      label: labels.later,
      accent: 'later',
      children: dedupeMindLeaves(
        orphans.map((orphan) => ({
          id: orphan.id,
          name: orphan.name,
          filePath: orphan.filePath,
          startLine: orphan.startLine,
          endLine: orphan.endLine,
          kind: orphan.kind
        }))
      )
    });
  }

  if (branches.length === 0) {
    branches.push({
      id: 'start',
      label: labels.empty,
      accent: 'entry',
      children: []
    });
  }

  const mermaid = buildLearningMindMapMermaidFromModel(rootTitle, labels, branches);

  return {
    rootTitle,
    subtitle: labels.subtitle(entries.length, hubs.length),
    branches,
    mermaid,
    stats: {
      entryCount: entries.length,
      hubCount: hubs.length,
      stageCount: stages.length,
      moduleCount: folders.length
    }
  };
}

function buildLearningMindMapMermaidFromModel(
  root: string,
  labels: ReturnType<typeof branchLabels>,
  branches: LearningMindMapBranch[]
): string {
  const lines: string[] = ['mindmap', `${indent(1)}root((${sanitizeMindLabel(root, 40)}))`];

  if (branches.every((b) => b.children.length === 0)) {
    lines.push(`${indent(2)}${sanitizeMindLabel(labels.empty)}`);
    return lines.join('\n');
  }

  for (const branch of branches) {
    if (branch.children.length === 0) continue;
    lines.push(`${indent(2)}${sanitizeMindLabel(branch.label)}`);
    for (const child of branch.children) {
      const prefix =
        branch.id === 'flow'
          ? child.role === 'input'
            ? 'in: '
            : child.role === 'output'
              ? 'out: '
              : ''
          : '';
      lines.push(`${indent(3)}${sanitizeMindLabel(prefix + child.name)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Mind map pecahan belajar: mulai dari entry → alur utama → hub → modul folder.
 * Mermaid mindmap (indent-based) — kept for Copy/Source.
 */
export function buildLearningMindMapMermaid(
  insights: GraphInsights,
  options: LearningMindMapOptions = {}
): string {
  return buildLearningMindMapModel(insights, options).mermaid;
}

const BREAKDOWN_KINDS = new Set(['calls', 'uses', 'defines']);

function findGraphNode(graph: CodeGraph, leaf: LearningMindMapLeaf): GraphNode | undefined {
  if (leaf.id && !leaf.id.startsWith('folder:')) {
    const byId = graph.nodes.find((n) => n.id === leaf.id);
    if (byId) return byId;
  }
  if (!leaf.filePath || !leaf.name) return undefined;
  const wantPath = normPath(leaf.filePath);
  const wantName = leaf.name.toLowerCase();
  return graph.nodes.find(
    (n) =>
      normPath(n.filePath) === wantPath &&
      n.name.toLowerCase() === wantName &&
      n.kind !== 'file'
  );
}

function nodeToLeaf(node: GraphNode, role?: string): LearningMindMapLeaf {
  return {
    id: node.id,
    name: node.name,
    filePath: node.filePath,
    startLine: node.startLine,
    endLine: node.endLine,
    kind: node.kind,
    role
  };
}

/** Pecah leaf dari edge graph (calls/uses/defines). Tidak menambah anak kosong. */
export function heuristicChildrenForLeaf(
  leaf: LearningMindMapLeaf,
  graph: CodeGraph,
  limit = 5,
  blocked: ReadonlySet<string> = new Set()
): LearningMindMapLeaf[] {
  if (leaf.id.startsWith('folder:')) {
    const folderKey = leaf.name.replace(/\\/g, '/').toLowerCase();
    const raw: LearningMindMapLeaf[] = [];
    for (const node of graph.nodes) {
      const fp = normPath(node.filePath);
      if (!fp.includes(`/${folderKey}/`) && !fp.endsWith(`/${folderKey}`) && !fp.includes(folderKey)) {
        continue;
      }
      if (node.kind === 'file') continue;
      const key = mindLeafKey(node);
      if (blocked.has(key)) continue;
      raw.push(nodeToLeaf(node, 'symbol'));
      if (raw.length >= limit * 3) break;
    }
    return dedupeMindLeaves(raw).slice(0, limit);
  }

  const source = findGraphNode(graph, leaf);
  if (!source) return [];

  const raw: LearningMindMapLeaf[] = [];
  const localBlocked = new Set(blocked);
  localBlocked.add(mindLeafKey(source));
  for (const edge of graph.edges) {
    if (edge.from !== source.id) continue;
    if (!BREAKDOWN_KINDS.has(edge.kind)) continue;
    const target = graph.nodes.find((n) => n.id === edge.to);
    if (!target || target.kind === 'file') continue;
    const key = mindLeafKey(target);
    if (localBlocked.has(key)) continue;
    localBlocked.add(key);
    raw.push(nodeToLeaf(target, edge.kind));
    if (raw.length >= limit * 2) break;
  }
  return dedupeMindLeaves(raw).slice(0, limit);
}

/**
 * Isi children dari CodeGraph (satu tingkat). Leaf yang sudah punya children tidak ditimpa.
 * Tidak menulis children: [] — biarkan undefined agar UI tidak menggambar handle kosong.
 */
export function attachHeuristicMindMapBreakdown(
  model: LearningMindMapModel,
  graph: CodeGraph | null | undefined,
  options: { maxPerLeaf?: number; depth?: number } = {}
): LearningMindMapModel {
  if (!graph?.nodes?.length) return model;
  const maxPerLeaf = options.maxPerLeaf ?? 5;
  const maxDepth = Math.max(1, Math.min(options.depth ?? 2, 3));

  const expand = (
    leaf: LearningMindMapLeaf,
    depthLeft: number,
    ancestors: ReadonlySet<string>
  ): LearningMindMapLeaf => {
    const selfKey = mindLeafKey(leaf);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(selfKey);

    if (leaf.children && leaf.children.length > 0) {
      const kids = dedupeMindLeaves(leaf.children)
        .filter((c) => !nextAncestors.has(mindLeafKey(c)))
        .map((c) => (depthLeft > 1 ? expand(c, depthLeft - 1, nextAncestors) : c));
      return kids.length > 0 ? { ...leaf, children: kids } : { ...leaf, children: undefined };
    }
    if (depthLeft <= 0) return leaf;
    const kids = heuristicChildrenForLeaf(leaf, graph, maxPerLeaf, nextAncestors);
    if (kids.length === 0) return leaf;
    return {
      ...leaf,
      children:
        depthLeft > 1 ? kids.map((c) => expand(c, depthLeft - 1, nextAncestors)) : kids
    };
  };

  return {
    ...model,
    branches: model.branches.map((branch) => ({
      ...branch,
      children: dedupeMindLeaves(branch.children).map((leaf) => expand(leaf, maxDepth, new Set()))
    }))
  };
}

/** Merge children dari map id→kids; skip empty; jangan timpa yang sudah ada. */
export function mergeMindMapBreakdown(
  model: LearningMindMapModel,
  byParentId: Record<string, LearningMindMapLeaf[]>
): LearningMindMapModel {
  const apply = (leaf: LearningMindMapLeaf, ancestors: ReadonlySet<string>): LearningMindMapLeaf => {
    const selfKey = mindLeafKey(leaf);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(selfKey);

    const existing = dedupeMindLeaves(leaf.children?.filter(Boolean) ?? []).filter(
      (c) => !nextAncestors.has(mindLeafKey(c))
    );
    if (existing.length > 0) {
      return {
        ...leaf,
        children: existing.map((c) => apply(c, nextAncestors))
      };
    }
    const extra = dedupeMindLeaves(byParentId[leaf.id] ?? []).filter(
      (c) => !nextAncestors.has(mindLeafKey(c))
    );
    if (extra.length === 0) return leaf;
    return { ...leaf, children: extra };
  };

  return {
    ...model,
    branches: model.branches.map((branch) => ({
      ...branch,
      children: dedupeMindLeaves(branch.children).map((leaf) => apply(leaf, new Set()))
    }))
  };
}

/** Leaf L1 yang masih belum punya children (kandidat LLM). */
export function listMindMapLeavesNeedingBreakdown(
  model: LearningMindMapModel,
  limit = 10
): LearningMindMapLeaf[] {
  const out: LearningMindMapLeaf[] = [];
  const seen = new Set<string>();
  for (const branch of model.branches) {
    for (const leaf of branch.children) {
      if (leaf.children && leaf.children.length > 0) continue;
      if (!leaf.name) continue;
      const key = mindLeafKey(leaf);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(leaf);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
