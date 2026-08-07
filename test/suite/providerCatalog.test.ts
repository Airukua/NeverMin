import * as assert from 'assert';
import { createLlmProvider } from '../../src/core/llm/llmClient';
import { PROVIDER_CATALOG, isProviderName } from '../../src/core/llm/providerCatalog';
import { PROVIDER_IDS } from '../../src/core/llm/providerCatalog';

describe('provider catalog + factory', () => {
  it('semua id catalog valid sebagai ProviderName', () => {
    for (const entry of PROVIDER_CATALOG) {
      assert.ok(isProviderName(entry.id), entry.id);
    }
    assert.strictEqual(PROVIDER_IDS.length, PROVIDER_CATALOG.length);
  });

  it('createLlmProvider membuat instance untuk setiap provider', () => {
    for (const entry of PROVIDER_CATALOG) {
      const provider = createLlmProvider(entry.id, entry.requiresApiKey ? 'test-key' : '', {
        model: entry.defaultModel
      });
      assert.strictEqual(provider.name, entry.id);
    }
  });

  it('mencakup OpenAI sampai OpenRouter plus lokal/aggregator lain', () => {
    const ids = new Set(PROVIDER_CATALOG.map((e) => e.id));
    for (const required of [
      'gemini',
      'openai',
      'anthropic',
      'openrouter',
      'deepseek',
      'groq',
      'mistral',
      'together',
      'xai',
      'ollama'
    ]) {
      assert.ok(ids.has(required as never), required);
    }
  });
});
