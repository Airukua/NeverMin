import * as vscode from 'vscode';

const CODE_FILE_GLOB = '**/*.{ts,tsx,js,jsx,mjs,cjs,py,go,java,kt,kts,rs,rb,php,sh,c,cc,cpp,h,hpp,cs,swift,md}';
const ANALYSIS_FILE_GLOB = '**/*.{ts,tsx,js,jsx,mjs,cjs,py,go,java,kt,kts,rs,rb,php,sh,c,cc,cpp,h,hpp,cs,swift,md,json,yml,yaml,toml,txt}';
const WORKSPACE_EXCLUDES = '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.vscode-test/**,**/build/**,**/coverage/**,**/vendor/**,**/lib/**,**/libs/**,**/.next/**,**/.nuxt/**,**/.svelte-kit/**,**/.cache/**,**/.turbo/**,**/tmp/**,**/temp/**}';
const IGNORED_PATH_SEGMENTS = [
  'node_modules',
  '.git',
  'dist',
  'out',
  '.vscode-test',
  'build',
  'coverage',
  'vendor',
  'lib',
  'libs',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.cache',
  '.turbo',
  'tmp',
  'temp'
];

export function hasWorkspaceFolders(): boolean {
  return (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
}

export async function getWorkspaceCodeFiles(maxResults = 50): Promise<vscode.Uri[]> {
  if (!hasWorkspaceFolders()) {
    return [];
  }

  return vscode.workspace.findFiles(CODE_FILE_GLOB, WORKSPACE_EXCLUDES, maxResults);
}

export async function getWorkspaceAnalysisFiles(maxResults = 200): Promise<vscode.Uri[]> {
  if (!hasWorkspaceFolders()) {
    return [];
  }

  return vscode.workspace.findFiles(ANALYSIS_FILE_GLOB, WORKSPACE_EXCLUDES, maxResults);
}

export async function hasWorkspaceCodeFiles(): Promise<boolean> {
  const files = await getWorkspaceCodeFiles(1);
  return files.length > 0;
}

export function isIgnoredWorkspacePath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  return IGNORED_PATH_SEGMENTS.some((segment) => normalizedPath.includes(`/${segment}/`) || normalizedPath.endsWith(`/${segment}`));
}
