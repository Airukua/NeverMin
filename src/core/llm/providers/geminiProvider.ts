import { LlmProvider } from '../../../types';
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

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

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

  async complete(prompt: string): Promise<string> {
    const cachedResponse = getCachedPromptResponse(prompt, { namespace: this.name });
    if (cachedResponse !== undefined) {
      return cachedResponse;
    }

    await this.rateLimiter.acquire();

    if (typeof globalThis.fetch !== 'function') {
      throw new Error('Fetch API is not available in this runtime.');
    }

    const responseText = await retryWithBackoff(async () => {
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
          throw new HttpStatusError(`Gemini API error: ${res.status}`, res.status, await res.text());
        }

        const data = (await res.json()) as GeminiResponse;
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      } finally {
        clearTimeout(timeout);
      }
    });

    setCachedPromptResponse(prompt, responseText, { namespace: this.name });
    return responseText;
  }
}
