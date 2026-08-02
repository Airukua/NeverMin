import { CodeGraph } from '../../core/graph/types';

export interface WebviewGraphNodeData {
  data: {
    id: string;
    label: string;
    kind: string;
    filePath: string;
    startLine: number;
    endLine: number;
  };
}

export interface WebviewGraphEdgeData {
  data: {
    id: string;
    source: string;
    target: string;
    label: string;
  };
}

export interface WebviewGraphPayload {
  nodes: WebviewGraphNodeData[];
  edges: WebviewGraphEdgeData[];
}

/**
 * Convert CodeGraph ke format elemen Cytoscape (flat — tanpa compound parent).
 * Compound parent membuat banyak kartu file kosong dan layout sulit dibaca.
 */
export function buildGraphPayload(graph: CodeGraph): WebviewGraphPayload {
  return {
    nodes: graph.nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.name,
        kind: node.kind,
        filePath: node.filePath,
        startLine: node.startLine,
        endLine: node.endLine
      }
    })),
    edges: graph.edges.map((edge) => ({
      data: {
        id: `${edge.from}-${edge.to}-${edge.kind}`,
        source: edge.from,
        target: edge.to,
        label: edge.kind
      }
    }))
  };
}
