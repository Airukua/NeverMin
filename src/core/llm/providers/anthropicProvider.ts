import { LlmProvider } from '../../../types';
import { RateLimiter } from '../rateLimiter';
import { HttpStatusError, retryWithBackoff } from '../retryWithBackoff';
import { getCachedPromptResponse, setCachedPromptResponse } from '../promptCache';
import { LlmProviderOptions } from '../llmOptions';

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic' as const;
  private readonly rateLimiter = new RateLimiter({ requestsPerMinute: 60 });
  private readonly model: string;
  private readonly temperature: number;

  constructor(
    private readonly apiKey: string,
    options: LlmProviderOptions = {}
  ) {
    this.model = options.model?.trim() || DEFAULT_ANTHROPIC_MODEL;
    this.temperature = options.temperature ?? 0.2;
  }

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
        const res = await globalThis.fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 4096,
            temperature: this.temperature,
            messages: [{ role: 'user', content: prompt }]
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          throw new HttpStatusError(`Anthropic API error: ${res.status}`, res.status, await res.text());
        }

        const data = (await res.json()) as AnthropicResponse;
        return (data.content ?? [])
          .filter((part) => part.type === 'text' && typeof part.text === 'string')
          .map((part) => part.text as string)
          .join('\n');
      } finally {
        clearTimeout(timeout);
      }
    });

    setCachedPromptResponse(prompt, responseText, { namespace: this.name });
    return responseText;
  }
}
