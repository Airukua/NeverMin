import { extractSymbols, SymbolInfo } from './astParser';

const cache = new Map<string, Promise<SymbolInfo[]>>();
const MAX_ENTRIES = 2000;

function hashContent(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function cacheKey(filePath: string, content: string): string {
  return `${filePath}::${content.length}::${hashContent(content)}`;
}

/**
 * Cache hasil extractSymbols agar analyzeRepo + buildRepoGraph tidak parse 2x.
 */
export function extractSymbolsCached(filePath: string, content: string): Promise<SymbolInfo[]> {
  const key = cacheKey(filePath, content);
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }

  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }

  const promise = extractSymbols(filePath, content);
  cache.set(key, promise);
  promise.catch(() => {
    cache.delete(key);
  });
  return promise;
}

export function clearSymbolCache(): void {
  cache.clear();
}
