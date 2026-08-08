import type { LlmCompletionResult, LlmTokenUsage } from '../../types';

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.round(value);
}

/** Normalisasi usage Chat Completions bergaya OpenAI (termasuk Ollama /v1). */
export function normalizeOpenAiTokenUsage(raw: unknown): LlmTokenUsage | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const usage = raw as Record<string, unknown>;
  const promptTokens = asNonNegativeInt(usage.prompt_tokens);
  const completionTokens = asNonNegativeInt(usage.completion_tokens);
  const totalTokens =
    asNonNegativeInt(usage.total_tokens) ??
    (promptTokens !== undefined || completionTokens !== undefined
      ? (promptTokens ?? 0) + (completionTokens ?? 0)
      : undefined);

  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined
  ) {
    return undefined;
  }

  return { promptTokens, completionTokens, totalTokens };
}

/** Normalisasi usage Anthropic Messages API. */
export function normalizeAnthropicTokenUsage(raw: unknown): LlmTokenUsage | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const usage = raw as Record<string, unknown>;
  const promptTokens = asNonNegativeInt(usage.input_tokens);
  const completionTokens = asNonNegativeInt(usage.output_tokens);
  if (promptTokens === undefined && completionTokens === undefined) {
    return undefined;
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens: (promptTokens ?? 0) + (completionTokens ?? 0)
  };
}

/** Normalisasi usageMetadata Gemini generateContent. */
export function normalizeGeminiTokenUsage(raw: unknown): LlmTokenUsage | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const usage = raw as Record<string, unknown>;
  const promptTokens = asNonNegativeInt(usage.promptTokenCount);
  const completionTokens = asNonNegativeInt(usage.candidatesTokenCount);
  const totalTokens =
    asNonNegativeInt(usage.totalTokenCount) ??
    (promptTokens !== undefined || completionTokens !== undefined
      ? (promptTokens ?? 0) + (completionTokens ?? 0)
      : undefined);

  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined
  ) {
    return undefined;
  }

  return { promptTokens, completionTokens, totalTokens };
}

export function addTokenUsage(
  a?: LlmTokenUsage,
  b?: LlmTokenUsage
): LlmTokenUsage | undefined {
  if (!a && !b) {
    return undefined;
  }
  const promptTokens = (a?.promptTokens ?? 0) + (b?.promptTokens ?? 0);
  const completionTokens = (a?.completionTokens ?? 0) + (b?.completionTokens ?? 0);
  const totalTokens =
    a?.totalTokens !== undefined || b?.totalTokens !== undefined
      ? (a?.totalTokens ?? 0) + (b?.totalTokens ?? 0)
      : promptTokens + completionTokens;

  return {
    promptTokens: a?.promptTokens !== undefined || b?.promptTokens !== undefined ? promptTokens : undefined,
    completionTokens:
      a?.completionTokens !== undefined || b?.completionTokens !== undefined
        ? completionTokens
        : undefined,
    totalTokens
  };
}

/**
 * Gabungkan usage dari satu hasil complete(). Cache hit tidak dihitung ulang
 * (token sudah dibayar di call asli).
 */
export function accumulateCompletionUsage(
  total: LlmTokenUsage | undefined,
  result: LlmCompletionResult | undefined
): LlmTokenUsage | undefined {
  if (!result?.usage || result.fromCache) {
    return total;
  }
  return addTokenUsage(total, result.usage);
}

export function formatTokenUsageForLog(usage?: LlmTokenUsage): string {
  if (!usage) {
    return '';
  }
  const prompt = usage.promptTokens;
  const completion = usage.completionTokens;
  const total = usage.totalTokens;
  if (prompt !== undefined && completion !== undefined) {
    const sum = total ?? prompt + completion;
    return `${prompt}+${completion}=${sum} tok`;
  }
  if (total !== undefined) {
    return `${total} tok`;
  }
  if (prompt !== undefined) {
    return `${prompt} prompt tok`;
  }
  if (completion !== undefined) {
    return `${completion} completion tok`;
  }
  return '';
}
