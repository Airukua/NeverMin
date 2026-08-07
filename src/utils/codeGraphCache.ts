import * as vscode from 'vscode';
import { CodeGraph } from '../core/graph/types';

const CODE_GRAPH_KEY = 'nevermin.codeGraph';

let memoryGraph: CodeGraph | undefined;

export function getCachedCodeGraph(context: vscode.ExtensionContext): CodeGraph | undefined {
  if (memoryGraph && memoryGraph.nodes.length > 0) {
    return memoryGraph;
  }
  const stored = context.workspaceState.get<CodeGraph>(CODE_GRAPH_KEY);
  if (stored?.nodes?.length) {
    memoryGraph = stored;
    return stored;
  }
  return undefined;
}

export async function setCachedCodeGraph(
  context: vscode.ExtensionContext,
  graph: CodeGraph
): Promise<void> {
  memoryGraph = graph;
  await context.workspaceState.update(CODE_GRAPH_KEY, graph);
}

export async function clearCachedCodeGraph(context: vscode.ExtensionContext): Promise<void> {
  memoryGraph = undefined;
  await context.workspaceState.update(CODE_GRAPH_KEY, undefined);
}
