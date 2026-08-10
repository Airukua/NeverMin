import type { MermaidNodeMeta } from '../types';
import type { NodeExplainState } from '../components/NodeExplainModal';

export type CachedNodeExplain = {
  text: string;
  thinking?: string;
  scope?: NodeExplainState['scope'];
  sensitivityLevel?: NodeExplainState['sensitivityLevel'];
  sensitivityReason?: string;
  title?: string;
  savedAt: number;
};

const cache = new Map<string, CachedNodeExplain>();
const MAX_ENTRIES = 40;

export function explainCacheKey(meta: Pick<MermaidNodeMeta, 'id' | 'name' | 'filePath' | 'startLine' | 'endLine'>): string {
  const id = (meta.id || '').trim();
  const path = (meta.filePath || '').replace(/\\/g, '/').toLowerCase();
  const name = (meta.name || '').trim().toLowerCase();
  const start = meta.startLine ?? 0;
  const end = meta.endLine ?? start;
  if (id) return `id:${id}|${path}|${start}-${end}`;
  return `sym:${path}|${name}|${start}-${end}`;
}

export function getCachedNodeExplain(meta: MermaidNodeMeta): CachedNodeExplain | undefined {
  return cache.get(explainCacheKey(meta));
}

export function setCachedNodeExplain(meta: MermaidNodeMeta, entry: Omit<CachedNodeExplain, 'savedAt'>): void {
  const key = explainCacheKey(meta);
  cache.set(key, { ...entry, savedAt: Date.now() });
  if (cache.size > MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].savedAt - b[1].savedAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

export function clearCachedNodeExplain(meta: MermaidNodeMeta): void {
  cache.delete(explainCacheKey(meta));
}
