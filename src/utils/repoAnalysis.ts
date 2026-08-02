import * as vscode from 'vscode';
import { RepoAnalysis } from '../core/analysis/repoAnalyzer';

const REPO_ANALYSIS_KEY = 'nevermin.repoAnalysis';
const REPO_ANALYSIS_STATUS_KEY = 'nevermin.repoAnalysisStatus';

export type RepoAnalysisStatus = 'idle' | 'loading' | 'ready' | 'error';

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
