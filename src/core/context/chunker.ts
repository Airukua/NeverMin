import path from 'path';
import { CodeChunk } from '../../types';

export interface ChunkSymbol {
  kind: 'function' | 'method' | 'class' | 'interface' | 'type' | 'variable';
  name: string;
  startLine: number;
  endLine: number;
  parentClass?: string;
  signature?: string;
}

export interface ChunkingOptions {
  maxTokensPerChunk?: number;
}

export interface RetrievalOptions {
  tokenBudget: number;
  queryVariants?: string[];
  maxCandidatesPerQuery?: number;
}

interface ChunkCandidate extends CodeChunk {
  mergeable: boolean;
  textForRanking: string;
}

const DEFAULT_MAX_TOKENS_PER_CHUNK = 800;
const DEFAULT_MAX_CANDIDATES_PER_QUERY = 10;
const DEFAULT_CONTEXT_SEPARATOR = '\n';
const DEFAULT_RRF_K = 60;

export function chunkFile(filePath: string, content: string): CodeChunk[] {
  return chunkBySymbol(filePath, content, [], { maxTokensPerChunk: DEFAULT_MAX_TOKENS_PER_CHUNK });
}

export function chunkBySymbol(
  filePath: string,
  sourceCode: string,
  symbols: ChunkSymbol[],
  options: ChunkingOptions = {}
): CodeChunk[] {
  const lines = sourceCode.split(/\r?\n/);
  const maxTokensPerChunk = options.maxTokensPerChunk ?? DEFAULT_MAX_TOKENS_PER_CHUNK;
  const relativeFilePath = toRelativePath(filePath);
  const imports = extractImports(lines);
  const normalizedSymbols = normalizeSymbols(sourceCode, symbols);
  const occupiedRanges = normalizedSymbols
    .map((symbol) => ({ startLine: symbol.startLine, endLine: symbol.endLine }))
    .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);

  const candidates: ChunkCandidate[] = [];

  for (const range of buildModuleRanges(lines.length, occupiedRanges)) {
    candidates.push(
      ...buildModuleChunks({
        filePath: relativeFilePath,
        lines,
        range,
        imports,
        maxTokensPerChunk
      })
    );
  }

  for (const symbol of normalizedSymbols) {
    candidates.push(
      ...buildSymbolChunks({
        filePath: relativeFilePath,
        lines,
        symbol,
        imports,
        maxTokensPerChunk
      })
    );
  }

  candidates.sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);
  return candidates.map(stripChunkCandidate);
}

export function selectRelevantChunks(
  query: string,
  chunks: CodeChunk[],
  tokenBudget: number,
  options: Partial<RetrievalOptions> = {}
): CodeChunk[] {
  const queryVariants = (options.queryVariants?.length ? options.queryVariants : [query]).slice(0, 3);
  const maxCandidatesPerQuery = options.maxCandidatesPerQuery ?? DEFAULT_MAX_CANDIDATES_PER_QUERY;
  const rankedByQuery = queryVariants.map((variant) =>
    rankChunksBm25(variant, chunks).slice(0, maxCandidatesPerQuery)
  );
  const fused = fuseRankings(rankedByQuery);
  const moduleContext = chunks.find((chunk) => chunk.chunkKind === 'module');
  const selected: CodeChunk[] = [];
  let remainingBudget = tokenBudget;

  if (moduleContext) {
    selected.push(moduleContext);
    remainingBudget -= getChunkTokenCount(moduleContext);
  }

  for (const item of fused) {
    if (remainingBudget <= 0) {
      break;
    }

    const candidate = item.chunk;
    if (selected.includes(candidate)) {
      continue;
    }

    const cost = getChunkTokenCount(candidate);
    if (cost <= remainingBudget || selected.length === 0) {
      selected.push(candidate);
      remainingBudget -= cost;
    }
  }

  return selected;
}

export function estimateChunkingMetrics(chunks: CodeChunk[]): { totalTokens: number; averageTokens: number } {
  const totalTokens = chunks.reduce((sum, chunk) => sum + getChunkTokenCount(chunk), 0);
  return {
    totalTokens,
    averageTokens: chunks.length > 0 ? totalTokens / chunks.length : 0
  };
}

