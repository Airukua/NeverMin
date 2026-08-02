import crypto from 'crypto';

interface PromptCacheEntry {
  response: string;
  timestamp: number;
}

interface PromptCacheOptions {
  ttlMs?: number;
  clock?: () => number;
  namespace?: string;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, PromptCacheEntry>();

export function getCachedPromptResponse(
  prompt: string,
  options: PromptCacheOptions = {}
): string | undefined {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const clock = options.clock ?? Date.now;
  const key = createPromptCacheKey(prompt, options.namespace);
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  if (clock() - entry.timestamp > ttlMs) {
    cache.delete(key);
    return undefined;
  }

  return entry.response;
}

export function setCachedPromptResponse(
  prompt: string,
  response: string,
  options: PromptCacheOptions = {}
): void {
  const clock = options.clock ?? Date.now;
  const key = createPromptCacheKey(prompt, options.namespace);
  cache.set(key, { response, timestamp: clock() });
}

export function clearPromptCache(): void {
  cache.clear();
}

export function createPromptCacheKey(prompt: string, namespace = ''): string {
  return crypto.createHash('sha256').update(namespace).update('\0').update(prompt).digest('hex');
}
