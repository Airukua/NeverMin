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
import { GraphNodeCard, handleColorForCard, type NodeRole } from './GraphNodeCard';
import { tw } from '../i18n';

type ConnectedHandles = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
};

type HandleSide = keyof ConnectedHandles;

type SideRoles = {
  source: boolean;
  target: boolean;
};

type SideUsage = Record<HandleSide, SideRoles>;

export type FlowCardData = {
  name: string;
  filePath: string;
  summary?: string;
  iconKey?: string;
  role: NodeRole;
  kind?: string;
  sensitivityLevel?: import('../types').SensitivityLevel;
  sensitivityReason?: string;
  meta: MermaidNodeMeta;
  skeleton?: boolean;
  /** Handle hanya dirender jika sisi ini punya edge. */
  sideUsage: SideUsage;
};

type SectionLabelData = {
  label: string;
  hint?: string;
  role?: GraphCardRole;
  accent?: string;
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

function emptySideUsage(): SideUsage {
  return {
    top: { source: false, target: false },
    bottom: { source: false, target: false },
    left: { source: false, target: false },
    right: { source: false, target: false }
  };
}

const SIDE_POSITION: Record<HandleSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right
};

function GraphCardNode({ data, selected }: NodeProps<FlowCardNode>) {
  const handleColor = handleColorForCard(data.role, data.sensitivityLevel);
  const handleClass = '!h-2.5 !w-2.5 !border-0';
  const sides = data.sideUsage;
  return (
    <div className="relative">
      {(Object.keys(sides) as HandleSide[]).map((side) => {
        const role = sides[side];
        const pos = SIDE_POSITION[side];
        return (
          <span key={side}>
            {role.target ? (
              <Handle
                id={`t-${side}`}
                type="target"
                position={pos}
                className={handleClass}
                style={{ background: handleColor }}
              />
            ) : null}
            {role.source ? (
              <Handle
                id={`s-${side}`}
                type="source"
                position={pos}
                className={handleClass}
                style={{ background: handleColor }}
              />
            ) : null}
          </span>
        );
      })}
      <GraphNodeCard
        name={data.name}
        filePath={data.filePath}
        summary={data.summary}
        iconKey={data.iconKey}
        role={data.role}
        kind={data.kind}
        selected={selected}
        skeleton={data.skeleton}
        sensitivityLevel={data.sensitivityLevel}
        sensitivityReason={data.sensitivityReason}
      />
    </div>
  );
}

function SectionLabelNodeView({ data }: NodeProps<SectionLabelNode>) {
  const color =
    data.accent || (data.role ? SECTION_ROLE_COLOR[data.role] : 'var(--text-lo)');
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

/** Pilih sisi source/target dari posisi relatif dua kartu. */
function pickEdgeHandles(
  source: { x: number; y: number },
  target: { x: number; y: number }
): { sourceHandle: HandleSide; targetHandle: HandleSide } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? { sourceHandle: 'bottom', targetHandle: 'top' }
      : { sourceHandle: 'top', targetHandle: 'bottom' };
  }
  return dx >= 0
    ? { sourceHandle: 'right', targetHandle: 'left' }
    : { sourceHandle: 'left', targetHandle: 'right' };
}

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
      sensitivityLevel: n.sensitivityLevel,
      sensitivityReason: n.sensitivityReason,
      skeleton,
      sideUsage: emptySideUsage(),
      meta: {
        id: n.id,
        mermaidId: n.id,
        name: n.name,
        kind: n.kind,
        filePath: n.filePath,
        startLine: n.startLine,
        endLine: n.endLine,
        summary: n.summary,
        expandKey: n.expandKey,
        sensitivityLevel: n.sensitivityLevel,
        sensitivityReason: n.sensitivityReason
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
        accent: section.accent,
        width
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false
    });
  }

  const nodeById = new Map(cardNodes.map((n) => [n.id, n]));
  const edges: Edge[] = [];
  for (const e of model.edges) {
    const sourceNode = nodeById.get(e.source);
    const targetNode = nodeById.get(e.target);
    if (!sourceNode || !targetNode) continue;

    const { sourceHandle, targetHandle } = pickEdgeHandles(
      sourceNode.position,
      targetNode.position
    );
    sourceNode.data.sideUsage[sourceHandle].source = true;
    targetNode.data.sideUsage[targetHandle].target = true;

    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: `s-${sourceHandle}`,
      targetHandle: `t-${targetHandle}`,
      label: e.label,
      animated: !e.dashed,
      style: {
        stroke: e.dashed ? 'var(--role-support)' : 'var(--role-entry)',
        strokeWidth: 1.5,
        strokeDasharray: e.dashed ? '6 4' : undefined
      },
      labelStyle: { fill: 'var(--text-lo)', fontSize: 10 }
    });
  }

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
