export type NodeKind = 'function' | 'class' | 'method' | 'file' | 'variable';
export type EdgeKind = 'calls' | 'imports' | 'extends' | 'uses' | 'defines';

export interface GraphNode {
  id: string;              // unik, misal "src/auth/login.ts#loginUser"
  kind: NodeKind;
  name: string;             // nama tampil, misal "loginUser"
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface GraphEdge {
  from: string;             // GraphNode.id
  to: string;                // GraphNode.id
  kind: EdgeKind;
}

export interface CodeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