export function compareChunkingMetrics(beforeChunks: CodeChunk[], afterChunks: CodeChunk[]): {
  before: { totalTokens: number; averageTokens: number };
  after: { totalTokens: number; averageTokens: number };
  deltaTotalTokens: number;
  deltaAverageTokens: number;
} {
  const before = estimateChunkingMetrics(beforeChunks);
  const after = estimateChunkingMetrics(afterChunks);

  return {
    before,
    after,
    deltaTotalTokens: after.totalTokens - before.totalTokens,
    deltaAverageTokens: after.averageTokens - before.averageTokens
  };
}

function buildModuleRanges(
  lineCount: number,
  occupiedRanges: Array<{ startLine: number; endLine: number }>
): Array<{ startLine: number; endLine: number }> {
  if (occupiedRanges.length === 0) {
    return lineCount > 0 ? [{ startLine: 1, endLine: lineCount }] : [];
  }

  const ranges: Array<{ startLine: number; endLine: number }> = [];
  let cursor = 1;

  for (const occupied of occupiedRanges) {
    if (cursor < occupied.startLine) {
      ranges.push({ startLine: cursor, endLine: occupied.startLine - 1 });
    }
    cursor = Math.max(cursor, occupied.endLine + 1);
  }

  if (cursor <= lineCount) {
    ranges.push({ startLine: cursor, endLine: lineCount });
  }

  return ranges.filter((range) => range.startLine <= range.endLine);
}

function buildModuleChunks(params: {
  filePath: string;
  lines: string[];
  range: { startLine: number; endLine: number };
  imports: string[];
  maxTokensPerChunk: number;
}): ChunkCandidate[] {
  const { filePath, lines, range, imports, maxTokensPerChunk } = params;
  const segments = splitByBlankLines(lines, range.startLine, range.endLine);
  const chunks: ChunkCandidate[] = [];
  let buffered: Array<{ startLine: number; endLine: number; text: string }> = [];
  let bufferedTokens = 0;

  for (const segment of segments) {
    const segmentText = sliceLines(lines, segment.startLine, segment.endLine);
    const segmentTokens = estimateTokens(segmentText);

    if (segmentTokens > maxTokensPerChunk) {
      if (buffered.length > 0) {
        chunks.push(
          makeModuleChunk({
            filePath,
            imports,
            segments: buffered,
            chunkKind: 'module'
          })
        );
        buffered = [];
        bufferedTokens = 0;
      }

      chunks.push(
        ...splitLargeModuleSegment({
          filePath,
          lines,
          imports,
          startLine: segment.startLine,
          endLine: segment.endLine,
          maxTokensPerChunk
        })
      );
      continue;
    }

    if (bufferedTokens + segmentTokens > maxTokensPerChunk && buffered.length > 0) {
      chunks.push(
        makeModuleChunk({
          filePath,
          imports,
          segments: buffered,
          chunkKind: 'module'
        })
      );
      buffered = [];
      bufferedTokens = 0;
    }

    buffered.push({ ...segment, text: segmentText });
    bufferedTokens += segmentTokens;
  }

  if (buffered.length > 0) {
    chunks.push(
      makeModuleChunk({
        filePath,
        imports,
        segments: buffered,
        chunkKind: 'module'
      })
    );
  }

  return chunks;
}

function buildSymbolChunks(params: {
  filePath: string;
  lines: string[];
  symbol: ChunkSymbol;
  imports: string[];
  maxTokensPerChunk: number;
}): ChunkCandidate[] {
  const { filePath, lines, symbol, imports, maxTokensPerChunk } = params;
  const content = sliceLines(lines, symbol.startLine, symbol.endLine);
  const signature = symbol.signature ?? inferSignature(lines, symbol.startLine, symbol.endLine);
  const baseHeader = buildContextHeader({
    filePath,
    imports,
    symbol,
    signature
  });
  const estimatedTokens = estimateTokens(content) + estimateTokens(baseHeader);

  if (symbol.kind === 'class' && estimatedTokens > maxTokensPerChunk) {
    return splitLargeClassChunk({
      filePath,
      lines,
      symbol,
      imports,
      maxTokensPerChunk
    });
  }

  if (estimatedTokens <= maxTokensPerChunk) {
    return [
      makeChunkCandidate({
        filePath,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        content,
        contextHeader: baseHeader,
        symbolName: symbol.name,
        symbolKind: symbol.kind,
        parentClass: symbol.parentClass,
        signature,
        chunkKind: 'symbol',
        mergeable: true
      })
    ];
  }

  return splitLargeSymbolChunk({
    filePath,
    lines,
    symbol,
    imports,
    maxTokensPerChunk,
    signature
  });
}

