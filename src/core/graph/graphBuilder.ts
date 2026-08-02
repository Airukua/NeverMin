import path from 'path';
import { extractSymbols } from '../parser/astParser';
import { CodeGraph, GraphEdge, GraphNode } from './types';

type GraphSymbolKind = 'function' | 'method' | 'class' | 'interface' | 'type' | 'variable';

interface RepoFile {
  path: string;
  content: string;
}

interface GraphSymbol {
  kind: GraphSymbolKind;
  name: string;
  startLine: number;
  endLine: number;
  parentClass?: string;
  signature?: string;
  extendsName?: string;
  qualifiedName?: string;
}

interface FileContext {
  inputPath: string;
  absolutePath: string;
  displayPath: string;
  content: string;
  lines: string[];
  fileNode: GraphNode;
  symbols: GraphSymbol[];
  symbolNodes: GraphNode[];
  imports: ImportStatement[];
}

interface ImportBinding {
  localName: string;
  importedName: string;
  isDefault?: boolean;
  isNamespace?: boolean;
}

interface ImportStatement {
  moduleSpecifier: string;
  bindings: ImportBinding[];
  sideEffect: boolean;
}

const EDGE_PRIORITY: Record<GraphEdge['kind'], number> = {
  defines: 0,
  imports: 1,
  calls: 2,
  uses: 3,
  extends: 4
};

const KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'function',
  'class',
  'new',
  'super',
  'this',
  'const',
  'let',
  'var',
  'typeof',
  'instanceof',
  'await',
  'async',
  'delete',
  'void',
  'yield',
  'import',
  'from',
  'export',
  'default',
  'extends'
]);

/**
 * Bangun graph repo sederhana tapi symbol-aware:
 * 1. buat node file dan node symbol
 * 2. resolusi import antar file/symbol
 * 3. resolusi call/use antar symbol
 * 4. tambahkan edge defines untuk struktur utama
 */
export async function buildRepoGraph(files: RepoFile[]): Promise<CodeGraph> {
  const contexts = await Promise.all(files.map((file) => buildFileContext(file)));
  const nodes = contexts.flatMap((context) => [context.fileNode, ...context.symbolNodes]);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodesByName = buildNodeNameIndex(nodes);
  const nodesByFile = new Map<string, GraphNode[]>(contexts.map((context) => [context.absolutePath, context.symbolNodes]));
  const fileIndex = new Map<string, FileContext>(contexts.map((context) => [context.absolutePath, context]));
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  const addEdge = (from: string, to: string, kind: GraphEdge['kind']): void => {
    if (!nodeById.has(from) || !nodeById.has(to)) {
      return;
    }

    const key = `${from}|${to}|${kind}`;
    if (edgeKeys.has(key)) {
      return;
    }

    edgeKeys.add(key);
    edges.push({ from, to, kind });
  };

  for (const context of contexts) {
    addDefinesEdges(context, addEdge, nodesByFile);
  }

  for (const context of contexts) {
    addImportEdges(context, addEdge, nodesByFile, nodesByName, fileIndex);
  }

  for (const context of contexts) {
    addSymbolFlowEdges(context, addEdge, nodesByName, nodesByFile, fileIndex);
  }

  nodes.sort(sortNodes);
  edges.sort(sortEdges);

  return { nodes, edges };
}

/**
 * Trace semua jalur keluar dari sebuah node.
 * Edge diprioritaskan dari struktur -> impor -> call -> use -> extends
 * supaya hasil traversal lebih berguna untuk memahami flow kode.
 */
export function traceFrom(graph: CodeGraph, nodeId: string, maxDepth = 5): GraphNode[][] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoingByNode = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    const list = outgoingByNode.get(edge.from) ?? [];
    list.push(edge);
    outgoingByNode.set(edge.from, list);
  }

  const paths: GraphNode[][] = [];

  const walk = (currentId: string, currentPath: GraphNode[], visited: Set<string>, depth: number): void => {
    if (depth > maxDepth) {
      return;
    }

    const node = nodeById.get(currentId);
    if (!node) {
      return;
    }

    const nextPath = [...currentPath, node];
    const outgoing = (outgoingByNode.get(currentId) ?? [])
      .slice()
      .sort((left, right) => EDGE_PRIORITY[left.kind] - EDGE_PRIORITY[right.kind]);

    const candidates = outgoing.filter((edge) => !visited.has(edge.to));
    if (candidates.length === 0) {
      paths.push(nextPath);
      return;
    }

    for (const edge of candidates) {
      const nextVisited = new Set(visited);
      nextVisited.add(edge.to);
      walk(edge.to, nextPath, nextVisited, depth + 1);
    }
  };

  walk(nodeId, [], new Set([nodeId]), 0);
  return paths;
}

