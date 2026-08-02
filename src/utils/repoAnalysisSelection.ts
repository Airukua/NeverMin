import * as vscode from 'vscode';

const REPO_ANALYSIS_SELECTED_FILES_KEY = 'nevermin.selectedAnalysisFiles';

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function getSelectedAnalysisFilePaths(context: vscode.ExtensionContext): string[] {
  const stored = context.workspaceState.get<string[]>(REPO_ANALYSIS_SELECTED_FILES_KEY, []);
  return [...new Set(stored.map(normalizeFilePath))];
}

export function getSelectedAnalysisFileUris(context: vscode.ExtensionContext): vscode.Uri[] {
  return getSelectedAnalysisFilePaths(context).map((filePath) => vscode.Uri.file(filePath));
}

export async function setSelectedAnalysisFilePaths(
  context: vscode.ExtensionContext,
  filePaths: string[]
): Promise<void> {
  const normalized = [...new Set(filePaths.map(normalizeFilePath))].filter((value) => value.length > 0);
  await context.workspaceState.update(REPO_ANALYSIS_SELECTED_FILES_KEY, normalized);
}

export async function addSelectedAnalysisFilePath(
  context: vscode.ExtensionContext,
  filePath: string
): Promise<void> {
  const current = getSelectedAnalysisFilePaths(context);
  await setSelectedAnalysisFilePaths(context, [...current, filePath]);
}

export async function removeSelectedAnalysisFilePath(
  context: vscode.ExtensionContext,
  filePath: string
): Promise<void> {
  const normalizedTarget = normalizeFilePath(filePath);
  const current = getSelectedAnalysisFilePaths(context).filter((value) => value !== normalizedTarget);
  await setSelectedAnalysisFilePaths(context, current);
}
