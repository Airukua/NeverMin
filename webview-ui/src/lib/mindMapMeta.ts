import type { LearningMindMapLeaf, MermaidNodeMeta } from '../types';

export function leafToMeta(leaf: LearningMindMapLeaf): MermaidNodeMeta {
  return {
    id: leaf.id,
    mermaidId: leaf.id,
    name: leaf.name,
    kind: leaf.kind || 'file',
    filePath: leaf.filePath || '',
    startLine: leaf.startLine ?? 1,
    endLine: leaf.endLine ?? 1
  };
}
