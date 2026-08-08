import { LlmCompleteOptions, LlmCompletionResult, LlmProvider } from '../../../types';
import { RateLimiter } from '../rateLimiter';
import {
  HttpStatusError,
  retryWithBackoff
} from '../retryWithBackoff';
import {
  getCachedPromptResponse,
  setCachedPromptResponse
} from '../promptCache';
import { LlmProviderOptions } from '../llmOptions';
import { normalizeGeminiTokenUsage } from '../tokenUsage';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: unknown;
}

const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  private readonly rateLimiter = new RateLimiter({
    requestsPerMinute: 10,
    requestsPerDay: 1000
  });
  private readonly model: string;
  private readonly temperature: number;

  constructor(
    private readonly apiKey: string,
    options: LlmProviderOptions = {}
  ) {
    this.model = options.model?.trim() || DEFAULT_GEMINI_MODEL;
    this.temperature = options.temperature ?? 0.2;
  }

  async complete(
    prompt: string,
    options: LlmCompleteOptions = {}
  ): Promise<LlmCompletionResult> {
    const skipCache = Boolean(options.skipCache);
    const cacheResponse = options.cacheResponse !== false;

    if (!skipCache) {
      const cached = getCachedPromptResponse(prompt, { namespace: this.name });
      if (cached !== undefined) {
        return { text: cached.response, usage: cached.usage, fromCache: true };
      }
    }

    await this.rateLimiter.acquire();

    if (typeof globalThis.fetch !== 'function') {
      throw new Error('Fetch API is not available in this runtime.');
    }

    const result = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      try {
        const res = await globalThis.fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': this.apiKey
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: this.temperature
              }
            }),
            signal: controller.signal
          }
        );

        if (!res.ok) {
          const body = await res.text();
          const detail = body.replace(/\s+/g, ' ').trim().slice(0, 280);
          throw new HttpStatusError(
            detail ? `Gemini API error: ${res.status} · ${detail}` : `Gemini API error: ${res.status}`,
            res.status,
            body
          );
        }

        const data = (await res.json()) as GeminiResponse;
        return {
          text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
          usage: normalizeGeminiTokenUsage(data.usageMetadata)
        } satisfies LlmCompletionResult;
      } finally {
        clearTimeout(timeout);
      }
    });

    if (cacheResponse) {
      setCachedPromptResponse(prompt, result.text, {
        namespace: this.name,
        usage: result.usage
      });
    }
    return result;
  }
}
