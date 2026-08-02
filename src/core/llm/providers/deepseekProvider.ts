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

interface DeepseekResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const DEEPSEEK_MODEL = 'deepseek-v4-flash';

export class DeepseekProvider implements LlmProvider {
  readonly name = 'deepseek' as const;
  private readonly rateLimiter = new RateLimiter({
    requestsPerMinute: 60
  });

  constructor(private readonly apiKey: string) {}

  async complete(prompt: string): Promise<string> {
    const cachedResponse = getCachedPromptResponse(prompt, { namespace: this.name });
    if (cachedResponse !== undefined) {
      return cachedResponse;
    }

    await this.rateLimiter.acquire();

    if (typeof globalThis.fetch !== 'function') {
      throw new Error('Global fetch is not available in this environment.');
    }

    const responseText = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      try {
        const res = await globalThis.fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [{ role: 'user', content: prompt }],
            stream: false
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          throw new HttpStatusError(`DeepSeek API error: ${res.status}`, res.status, await res.text());
        }

        const data = (await res.json()) as DeepseekResponse;
        return data.choices?.[0]?.message?.content ?? '';
      } finally {
        clearTimeout(timeout);
      }
    });

    setCachedPromptResponse(prompt, responseText, { namespace: this.name });
    return responseText;
  }
}