function splitLargeClassChunk(params: {
  filePath: string;
  lines: string[];
  symbol: ChunkSymbol;
  imports: string[];
  maxTokensPerChunk: number;
}): ChunkCandidate[] {
  const { filePath, lines, symbol, imports, maxTokensPerChunk } = params;
  const classSignature = symbol.signature ?? inferSignature(lines, symbol.startLine, symbol.endLine);
  const methods = detectClassMethods(lines, symbol);

  if (methods.length === 0) {
    return splitLargeSymbolChunk({
      filePath,
      lines,
      symbol,
      imports,
      maxTokensPerChunk,
      signature: classSignature
    });
  }

  const chunks: ChunkCandidate[] = [];
  const classHeader = buildContextHeader({
    filePath,
    imports,
    symbol,
    signature: classSignature
  });

  const scaffoldStart = symbol.startLine;
  const scaffoldEnd = Math.max(symbol.startLine, methods[0].startLine - 1);
  if (scaffoldStart <= scaffoldEnd) {
    const scaffoldContent = sliceLines(lines, scaffoldStart, scaffoldEnd);
    if (scaffoldContent.trim()) {
      chunks.push(
        makeChunkCandidate({
          filePath,
          startLine: scaffoldStart,
          endLine: scaffoldEnd,
          content: scaffoldContent,
          contextHeader: `${classHeader}\npart: scaffold`,
          symbolName: symbol.name,
          symbolKind: 'class',
          parentClass: symbol.parentClass,
          signature: classSignature,
          chunkKind: 'symbol-part',
          mergeable: false
        })
      );
    }
  }

  methods.forEach((method, index) => {
    const partContent = sliceLines(lines, method.startLine, method.endLine);
    chunks.push(
      makeChunkCandidate({
        filePath,
        startLine: method.startLine,
        endLine: method.endLine,
        content: partContent,
        contextHeader: [
          classHeader,
          `part: ${index + 1}/${methods.length}`,
          `methodSignature: ${method.signature}`
        ].join('\n'),
        symbolName: method.name,
        symbolKind: 'method',
        parentClass: symbol.name,
        signature: method.signature,
        chunkKind: 'symbol-part',
        mergeable: false
      })
    );
  });

  const classTailStart = methods[methods.length - 1].endLine + 1;
  if (classTailStart <= symbol.endLine) {
    const tailContent = sliceLines(lines, classTailStart, symbol.endLine);
    if (tailContent.trim()) {
      chunks.push(
        makeChunkCandidate({
          filePath,
          startLine: classTailStart,
          endLine: symbol.endLine,
          content: tailContent,
          contextHeader: `${classHeader}\npart: tail`,
          symbolName: symbol.name,
          symbolKind: 'class',
          parentClass: symbol.parentClass,
          signature: classSignature,
          chunkKind: 'symbol-part',
          mergeable: false
        })
      );
    }
  }

  return chunks;
}

function splitLargeSymbolChunk(params: {
  filePath: string;
  lines: string[];
  symbol: ChunkSymbol;
  imports: string[];
  maxTokensPerChunk: number;
  signature: string;
}): ChunkCandidate[] {
  const { filePath, lines, symbol, imports, maxTokensPerChunk, signature } = params;
  const segments = splitBySafeBoundaries(lines, symbol.startLine, symbol.endLine, maxTokensPerChunk);
  const header = buildContextHeader({
    filePath,
    imports,
    symbol,
    signature
  });

  return segments.map((segment, index) =>
    makeChunkCandidate({
      filePath,
      startLine: segment.startLine,
      endLine: segment.endLine,
      content: sliceLines(lines, segment.startLine, segment.endLine),
      contextHeader: [
        header,
        `part: ${index + 1}/${segments.length}`
      ].join('\n'),
      symbolName: symbol.name,
      symbolKind: symbol.kind,
      parentClass: symbol.parentClass,
      signature,
      chunkKind: 'symbol-part',
      mergeable: false
    })
  );
}

