import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Network,
  Puzzle,
  Sparkles,
  Bookmark
} from 'lucide-react';
import type {
  LearningMindMapBranch,
  LearningMindMapLeaf,
  LearningMindMapModel,
  MermaidNodeMeta
} from '../types';
import { setWebviewI18n, tw } from '../i18n';
import { getBoot, postToExtension } from '../vscodeApi';
import { leafToMeta } from '../lib/mindMapMeta';

export { leafToMeta } from '../lib/mindMapMeta';

const bootI18n = getBoot()?.i18n;
if (bootI18n) setWebviewI18n(bootI18n);

type Accent = LearningMindMapBranch['accent'];
type Side = 'left' | 'right';

const accentColor: Record<Accent, string> = {
  entry: 'var(--role-entry)',
  pipeline: '#a78bfa',
  hub: 'var(--role-hub)',
  modules: 'var(--role-pipeline)',
  later: 'var(--role-support)'
};

type MindCardData = {
  title: string;
  subtitle?: string;
  accent: Accent;
  variant: 'root' | 'branch' | 'leaf';
  meta?: MermaidNodeMeta;
  leaf?: LearningMindMapLeaf;
  hasChildren?: boolean;
  /** Expand key in `expanded` set (branch id or leaf path key). */
  expandId?: string;
  expanded?: boolean;
  childCount?: number;
  /** Arah peletakan dari root — mempengaruhi handle kiri/kanan. */
  side?: Side;
};

type MindCardNode = Node<MindCardData, 'mindCard'>;

