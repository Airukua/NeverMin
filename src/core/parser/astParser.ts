import fs from 'fs';
import path from 'path';
import { Language, Node, Parser, Query } from 'web-tree-sitter';
import { detectLanguage, getLanguageConfig, SupportedLanguage } from './languageRegistry';

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable';
  startLine: number;
  endLine: number;
}

let parserInitPromise: Promise<void> | null = null;
let parserInstance: Parser | null = null;
const languageCache = new Map<SupportedLanguage, Promise<Language>>();
/** Hanya true kalau init/WASM runtime gagal total — bukan error per-file. */
let treeSitterInitFailed = false;
let extensionRoot: string | null = null;
let runtimeWasmLogged = false;
/** Antrian supaya setLanguage + parse tidak saling tabrak di Promise.all. */
let parseQueue: Promise<unknown> = Promise.resolve();

/**
 * Panggil dari activate() agar WASM di-resolve dari folder extension,
 * bukan process.cwd() (yang di VS Code sering mengarah ke install dir Windows).
 */
export function configureAstParser(options: { extensionPath: string }): void {
  extensionRoot = options.extensionPath;
  treeSitterInitFailed = false;
  languageCache.clear();
  parserInitPromise = null;
  parserInstance = null;
  runtimeWasmLogged = false;
  parseQueue = Promise.resolve();
}

async function withParserLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = parseQueue;
  let release!: () => void;
  parseQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function uniqueExisting(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of paths) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    result.push(candidate);
  }
  return result;
}

function grammarWasmCandidates(relativeWasmPath: string): string[] {
  const basename = path.basename(relativeWasmPath);
  const roots = [
    extensionRoot,
    // dist/core/parser -> extension root
    path.resolve(__dirname, '../../..'),
    process.cwd()
  ].filter((value): value is string => Boolean(value));

  const candidates: string[] = [];
  for (const root of roots) {
    candidates.push(path.join(root, relativeWasmPath));
    candidates.push(path.join(root, 'media', 'grammars', basename));
    candidates.push(path.join(root, 'node_modules', 'tree-sitter-wasms', 'out', basename));
  }

  return uniqueExisting(candidates);
}

function runtimeWasmCandidates(scriptName: string): string[] {
  const roots = [
    extensionRoot,
    path.resolve(__dirname, '../../..'),
    process.cwd()
  ].filter((value): value is string => Boolean(value));

  const candidates: string[] = [];
  for (const root of roots) {
    candidates.push(path.join(root, 'node_modules', 'web-tree-sitter', scriptName));
    candidates.push(path.join(root, 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm'));
    candidates.push(path.join(root, 'media', 'grammars', scriptName));
  }

  return uniqueExisting(candidates);
}

function resolveExistingFile(candidates: string[], label: string): string {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore access errors and try next candidate
    }
  }

  throw new Error(`${label} not found. Tried:\n${candidates.join('\n')}`);
}

async function ensureParser(): Promise<Parser> {
  if (!parserInitPromise) {
    parserInitPromise = Parser.init({
      locateFile(scriptName: string): string {
        try {
          return resolveExistingFile(runtimeWasmCandidates(scriptName), `Tree-sitter runtime WASM (${scriptName})`);
        } catch (error) {
          if (!runtimeWasmLogged) {
            runtimeWasmLogged = true;
            console.warn(error);
          }
          return scriptName;
        }
      }
    });
  }

  await parserInitPromise;

  if (!parserInstance) {
    parserInstance = new Parser();
  }

  return parserInstance;
}

async function loadLanguage(lang: SupportedLanguage): Promise<Language> {
  const cached = languageCache.get(lang);
  if (cached) {
    return cached;
  }

  const config = getLanguageConfig(lang);
  const promise = (async () => {
    const wasmPath = resolveExistingFile(
      grammarWasmCandidates(config.wasmPath),
      `Tree-sitter grammar WASM (${config.wasmPath})`
    );
    return Language.load(wasmPath);
  })();

  languageCache.set(lang, promise);
  promise.catch(() => {
    languageCache.delete(lang);
  });
  return promise;
}

function collectSymbolsFromQuery(
  query: Query,
  rootNode: Node,
  kind: SymbolInfo['kind']
): SymbolInfo[] {
  const results: SymbolInfo[] = [];
  const matches = query.matches(rootNode);

  for (const match of matches) {
    const nameCapture = match.captures.find((capture: { name: string; node: Node }) => capture.name === 'name');
    const outerCapture = match.captures.find((capture: { name: string; node: Node }) => capture.name !== 'name') ?? nameCapture;

    if (!nameCapture || !outerCapture) {
      continue;
    }

    const name = nameCapture.node.text.trim();
    if (!name) {
      continue;
    }

    results.push({
      name,
      kind,
      startLine: outerCapture.node.startPosition.row + 1,
      endLine: outerCapture.node.endPosition.row + 1
    });
  }

  return results;
}