function splitLargeModuleSegment(params: {
  filePath: string;
  lines: string[];
  imports: string[];
  startLine: number;
  endLine: number;
  maxTokensPerChunk: number;
}): ChunkCandidate[] {
  const { filePath, lines, imports, startLine, endLine, maxTokensPerChunk } = params;
  const segments = splitBySafeBoundaries(lines, startLine, endLine, maxTokensPerChunk);

  return segments.map((segment, index) =>
    makeChunkCandidate({
      filePath,
      startLine: segment.startLine,
      endLine: segment.endLine,
      content: sliceLines(lines, segment.startLine, segment.endLine),
      contextHeader: [
        buildContextHeader({
          filePath,
          imports,
          symbol: undefined,
          signature: 'module'
        }),
        `part: ${index + 1}/${segments.length}`
      ].join('\n'),
      chunkKind: 'module',
      mergeable: true
    })
  );
}

function detectClassMethods(lines: string[], classSymbol: ChunkSymbol): Array<{ name: string; startLine: number; endLine: number; signature: string }> {
  const methods: Array<{ name: string; startLine: number; endLine: number; signature: string }> = [];
  const startLine = classSymbol.startLine;
  const endLine = classSymbol.endLine;
  const isPython = /:\s*$/.test(lines[startLine - 1] ?? '') || lines.some((line) => /^\s*def\s+/.test(line));

  if (isPython) {
    const classIndent = (lines[startLine - 1]?.match(/^\s*/)?.[0].length ?? 0) + 4;
    for (let lineNumber = startLine + 1; lineNumber <= endLine; lineNumber += 1) {
      const line = lines[lineNumber - 1];
      if (!line) {
        continue;
      }

      const methodMatch = line.match(/^\s*def\s+([A-Za-z_$][\w$]*)\s*\(/);
      if (!methodMatch) {
        continue;
      }

      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (indent < classIndent) {
        continue;
      }

      const methodEnd = findPythonBlockEnd(lines, lineNumber);
      methods.push({
        name: methodMatch[1],
        startLine: lineNumber,
        endLine: methodEnd,
        signature: inferSignature(lines, lineNumber, methodEnd)
      });
    }
    return methods;
  }

  const classIndent = lines[startLine - 1]?.match(/^\s*/)?.[0].length ?? 0;
  for (let lineNumber = startLine + 1; lineNumber <= endLine; lineNumber += 1) {
    const line = lines[lineNumber - 1];
    if (!line) {
      continue;
    }

    const methodMatch = line.match(/^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+|readonly\s+|\*)*([A-Za-z_$][\w$]*)\s*\(/);
    if (!methodMatch) {
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= classIndent) {
      continue;
    }

    const methodEnd = findBraceBlockEnd(lines, lineNumber);
    methods.push({
      name: methodMatch[1],
      startLine: lineNumber,
      endLine: Math.min(methodEnd, endLine),
      signature: inferSignature(lines, lineNumber, Math.min(methodEnd, endLine))
    });
  }

  return methods;
}

function splitByBlankLines(lines: string[], startLine: number, endLine: number): Array<{ startLine: number; endLine: number }> {
  const segments: Array<{ startLine: number; endLine: number }> = [];
  let segmentStart = startLine;

  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    const line = lines[lineNumber - 1] ?? '';
    const isBlank = line.trim().length === 0;
    if (isBlank) {
      if (segmentStart <= lineNumber - 1) {
        segments.push({ startLine: segmentStart, endLine: lineNumber - 1 });
      }
      segmentStart = lineNumber + 1;
    }
  }

  if (segmentStart <= endLine) {
    segments.push({ startLine: segmentStart, endLine });
  }

  return segments.filter((segment) => sliceLines(lines, segment.startLine, segment.endLine).trim().length > 0);
}

