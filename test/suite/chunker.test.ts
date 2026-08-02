import * as assert from 'assert';
import {
  chunkBySymbol,
  compareChunkingMetrics,
  estimateChunkingMetrics,
  selectRelevantChunks,
  ChunkSymbol
} from '../../src/core/context/chunker';

function buildFixture() {
  const lines: string[] = ["import { helper } from './helper';", ''];
  const symbols: ChunkSymbol[] = [];

  const addFunction = (name: string, marker: string) => {
    const startLine = lines.length + 1;
    lines.push(
      `function ${name}(input: string) {`,
      `  const cleaned = helper(input);`,
      `  return cleaned + '${marker}';`,
      `}`,
      ''
    );
    symbols.push({
      kind: 'function',
      name,
      startLine,
      endLine: startLine + 3,
      signature: `function ${name}(input: string)`
    });
  };

  for (let index = 1; index <= 12; index += 1) {
    addFunction(`fn${index}`, `marker-${index}`);
  }

  const classStartLine = lines.length + 1;
  lines.push('class BigService {', '  state = 0;', '');

  const addMethod = (name: string, marker: string) => {
    const startLine = lines.length + 1;
    lines.push(
      `  ${name}(input: string) {`,
      `    const step1 = helper(input + '${marker}-1');`,
      `    const step2 = helper(step1 + '${marker}-2');`,
      `    const step3 = helper(step2 + '${marker}-3');`,
      `    const step4 = helper(step3 + '${marker}-4');`,
      `    const step5 = helper(step4 + '${marker}-5');`,
      `    const step6 = helper(step5 + '${marker}-6');`,
      `    const step7 = helper(step6 + '${marker}-7');`,
      `    const step8 = helper(step7 + '${marker}-8');`,
      `    const step9 = helper(step8 + '${marker}-9');`,
      `    return step9;`,
      `  }`,
      ''
    );
    return {
      name,
      startLine,
      endLine: startLine + 11,
      signature: `${name}(input: string)`
    };
  };

  const methodSymbols = [
    addMethod('renderReport', 'report'),
    addMethod('buildGraphView', 'graph'),
    addMethod('summarizeUsage', 'usage')
  ];

  lines.push('}');

  symbols.push({
    kind: 'class',
    name: 'BigService',
    startLine: classStartLine,
    endLine: lines.length,
    signature: 'class BigService'
  });

  return {
    content: lines.join('\n'),
    symbols,
    methodSymbols
  };
}

describe('chunker symbol-aware flow', () => {
  it('memotong file berdasarkan symbol dan menjaga header/context di preset 400 dan 800', () => {
    const fixture = buildFixture();
    const chunks400 = chunkBySymbol('src/sample.ts', fixture.content, fixture.symbols, {
      maxTokensPerChunk: 400
    });
    const chunks800 = chunkBySymbol('src/sample.ts', fixture.content, fixture.symbols, {
      maxTokensPerChunk: 800
    });

    assert.ok(chunks400.length > chunks800.length);

    for (const chunk of chunks400) {
      assert.ok((chunk.estimatedTokens ?? 0) <= 400, `chunk melebihi budget: ${chunk.estimatedTokens}`);
    }

    for (const chunk of chunks800) {
      assert.ok((chunk.estimatedTokens ?? 0) <= 800, `chunk melebihi budget: ${chunk.estimatedTokens}`);
    }

    const moduleChunk = chunks400.find((chunk) => chunk.chunkKind === 'module');
    assert.ok(moduleChunk);
    assert.match(moduleChunk!.contextHeader ?? '', /path: src\/sample\.ts/);
    assert.match(moduleChunk!.contextHeader ?? '', /imports:/);

    const functionChunk = chunks400.find((chunk) => chunk.symbolName === 'fn1');
    assert.ok(functionChunk);
    assert.strictEqual(functionChunk?.chunkKind, 'symbol');
    assert.match(functionChunk!.contextHeader ?? '', /symbolName: fn1/);
    assert.match(functionChunk!.contextHeader ?? '', /signature: function fn1\(input: string\)/);

    const classPartChunk = chunks400.find((chunk) => chunk.chunkKind === 'symbol-part' && chunk.parentClass === 'BigService');
    assert.ok(classPartChunk);
    assert.match(classPartChunk!.contextHeader ?? '', /symbolKind: class|symbolKind: method/);
    assert.match(classPartChunk!.contextHeader ?? '', /part:/);
  });

  it('menyeleksi chunk relevan dengan BM25 + reciprocal rank fusion', () => {
    const chunks = [
      {
        filePath: 'src/context.ts',
        startLine: 1,
        endLine: 5,
        content: "import { helper } from './helper';\nconst bootstrap = true;",
        contextHeader: '/* NEVERMIN_CONTEXT\npath: src/context.ts\nsignature: module\nimports:\n- import { helper } from \'./helper\';\n*/',
        estimatedTokens: 20,
        chunkKind: 'module' as const
      },
      {
        filePath: 'src/context.ts',
        startLine: 10,
        endLine: 30,
        content: 'function renderGraph() { return "graph nodes edges"; }',
        contextHeader: '/* NEVERMIN_CONTEXT\npath: src/context.ts\nsignature: function renderGraph()\nsymbolKind: function\nsymbolName: renderGraph\n*/',
        estimatedTokens: 12,
        chunkKind: 'symbol' as const,
        symbolName: 'renderGraph',
        symbolKind: 'function' as const,
        signature: 'function renderGraph()'
      },
      {
        filePath: 'src/context.ts',
        startLine: 40,
        endLine: 60,
        content: 'function parseYaml() { return "yaml"; }',
        contextHeader: '/* NEVERMIN_CONTEXT\npath: src/context.ts\nsignature: function parseYaml()\nsymbolKind: function\nsymbolName: parseYaml\n*/',
        estimatedTokens: 10,
        chunkKind: 'symbol' as const,
        symbolName: 'parseYaml',
        symbolKind: 'function' as const,
        signature: 'function parseYaml()'
      }
    ];

    const selected = selectRelevantChunks('graph nodes', chunks, 50, {
      queryVariants: ['graph nodes', 'graph', 'nodes']
    });

    assert.strictEqual(selected[0].chunkKind, 'module');
    assert.strictEqual(selected[1].symbolName, 'renderGraph');
  });

  it('menghitung metrik token dari chunk hasil split', () => {
    const fixture = buildFixture();
    const chunks400 = chunkBySymbol('src/sample.ts', fixture.content, fixture.symbols, {
      maxTokensPerChunk: 400
    });
    const chunks800 = chunkBySymbol('src/sample.ts', fixture.content, fixture.symbols, {
      maxTokensPerChunk: 800
    });
    const metrics = estimateChunkingMetrics(chunks400);
    const comparison = compareChunkingMetrics(chunks800, chunks400);

    assert.ok(metrics.totalTokens > 0);
    assert.ok(metrics.averageTokens > 0);
    assert.strictEqual(comparison.before.totalTokens, estimateChunkingMetrics(chunks800).totalTokens);
    assert.notStrictEqual(comparison.deltaAverageTokens, 0);
  });
});
