import { ProviderName } from '../../types';

export interface ProviderCatalogEntry {
  readonly id: ProviderName;
  readonly label: string;
  readonly description: string;
  readonly defaultModel: string;
  /** OpenAI-compatible chat completions URL, or special markers. */
  readonly kind: 'openai' | 'gemini' | 'anthropic' | 'ollama';
  readonly baseUrl?: string;
  readonly requiresApiKey: boolean;
  readonly docsUrl: string;
}

/**
 * Catalog penyedia LLM NeverMIN (riset 2026).
 * OpenAI-compatible digabung lewat satu base class; Gemini/Anthropic khusus.
 */
export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Google AI Studio / Gemini API',
    defaultModel: 'gemini-flash-latest',
    kind: 'gemini',
    requiresApiKey: true,
    docsUrl: 'https://ai.google.dev/'
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o / o-series via Chat Completions',
    defaultModel: 'gpt-4o-mini',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    docsUrl: 'https://platform.openai.com/docs'
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude via Messages API',
    defaultModel: 'claude-sonnet-4-5',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    requiresApiKey: true,
    docsUrl: 'https://docs.anthropic.com/'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: '400+ model dari banyak provider (satu API key)',
    defaultModel: 'openrouter/auto',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    docsUrl: 'https://openrouter.ai/docs'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'DeepSeek Chat Completions',
    defaultModel: 'deepseek-chat',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com',
    requiresApiKey: true,
    docsUrl: 'https://api-docs.deepseek.com/'
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Inference cepat (Llama, Mixtral, dll.)',
    defaultModel: 'llama-3.3-70b-versatile',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    docsUrl: 'https://console.groq.com/docs'
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    description: 'Mistral / Mixtral Chat Completions',
    defaultModel: 'mistral-small-latest',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
    docsUrl: 'https://docs.mistral.ai/'
  },
  {
    id: 'together',
    label: 'Together AI',
    description: 'Open-source models via Together',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    kind: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    requiresApiKey: true,
    docsUrl: 'https://docs.together.ai/'
  },
  {
    id: 'xai',
    label: 'xAI',
    description: 'Grok models',
    defaultModel: 'grok-2-latest',
    kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    requiresApiKey: true,
    docsUrl: 'https://docs.x.ai/'
  },
  {
    id: 'ollama',
    label: 'Ollama',
    description: 'Local OpenAI-compatible (localhost)',
    defaultModel: 'llama3.2',
    kind: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    requiresApiKey: false,
    docsUrl: 'https://ollama.com/'
  }
] as const;

export function getProviderCatalogEntry(id: ProviderName): ProviderCatalogEntry {
  const entry = PROVIDER_CATALOG.find((item) => item.id === id);
  if (!entry) {
    throw new Error(`Provider tidak dikenal: ${id}`);
  }
  return entry;
}

export function isProviderName(value: string): value is ProviderName {
  return PROVIDER_CATALOG.some((item) => item.id === value);
}

export const PROVIDER_IDS: ProviderName[] = PROVIDER_CATALOG.map((item) => item.id);
