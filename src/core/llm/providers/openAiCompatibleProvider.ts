import { LlmCompleteOptions, LlmCompletionResult, LlmProvider, ProviderName } from '../../../types';
import { RateLimiter } from '../rateLimiter';
import { HttpStatusError, retryWithBackoff } from '../retryWithBackoff';
import { getCachedPromptResponse, setCachedPromptResponse } from '../promptCache';
import { LlmProviderOptions } from '../llmOptions';
import { normalizeOpenAiTokenUsage } from '../tokenUsage';
import { ollamaNativeBaseUrl } from '../../../utils/ollamaModels';
import { getOllamaNumCtx } from '../../../utils/config';

interface OpenAiChatMessage {
  content?: string | Array<{ type?: string; text?: string }>;
  /** Ollama native thinking / OpenAI-compat reasoning fields */
  thinking?: string;
  reasoning?: string;
  reasoning_content?: string;
}

interface OpenAiChatResponse {
  choices?: Array<{
    message?: OpenAiChatMessage;
  }>;
  usage?: unknown;
}

interface OllamaNativeChatResponse {
  message?: {
    content?: string;
    thinking?: string;
  };
  prompt_eval_count?: number;
  eval_count?: number;
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

function joinContentParts(content: string | Array<{ type?: string; text?: string }> | undefined): string {
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

/** Ambil thinking dari field API atau tag &lt;think&gt; di content. */
export function extractOpenAiMessageParts(message: OpenAiChatMessage | undefined): {
  text: string;
  thinking?: string;
} {
  const fieldThinking = [message?.thinking, message?.reasoning, message?.reasoning_content]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  let text = joinContentParts(message?.content).trim();
  let taggedThinking: string | undefined;

  const closed = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (closed) {
    taggedThinking = closed[1].trim();
    text = text.replace(closed[0], '').trim();
  } else {
    const openOnly = text.match(/<think>([\s\S]*)$/i);
    if (openOnly) {
      taggedThinking = openOnly[1].trim();
      text = text.slice(0, openOnly.index).trim();
    }
  }

  const thinking = fieldThinking || taggedThinking || undefined;
  return { text, thinking };
}

/** Base class untuk semua provider Chat Completions bergaya OpenAI. */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: ProviderName;
  private readonly rateLimiter: RateLimiter;
  private readonly model: string;
  private readonly temperature: number;
  private readonly endpoint: string;
  private readonly openAiBaseUrl: string;
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
    this.openAiBaseUrl = config.baseUrl.replace(/\/$/, '');
    this.endpoint = `${this.openAiBaseUrl}/chat/completions`;
    this.extraHeaders = config.extraHeaders ?? {};
    this.allowEmptyApiKey = Boolean(config.allowEmptyApiKey);
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: config.requestsPerMinute ?? 60
    });
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
        return {
          text: cached.response,
          thinking: cached.thinking,
          usage: cached.usage,
          fromCache: true
        };
      }
    }

    if (!this.allowEmptyApiKey && !this.apiKey.trim()) {
      throw new Error(`API key ${this.label} belum diset.`);
    }

    await this.rateLimiter.acquire();

    if (typeof globalThis.fetch !== 'function') {
      throw new Error('Global fetch is not available in this environment.');
    }

    const isOllama = this.name === 'ollama';
    const timeoutMs = isOllama ? 180_000 : 60_000;

    const result = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        if (isOllama) {
          return await this.completeOllamaNative(prompt, options, controller.signal);
        }
        return await this.completeOpenAiCompat(prompt, options, controller.signal);
      } finally {
        clearTimeout(timeout);
      }
    });

    if (cacheResponse) {
      setCachedPromptResponse(prompt, result.text, {
        namespace: this.name,
        usage: result.usage,
        thinking: result.thinking
      });
    }
    return result;
  }

  private async completeOpenAiCompat(
    prompt: string,
    _options: LlmCompleteOptions,
    signal: AbortSignal
  ): Promise<LlmCompletionResult> {
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
      signal
    });

    if (!res.ok) {
      const errBody = await res.text();
      const detail = errBody.replace(/\s+/g, ' ').trim().slice(0, 280);
      throw new HttpStatusError(
        detail
          ? `${this.label} API error: ${res.status} · ${detail}`
          : `${this.label} API error: ${res.status}`,
        res.status,
        errBody
      );
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const parts = extractOpenAiMessageParts(data.choices?.[0]?.message);
    return {
      text: parts.text,
      thinking: parts.thinking,
      usage: normalizeOpenAiTokenUsage(data.usage)
    };
  }

  /** Native /api/chat — `think` top-level benar-benar dihormati (beda dari /v1). */
  private async completeOllamaNative(
    prompt: string,
    options: LlmCompleteOptions,
    signal: AbortSignal
  ): Promise<LlmCompletionResult> {
    const native = ollamaNativeBaseUrl(this.openAiBaseUrl);
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: {
        temperature: this.temperature,
        // Banyak model Ollama default num_ctx=4096; prompt Explain file mudah >6k token.
        num_ctx: getOllamaNumCtx()
      }
    };
    if (options.think !== undefined) {
      body.think = options.think;
    }

    const res = await globalThis.fetch(`${native}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });

    if (!res.ok) {
      const errBody = await res.text();
      const detail = errBody.replace(/\s+/g, ' ').trim().slice(0, 280);
      throw new HttpStatusError(
        detail
          ? `${this.label} API error: ${res.status} · ${detail}`
          : `${this.label} API error: ${res.status}`,
        res.status,
        errBody
      );
    }

    const data = (await res.json()) as OllamaNativeChatResponse;
    const parts = extractOpenAiMessageParts({
      content: data.message?.content,
      thinking: data.message?.thinking
    });
    const promptTokens = data.prompt_eval_count;
    const completionTokens = data.eval_count;
    return {
      text: parts.text,
      thinking: parts.thinking,
      usage:
        promptTokens !== undefined || completionTokens !== undefined
          ? {
              promptTokens,
              completionTokens,
              totalTokens:
                promptTokens !== undefined && completionTokens !== undefined
                  ? promptTokens + completionTokens
                  : undefined
            }
          : undefined
    };
  }

  async completeStream(
    prompt: string,
    handlers: { onToken: (chunk: string) => void },
    options: LlmCompleteOptions = {}
  ): Promise<LlmCompletionResult> {
    const skipCache = Boolean(options.skipCache);
    if (!skipCache) {
      const cached = getCachedPromptResponse(prompt, { namespace: this.name });
      if (cached !== undefined) {
        if (cached.response) handlers.onToken(cached.response);
        return {
          text: cached.response,
          thinking: cached.thinking,
          usage: cached.usage,
          fromCache: true
        };
      }
    }

    if (!this.allowEmptyApiKey && !this.apiKey.trim()) {
      throw new Error(`API key ${this.label} belum diset.`);
    }
    if (typeof globalThis.fetch !== 'function') {
      throw new Error('Global fetch is not available in this environment.');
    }

    await this.rateLimiter.acquire();

    const isOllama = this.name === 'ollama';
    const timeoutMs = isOllama ? 180_000 : 90_000;
    const controller = new AbortController();
    const outer = options.signal;
    const onAbort = () => controller.abort();
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener('abort', onAbort, { once: true });
    }
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = isOllama
        ? await this.streamOllamaNative(prompt, handlers, options, controller.signal)
        : await this.streamOpenAiCompat(prompt, handlers, controller.signal);

      if (options.cacheResponse !== false) {
        setCachedPromptResponse(prompt, result.text, {
          namespace: this.name,
          usage: result.usage,
          thinking: result.thinking
        });
      }
      return result;
    } finally {
      clearTimeout(timeout);
      if (outer) outer.removeEventListener('abort', onAbort);
    }
  }

  private async streamOpenAiCompat(
    prompt: string,
    handlers: { onToken: (chunk: string) => void },
    signal: AbortSignal
  ): Promise<LlmCompletionResult> {
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
        stream: true
      }),
      signal
    });

    if (!res.ok) {
      const errBody = await res.text();
      const detail = errBody.replace(/\s+/g, ' ').trim().slice(0, 280);
      throw new HttpStatusError(
        detail
          ? `${this.label} API error: ${res.status} · ${detail}`
          : `${this.label} API error: ${res.status}`,
        res.status,
        errBody
      );
    }

    if (!res.body) {
      throw new Error(`${this.label} stream: empty body`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let text = '';
    let usage: LlmCompletionResult['usage'];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: unknown;
          };
          const piece = json.choices?.[0]?.delta?.content;
          if (typeof piece === 'string' && piece.length > 0) {
            text += piece;
            handlers.onToken(piece);
          }
          if (json.usage) {
            usage = normalizeOpenAiTokenUsage(json.usage);
          }
        } catch {
          /* ignore partial JSON */
        }
      }
    }

    const parts = extractOpenAiMessageParts({ content: text });
    return { text: parts.text || text, thinking: parts.thinking, usage };
  }

  private async streamOllamaNative(
    prompt: string,
    handlers: { onToken: (chunk: string) => void },
    options: LlmCompleteOptions,
    signal: AbortSignal
  ): Promise<LlmCompletionResult> {
    const native = ollamaNativeBaseUrl(this.openAiBaseUrl);
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      options: {
        temperature: this.temperature,
        num_ctx: getOllamaNumCtx()
      }
    };
    // Only set `think` when the caller opted in/out (thinking models).
    // Do NOT default to false — non-thinking models must omit the field.
    if (options.think !== undefined) {
      body.think = options.think;
    }

    const res = await globalThis.fetch(`${native}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });

    if (!res.ok) {
      const errBody = await res.text();
      const detail = errBody.replace(/\s+/g, ' ').trim().slice(0, 280);
      throw new HttpStatusError(
        detail
          ? `${this.label} API error: ${res.status} · ${detail}`
          : `${this.label} API error: ${res.status}`,
        res.status,
        errBody
      );
    }
    if (!res.body) {
      throw new Error(`${this.label} stream: empty body`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let text = '';
    let thinking = '';
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed) as {
            message?: { content?: string; thinking?: string };
            prompt_eval_count?: number;
            eval_count?: number;
            done?: boolean;
          };
          const piece = json.message?.content;
          if (typeof piece === 'string' && piece.length > 0) {
            text += piece;
            handlers.onToken(piece);
          }
          if (typeof json.message?.thinking === 'string' && json.message.thinking) {
            thinking += json.message.thinking;
          }
          if (json.prompt_eval_count !== undefined) promptTokens = json.prompt_eval_count;
          if (json.eval_count !== undefined) completionTokens = json.eval_count;
        } catch {
          /* ignore */
        }
      }
    }

    const parts = extractOpenAiMessageParts({
      content: text,
      thinking: thinking || undefined
    });
    return {
      text: parts.text || text,
      thinking: parts.thinking,
      usage:
        promptTokens !== undefined || completionTokens !== undefined
          ? {
              promptTokens,
              completionTokens,
              totalTokens:
                promptTokens !== undefined && completionTokens !== undefined
                  ? promptTokens + completionTokens
                  : undefined
            }
          : undefined
    };
  }
}