async function buildFileContext(file: RepoFile): Promise<FileContext> {
  const displayPath = normalizeDisplayPath(file.path);
  const absolutePath = toAbsolutePath(file.path);
  const lines = file.content.split(/\r?\n/);
  const fileNode: GraphNode = {
    id: absolutePath,
    kind: 'file',
    name: path.basename(displayPath),
    filePath: displayPath,
    startLine: 1,
    endLine: Math.max(1, lines.length)
  };

  const parsedSymbols = await extractSymbols(file.path, file.content);
  const symbols: GraphSymbol[] = [];

  for (const symbol of parsedSymbols) {
    const graphSymbol: GraphSymbol = {
      ...symbol,
      kind: normalizeSymbolKind(symbol.kind),
      qualifiedName: symbol.name
    };

    if (graphSymbol.kind === 'class') {
      graphSymbol.extendsName = detectBaseClassName(lines, graphSymbol.startLine);
    }

    symbols.push(graphSymbol);
  }

  for (const classSymbol of symbols.filter((symbol) => symbol.kind === 'class')) {
    for (const method of extractMethodsForClass(file.path, lines, classSymbol)) {
      symbols.push(method);
    }
  }

  const symbolNodes = symbols.map((symbol) => createSymbolNode(displayPath, symbol));
  return {
    inputPath: file.path,
    absolutePath,
    displayPath,
    content: file.content,
    lines,
    fileNode,
    symbols,
    symbolNodes,
    imports: parseImports(file.path, file.content)
  };
}

function addDefinesEdges(
  context: FileContext,
  addEdge: (from: string, to: string, kind: GraphEdge['kind']) => void,
  nodesByFile: Map<string, GraphNode[]>
): void {
  const fileDefines = nodesByFile.get(context.absolutePath) ?? [];
  for (const node of fileDefines) {
    if (node.kind === 'method') {
      const parentClass = node.name.split('.')[0];
      const parentClassNode = findNodeInContext(context, parentClass, 'class');
      if (parentClassNode) {
        addEdge(parentClassNode.id, node.id, 'defines');
      } else {
        addEdge(context.fileNode.id, node.id, 'defines');
      }
      continue;
    }

    addEdge(context.fileNode.id, node.id, 'defines');
  }
}

function addImportEdges(
  context: FileContext,
  addEdge: (from: string, to: string, kind: GraphEdge['kind']) => void,
  nodesByFile: Map<string, GraphNode[]>,
  nodesByName: Map<string, GraphNode[]>,
  fileIndex: Map<string, FileContext>
): void {
  for (const importStatement of context.imports) {
    const targetFile = resolveModuleTarget(context.absolutePath, importStatement.moduleSpecifier, fileIndex);
    const targetFileNode = targetFile ? targetFile : null;

    if (importStatement.sideEffect || importStatement.bindings.some((binding) => binding.isDefault || binding.isNamespace)) {
      if (targetFileNode) {
        addEdge(context.fileNode.id, targetFileNode, 'imports');
      }
    }

    for (const binding of importStatement.bindings) {
      const resolved = resolveImportedNodes({
        targetFile,
        binding,
        nodesByFile,
        nodesByName
      });

      if (resolved.length === 0) {
        if (targetFileNode) {
          addEdge(context.fileNode.id, targetFileNode, 'imports');
        }
        continue;
      }

      for (const node of resolved) {
        addEdge(context.fileNode.id, node.id, 'imports');
      }
    }
  }
}

