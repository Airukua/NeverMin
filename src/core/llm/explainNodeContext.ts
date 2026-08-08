import { CodeChunk } from '../../types';
import { NeverminLanguage } from '../../i18n/types';
import { CodeGraph } from '../graph/types';
import {
  buildModuleFolderMermaid,
  collectModuleFolderFiles,
  moduleFolderKey,
  type ModuleFolderFileInfo
} from '../graph/repoMermaid';
import { buildContextFromFile } from '../context/contextBuilder';
import {
  buildExplainFilePrompt,
  buildExplainFunctionPrompt,
  buildExplainModulePrompt
} from './promptBuilder';

export type ExplainGraphView = 'architecture' | 'modules' | 'flow' | 'functions' | 'git';

export type ExplainScope = 'file' | 'module' | 'function';

export interface ExplainNodeMeta {
  id?: string;
  name?: string;
  kind?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  expandKey?: string;
  view?: ExplainGraphView | string;
}

export function resolveExplainScope(meta: ExplainNodeMeta): ExplainScope {
  const view = (meta.view || '').trim();
  const kind = (meta.kind || '').trim().toLowerCase();

  if (view === 'modules' || kind === 'module' || kind === 'folder') {
    return 'module';
  }

  if (view === 'functions') {
    if (kind === 'function' || kind === 'method' || kind === 'class') {
      return 'function';
    }
    // file-group overview → jelaskan file utuh
    return 'file';
  }

  // Architecture & Flow: satu file utuh (bukan potongan symbol saja)
  return 'file';
}

function sliceLines(content: string, startLine: number, endLine: number): string {
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, Math.max(start + 1, endLine));
  return lines.slice(start, end).join('\n');
}

async function buildFileChunks(filePath: string, fileContent: string): Promise<CodeChunk[]> {
  // Query kosong = semua chunk simbol di file (file utuh untuk Architecture).
  return buildContextFromFile(filePath, fileContent, '');
}

async function buildFunctionChunks(
  filePath: string,
  fileContent: string,
  startLine: number,
  endLine: number,
  symbolName?: string
): Promise<CodeChunk[]> {
  const selection = sliceLines(fileContent, startLine, endLine).trim() || fileContent;
  const chunks = await buildContextFromFile(filePath, fileContent, selection);
  if (chunks.length > 0) {
    return chunks;
  }
  return [
    {
      filePath,
      startLine,
      endLine,
      content: selection,
      symbolName,
      chunkKind: 'symbol',
      contextHeader: symbolName ? `Symbol: ${symbolName}` : undefined
    }
  ];
}

function formatModuleInventory(files: ModuleFolderFileInfo[], lang: NeverminLanguage): string {
  if (files.length === 0) {
    return lang === 'en' ? '(no files)' : '(tidak ada file)';
  }
  return files
    .map((file) => {
      const rel = file.filePath.replace(/\\/g, '/').split('/').slice(-3).join('/');
      const symbols =
        file.symbols.length === 0
          ? lang === 'en'
            ? '  - (no parsed functions)'
            : '  - (tidak ada fungsi terdeteksi)'
          : file.symbols
              .slice(0, 24)
              .map((s) => `  - ${s.kind} ${s.name} (L${s.startLine}-${s.endLine})`)
              .join('\n');
      return `- ${rel}\n${symbols}`;
    })
    .join('\n');
}

async function buildModuleFileContentChunks(
  files: ModuleFolderFileInfo[],
  readFile: (filePath: string) => Promise<string>
): Promise<CodeChunk[]> {
  const chunks: CodeChunk[] = [];
  const maxFiles = 8;
  const maxCharsPerFile = 2_800;

  for (const file of files.slice(0, maxFiles)) {
    try {
      const content = await readFile(file.filePath);
      const truncated =
        content.length > maxCharsPerFile
          ? `${content.slice(0, maxCharsPerFile)}\n\n/* … truncated … */`
          : content;
      chunks.push({
        filePath: file.filePath,
        startLine: 1,
        endLine: Math.max(1, truncated.split(/\r?\n/).length),
        content: truncated,
        chunkKind: 'module',
        contextHeader: `Module file · ${file.symbols.length} symbols`
      });
    } catch {
      chunks.push({
        filePath: file.filePath,
        startLine: 1,
        endLine: 1,
        content: '/* unreadable */',
        chunkKind: 'module',
        contextHeader: 'Module file (unreadable)'
      });
    }
  }
  return chunks;
}

export interface BuiltExplainPrompt {
  scope: ExplainScope;
  prompt: string;
  taskLabel: string;
  title: string;
}

/**
 * Susun prompt Explain sesuai view:
 * - Architecture/Flow → file utuh
 * - Modules → folder + inventory simbol + Mermaid + isi file
 * - Functions → hanya fungsi yang diklik
 */
export async function buildScopedExplainPrompt(options: {
  meta: ExplainNodeMeta;
  graph: CodeGraph | null | undefined;
  lang: NeverminLanguage;
  readFile: (filePath: string) => Promise<string>;
}): Promise<BuiltExplainPrompt> {
  const { meta, graph, lang, readFile } = options;
  const scope = resolveExplainScope(meta);
  const filePath = (meta.filePath || '').trim();
  const name = (meta.name || '').trim() || filePath.split(/[/\\]/).pop() || 'node';

  if (scope === 'module') {
    const folder = (meta.name || '').trim() || (filePath ? moduleFolderKey(filePath) : 'root');
    const files = graph ? collectModuleFolderFiles(graph, folder) : [];
    const mermaid = graph
      ? buildModuleFolderMermaid(graph, folder)
      : 'flowchart TB\n  empty["No graph"]';
    const inventory = formatModuleInventory(files, lang);
    const contentChunks = await buildModuleFileContentChunks(files, readFile);
    return {
      scope,
      title: folder,
      taskLabel: `explain module · ${folder}`,
      prompt: buildExplainModulePrompt({
        folder,
        inventory,
        mermaid,
        chunks: contentChunks,
        lang
      })
    };
  }

  if (!filePath) {
    throw new Error('missing filePath');
  }

  const fileContent = await readFile(filePath);

  if (scope === 'function') {
    const startLine = Math.max(1, meta.startLine ?? 1);
    const endLine = Math.max(startLine, meta.endLine ?? startLine);
    const chunks = await buildFunctionChunks(filePath, fileContent, startLine, endLine, name);
    return {
      scope,
      title: name,
      taskLabel: `explain function · ${name}`,
      prompt: buildExplainFunctionPrompt({
        symbolName: name,
        kind: meta.kind || 'function',
        filePath,
        startLine,
        endLine,
        chunks,
        lang
      })
    };
  }

  // file (Architecture / Flow / Functions file-group)
  const chunks = await buildFileChunks(filePath, fileContent);
  return {
    scope,
    title: name,
    taskLabel: `explain file · ${name}`,
    prompt: buildExplainFilePrompt({
      filePath,
      fileName: name,
      chunks,
      lang
    })
  };
}