function MindCardNodeView({ data, selected }: NodeProps<MindCardNode>) {
  const color = accentColor[data.accent];
  const clickable = data.variant === 'leaf' && Boolean(data.meta?.filePath);
  const branchToggle = data.variant === 'branch' && Boolean(data.hasChildren);
  const showSource =
    data.variant === 'root' ||
    (data.variant === 'branch' && data.expanded) ||
    (data.variant === 'leaf' && data.expanded);
  const side: Side = data.side ?? 'right';
  const growLeft = side === 'left';

  const targetPos = growLeft ? Position.Right : Position.Left;
  const sourcePos = growLeft ? Position.Left : Position.Right;

  return (
    <div
      className={`relative ${clickable || branchToggle ? 'nodrag nopan' : ''}`}
    >
      {data.variant === 'root' ? (
        <>
          <Handle
            id="out-left"
            type="source"
            position={Position.Left}
            className="!h-2 !w-2 !border-0"
            style={{ background: color }}
          />
          <Handle
            id="out-right"
            type="source"
            position={Position.Right}
            className="!h-2 !w-2 !border-0"
            style={{ background: color }}
          />
        </>
      ) : (
        <Handle
          type="target"
          position={targetPos}
          className="!h-2 !w-2 !border-0"
          style={{ background: color }}
        />
      )}
      <div
        className={[
          'box-border rounded-xl border px-3 py-2 text-left transition',
          data.variant === 'root'
            ? 'min-w-[160px] bg-[var(--panel-l2)]'
            : data.variant === 'branch'
              ? 'min-w-[140px] max-w-[220px] bg-[var(--panel)]'
              : 'w-[210px] bg-[var(--panel)]',
          selected ? 'bg-[var(--panel-l3)]' : '',
          clickable || branchToggle
            ? 'cursor-pointer hover:bg-[var(--panel-l2)]'
            : 'cursor-default'
        ].join(' ')}
        style={{
          borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
          boxShadow:
            data.variant === 'root'
              ? `0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`
              : undefined
        }}
      >
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold leading-snug tracking-tight text-white">
              {data.title}
            </div>
            {data.subtitle ? (
              <div className="mt-0.5 truncate font-mono text-[10px] leading-snug text-[var(--text-lo)]">
                {data.subtitle}
              </div>
            ) : null}
          </div>
          {data.hasChildren && data.expandId ? (
            <span
              data-mind-expand={data.expandId}
              className="nodrag nopan inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[var(--text-lo)]"
              style={{ color }}
              title={data.expanded ? 'Collapse' : 'Expand'}
            >
              {data.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          ) : null}
        </div>
      </div>
      {data.variant !== 'root' && showSource ? (
        <Handle
          type="source"
          position={sourcePos}
          className="!h-2 !w-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
    </div>
  );
}

const nodeTypes = { mindCard: MindCardNodeView };

const BRANCH_ICONS = {
  entry: Sparkles,
  pipeline: GitBranch,
  hub: Network,
  modules: Puzzle,
  later: Bookmark
} as const;

function shortPath(filePath?: string): string {
  if (!filePath) return '';
  const n = filePath.replace(/\\/g, '/');
  const parts = n.split('/').filter(Boolean);
  if (parts.length <= 2) return n;
  return parts.slice(-2).join('/');
}

const COL_GAP = 280;
const ROW_H = 58;
const BRANCH_GAP = 36;

function isExpanded(expanded: ReadonlySet<string>, id: string): boolean {
  return expanded.has(id);
}

function subtreeRows(leaf: LearningMindMapLeaf, pathKey: string, expanded: ReadonlySet<string>): number {
  const kids = leaf.children?.filter((c) => c?.name) ?? [];
  if (kids.length === 0 || !isExpanded(expanded, pathKey)) return 1;
  return Math.max(
    1,
    kids.reduce(
      (sum, kid, i) => sum + subtreeRows(kid, `${pathKey}.${i}`, expanded),
      0
    )
  );
}

function branchExpandId(branchId: string): string {
  return `branch:${branchId}`;
}

function branchRows(
  branch: LearningMindMapBranch,
  side: Side,
  expanded: ReadonlySet<string>
): number {
  const expandId = branchExpandId(branch.id);
  if (branch.children.length === 0 || !isExpanded(expanded, expandId)) return 1;
  return branch.children.reduce(
    (sum, leaf, ci) => sum + subtreeRows(leaf, `${side}-${branch.id}-${ci}`, expanded),
    0
  );
}

/**
 * Bagi cabang ke kiri/kanan secara seimbang.
 * Prefer baca kanan: Start / Flow; kiri: Hubs / Modules / Later.
 */
function splitBranchesBySide(branches: LearningMindMapBranch[]): {
  left: LearningMindMapBranch[];
  right: LearningMindMapBranch[];
} {
  if (branches.length === 0) return { left: [], right: [] };
  if (branches.length === 1) return { left: [], right: branches };

  const byId = new Map(branches.map((b) => [b.id, b]));
  const rightIds = ['start', 'flow'] as const;
  const leftIds = ['hubs', 'modules', 'later'] as const;

  const right: LearningMindMapBranch[] = [];
  const left: LearningMindMapBranch[] = [];
  const used = new Set<string>();

  for (const id of rightIds) {
    const b = byId.get(id);
    if (b) {
      right.push(b);
      used.add(id);
    }
  }
  for (const id of leftIds) {
    const b = byId.get(id);
    if (b) {
      left.push(b);
      used.add(id);
    }
  }

  const rest = branches.filter((b) => !used.has(b.id));
  // Weight while collapsed is always 1 — balance by count.
  let leftWeight = left.length;
  let rightWeight = right.length;

  for (const b of rest) {
    if (rightWeight <= leftWeight) {
      right.push(b);
      rightWeight += 1;
    } else {
      left.push(b);
      leftWeight += 1;
    }
  }

  if (left.length === 0 && right.length >= 2) {
    left.push(right.pop()!);
  }
  if (right.length === 0 && left.length >= 2) {
    right.push(left.shift()!);
  }

  return { left, right };
}

function placeLeafTree(
  leaf: LearningMindMapLeaf,
  accent: Accent,
  side: Side,
  depth: number,
  rowStart: number,
  parentId: string,
  nodes: MindCardNode[],
  edges: Edge[],
  pathKey: string,
  expanded: ReadonlySet<string>
): number {
  const kids = leaf.children?.filter((c) => c?.name) ?? [];
  const open = kids.length > 0 && isExpanded(expanded, pathKey);
  const rows = subtreeRows(leaf, pathKey, expanded);
  const selfRow = !open ? rowStart : rowStart + (rows - 1) / 2;
  const nodeId = `n-${pathKey}`;
  const dir = side === 'right' ? 1 : -1;
  const x = dir * depth * COL_GAP;
  const hasChildren = kids.length > 0;

  nodes.push({
    id: nodeId,
    type: 'mindCard',
    position: { x, y: selfRow * ROW_H },
    data: {
      title: leaf.name,
      subtitle: shortPath(leaf.filePath) || undefined,
      accent,
      variant: 'leaf',
      leaf,
      meta: leafToMeta(leaf),
      hasChildren,
      expandId: hasChildren ? pathKey : undefined,
      expanded: open,
      childCount: kids.length,
      side
    },
    draggable: true
  });
  edges.push({
    id: `e-${parentId}-${nodeId}`,
    source: parentId,
    target: nodeId,
    style: {
      stroke: accentColor[accent],
      strokeWidth: depth <= 2 ? 1.35 : 1.1,
      opacity: 0.88
    }
  });

  if (!open) return rows;

  let childRow = rowStart;
  kids.forEach((kid, i) => {
    const used = placeLeafTree(
      kid,
      accent,
      side,
      depth + 1,
      childRow,
      nodeId,
      nodes,
      edges,
      `${pathKey}.${i}`,
      expanded
    );
    childRow += used;
  });
  return rows;
}

function placeSide(
  side: Side,
  branches: LearningMindMapBranch[],
  rootId: string,
  nodes: MindCardNode[],
  edges: Edge[],
  expanded: ReadonlySet<string>
): void {
  if (branches.length === 0) return;

  const weights = branches.map((b) => branchRows(b, side, expanded));
  const total = weights.reduce((a, b) => a + b, 0) + (branches.length - 1) * (BRANCH_GAP / ROW_H);
  let cursor = -total / 2;

  const dir = side === 'right' ? 1 : -1;
  const branchX = dir * COL_GAP;
  const sourceHandle = side === 'right' ? 'out-right' : 'out-left';

  branches.forEach((branch, bi) => {
    const rows = weights[bi];
    const branchRow = cursor + (rows - 1) / 2;
    const branchId = `branch-${side}-${branch.id}`;
    const expandId = branchExpandId(branch.id);
    const open = branch.children.length > 0 && isExpanded(expanded, expandId);
    const count = branch.children.length;

    nodes.push({
      id: branchId,
      type: 'mindCard',
      position: { x: branchX, y: branchRow * ROW_H },
      data: {
        title: branch.label,
        accent: branch.accent,
        variant: 'branch',
        hasChildren: count > 0,
        expandId: count > 0 ? expandId : undefined,
        expanded: open,
        childCount: count,
        side
      },
      draggable: true
    });
    edges.push({
      id: `e-${rootId}-${branchId}`,
      source: rootId,
      sourceHandle,
      target: branchId,
      style: {
        stroke: accentColor[branch.accent],
        strokeWidth: 1.6
      }
    });

    if (open) {
      let row = cursor;
      branch.children.forEach((child, ci) => {
        const used = placeLeafTree(
          child,
          branch.accent,
          side,
          2,
          row,
          branchId,
          nodes,
          edges,
          `${side}-${branch.id}-${ci}`,
          expanded
        );
        row += used;
      });
    }

    cursor += rows + BRANCH_GAP / ROW_H;
  });
}

function toFlowElements(
  model: LearningMindMapModel,
  expanded: ReadonlySet<string>
): { nodes: MindCardNode[]; edges: Edge[] } {
  const nodes: MindCardNode[] = [];
  const edges: Edge[] = [];
  const { left, right } = splitBranchesBySide(model.branches);

  const rootId = 'mind-root';
  nodes.push({
    id: rootId,
    type: 'mindCard',
    position: { x: 0, y: 0 },
    data: {
      title: model.rootTitle,
      accent: 'entry',
      variant: 'root',
      hasChildren: model.branches.length > 0,
      side: 'right'
    },
    draggable: true
  });

  placeSide('right', right, rootId, nodes, edges, expanded);
  placeSide('left', left, rootId, nodes, edges, expanded);

  return { nodes, edges };
}

function allExpandableIds(model: LearningMindMapModel): string[] {
  const ids: string[] = [];
  const { left, right } = splitBranchesBySide(model.branches);
  const walkLeaf = (leaf: LearningMindMapLeaf, pathKey: string) => {
    const kids = leaf.children?.filter((c) => c?.name) ?? [];
    if (kids.length > 0) {
      ids.push(pathKey);
      kids.forEach((kid, i) => walkLeaf(kid, `${pathKey}.${i}`));
    }
  };
  for (const side of ['right', 'left'] as const) {
    const list = side === 'right' ? right : left;
    for (const branch of list) {
      if (branch.children.length > 0) {
        ids.push(branchExpandId(branch.id));
        branch.children.forEach((child, ci) => walkLeaf(child, `${side}-${branch.id}-${ci}`));
      }
    }
  }
  return ids;
}

interface MindMapViewProps {
  model: LearningMindMapModel;
  onLeafClick?: (leaf: LearningMindMapLeaf, clientX: number, clientY: number) => void;
  statusMessage?: string;
}

function FitOnChange({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = window.setTimeout(() => {
      void fitView({ padding: 0.32, duration: 220 });
    }, 40);
    return () => window.clearTimeout(id);
  }, [nodeCount, fitView]);
  return null;
}

function MindMapCanvas({
  model,
  onLeafClick,
  expanded,
  onToggleExpand
}: {
  model: LearningMindMapModel;
  onLeafClick?: (leaf: LearningMindMapLeaf, clientX: number, clientY: number) => void;
  expanded: ReadonlySet<string>;
  onToggleExpand: (id: string) => void;
}) {
  const { nodes, edges } = useMemo(() => toFlowElements(model, expanded), [model, expanded]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.32 }}
      minZoom={0.2}
      maxZoom={1.4}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      onNodeClick={(event, node) => {
        if (node.type !== 'mindCard') return;
        const data = (node as MindCardNode).data;
        const target = event.target as HTMLElement | null;
        const expandFromBtn = target?.closest?.('[data-mind-expand]') as HTMLElement | null;
        if (expandFromBtn?.dataset.mindExpand) {
          event.preventDefault();
          event.stopPropagation();
          onToggleExpand(expandFromBtn.dataset.mindExpand);
          return;
        }
        if (data.variant === 'branch' && data.expandId) {
          event.preventDefault();
          event.stopPropagation();
          onToggleExpand(data.expandId);
          return;
        }
        if (data.variant !== 'leaf' || !data.leaf?.filePath || !onLeafClick) return;
        event.preventDefault();
        event.stopPropagation();
        onLeafClick(data.leaf, event.clientX, event.clientY);
      }}
      onNodeDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      nodesDraggable
      elementsSelectable={false}
      selectNodesOnDrag={false}
    >
      <FitOnChange nodeCount={nodes.length} />
      <Background
        variant={BackgroundVariant.Dots}
        gap={18}
        size={1}
        color="color-mix(in srgb, var(--text-lo) 40%, transparent)"
      />
      <Controls className="!bg-[var(--panel)] !border-[color-mix(in_srgb,var(--text-lo)_30%,transparent)] !shadow-none" />
    </ReactFlow>
  );
}