function splitBySafeBoundaries(
  lines: string[],
  startLine: number,
  endLine: number,
  maxTokensPerChunk: number
): Array<{ startLine: number; endLine: number }> {
  const text = sliceLines(lines, startLine, endLine);
  if (estimateTokens(text) <= maxTokensPerChunk) {
    return [{ startLine, endLine }];
  }

  const blankSegments = splitByBlankLines(lines, startLine, endLine);
  if (blankSegments.length > 1) {
    const result: Array<{ startLine: number; endLine: number }> = [];
    for (const segment of blankSegments) {
      result.push(...splitBySafeBoundaries(lines, segment.startLine, segment.endLine, maxTokensPerChunk));
    }
    return result;
  }

  const midpoint = Math.floor((startLine + endLine) / 2);
  const splitPoint = findNearestSafeSplit(lines, startLine, endLine, midpoint);

  if (!splitPoint || splitPoint <= startLine || splitPoint >= endLine) {
    return [{ startLine, endLine }];
  }

  return [
    ...splitBySafeBoundaries(lines, startLine, splitPoint, maxTokensPerChunk),
    ...splitBySafeBoundaries(lines, splitPoint + 1, endLine, maxTokensPerChunk)
  ];
}

function findNearestSafeSplit(lines: string[], startLine: number, endLine: number, midpoint: number): number | null {
  for (let offset = 0; offset <= endLine - startLine; offset += 1) {
    const forward = midpoint + offset;
    const backward = midpoint - offset;
    if (forward < endLine && isSafeSplitLine(lines, forward)) {
      return forward;
    }
    if (backward > startLine && isSafeSplitLine(lines, backward)) {
      return backward;
    }
  }

  return null;
}

function isSafeSplitLine(lines: string[], lineNumber: number): boolean {
  const current = lines[lineNumber - 1] ?? '';
  const next = lines[lineNumber] ?? '';
  return current.trim().length === 0 || next.trim().length === 0 || /[)}\]]\s*$/.test(current);
}

function makeModuleChunk(params: {
  filePath: string;
  imports: string[];
  segments: Array<{ startLine: number; endLine: number; text: string }>;
  chunkKind: 'module';
}): ChunkCandidate {
  const { filePath, imports, segments } = params;
  const startLine = segments[0].startLine;
  const endLine = segments[segments.length - 1].endLine;
  const content = segments.map((segment) => segment.text).join(DEFAULT_CONTEXT_SEPARATOR);
  const contextHeader = buildContextHeader({
    filePath,
    imports,
    signature: 'module'
  });

  return makeChunkCandidate({
    filePath,
    startLine,
    endLine,
    content,
    contextHeader,
    chunkKind: 'module',
    mergeable: true
  });
}

function makeChunkCandidate(params: {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  contextHeader: string;
  chunkKind: CodeChunk['chunkKind'];
  mergeable: boolean;
  symbolName?: string;
  symbolKind?: ChunkSymbol['kind'];
  parentClass?: string;
  signature?: string;
}): ChunkCandidate {
  const estimatedTokens = estimateTokens(params.contextHeader) + estimateTokens(params.content);
  return {
    filePath: params.filePath,
    startLine: params.startLine,
    endLine: params.endLine,
    content: params.content.trimEnd(),
    contextHeader: params.contextHeader.trimEnd(),
    estimatedTokens,
    chunkKind: params.chunkKind,
    symbolName: params.symbolName,
    symbolKind: params.symbolKind,
    parentClass: params.parentClass,
    signature: params.signature,
    mergeable: params.mergeable,
    textForRanking: [
      params.symbolName ?? '',
      params.signature ?? '',
      params.parentClass ?? '',
      params.contextHeader,
      params.content
    ].join(DEFAULT_CONTEXT_SEPARATOR)
  };
}

function stripChunkCandidate(candidate: ChunkCandidate): CodeChunk {
  const { mergeable: _mergeable, textForRanking: _textForRanking, ...chunk } = candidate;
  return chunk;
}