function addSymbolFlowEdges(
  context: FileContext,
  addEdge: (from: string, to: string, kind: GraphEdge['kind']) => void,
  nodesByName: Map<string, GraphNode[]>,
  nodesByFile: Map<string, GraphNode[]>,
  fileIndex: Map<string, FileContext>
): void {
  for (const symbol of context.symbols) {
    const currentNode = findNodeForSymbol(context, symbol);
    if (!currentNode) {
      continue;
    }

    const body = sliceLines(context.lines, symbol.startLine, symbol.endLine);
    const bodyLines = body.split(/\r?\n/);
    const visibleTargets = collectVisibleTargets(context, nodesByName, nodesByFile, fileIndex);
    for (const line of bodyLines) {
      const callNames = collectCallNames(line);
      const jsxNames = collectJsxComponentNames(line);
      const identifierNames = collectIdentifierNames(line);

      for (const callName of callNames) {
        for (const target of resolveTargetsForName(callName, visibleTargets, context.absolutePath)) {
          if (target.id !== currentNode.id) {
            addEdge(currentNode.id, target.id, 'calls');
          }
        }
      }

      for (const jsxName of jsxNames) {
        for (const target of resolveTargetsForName(jsxName, visibleTargets, context.absolutePath)) {
          if (target.id !== currentNode.id) {
            addEdge(currentNode.id, target.id, 'uses');
          }
        }
      }

      for (const identifierName of identifierNames) {
        if (KEYWORDS.has(identifierName) || callNames.has(identifierName) || jsxNames.has(identifierName)) {
          continue;
        }

        for (const target of resolveTargetsForName(identifierName, visibleTargets, context.absolutePath)) {
          if (target.id !== currentNode.id) {
            addEdge(currentNode.id, target.id, 'uses');
          }
        }
      }
    }

    if (symbol.kind === 'class' && symbol.extendsName) {
      for (const target of resolveTargetsForName(symbol.extendsName, visibleTargets, context.absolutePath, 'class')) {
        if (target.id !== currentNode.id) {
          addEdge(currentNode.id, target.id, 'extends');
        }
      }
    }
  }
}

function buildNodeNameIndex(nodes: GraphNode[]): Map<string, GraphNode[]> {
  const index = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    registerNodeName(index, node, node.name);
    if (node.kind === 'method' && node.name.includes('.')) {
      registerNodeName(index, node, node.name.split('.').pop() ?? node.name);
    }
  }

  return index;
}

function registerNodeName(index: Map<string, GraphNode[]>, node: GraphNode, name: string): void {
  const bucket = index.get(name) ?? [];
  if (!bucket.includes(node)) {
    bucket.push(node);
    index.set(name, bucket);
  }
}

function collectVisibleTargets(
  context: FileContext,
  nodesByName: Map<string, GraphNode[]>,
  nodesByFile: Map<string, GraphNode[]>,
  fileIndex: Map<string, FileContext>
): Map<string, GraphNode[]> {
  const visible = new Map<string, GraphNode[]>();

  for (const node of context.symbolNodes) {
    registerNodeName(visible, node, node.name);
    if (node.kind === 'method' && node.name.includes('.')) {
      registerNodeName(visible, node, node.name.split('.').pop() ?? node.name);
    }
  }

  for (const importStatement of context.imports) {
    const targetFile = resolveModuleTarget(context.absolutePath, importStatement.moduleSpecifier, fileIndex);
    for (const binding of importStatement.bindings) {
      const resolved = resolveImportedNodes({
        targetFile,
        binding,
        nodesByFile,
        nodesByName
      });
      if (resolved.length > 0) {
        visible.set(binding.localName, resolved);
      }
    }
  }

  return visible;
}

function resolveImportedNodes(params: {
  targetFile: string | null;
  binding: ImportBinding;
  nodesByFile: Map<string, GraphNode[]>;
  nodesByName: Map<string, GraphNode[]>;
}): GraphNode[] {
  const { targetFile, binding, nodesByFile, nodesByName } = params;
  if (!targetFile) {
    return [];
  }

  const candidateNodes = nodesByFile.get(targetFile) ?? [];

  if (binding.isNamespace) {
    return [];
  }

  if (binding.isDefault) {
    const baseName = path.basename(targetFile).replace(/\.(tsx?|jsx?|mjs|cjs|py)$/i, '');
    const byFileName = candidateNodes.filter((node) => node.name === baseName || node.name.endsWith(`.${baseName}`));
    if (byFileName.length > 0) {
      return byFileName;
    }

    const exportedCallables = candidateNodes.filter((node) => node.kind === 'function' || node.kind === 'class');
    return exportedCallables.slice(0, 1);
  }

  const exactMatches = candidateNodes.filter((node) => node.name === binding.importedName || node.name.endsWith(`.${binding.importedName}`));
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const globalMatches = nodesByName.get(binding.importedName) ?? [];
  if (globalMatches.length > 0) {
    return globalMatches.filter((node) => toAbsolutePath(node.filePath) === targetFile);
  }

  return [];
}

