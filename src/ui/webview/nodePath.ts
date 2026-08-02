import { GraphNode } from '../../core/graph/types';

export function resolveGraphNodePath(node: Partial<GraphNode> | undefined): string | null {
  const candidate =
    typeof node?.filePath === 'string' && node.filePath.trim().length > 0
      ? node.filePath.trim()
      : typeof node?.id === 'string'
        ? node.id.trim()
        : '';

  if (!candidate) {
    return null;
  }

  if (candidate.includes('://')) {
    return candidate;
  }

  return candidate;
}
