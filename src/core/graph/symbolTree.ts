import { CodeGraph, GraphNode, NodeKind } from './types';

export interface SymbolTreeSymbol {
  id: string;
  name: string;
  kind: NodeKind;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface SymbolTreeFile {
  filePath: string;
  displayName: string;
  symbols: SymbolTreeSymbol[];
}

/** Satu level folder — nested seperti VS Code Explorer (bukan flat path panjang). */
export interface SymbolTreeFolder {
  /** Label pendek: `src`, `app`, `(auth)`. */
  name: string;
  /** Path relatif penuh untuk tooltip: `src/app/(auth)`. */
  folderPath: string;
  folders: SymbolTreeFolder[];
  files: SymbolTreeFile[];
}

export interface SymbolTreeRoot {
  folders: SymbolTreeFolder[];
  files: SymbolTreeFile[];
}

const SYMBOL_KINDS: ReadonlySet<NodeKind> = new Set(['function', 'class', 'method']);

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function baseName(filePath: string): string {
  const normalized = normalizePath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

/** Path file relatif ke workspace root (mis. `src/utils/a.ts`). */
export function relativePathForFile(filePath: string, workspaceRoots: string[] = []): string {
  const normalized = normalizePath(filePath);
  for (const root of workspaceRoots) {
    const rootNorm = normalizePath(root).replace(/\/+$/, '');
    if (!rootNorm) {
      continue;
    }
    if (normalized === rootNorm) {
      return baseName(normalized);
    }
    const prefix = `${rootNorm}/`;
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length);
    }
  }
  return normalized.replace(/^\.\//, '');
}

/** @deprecated pakai relativePathForFile + nested tree */
export function folderKeyForFile(filePath: string, workspaceRoots: string[] = []): string {
  const relative = relativePathForFile(filePath, workspaceRoots);
  const idx = relative.lastIndexOf('/');
  return idx >= 0 ? relative.slice(0, idx) : '.';
}

interface MutableFolder {
  name: string;
  folderPath: string;
  folders: Map<string, MutableFolder>;
  files: SymbolTreeFile[];
}

function createMutableFolder(name: string, folderPath: string): MutableFolder {
  return { name, folderPath, folders: new Map(), files: [] };
}

function ensureChild(parent: MutableFolder, segment: string): MutableFolder {
  let child = parent.folders.get(segment);
  if (!child) {
    const folderPath = parent.folderPath === '.' ? segment : `${parent.folderPath}/${segment}`;
    child = createMutableFolder(segment, folderPath);
    parent.folders.set(segment, child);
  }
  return child;
}

function freezeFolder(folder: MutableFolder, maxFilesPerFolder: number): SymbolTreeFolder {
  return {
    name: folder.name,
    folderPath: folder.folderPath,
    folders: [...folder.folders.values()]
      .map((child) => freezeFolder(child, maxFilesPerFolder))
      .sort((a, b) => a.name.localeCompare(b.name)),
    files: folder.files
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .slice(0, maxFilesPerFolder)
  };
}

export function countSymbolFiles(folder: SymbolTreeFolder): number {
  return folder.files.length + folder.folders.reduce((sum, child) => sum + countSymbolFiles(child), 0);
}

/**
 * Susun tree Folder → (subfolder | File) → fungsi/class/method.
 * Nested seperti sidebar Explorer VS Code, bukan daftar path flat.
 */
export function buildSymbolTree(
  graph: CodeGraph,
  options: {
    maxFilesPerFolder?: number;
    maxSymbolsPerFile?: number;
    workspaceRoots?: string[];
  } = {}
): SymbolTreeRoot {
  const maxFilesPerFolder = options.maxFilesPerFolder ?? 80;
  const maxSymbolsPerFile = options.maxSymbolsPerFile ?? 60;
  const workspaceRoots = options.workspaceRoots ?? [];

  const byFile = new Map<string, SymbolTreeSymbol[]>();
  for (const node of graph.nodes) {
    if (!SYMBOL_KINDS.has(node.kind)) {
      continue;
    }
    const filePath = normalizePath(node.filePath);
    const list = byFile.get(filePath) ?? [];
    list.push({
      id: node.id,
      name: node.name,
      kind: node.kind,
      filePath,
      startLine: node.startLine,
      endLine: node.endLine
    });
    byFile.set(filePath, list);
  }

  const root = createMutableFolder('.', '.');

  for (const [filePath, symbols] of byFile) {
    const relative = relativePathForFile(filePath, workspaceRoots);
    const parts = relative.split('/').filter(Boolean);
    if (parts.length === 0) {
      continue;
    }

    const displayName = parts[parts.length - 1];
    const dirSegments = parts.slice(0, -1);
    let cursor = root;
    for (const segment of dirSegments) {
      cursor = ensureChild(cursor, segment);
    }

    cursor.files.push({
      filePath,
      displayName,
      symbols: symbols
        .slice()
        .sort((a, b) => a.startLine - b.startLine || a.name.localeCompare(b.name))
        .slice(0, maxSymbolsPerFile)
    });
  }

  const frozen = freezeFolder(root, maxFilesPerFolder);
  return {
    folders: frozen.folders,
    files: frozen.files
  };
}

export function symbolsInFile(graph: CodeGraph, filePath: string): GraphNode[] {
  const target = normalizePath(filePath);
  return graph.nodes.filter(
    (node) =>
      SYMBOL_KINDS.has(node.kind) &&
      (normalizePath(node.filePath) === target ||
        normalizePath(node.id).startsWith(target) ||
        node.id.replace(/\\/g, '/').includes(`/${baseName(target)}#`))
  );
}
