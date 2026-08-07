import * as vscode from 'vscode';
import { GitHistoryInsights } from '../core/git/gitHistoryInsights';

const GIT_HISTORY_KEY = 'nevermin.gitHistory';
const GIT_HISTORY_STATUS_KEY = 'nevermin.gitHistoryStatus';

export type GitHistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

export function getLatestGitHistory(context: vscode.ExtensionContext): GitHistoryInsights | undefined {
  return context.workspaceState.get<GitHistoryInsights>(GIT_HISTORY_KEY);
}

export async function saveGitHistory(
  context: vscode.ExtensionContext,
  insights: GitHistoryInsights
): Promise<void> {
  await context.workspaceState.update(GIT_HISTORY_KEY, insights);
}

export function getGitHistoryStatus(context: vscode.ExtensionContext): GitHistoryStatus {
  return context.workspaceState.get<GitHistoryStatus>(GIT_HISTORY_STATUS_KEY, 'idle');
}

export async function setGitHistoryStatus(
  context: vscode.ExtensionContext,
  status: GitHistoryStatus
): Promise<void> {
  await context.workspaceState.update(GIT_HISTORY_STATUS_KEY, status);
}

/** Hapus hasil Git History tersimpan. */
export async function clearGitHistory(context: vscode.ExtensionContext): Promise<void> {
  await context.workspaceState.update(GIT_HISTORY_KEY, undefined);
  await context.workspaceState.update(GIT_HISTORY_STATUS_KEY, 'idle');
}
