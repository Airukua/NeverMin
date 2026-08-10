/**
 * Ollama "thinking" models (qwen3, deepseek-r1, …) honor a top-level `think` field.
 * Non-thinking models should NOT receive `think` at all — sending it can break calls
 * or waste tokens when we blindly enable/disable it.
 */

const THINKING_MODEL_RE =
  /\b(qwen3|deepseek-r1|qwq|magistral|cogito|reasoning)\b|[/:-]r1\b|\br1[/:-]|\bthinking\b/i;

export function isThinkingModelName(model: string | undefined | null): boolean {
  const m = (model || '').trim();
  if (!m) return false;
  return THINKING_MODEL_RE.test(m);
}

/**
 * Resolve Ollama `think` option for a call.
 * - Non-Ollama → undefined (omit)
 * - Non-thinking model → undefined (omit)
 * - Thinking model + prefer-on → true (Explain UI)
 * - Thinking model + prefer-off → false (strict JSON)
 */
export function resolveOllamaThinkOption(
  provider: string | undefined | null,
  model: string | undefined | null,
  intent: 'prefer-on' | 'prefer-off'
): boolean | undefined {
  if ((provider || '').trim().toLowerCase() !== 'ollama') {
    return undefined;
  }
  if (!isThinkingModelName(model)) {
    return undefined;
  }
  return intent === 'prefer-on';
}