function fallbackExtractSymbols(filePath: string, content: string): SymbolInfo[] {
  const lines = content.split(/\r?\n/);
  const symbols: SymbolInfo[] = [];
  const seen = new Set<string>();

  const functionPattern = /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/;
  const classPattern = /^\s*(?:export\s+(?:default\s+)?)?class\s+([A-Za-z_$][\w$]*)\b/;
  const constCallablePattern =
    /^\s*(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|function\b)/;
  const pythonFunctionPattern = /^\s*def\s+([A-Za-z_$][\w$]*)\b/;
  const pythonClassPattern = /^\s*class\s+([A-Za-z_$][\w$]*)\b/;

  const isPython = filePath.endsWith('.py');

  const pushSymbol = (name: string, kind: SymbolInfo['kind'], startLine: number, endLine: number): void => {
    const key = `${kind}:${name}:${startLine}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    symbols.push({ name, kind, startLine, endLine });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isPython && /^\s+/.test(line)) {
      continue;
    }

    if (isPython) {
      const pythonMatch = line.match(pythonFunctionPattern) ?? line.match(pythonClassPattern);
      if (!pythonMatch) {
        continue;
      }

      const isClass = Boolean(line.match(pythonClassPattern));
      pushSymbol(pythonMatch[1], isClass ? 'class' : 'function', index + 1, findPythonBlockEnd(lines, index));
      continue;
    }

    const classMatch = line.match(classPattern);
    if (classMatch) {
      pushSymbol(classMatch[1], 'class', index + 1, findBraceBlockEnd(lines, index));
      continue;
    }

    const functionMatch = line.match(functionPattern);
    if (functionMatch) {
      pushSymbol(functionMatch[1], 'function', index + 1, findBraceBlockEnd(lines, index));
      continue;
    }

    const constMatch = line.match(constCallablePattern);
    if (constMatch) {
      pushSymbol(constMatch[1], 'function', index + 1, findBraceBlockEnd(lines, index));
    }
  }

  return symbols;
}

function mergeSymbols(primary: SymbolInfo[], secondary: SymbolInfo[]): SymbolInfo[] {
  const merged = [...primary];
  const seen = new Set(primary.map((symbol) => `${symbol.kind}:${symbol.name}:${symbol.startLine}`));

  for (const symbol of secondary) {
    const key = `${symbol.kind}:${symbol.name}:${symbol.startLine}`;
    if (seen.has(key)) {
      continue;
    }
    // Dedup by name+kind when start lines differ slightly between parsers
    const nameKind = `${symbol.kind}:${symbol.name}`;
    if (merged.some((item) => `${item.kind}:${item.name}` === nameKind)) {
      continue;
    }
    seen.add(key);
    merged.push(symbol);
  }

  return merged.sort((left, right) => left.startLine - right.startLine || left.name.localeCompare(right.name));
}

function findBraceBlockEnd(lines: string[], startIndex: number): number {
  let depth = 0;
  let seenOpen = false;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    for (const char of line) {
      if (char === '{') {
        depth += 1;
        seenOpen = true;
      } else if (char === '}') {
        depth -= 1;
        if (seenOpen && depth <= 0) {
          return index + 1;
        }
      }
    }
  }

  return startIndex + 1;
}

function findPythonBlockEnd(lines: string[], startIndex: number): number {
  const startIndent = lines[startIndex].match(/^\s*/)?.[0].length ?? 0;
  let endLine = startIndex + 1;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      endLine = index + 1;
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= startIndent) {
      break;
    }
    endLine = index + 1;
  }

  return endLine;
}

export async function extractSymbols(filePath: string, content: string): Promise<SymbolInfo[]> {
  const languageKey = detectLanguage(filePath);
  const regexSymbols = fallbackExtractSymbols(filePath, content);

  if (!languageKey) {
    return [];
  }

  if (treeSitterInitFailed) {
    return regexSymbols;
  }

  try {
    return await withParserLock(async () => {
      const parser = await ensureParser();
      const language = await loadLanguage(languageKey);
      parser.setLanguage(language);

      const tree = parser.parse(content);
      if (!tree) {
        return regexSymbols;
      }

    const config = getLanguageConfig(languageKey);
    const functionQuery = new Query(language, config.functionQuery);
    const classQuery = new Query(language, config.classQuery);
    const interfaceSymbols =
      config.interfaceQuery
        ? collectSymbolsFromQuery(new Query(language, config.interfaceQuery), tree.rootNode, 'interface')
        : [];

    return mergeSymbols(
      [
        ...collectSymbolsFromQuery(functionQuery, tree.rootNode, 'function'),
        ...collectSymbolsFromQuery(classQuery, tree.rootNode, 'class'),
        ...interfaceSymbols
      ],
      regexSymbols
    );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Hanya matikan AST global untuk kegagalan runtime/WASM, bukan parse satu file.
    if (/WASM|not found|Parser\.init|locateFile|Language\.load/i.test(message)) {
      treeSitterInitFailed = true;
    }
    console.warn(`Tree-sitter fallback for ${filePath}:`, error);
    return regexSymbols;
  }
}
