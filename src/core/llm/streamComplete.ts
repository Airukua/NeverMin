import type {
  LlmCompleteOptions,
  LlmCompletionResult,
  LlmProvider,
  LlmStreamHandlers
} from '../../types';

/** Stream bila provider mendukung; kalau tidak, satu shot `complete` lalu emit penuh. */
export async function completeWithOptionalStream(
  provider: LlmProvider,
  prompt: string,
  handlers: LlmStreamHandlers,
  options: LlmCompleteOptions = {}
): Promise<LlmCompletionResult> {
  if (typeof provider.completeStream === 'function') {
    return provider.completeStream(prompt, handlers, options);
  }
  const result = await provider.complete(prompt, options);
  if (result.text) {
    handlers.onToken(result.text);
  }
  return result;
}
