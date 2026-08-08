import type { ProviderName } from '../../types';
import type { NeverminLanguage } from '../../i18n/types';
import { Logger } from '../../utils/logger';
import { classifyLlmError, type LlmIssueKind } from '../../utils/llmUserNotice';

export interface SemanticRetryPlan {
  maxAttempts: number;
  baseDelayMs: number;
}

/** Ollama kecil sering gagal format — retry agresif. Cloud cukup 2x. */
export function semanticRetryPlanFor(provider: ProviderName): SemanticRetryPlan {
  if (provider === 'ollama') {
    return { maxAttempts: 5, baseDelayMs: 1500 };
  }
  return { maxAttempts: 2, baseDelayMs: 1000 };
}

export function semanticRetryTemperature(base: number, attemptIndex: number): number {
  return Math.min(0.85, Math.max(0, base) + attemptIndex * 0.12);
}

export function semanticRetryPromptSuffix(
  attemptIndex: number,
  lang: NeverminLanguage
): string {
  if (attemptIndex <= 0) {
    return '';
  }
  if (lang === 'en') {
    return [
      '',
      'IMPORTANT (retry): Previous answer was invalid or empty.',
      'Reply with ONLY the required output format.',
      'No preamble. No wrapping the entire answer in a markdown code fence.'
    ].join('\n');
  }
  return [
    '',
    'PENTING (retry): Jawaban sebelumnya tidak valid atau kosong.',
    'Balas HANYA dengan format output yang diminta.',
    'Tanpa pembuka. Jangan bungkus seluruh jawaban dalam code fence markdown.'
  ].join('\n');
}

export function semanticRetryDelayMs(baseDelayMs: number, attemptIndex: number): number {
  // attemptIndex = failed attempt number starting at 0 before first retry wait
  return Math.min(10_000, baseDelayMs * 2 ** Math.max(0, attemptIndex) + Math.floor(Math.random() * 400));
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Auth / no_key / quota jelas — jangan retry. */
export function shouldAbortSemanticRetry(kind: LlmIssueKind): boolean {
  return kind === 'auth' || kind === 'no_key' || kind === 'quota';
}

export function shouldAbortSemanticRetryFromError(error: unknown): boolean {
  return shouldAbortSemanticRetry(classifyLlmError(error));
}

export function logSemanticRetry(
  task: string,
  attempt: number,
  maxAttempts: number,
  reason: string
): void {
  Logger.warn(
    `LLM retry · ${task} · percobaan ${attempt}/${maxAttempts} · ${reason.replace(/\s+/g, ' ').trim().slice(0, 160)}`
  );
}