function resolveTargetsForName(
  name: string,
  visibleTargets: Map<string, GraphNode[]>,
  currentFilePath: string,
  preferredKind?: GraphNode['kind']
): GraphNode[] {
  const visible = visibleTargets.get(name) ?? [];
  if (visible.length === 0) {
    return [];
  }

  const kindFiltered = preferredKind ? visible.filter((node) => node.kind === preferredKind) : visible;
  const sameFile = kindFiltered.filter((node) => toAbsolutePath(node.filePath) === currentFilePath);
  if (sameFile.length > 0) {
    return sameFile;
  }

  return kindFiltered;
}

function findNodeForSymbol(context: FileContext, symbol: GraphSymbol): GraphNode | undefined {
  if (symbol.kind === 'method' && symbol.qualifiedName) {
    return context.symbolNodes.find((node) => node.name === symbol.qualifiedName);
  }

  return context.symbolNodes.find((node) => node.name === symbol.name);
}

function findNodeInContext(context: FileContext, name: string, kind?: GraphNode['kind']): GraphNode | undefined {
  return context.symbolNodes.find((node) => {
    if (kind && node.kind !== kind) {
      return false;
    }

    return node.name === name || node.name.endsWith(`.${name}`);
  });
}

function createSymbolNode(displayPath: string, symbol: GraphSymbol): GraphNode {
  const isMethod = symbol.kind === 'method' && symbol.parentClass;
  const displayName = isMethod ? `${symbol.parentClass}.${symbol.name}` : symbol.name;
  const qualified = symbol.qualifiedName ?? displayName;

  return {
    id: `${displayPath}#${qualified}:${symbol.startLine}`,
    kind: normalizeGraphNodeKind(symbol.kind),
    name: displayName,
    filePath: displayPath,
    startLine: symbol.startLine,
    endLine: symbol.endLine
  };
}

function normalizeGraphNodeKind(kind: GraphSymbolKind): GraphNode['kind'] {
  if (kind === 'method') {
    return 'method';
  }
  if (kind === 'class') {
    return 'class';
  }
  if (kind === 'variable') {
    return 'variable';
  }
  return 'function';
}

function normalizeSymbolKind(kind: string): GraphSymbolKind {
  if (kind === 'class') {
    return 'class';
  }
  if (kind === 'function') {
    return 'function';
  }
  if (kind === 'interface') {
    return 'interface';
  }
  if (kind === 'variable') {
    return 'variable';
  }
  return 'function';
}

function extractMethodsForClass(filePath: string, lines: string[], classSymbol: GraphSymbol): GraphSymbol[] {
  const results: GraphSymbol[] = [];
  const isPython = filePath.endsWith('.py');
  const classHeader = lines[classSymbol.startLine - 1] ?? '';

  if (isPython) {
    const classIndent = classHeader.match(/^\s*/)?.[0].length ?? 0;
    for (let lineNumber = classSymbol.startLine + 1; lineNumber <= classSymbol.endLine; lineNumber += 1) {
      const line = lines[lineNumber - 1] ?? '';
      const methodMatch = line.match(/^\s*def\s+([A-Za-z_$][\w$]*)\s*\(/);
      if (!methodMatch) {
        continue;
      }

      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (indent <= classIndent) {
        continue;
      }

      const endLine = findPythonBlockEnd(lines, lineNumber);
      results.push({
        name: methodMatch[1],
        kind: 'method',
        startLine: lineNumber,
        endLine,
        parentClass: classSymbol.name,
        qualifiedName: `${classSymbol.name}.${methodMatch[1]}`,
        signature: line.trim()
      });
    }
    return results;
  }

  const classIndent = classHeader.match(/^\s*/)?.[0].length ?? 0;
  for (let lineNumber = classSymbol.startLine + 1; lineNumber <= classSymbol.endLine; lineNumber += 1) {
    const line = lines[lineNumber - 1] ?? '';
    const methodMatch = line.match(/^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+|readonly\s+|\*)*([A-Za-z_$][\w$]*)\s*\(/);
    if (!methodMatch) {
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= classIndent) {
      continue;
    }

    const endLine = Math.min(findBraceBlockEnd(lines, lineNumber), classSymbol.endLine);
    results.push({
      name: methodMatch[1],
      kind: 'method',
      startLine: lineNumber,
      endLine,
      parentClass: classSymbol.name,
      qualifiedName: `${classSymbol.name}.${methodMatch[1]}`,
      signature: line.trim()
    });
  }

  return results;
}

function parseImports(filePath: string, content: string): ImportStatement[] {
  const isPython = filePath.endsWith('.py');
  if (isPython) {
    return parsePythonImports(content);
  }

  return parseJavaScriptImports(content);
}

function parsePythonImports(content: string): ImportStatement[] {
  const imports: ImportStatement[] = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ') && !trimmed.startsWith('from ')) {
      continue;
    }

    const fromMatch = trimmed.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
    if (fromMatch) {
      const moduleSpecifier = pythonModuleToSpecifier(fromMatch[1]);
      const bindings = fromMatch[2]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const aliasMatch = part.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
          const importedName = aliasMatch?.[1] ?? part;
          const localName = aliasMatch?.[2] ?? importedName;
          return { importedName, localName };
        });
      imports.push({
        moduleSpecifier,
        bindings,
        sideEffect: false
      });
      continue;
    }

    const importMatch = trimmed.match(/^import\s+([.\w]+)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
    if (importMatch) {
      imports.push({
        moduleSpecifier: pythonModuleToSpecifier(importMatch[1]),
        bindings: [
          {
            importedName: importMatch[1].split('.').pop() ?? importMatch[1],
            localName: importMatch[2] ?? importMatch[1].split('.').pop() ?? importMatch[1],
            isNamespace: true
          }
        ],
        sideEffect: false
      });
    }
  }

  return imports;
}

