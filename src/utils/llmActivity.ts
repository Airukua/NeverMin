import { Logger } from './logger';
import { t } from '../i18n';
import type { LlmCompletionResult } from '../types';
import { formatTokenUsageForLog } from '../core/llm/tokenUsage';

export interface LlmCallMeta {
  /** Nama tugas singkat untuk sidebar, mis. "narasi insights" */
  task: string;
  provider: string;
  model?: string;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  return String(error);
}

function clip(text: string, max = 96): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) {
    return compact;
  }
  return `${compact.slice(0, max - 1)}…`;
}

/**
 * Log panggilan LLM ke Output + sidebar (activity): mulai, sukses+ringkas hasil, atau gagal.
 */
export async function runLoggedLlmCall<T>(
  meta: LlmCallMeta,
  run: () => Promise<T>,
  summarize: (result: T) => string
): Promise<T> {
  const modelPart = meta.model?.trim() ? ` · ${meta.model.trim()}` : '';
  Logger.info(t('llm.call', { task: meta.task, provider: meta.provider, model: modelPart }));
  const started = Date.now();
  try {
    const result = await run();
    const ms = Date.now() - started;
    Logger.info(t('llm.ok', { task: meta.task, ms: String(ms), summary: summarize(result) }));
    return result;
  } catch (error) {
    const ms = Date.now() - started;
    Logger.error(t('llm.fail', { task: meta.task, ms: String(ms), error: formatError(error) }));
    throw error;
  }
}

/** Wrap text summarizer supaya log ikut menampilkan token usage bila ada. */
export function withCompletionUsageSummary(
  summarizeText: (text: string) => string
): (result: LlmCompletionResult) => string {
  return (result) => {
    const base = summarizeText(result.text);
    const usage = formatTokenUsageForLog(result.usage);
    const cacheTag = result.fromCache ? ' · cache' : '';
    const thinking = result.thinking?.trim();
    if (thinking) {
      Logger.info(`LLM thinking · ${thinking.length} karakter · ${clip(thinking, 160)}`);
    }
    const thinkTag = thinking ? ` · thinking=${thinking.length}c` : '';
    return usage ? `${base} · ${usage}${thinkTag}${cacheTag}` : `${base}${thinkTag}${cacheTag}`;
  };
}

/** Cuplikan narasi untuk log (ambil heading tujuan bila ada). */
export function summarizeNarrativeResult(narrative: string): string {
  const text = narrative.trim();
  if (!text) {
    return t('llm.empty');
  }
  const purpose = text.match(
    /##\s*(?:Kodingan ini untuk apa|What this codebase is for)\s*([\s\S]*?)(?=\n##\s|$)/i
  );
  const focus = (purpose?.[1] || text).trim();
  return `${text.length} karakter · ${clip(focus)}`;
}

export function summarizeNodeSummariesResult(
  summaries: Record<string, string>,
  targetCount: number
): string {
  const keys = Object.keys(summaries);
  if (keys.length === 0) {
    return t('llm.parseFail', { count: targetCount });
  }
  const sample = keys
    .slice(0, 3)
    .map((key) => clip(summaries[key] || key, 40))
    .join(' | ');
  return `${keys.length}/${targetCount} node · ${sample}`;
}

export function summarizeExplainResult(answer: string): string {
  const text = answer.trim();
  if (!text) {
    return t('llm.empty');
  }
  return `${text.length} karakter · ${clip(text)}`;
}