function normalizeSymbols(sourceCode: string, symbols: ChunkSymbol[]): ChunkSymbol[] {
  return symbols
    .map((symbol) => ({
      ...symbol,
      signature: symbol.signature ?? inferSignature(sourceCode.split(/\r?\n/), symbol.startLine, symbol.endLine)
    }))
    .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);
}

function buildContextHeader(params: {
  filePath: string;
  imports: string[];
  symbol?: ChunkSymbol;
  signature: string;
}): string {
  const lines = [
    '/* NEVERMIN_CONTEXT',
    `path: ${params.filePath}`,
    `signature: ${params.signature}`
  ];

  if (params.imports.length > 0) {
    lines.push('imports:');
    for (const item of params.imports) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push('imports: []');
  }

  if (params.symbol) {
    lines.push(`symbolKind: ${params.symbol.kind}`);
    lines.push(`symbolName: ${params.symbol.name}`);
    if (params.symbol.parentClass) {
      lines.push(`parentClass: ${params.symbol.parentClass}`);
    }
  }

  lines.push('*/');
  return lines.join('\n');
}

function extractImports(lines: string[]): string[] {
  return lines
    .filter((line) => /^\s*import\s+/.test(line) || /^\s*from\s+.+\s+import\s+/.test(line))
    .map((line) => line.trim())
    .slice(0, 20);
}

function inferSignature(lines: string[], startLine: number, endLine: number): string {
  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    const line = (lines[lineNumber - 1] ?? '').trim();
    if (line.length === 0) {
      continue;
    }
    return line.replace(/\s+/g, ' ').slice(0, 240);
  }

  return 'unknown';
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

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  const tokens = trimmed.match(/[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|[^\s]/g);
  return Math.max(1, tokens?.length ?? 0);
}

function getChunkTokenCount(chunk: CodeChunk): number {
  return chunk.estimatedTokens ?? estimateTokens([chunk.contextHeader ?? '', chunk.content].join('\n'));
}

function rankChunksBm25(query: string, chunks: CodeChunk[]): Array<{ chunk: CodeChunk; score: number }> {
  const queryTerms = tokenize(query);
  const docs = chunks.map((chunk) => tokenize(getRankingText(chunk)));
  const docCount = docs.length || 1;
  const avgDocLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docCount || 1;
  const termDocumentFrequencies = new Map<string, number>();

  for (const doc of docs) {
    const uniqueTerms = new Set(doc);
    for (const term of uniqueTerms) {
      termDocumentFrequencies.set(term, (termDocumentFrequencies.get(term) ?? 0) + 1);
    }
  }

  return chunks
    .map((chunk, index) => {
      const doc = docs[index];
      const score = queryTerms.reduce((total, term) => {
        const tf = doc.filter((docTerm) => docTerm === term).length;
        if (tf === 0) {
          return total;
        }

        const df = termDocumentFrequencies.get(term) ?? 0;
        const idf = Math.log(1 + ((docCount - df + 0.5) / (df + 0.5)));
        const k1 = 1.5;
        const b = 0.75;
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + (b * doc.length) / avgDocLength);
        return total + idf * (numerator / denominator);
      }, 0);

      return { chunk, score };
    })
    .sort((left, right) => right.score - left.score);
}

function fuseRankings(rankings: Array<Array<{ chunk: CodeChunk; score: number }>>): Array<{ chunk: CodeChunk; score: number }> {
  const fused = new Map<CodeChunk, number>();

  for (const ranking of rankings) {
    ranking.forEach((entry, index) => {
      const current = fused.get(entry.chunk) ?? 0;
      fused.set(entry.chunk, current + 1 / (DEFAULT_RRF_K + index + 1));
    });
  }

  return [...fused.entries()]
    .map(([chunk, score]) => ({ chunk, score }))
    .sort((left, right) => right.score - left.score);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z0-9_]+/g)
    ?.filter(Boolean) ?? [];
}

function getRankingText(chunk: CodeChunk): string {
  return [
    chunk.symbolName ?? '',
    chunk.signature ?? '',
    chunk.parentClass ?? '',
    chunk.contextHeader ?? '',
    chunk.content
  ].join('\n');
}

function toRelativePath(filePath: string): string {
  return path.isAbsolute(filePath) ? path.relative(process.cwd(), filePath) : filePath;
}
