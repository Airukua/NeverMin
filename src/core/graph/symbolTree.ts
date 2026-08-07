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

export interface SymbolTreeFolder {
  folderPath: string;
  files: SymbolTreeFile[];
}

const SYMBOL_KINDS: ReadonlySet<NodeKind> = new Set(['function', 'class', 'method']);

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function folderOf(filePath: string): string {
  const normalized = normalizePath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx) : '.';
}

function baseName(filePath: string): string {
  const normalized = normalizePath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

/** Susun Folder → File → fungsi/class/method dari CodeGraph. */
export function buildSymbolTree(graph: CodeGraph, options: { maxFolders?: number; maxFilesPerFolder?: number; maxSymbolsPerFile?: number } = {}): SymbolTreeFolder[] {
  const maxFolders = options.maxFolders ?? 40;
  const maxFilesPerFolder = options.maxFilesPerFolder ?? 40;
  const maxSymbolsPerFile = options.maxSymbolsPerFile ?? 60;

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

  const byFolder = new Map<string, SymbolTreeFile[]>();
  for (const [filePath, symbols] of byFile) {
    const folder = folderOf(filePath);
    const files = byFolder.get(folder) ?? [];
    files.push({
      filePath,
      displayName: baseName(filePath),
      symbols: symbols
        .slice()
        .sort((a, b) => a.startLine - b.startLine || a.name.localeCompare(b.name))
        .slice(0, maxSymbolsPerFile)
    });
    byFolder.set(folder, files);
  }

  return [...byFolder.entries()]
    .map(([folderPath, files]) => ({
      folderPath,
      files: files
        .slice()
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, maxFilesPerFolder)
    }))
    .sort((a, b) => a.folderPath.localeCompare(b.folderPath))
    .slice(0, maxFolders);
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