function parseJavaScriptImports(content: string): ImportStatement[] {
  const imports: ImportStatement[] = [];
  const normalized = content.replace(/\r\n/g, '\n');
  const importPattern = /import\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]\s*;?/g;

  for (const match of normalized.matchAll(importPattern)) {
    const clause = (match[1] ?? '').trim();
    const specifier = match[2];

    if (!clause) {
      imports.push({
        moduleSpecifier: specifier,
        bindings: [],
        sideEffect: true
      });
      continue;
    }

    const bindings: ImportBinding[] = [];
    const namedMatch = clause.match(/\{([\s\S]*?)\}/);
    if (namedMatch) {
      for (const part of namedMatch[1].split(',')) {
        const trimmedPart = part.trim();
        if (!trimmedPart) {
          continue;
        }

        const aliasMatch = trimmedPart.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (!aliasMatch) {
          continue;
        }

        bindings.push({
          importedName: aliasMatch[1],
          localName: aliasMatch[2] ?? aliasMatch[1]
        });
      }
    }

    const defaultPart = clause.split(',')[0]?.trim();
    if (defaultPart && !defaultPart.startsWith('{') && defaultPart !== '*' && !defaultPart.startsWith('*')) {
      bindings.unshift({
        importedName: 'default',
        localName: defaultPart,
        isDefault: true
      });
    }

    const namespaceMatch = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (namespaceMatch) {
      bindings.push({
        importedName: namespaceMatch[1],
        localName: namespaceMatch[1],
        isNamespace: true
      });
    }

    imports.push({
      moduleSpecifier: specifier,
      bindings,
      sideEffect: false
    });
  }

  return imports;
}

function resolveModuleTarget(
  sourceAbsolutePath: string,
  moduleSpecifier: string,
  fileIndex: Map<string, FileContext>
): string | null {
  if (moduleSpecifier.startsWith('.')) {
    return resolveRelativeModuleTarget(sourceAbsolutePath, moduleSpecifier, fileIndex);
  }

  return resolveAliasedModuleTarget(moduleSpecifier, fileIndex);
}

function resolveRelativeModuleTarget(
  sourceAbsolutePath: string,
  moduleSpecifier: string,
  fileIndex: Map<string, FileContext>
): string | null {
  const sourceDir = path.dirname(sourceAbsolutePath);
  const basePath = path.resolve(sourceDir, moduleSpecifier);
  return matchModuleCandidates(basePath, fileIndex);
}

