import * as vscode from 'vscode';
import { HttpStatusError } from '../core/llm/retryWithBackoff';
import { t } from '../i18n';
import { Logger } from './logger';

export type LlmIssueKind =
  | 'no_key'
  | 'quota'
  | 'auth'
  | 'empty'
  | 'failed'
  | 'partial';

export interface LlmIssue {
  kind: LlmIssueKind;
  providerLabel: string;
  detail?: string;
}

function clip(text: string, max = 140): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) {
    return compact;
  }
  return `${compact.slice(0, max - 1)}…`;
}

function readStatus(error: unknown): number | undefined {
  if (error instanceof HttpStatusError) {
    return error.status;
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function readBody(error: unknown): string {
  if (error instanceof HttpStatusError && error.body) {
    return error.body;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? '');
}

/** Klasifikasi error HTTP/provider → jenis isu yang dimengerti user. */
export function classifyLlmError(error: unknown): Exclude<LlmIssueKind, 'no_key' | 'empty' | 'partial'> {
  const status = readStatus(error);
  const blob = readBody(error).toLowerCase();

  if (
    status === 429 ||
    status === 402 ||
    blob.includes('quota') ||
    blob.includes('resource_exhausted') ||
    blob.includes('rate limit') ||
    blob.includes('rate_limit') ||
    blob.includes('billing') ||
    blob.includes('insufficient_quota') ||
    blob.includes('exceeded')
  ) {
    return 'quota';
  }

  if (
    status === 401 ||
    status === 403 ||
    blob.includes('api key') ||
    blob.includes('unauthorized') ||
    blob.includes('forbidden') ||
    blob.includes('invalid_api_key') ||
    blob.includes('permission')
  ) {
    return 'auth';
  }

  return 'failed';
}

function issueMessage(issue: LlmIssue): string {
  const detail = issue.detail ? clip(issue.detail) : '';
  switch (issue.kind) {
    case 'no_key':
      return t('llm.notice.noKey', { label: issue.providerLabel });
    case 'quota':
      return t('llm.notice.quota', {
        label: issue.providerLabel,
        detail: detail || t('llm.notice.quotaHint')
      });
    case 'auth':
      return t('llm.notice.auth', {
        label: issue.providerLabel,
        detail: detail || t('llm.notice.authHint')
      });
    case 'empty':
      return t('llm.notice.empty', { label: issue.providerLabel });
    case 'partial':
      return t('llm.notice.partial', { label: issue.providerLabel });
    case 'failed':
    default:
      return t('llm.notice.failed', {
        label: issue.providerLabel,
        detail: detail || t('llm.notice.failedHint')
      });
  }
}

/**
 * Tampilkan peringatan VS Code + log, dengan aksi cepat (API key / settings / logs).
 * Diagram analisis tetap boleh sukses — ini khusus soal LLM.
 */
export async function notifyLlmIssue(issue: LlmIssue): Promise<void> {
  const message = issueMessage(issue);
  Logger.warn(`[llm-notice] ${issue.kind} · ${message}`);

  const saveKey = t('sidebar.action.saveApiKey');
  const openSettings = t('sidebar.action.openSettings');
  const openLogs = t('sidebar.logs.open');

  const buttons =
    issue.kind === 'no_key' || issue.kind === 'auth'
      ? [saveKey, openSettings, openLogs]
      : issue.kind === 'quota'
        ? [openSettings, openLogs]
        : [openLogs, openSettings];

  const picked = await vscode.window.showWarningMessage(message, ...buttons);
  if (picked === saveKey) {
    await vscode.commands.executeCommand('nevermin.setApiKey');
  } else if (picked === openSettings) {
    await vscode.commands.executeCommand('nevermin.openSettings');
  } else if (picked === openLogs) {
    await vscode.commands.executeCommand('nevermin.openOutputLogs');
  }
}

/** Ambil isu paling serius dari beberapa hasil enrich. */
export function pickPrimaryLlmIssue(issues: LlmIssue[]): LlmIssue | undefined {
  if (issues.length === 0) {
    return undefined;
  }
  const order: LlmIssueKind[] = ['quota', 'auth', 'no_key', 'failed', 'empty', 'partial'];
  for (const kind of order) {
    const hit = issues.find((item) => item.kind === kind);
    if (hit) {
      return hit;
    }
  }
  return issues[0];
}
