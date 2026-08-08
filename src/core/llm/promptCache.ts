import crypto from 'crypto';
import type { LlmTokenUsage } from '../../types';

interface PromptCacheEntry {
  response: string;
  thinking?: string;
  usage?: LlmTokenUsage;
  timestamp: number;
}

interface PromptCacheOptions {
  ttlMs?: number;
  clock?: () => number;
  namespace?: string;
}

export interface CachedPromptPayload {
  response: string;
  thinking?: string;
  usage?: LlmTokenUsage;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map<string, PromptCacheEntry>();

export function getCachedPromptResponse(
  prompt: string,
  options: PromptCacheOptions = {}
): CachedPromptPayload | undefined {
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

  return { response: entry.response, thinking: entry.thinking, usage: entry.usage };
}

export function setCachedPromptResponse(
  prompt: string,
  response: string,
  options: PromptCacheOptions & { usage?: LlmTokenUsage; thinking?: string } = {}
): void {
  if (!response.trim()) {
    return;
  }

  const clock = options.clock ?? Date.now;
  const key = createPromptCacheKey(prompt, options.namespace);

  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    let oldestKey: string | undefined;
    let oldestTs = Number.POSITIVE_INFINITY;
    for (const [entryKey, entry] of cache.entries()) {
      if (entry.timestamp < oldestTs) {
        oldestTs = entry.timestamp;
        oldestKey = entryKey;
      }
    }
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    response,
    thinking: options.thinking,
    usage: options.usage,
    timestamp: clock()
  });
}

export function clearPromptCache(): void {
  cache.clear();
}

function createPromptCacheKey(prompt: string, namespace?: string): string {
  const hash = crypto.createHash('sha256').update(prompt).digest('hex');
  return namespace ? `${namespace}:${hash}` : hash;
}
