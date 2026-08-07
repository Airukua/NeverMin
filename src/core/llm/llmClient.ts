import { LlmProvider, ProviderName } from '../../types';
import { GeminiProvider } from './providers/geminiProvider';
import { AnthropicProvider } from './providers/anthropicProvider';
import { OpenAiCompatibleProvider } from './providers/openAiCompatibleProvider';
import { LlmProviderOptions } from './llmOptions';
import { getProviderCatalogEntry } from './providerCatalog';

export type { LlmProviderOptions } from './llmOptions';

/**
 * Factory + abstraksi supaya command/core lain tidak perlu tahu
 * detail provider mana yang dipakai.
 */
export function createLlmProvider(
  name: ProviderName,
  apiKey: string,
  options: LlmProviderOptions = {}
): LlmProvider {
  const entry = getProviderCatalogEntry(name);

  switch (entry.kind) {
    case 'gemini':
      return new GeminiProvider(apiKey, options);
    case 'anthropic':
      return new AnthropicProvider(apiKey, options);
    case 'openai':
    case 'ollama': {
      const baseUrl =
        options.baseUrl?.trim() ||
        entry.baseUrl ||
        (entry.kind === 'ollama' ? 'http://127.0.0.1:11434/v1' : 'https://api.openai.com/v1');

      return new OpenAiCompatibleProvider(
        apiKey,
        {
          name: entry.id,
          label: entry.label,
          baseUrl,
          defaultModel: entry.defaultModel,
          allowEmptyApiKey: entry.kind === 'ollama' || !entry.requiresApiKey,
          extraHeaders:
            entry.id === 'openrouter'
              ? {
                  'HTTP-Referer': 'https://github.com/abdulwahidrukua/NeverMIN',
                  'X-OpenRouter-Title': 'NeverMIN'
                }
              : undefined
        },
        options
      );
    }
    default: {
      const _exhaustive: never = entry.kind;
      throw new Error(`Jenis provider tidak dikenal: ${_exhaustive}`);
    }
  }
}
