import { LlmProvider, ProviderName } from '../../../types';
import { RateLimiter } from '../rateLimiter';
import { HttpStatusError, retryWithBackoff } from '../retryWithBackoff';
import { getCachedPromptResponse, setCachedPromptResponse } from '../promptCache';
import { LlmProviderOptions } from '../llmOptions';

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export interface OpenAiCompatibleConfig {
  name: ProviderName;
  label: string;
  baseUrl: string;
  defaultModel: string;
  /** Extra headers (OpenRouter referer, etc.) */
  extraHeaders?: Record<string, string>;
  /** Ollama sering tanpa key — kirim Bearer hanya jika ada. */
  allowEmptyApiKey?: boolean;
  requestsPerMinute?: number;
}

function extractContent(data: OpenAiChatResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

/** Base class untuk semua provider Chat Completions bergaya OpenAI. */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: ProviderName;
  private readonly rateLimiter: RateLimiter;
  private readonly model: string;
  private readonly temperature: number;
  private readonly endpoint: string;
  private readonly label: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly allowEmptyApiKey: boolean;

  constructor(
    private readonly apiKey: string,
    config: OpenAiCompatibleConfig,
    options: LlmProviderOptions = {}
  ) {
    this.name = config.name;
    this.label = config.label;
    this.model = options.model?.trim() || config.defaultModel;
    this.temperature = options.temperature ?? 0.2;
    this.endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    this.extraHeaders = config.extraHeaders ?? {};
    this.allowEmptyApiKey = Boolean(config.allowEmptyApiKey);
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: config.requestsPerMinute ?? 60
    });
  }

  async complete(prompt: string): Promise<string> {
    const cachedResponse = getCachedPromptResponse(prompt, { namespace: this.name });
    if (cachedResponse !== undefined) {
      return cachedResponse;
    }

    if (!this.allowEmptyApiKey && !this.apiKey.trim()) {
      throw new Error(`API key ${this.label} belum diset.`);
    }

    await this.rateLimiter.acquire();

    if (typeof globalThis.fetch !== 'function') {
      throw new Error('Global fetch is not available in this environment.');
    }

    const responseText = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...this.extraHeaders
        };
        if (this.apiKey.trim()) {
          headers.Authorization = `Bearer ${this.apiKey.trim()}`;
        }

        const res = await globalThis.fetch(this.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: this.temperature,
            stream: false
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          throw new HttpStatusError(`${this.label} API error: ${res.status}`, res.status, await res.text());
        }

        const data = (await res.json()) as OpenAiChatResponse;
        return extractContent(data);
      } finally {
        clearTimeout(timeout);
      }
    });

    setCachedPromptResponse(prompt, responseText, { namespace: this.name });
    return responseText;
  }
}
