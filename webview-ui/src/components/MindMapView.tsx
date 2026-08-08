import { memo, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, Network, Puzzle, Sparkles, Bookmark } from 'lucide-react';
import type { LearningMindMapBranch, LearningMindMapLeaf, LearningMindMapModel } from '../types';
import { setWebviewI18n, tw } from '../i18n';
import { getBoot } from '../vscodeApi';

const bootI18n = getBoot()?.i18n;
if (bootI18n) setWebviewI18n(bootI18n);
import { postToExtension } from '../vscodeApi';

type Accent = LearningMindMapBranch['accent'];

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
  leaf?: LearningMindMapLeaf;
};

type MindCardNode = Node<MindCardData, 'mindCard'>;

function MindCardNodeView({ data, selected }: NodeProps<MindCardNode>) {
  const color = accentColor[data.accent];
  const clickable = data.variant === 'leaf' && Boolean(data.leaf?.filePath);

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0" style={{ background: color }} />
      <button
        type="button"
        disabled={!clickable}
        onClick={() => {
          if (!data.leaf?.filePath) return;
          postToExtension({
            type: 'nodeClick',
            node: {
              id: data.leaf.id,
              mermaidId: data.leaf.id,
              name: data.leaf.name,
              kind: data.leaf.kind || 'file',
              filePath: data.leaf.filePath,
              startLine: data.leaf.startLine ?? 1,
              endLine: data.leaf.endLine ?? 1
            }
          });
        }}
        className={[
          'box-border rounded-xl border px-3 py-2 text-left transition',
          data.variant === 'root'
            ? 'min-h-[64px] min-w-[180px] bg-[var(--panel-l2)]'
            : data.variant === 'branch'
              ? 'min-h-[56px] min-w-[150px] max-w-[220px] bg-[var(--panel)]'
              : 'h-[76px] w-[220px] bg-[var(--panel)]',
          selected ? 'bg-[var(--panel-l3)]' : '',
          clickable ? 'cursor-pointer hover:bg-[var(--panel-l2)]' : 'cursor-default'
        ].join(' ')}
        style={{
          borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
          boxShadow: data.variant === 'root' ? `0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)` : undefined
        }}
      >
        <div className="truncate text-[12px] font-semibold tracking-tight text-white">{data.title}</div>
        {data.subtitle ? (
          <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-lo)]">{data.subtitle}</div>
        ) : null}
        {data.leaf?.role ? (
          <div className="mt-1 text-[9px] font-medium uppercase tracking-wider" style={{ color }}>
            {data.leaf.role}
          </div>
        ) : null}
      </button>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0" style={{ background: color }} />
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

function shortPath(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const n = filePath.replace(/\\/g, '/');
  const parts = n.split('/').filter(Boolean);
  if (parts.length <= 2) return n;
  return parts.slice(-2).join('/');
}

function toFlowElements(model: LearningMindMapModel): { nodes: MindCardNode[]; edges: Edge[] } {
  const nodes: MindCardNode[] = [];
  const edges: Edge[] = [];

  const ROOT_X = 0;
  const BRANCH_X = 300;
  const LEAF_X = 600;
  /** Top-to-top step; must be >= fixed leaf card height (76) + gap. */
  const LEAF_STEP = 96;
  /** Extra space after a branch cluster before the next branch's first leaf. */
  const CLUSTER_GAP = 64;

  // Pack each branch's leaf column sequentially so clusters never overlap.
  // React Flow positions are top-left, so we reserve a full LEAF_STEP slot per card.
  type Packed = {
    branch: LearningMindMapBranch;
    leafYs: number[];
    branchY: number;
    bottom: number;
  };

  let cursorY = 0;
  const packed: Packed[] = model.branches.map((branch) => {
    const top = cursorY;
    const leafYs =
      branch.children.length === 0
        ? [top]
        : branch.children.map((_, i) => top + i * LEAF_STEP);
    const lastTop = leafYs[leafYs.length - 1] ?? top;
    // Reserve full card slot for the last leaf, then cluster gap
    const bottom = lastTop + LEAF_STEP;
    const branchY = (top + lastTop) / 2;
    cursorY = bottom + CLUSTER_GAP;
    return { branch, leafYs, branchY, bottom };
  });

  const totalHeight = packed.length > 0 ? packed[packed.length - 1].bottom : 0;
  const offsetY = -totalHeight / 2;

  const rootId = 'mind-root';
  nodes.push({
    id: rootId,
    type: 'mindCard',
    position: { x: ROOT_X, y: 0 },
    data: {
      title: model.rootTitle,
      subtitle: model.subtitle,
      accent: 'entry',
      variant: 'root'
    },
    draggable: true
  });

  for (const pack of packed) {
    const branchId = `branch-${pack.branch.id}`;
    nodes.push({
      id: branchId,
      type: 'mindCard',
      position: { x: BRANCH_X, y: pack.branchY + offsetY },
      data: {
        title: pack.branch.label,
        subtitle: `${pack.branch.children.length} items`,
        accent: pack.branch.accent,
        variant: 'branch'
      },
      draggable: true
    });
    edges.push({
      id: `e-${rootId}-${branchId}`,
      source: rootId,
      target: branchId,
      style: {
        stroke: accentColor[pack.branch.accent],
        strokeWidth: 1.5
      }
    });

    pack.branch.children.forEach((child, ci) => {
      const leafId = `leaf-${pack.branch.id}-${child.id}-${ci}`;
      nodes.push({
        id: leafId,
        type: 'mindCard',
        position: { x: LEAF_X, y: pack.leafYs[ci] + offsetY },
        data: {
          title: child.name,
          subtitle: shortPath(child.filePath),
          accent: pack.branch.accent,
          variant: 'leaf',
          leaf: child
        },
        draggable: true
      });
      edges.push({
        id: `e-${branchId}-${leafId}`,
        source: branchId,
        target: leafId,
        style: {
          stroke: accentColor[pack.branch.accent],
          strokeWidth: 1.25,
          opacity: 0.85
        }
      });
    });
  }

  return { nodes, edges };
}

interface MindMapViewProps {
  model: LearningMindMapModel;
}

function MindMapViewInner({ model }: MindMapViewProps) {
  const { nodes, edges } = useMemo(() => toFlowElements(model), [model]);

  return (
    <div className="flex h-screen w-screen flex-col bg-[var(--void)] text-[var(--text-hi)]">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[color-mix(in_srgb,var(--text-lo)_28%,transparent)] bg-[var(--panel)] px-3">
        <div className="flex items-center gap-2 text-[var(--role-entry)]">
          <Network size={16} />
          <span className="text-sm font-semibold tracking-wide text-white">Mind Map</span>
        </div>
        <span className="font-mono text-[10px] text-[var(--text-lo)]">{model.subtitle}</span>
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
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-[var(--text-hi)] hover:bg-[var(--panel-l2)]"
            onClick={() => postToExtension({ type: 'copySource', source: model.mermaid })}
          >
            Copy
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {nodes.length <= 1 && model.branches.every((b) => b.children.length === 0) ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--text-lo)]">
            {tw('mindmap.empty')}
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.3}
            maxZoom={1.4}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1}
              color="color-mix(in srgb, var(--text-lo) 40%, transparent)"
            />
            <Controls className="!bg-[var(--panel)] !border-[color-mix(in_srgb,var(--text-lo)_30%,transparent)] !shadow-none" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

export const MindMapView = memo(MindMapViewInner);
