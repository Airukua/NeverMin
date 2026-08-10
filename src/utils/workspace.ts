import * as vscode from 'vscode';

/**
 * Globs sengaja dipecah (bukan nested brace).
 * Pola nested brace (mis. star-star / {a, star.{ts,js}}) sering bikin findFiles kosong.
 */
const CODE_GLOBS = [
  '**/*.{ts,tsx,js,jsx,mjs,cjs}',
  '**/*.{py,go,rs,java,kt,kts,rb,php}',
  '**/*.{c,cc,cpp,h,hpp,cs,swift,sh}'
] as const;

const DOC_GLOBS = ['**/*.{md,json,yml,yaml,toml,txt}'] as const;

const EXTRA_GLOBS = ['**/CODEOWNERS', '**/.env', '**/.env.*'] as const;

/** Exclude satu level brace saja — nested brace rawan bikin match gagal. */
const WORKSPACE_EXCLUDES =
  '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.vscode-test/**,**/build/**,**/coverage/**,**/vendor/**,**/.next/**,**/.nuxt/**,**/.svelte-kit/**,**/.cache/**,**/.turbo/**,**/tmp/**,**/temp/**}';

const IGNORED_PATH_SEGMENTS = [
  'node_modules',
  '.git',
  'dist',
  'out',
  '.vscode-test',
  'build',
  'coverage',
  'vendor',
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

export function isIgnoredWorkspacePath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  return IGNORED_PATH_SEGMENTS.some(
    (segment) => normalizedPath.includes(`/${segment}/`) || normalizedPath.endsWith(`/${segment}`)
  );
}

async function findFilesSafe(
  include: vscode.GlobPattern,
  exclude: vscode.GlobPattern | undefined,
  maxResults: number
): Promise<vscode.Uri[]> {
  if (maxResults <= 0) {
    return [];
  }
  try {
    return await vscode.workspace.findFiles(include, exclude, maxResults);
  } catch {
    return [];
  }
}

async function findByGlobs(
  globs: readonly string[],
  maxResults: number,
  exclude: vscode.GlobPattern | undefined
): Promise<vscode.Uri[]> {
  const byPath = new Map<string, vscode.Uri>();
  const folders = vscode.workspace.workspaceFolders ?? [];

  const add = (uris: readonly vscode.Uri[]): boolean => {
    for (const uri of uris) {
      if (isIgnoredWorkspacePath(uri.fsPath)) {
        continue;
      }
      byPath.set(uri.fsPath, uri);
      if (byPath.size >= maxResults) {
        return true;
      }
    }
    return false;
  };

  for (const glob of globs) {
    if (byPath.size >= maxResults) {
      break;
    }
    const remaining = maxResults - byPath.size;
    // Fetch ekstra untuk mengisi slot setelah filter ignore.
    const fetchCap = Math.min(Math.max(maxResults * 2, remaining + 150), 5000);

    if (folders.length > 0) {
      const batches = await Promise.all(
        folders.map((folder) =>
          findFilesSafe(new vscode.RelativePattern(folder, glob), exclude, fetchCap)
        )
      );
      if (add(batches.flat())) {
        break;
      }
    } else {
      const found = await findFilesSafe(glob, exclude, fetchCap);
      if (add(found)) {
        break;
      }
    }
  }

  return [...byPath.values()].slice(0, maxResults);
}

/**
 * Kumpulkan file analisis: code dulu, lalu docs/config.
 * Dipakai sidebar + "Analisis seluruh repo" (satu jalur).
 */
export async function getWorkspaceAnalysisFiles(maxResults = 200): Promise<vscode.Uri[]> {
  if (!hasWorkspaceFolders() || maxResults <= 0) {
    return [];
  }

  const priorityGlobs = [...CODE_GLOBS, ...DOC_GLOBS, ...EXTRA_GLOBS];

  let files = await findByGlobs(priorityGlobs, maxResults, WORKSPACE_EXCLUDES);

  // Fallback: default files.exclude / search.exclude host
  if (files.length === 0) {
    files = await findByGlobs([...CODE_GLOBS, ...DOC_GLOBS], maxResults, undefined);
  }

  return files;
}

/** File kode saja (tanpa json/yml/txt ekstra) — status sidebar / preflight. */
export async function getWorkspaceCodeFiles(maxResults = 50): Promise<vscode.Uri[]> {
  if (!hasWorkspaceFolders() || maxResults <= 0) {
    return [];
  }

  let files = await findByGlobs(CODE_GLOBS, maxResults, WORKSPACE_EXCLUDES);
  if (files.length === 0) {
    files = await findByGlobs(CODE_GLOBS, maxResults, undefined);
  }
  return files;
}

export async function hasWorkspaceCodeFiles(): Promise<boolean> {
  const files = await getWorkspaceCodeFiles(1);
  return files.length > 0;
}
