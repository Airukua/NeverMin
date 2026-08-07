import * as vscode from 'vscode';
import { RepoAnalysis } from '../core/analysis/repoAnalyzer';

const REPO_ANALYSIS_KEY = 'nevermin.repoAnalysis';
const REPO_ANALYSIS_STATUS_KEY = 'nevermin.repoAnalysisStatus';
const REPO_ANALYSIS_MODE_KEY = 'nevermin.lastAnalysisMode';

export type RepoAnalysisStatus = 'idle' | 'loading' | 'ready' | 'error';
export type AnalysisMode = 'repo' | 'selected';

export function getLatestRepoAnalysis(context: vscode.ExtensionContext): RepoAnalysis | undefined {
  return context.workspaceState.get<RepoAnalysis>(REPO_ANALYSIS_KEY);
}

export async function saveRepoAnalysis(context: vscode.ExtensionContext, analysis: RepoAnalysis): Promise<void> {
  await context.workspaceState.update(REPO_ANALYSIS_KEY, analysis);
}

export function getRepoAnalysisStatus(context: vscode.ExtensionContext): RepoAnalysisStatus {
  return context.workspaceState.get<RepoAnalysisStatus>(REPO_ANALYSIS_STATUS_KEY, 'idle');
}

export async function setRepoAnalysisStatus(
  context: vscode.ExtensionContext,
  status: RepoAnalysisStatus
): Promise<void> {
  await context.workspaceState.update(REPO_ANALYSIS_STATUS_KEY, status);
}

export function getLastAnalysisMode(context: vscode.ExtensionContext): AnalysisMode {
  return context.workspaceState.get<AnalysisMode>(REPO_ANALYSIS_MODE_KEY, 'repo');
}

export async function setLastAnalysisMode(
  context: vscode.ExtensionContext,
  mode: AnalysisMode
): Promise<void> {
  await context.workspaceState.update(REPO_ANALYSIS_MODE_KEY, mode);
}

/** Hapus hasil analisis tersimpan (bukan file di disk). */
export async function clearRepoAnalysis(context: vscode.ExtensionContext): Promise<void> {
  await context.workspaceState.update(REPO_ANALYSIS_KEY, undefined);
  await context.workspaceState.update(REPO_ANALYSIS_STATUS_KEY, 'idle');
}

export async function clearLastAnalysisMode(context: vscode.ExtensionContext): Promise<void> {
  await context.workspaceState.update(REPO_ANALYSIS_MODE_KEY, undefined);
}
