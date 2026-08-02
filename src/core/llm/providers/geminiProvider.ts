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

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  private readonly rateLimiter = new RateLimiter({
    requestsPerMinute: 10,
    requestsPerDay: 1000
  });

  constructor(private readonly apiKey: string) {}

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
      const res = await globalThis.fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      if (!res.ok) {
        throw new HttpStatusError(`Gemini API error: ${res.status}`, res.status, await res.text());
      }

      const data = (await res.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return text;
    });

    setCachedPromptResponse(prompt, responseText, { namespace: this.name });
    return responseText;
  }
}
