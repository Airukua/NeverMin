import { LlmProvider, ProviderName } from '../../types';
import { GeminiProvider } from './providers/geminiProvider';
import { DeepseekProvider } from './providers/deepseekProvider';

/**
 * Factory + abstraksi supaya command/core lain tidak perlu tahu
 * detail provider mana yang dipakai. Tambah provider baru = tambah
 * satu file di ./providers + satu baris di sini.
 */
export function createLlmProvider(name: ProviderName, apiKey: string): LlmProvider {
  switch (name) {
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'deepseek':
      return new DeepseekProvider(apiKey);
    default: {
      const _exhaustive: never = name;
      throw new Error(`Provider tidak dikenal: ${_exhaustive}`);
    }
  }
}