function resolveAliasedModuleTarget(
  moduleSpecifier: string,
  fileIndex: Map<string, FileContext>
): string | null {
  const aliasMatchers: Array<(specifier: string) => string | null> = [
    (specifier) => (specifier.startsWith('@/') ? specifier.slice(2) : null),
    (specifier) => (specifier.startsWith('~/') ? specifier.slice(2) : null),
    (specifier) => (specifier.startsWith('src/') ? specifier : null)
  ];

  for (const matcher of aliasMatchers) {
    const relativePart = matcher(moduleSpecifier);
    if (!relativePart) {
      continue;
    }

    const normalizedRelative = relativePart.replace(/\\/g, '/').replace(/^\.\//, '');
    for (const absolutePath of fileIndex.keys()) {
      const normalizedAbsolute = absolutePath.replace(/\\/g, '/');
      if (pathMatchesAlias(normalizedAbsolute, normalizedRelative)) {
        return absolutePath;
      }
    }
  }

  return null;
}

function pathMatchesAlias(absolutePath: string, relativePart: string): boolean {
  const candidates = expandModuleSuffixes(relativePart);
  return candidates.some((candidate) => absolutePath === candidate || absolutePath.endsWith(`/${candidate}`));
}

function expandModuleSuffixes(modulePath: string): string[] {
  const normalized = modulePath.replace(/\\/g, '/').replace(/\.(tsx?|jsx?|mjs|cjs|py)$/i, '');
  return [
    normalized,
    `${normalized}.ts`,
    `${normalized}.tsx`,
    `${normalized}.js`,
    `${normalized}.jsx`,
    `${normalized}.mjs`,
    `${normalized}.cjs`,
    `${normalized}.py`,
    `${normalized}/index.ts`,
    `${normalized}/index.tsx`,
    `${normalized}/index.js`,
    `${normalized}/index.jsx`,
    `${normalized}/index.py`
  ];
}

function matchModuleCandidates(basePath: string, fileIndex: Map<string, FileContext>): string | null {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    `${basePath}.py`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.jsx'),
    path.join(basePath, 'index.py')
  ];

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (fileIndex.has(normalized)) {
      return normalized;
    }
  }

  return null;
}

function collectCallNames(body: string): Set<string> {
  const names = new Set<string>();
  const directCallPattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  const memberCallPattern = /\.([A-Za-z_$][\w$]*)\s*\(/g;

  for (const match of body.matchAll(directCallPattern)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }

  for (const match of body.matchAll(memberCallPattern)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }

  return names;
}

function collectJsxComponentNames(body: string): Set<string> {
  const names = new Set<string>();
  const jsxPattern = /<\/?([A-Z][A-Za-z0-9_]*)\b/g;
  for (const match of body.matchAll(jsxPattern)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  return names;
}

function collectIdentifierNames(body: string): string[] {
  return Array.from(new Set(body.match(/[A-Za-z_$][\w$]*/g) ?? [])).filter(Boolean);
}

function detectBaseClassName(lines: string[], startLine: number): string | undefined {
  const header = lines[startLine - 1] ?? '';
  const tsMatch = header.match(/\bextends\s+([A-Za-z_$][\w$.]*)/);
  if (tsMatch) {
    return tsMatch[1].split('.').pop();
  }

  const pythonMatch = header.match(/class\s+[A-Za-z_$][\w$]*\(([^)]+)\)/);
  if (pythonMatch) {
    return pythonMatch[1].split(',')[0]?.trim().split('.').pop();
  }

  return undefined;
}

function findBraceBlockEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let started = false;

  for (let lineNumber = startLine; lineNumber <= lines.length; lineNumber += 1) {
    const line = lines[lineNumber - 1] ?? '';
    for (const char of line) {
      if (char === '{') {
        depth += 1;
        started = true;
      } else if (char === '}') {
        depth -= 1;
        if (started && depth <= 0) {
          return lineNumber;
        }
      }
    }
  }

  return lines.length;
}

function findPythonBlockEnd(lines: string[], startLine: number): number {
  const header = lines[startLine - 1] ?? '';
  const baseIndent = header.match(/^\s*/)?.[0].length ?? 0;
  let endLine = startLine;

  for (let lineNumber = startLine + 1; lineNumber <= lines.length; lineNumber += 1) {
    const line = lines[lineNumber - 1] ?? '';
    if (!line.trim()) {
      endLine = lineNumber;
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= baseIndent) {
      break;
    }

    endLine = lineNumber;
  }

  return endLine;
}

function sliceLines(lines: string[], startLine: number, endLine: number): string {
  return lines.slice(startLine - 1, endLine).join('\n');
}

function sortNodes(left: GraphNode, right: GraphNode): number {
  return left.filePath.localeCompare(right.filePath) || left.startLine - right.startLine || left.name.localeCompare(right.name);
}

function sortEdges(left: GraphEdge, right: GraphEdge): number {
  return left.from.localeCompare(right.from) || left.to.localeCompare(right.to) || EDGE_PRIORITY[left.kind] - EDGE_PRIORITY[right.kind];
}

function normalizeDisplayPath(filePath: string): string {
  return path.normalize(filePath);
}

function toAbsolutePath(filePath: string): string {
  return path.normalize(path.resolve(process.cwd(), filePath));
}

function pythonModuleToSpecifier(modulePath: string): string {
  return modulePath.replace(/\./g, path.sep);
}
