import path from 'path';
import { extractSymbols, SymbolInfo } from '../parser/astParser';
import { GraphInsights } from '../graph/graphInsights';

export interface RepoFileSnapshot {
  filePath: string;
  workspaceRoot: string;
  content: string;
}

export interface RepoFolderSummary {
  folderPath: string;
  fileCount: number;
}

export interface RepoFileSummary {
  filePath: string;
  symbolCount: number;
  symbols: string[];
}

export interface RepoSymbolSummary {
  name: string;
  kind: SymbolInfo['kind'];
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface RepoAnalysis {
  generatedAt: string;
  workspaceRootCount: number;
  fileCount: number;
  folderCount: number;
  symbolCount: number;
  topFolders: RepoFolderSummary[];
  importantFiles: RepoFileSummary[];
  mainSymbols: RepoSymbolSummary[];
  insights?: GraphInsights;
}

interface AnalyzedFile {
  filePath: string;
  workspaceRoot: string;
  symbols: SymbolInfo[];
}

const TOP_FOLDER_LIMIT = 8;
const IMPORTANT_FILE_LIMIT = 8;
const MAIN_SYMBOL_LIMIT = 12;

function getWorkspaceLabel(workspaceRoot: string, filePath: string): string {
  const relativePath = path.relative(workspaceRoot, filePath);
  return relativePath || path.basename(filePath);
}

function getFolderLabel(workspaceRoot: string, filePath: string): string {
  const relativePath = path.relative(workspaceRoot, path.dirname(filePath));
  return relativePath ? `${path.basename(workspaceRoot)}/${relativePath}` : path.basename(workspaceRoot);
}

function isImportantFile(filePath: string): boolean {
  const baseName = path.basename(filePath).toLowerCase();
  return [
    'package.json',
    'README.md'.toLowerCase(),
    'readme.md',
    'tsconfig.json',
    'jsconfig.json',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
    'cargo.toml',
    'go.mod',
    'pyproject.toml'
  ].includes(baseName);
}

function scoreFile(filePath: string, symbolCount: number): number {
  const baseScore = symbolCount * 10;
  const importantBonus = isImportantFile(filePath) ? 40 : 0;
  const rootFileBonus = path.dirname(filePath) === path.dirname(path.dirname(filePath)) ? 5 : 0;
  return baseScore + importantBonus + rootFileBonus;
}

export async function analyzeRepoFiles(files: RepoFileSnapshot[]): Promise<RepoAnalysis> {
  const analyzedFiles: AnalyzedFile[] = [];
  const folderCounts = new Map<string, number>();

  for (const file of files) {
    const symbols = await extractSymbols(file.filePath, file.content);
    analyzedFiles.push({
      filePath: file.filePath,
      workspaceRoot: file.workspaceRoot,
      symbols
    });

    const folderLabel = getFolderLabel(file.workspaceRoot, file.filePath);
    folderCounts.set(folderLabel, (folderCounts.get(folderLabel) ?? 0) + 1);
  }

  const folderSummaries = [...folderCounts.entries()]
    .map(([folderPath, fileCount]) => ({ folderPath, fileCount }))
    .sort((left, right) => right.fileCount - left.fileCount || left.folderPath.localeCompare(right.folderPath));

  const fileSummaries = analyzedFiles
    .map((file) => ({
      filePath: getWorkspaceLabel(file.workspaceRoot, file.filePath),
      symbolCount: file.symbols.length,
      symbols: file.symbols.map((symbol) => symbol.name)
    }))
    .sort((left, right) => {
      const scoreDelta = scoreFile(right.filePath, right.symbolCount) - scoreFile(left.filePath, left.symbolCount);
      return scoreDelta || left.filePath.localeCompare(right.filePath);
    });

  const mainSymbols = analyzedFiles
    .flatMap((file) =>
      file.symbols.map((symbol) => ({
        name: symbol.name,
        kind: symbol.kind,
        filePath: getWorkspaceLabel(file.workspaceRoot, file.filePath),
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        span: symbol.endLine - symbol.startLine
      }))
    )
    .sort((left, right) => right.span - left.span || left.name.localeCompare(right.name) || left.filePath.localeCompare(right.filePath))
    .slice(0, MAIN_SYMBOL_LIMIT)
    .map(({ span, ...symbol }) => symbol);

  const workspaceRoots = new Set(analyzedFiles.map((file) => file.workspaceRoot));

  return {
    generatedAt: new Date().toISOString(),
    workspaceRootCount: workspaceRoots.size,
    fileCount: analyzedFiles.length,
    folderCount: folderCounts.size,
    symbolCount: analyzedFiles.reduce((total, file) => total + file.symbols.length, 0),
    topFolders: folderSummaries.slice(0, TOP_FOLDER_LIMIT),
    importantFiles: fileSummaries.slice(0, IMPORTANT_FILE_LIMIT),
    mainSymbols
  };
}