function MindMapViewInner({ model, onLeafClick, statusMessage }: MindMapViewProps) {
  // Default: semua cabang tertutup — user buka satu per satu.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpanded(new Set());
  }, [model.rootTitle, model.branches.map((b) => `${b.id}:${b.children.length}`).join('|')]);

  const onToggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandable = useMemo(() => allExpandableIds(model), [model]);
  const allOpen = expandable.length > 0 && expandable.every((id) => expanded.has(id));

  return (
    <div className="flex h-screen w-screen flex-col bg-[var(--void)] text-[var(--text-hi)]">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[color-mix(in_srgb,var(--text-lo)_28%,transparent)] bg-[var(--panel)] px-3">
        <div className="flex items-center gap-2 text-[var(--role-entry)]">
          <Network size={16} />
          <span className="text-sm font-semibold tracking-wide text-white">Mind Map</span>
        </div>
        {statusMessage ? (
          <span className="truncate text-[11px] text-[var(--text-lo)]">{statusMessage}</span>
        ) : (
          <span className="hidden truncate text-[11px] text-[var(--text-lo)] sm:inline">
            Click a branch to expand
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            {model.branches.map((b) => {
              const Icon = BRANCH_ICONS[b.accent];
              return (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]"
                  style={{
                    color: accentColor[b.accent],
                    borderColor: `color-mix(in srgb, ${accentColor[b.accent]} 40%, transparent)`
                  }}
                >
                  <Icon size={11} />
                  {b.label}
                </span>
              );
            })}
          </div>
          {expandable.length > 0 ? (
            <button
              type="button"
              className="nodrag rounded px-2 py-1 text-xs text-[var(--text-hi)] hover:bg-[var(--panel-l2)]"
              onClick={() =>
                setExpanded(allOpen ? new Set() : new Set(expandable))
              }
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          ) : null}
          <button
            type="button"
            className="nodrag rounded px-2 py-1 text-xs text-[var(--text-hi)] hover:bg-[var(--panel-l2)]"
            onClick={() => postToExtension({ type: 'copySource', source: model.mermaid })}
          >
            Copy
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {model.branches.every((b) => b.children.length === 0) ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--text-lo)]">
            {tw('mindmap.empty')}
          </div>
        ) : (
          <ReactFlowProvider>
            <MindMapCanvas
              model={model}
              onLeafClick={onLeafClick}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
            />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}

export const MindMapView = memo(MindMapViewInner);
