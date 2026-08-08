import { memo, useMemo, type MouseEvent } from 'react';
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
import type { GraphCardRole, GraphViewModel, MermaidNodeMeta } from '../types';
import { GraphNodeCard, ROLE_HANDLE_COLOR, type NodeRole } from './GraphNodeCard';
import { tw } from '../i18n';

export type FlowCardData = {
  name: string;
  filePath: string;
  summary?: string;
  iconKey?: string;
  role: NodeRole;
  kind?: string;
  meta: MermaidNodeMeta;
  skeleton?: boolean;
};

type SectionLabelData = {
  label: string;
  hint?: string;
  role?: GraphCardRole;
  width: number;
};

type FlowCardNode = Node<FlowCardData, 'graphCard'>;
type SectionLabelNode = Node<SectionLabelData, 'sectionLabel'>;
type CanvasNode = FlowCardNode | SectionLabelNode;

const SECTION_ROLE_COLOR: Record<GraphCardRole, string> = {
  entry: 'var(--role-entry)',
  hub: 'var(--role-hub)',
  pipeline: 'var(--role-pipeline)',
  support: 'var(--role-support)'
};

function GraphCardNode({ data, selected }: NodeProps<FlowCardNode>) {
  const handleColor = ROLE_HANDLE_COLOR[data.role] ?? 'var(--role-entry)';
  const handleClass = '!h-2.5 !w-2.5 !border-0';
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className={handleClass}
        style={{ background: handleColor }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className={handleClass}
        style={{ background: handleColor }}
      />
      <GraphNodeCard
        name={data.name}
        filePath={data.filePath}
        summary={data.summary}
        iconKey={data.iconKey}
        role={data.role}
        kind={data.kind}
        selected={selected}
        skeleton={data.skeleton}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={handleClass}
        style={{ background: handleColor }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={handleClass}
        style={{ background: handleColor }}
      />
    </div>
  );
}

function SectionLabelNodeView({ data }: NodeProps<SectionLabelNode>) {
  const color = data.role ? SECTION_ROLE_COLOR[data.role] : 'var(--text-lo)';
  return (
    <div
      className="pointer-events-none select-none"
      style={{ width: Math.max(data.width, 280) }}
    >
      <div className="mb-1.5 flex items-baseline gap-2.5">
        <span
          className="shrink-0 text-[12px] font-semibold tracking-wide"
          style={{ color }}
        >
          {data.label}
        </span>
        {data.hint ? (
          <span className="min-w-0 truncate text-[11px] text-[var(--text-lo)]">{data.hint}</span>
        ) : null}
      </div>
      <div
        className="h-px w-full"
        style={{
          background: `color-mix(in srgb, ${color} 55%, transparent)`
        }}
      />
    </div>
  );
}

const nodeTypes = {
  graphCard: GraphCardNode,
  sectionLabel: SectionLabelNodeView
};

const CARD_W = 320;
const GAP_X = 48;
const ROW_H = 260;
const SECTION_GAP = 40;

function toFlowElements(
  model: GraphViewModel,
  skeleton: boolean
): { nodes: CanvasNode[]; edges: Edge[] } {
  const cardNodes: FlowCardNode[] = model.nodes.map((n) => ({
    id: n.id,
    type: 'graphCard' as const,
    position: { x: n.col * (CARD_W + GAP_X), y: n.row * ROW_H },
    data: {
      name: n.name,
      filePath: n.filePath,
      summary: n.summary,
      iconKey: n.iconKey,
      role: n.role,
      kind: n.kind,
      skeleton,
      meta: {
        id: n.id,
        mermaidId: n.id,
        name: n.name,
        kind: n.kind,
        filePath: n.filePath,
        startLine: n.startLine,
        endLine: n.endLine,
        summary: n.summary,
        expandKey: n.expandKey
      }
    },
    draggable: true
  }));

  const byRow = new Map<number, FlowCardNode[]>();
  for (const node of cardNodes) {
    const row = Math.round(node.position.y / ROW_H);
    const list = byRow.get(row) ?? [];
    list.push(node);
    byRow.set(row, list);
  }
  for (const rowNodes of byRow.values()) {
    const totalW = rowNodes.length * CARD_W + Math.max(0, rowNodes.length - 1) * GAP_X;
    const startX = -totalW / 2;
    rowNodes
      .sort((a, b) => a.position.x - b.position.x)
      .forEach((node, i) => {
        node.position.x = startX + i * (CARD_W + GAP_X);
      });
  }

  const sectionNodes: SectionLabelNode[] = [];
  for (const section of model.sections ?? []) {
    const rowNodes = byRow.get(section.row);
    if (!rowNodes || rowNodes.length === 0) continue;
    const minX = Math.min(...rowNodes.map((n) => n.position.x));
    const maxX = Math.max(...rowNodes.map((n) => n.position.x)) + CARD_W;
    const width = Math.max(maxX - minX, CARD_W);
    sectionNodes.push({
      id: `section-label-${section.row}`,
      type: 'sectionLabel',
      position: { x: minX, y: section.row * ROW_H - SECTION_GAP },
      data: {
        label: section.label,
        hint: section.hint,
        role: section.role,
        width
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false
    });
  }

  const edges: Edge[] = model.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: !e.dashed,
    style: {
      stroke: e.dashed ? 'var(--role-support)' : 'var(--role-entry)',
      strokeWidth: 1.5,
      strokeDasharray: e.dashed ? '6 4' : undefined
    },
    labelStyle: { fill: 'var(--text-lo)', fontSize: 10 }
  }));

  return { nodes: [...sectionNodes, ...cardNodes], edges };
}

interface GraphFlowCanvasProps {
  model: GraphViewModel | null | undefined;
  onNodeClick: (meta: MermaidNodeMeta, event: MouseEvent) => void;
  emptyFallback?: string;
  /** Saat LLM inspecting: skeleton summary di setiap kartu (semua view). */
  llmInspecting?: boolean;
}

function GraphFlowCanvasInner({
  model,
  onNodeClick,
  emptyFallback,
  llmInspecting = false
}: GraphFlowCanvasProps) {
  const { nodes, edges } = useMemo(
    () => toFlowElements(model ?? { nodes: [], edges: [] }, llmInspecting),
    [model, llmInspecting]
  );

  const hasCards = nodes.some((n) => n.type === 'graphCard');

  if (!hasCards) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--text-lo)]">
        {model?.emptyMessage || emptyFallback || tw('graph.view.empty')}
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.25}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        onNodeClick={(event, node) => {
          if (node.type !== 'graphCard') return;
          onNodeClick((node as FlowCardNode).data.meta, event);
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="color-mix(in srgb, var(--text-lo) 40%, transparent)"
        />
        <Controls className="!bg-[var(--panel)] !border-[color-mix(in_srgb,var(--text-lo)_30%,transparent)] !shadow-none" />
      </ReactFlow>
    </div>
  );
}

export const GraphFlowCanvas = memo(GraphFlowCanvasInner);
