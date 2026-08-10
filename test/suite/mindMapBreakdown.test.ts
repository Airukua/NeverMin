import * as assert from 'assert';
import {
  attachHeuristicMindMapBreakdown,
  buildLearningMindMapModel,
  heuristicChildrenForLeaf,
  mergeMindMapBreakdown,
  listMindMapLeavesNeedingBreakdown
} from '../../src/core/graph/learningMindMap';
import type { CodeGraph } from '../../src/core/graph/types';
import type { GraphInsights } from '../../src/core/graph/graphInsights';

function emptyInsights(partial: Partial<GraphInsights> = {}): GraphInsights {
  return {
    generatedAt: new Date().toISOString(),
    entryPoints: [],
    hubs: [],
    mainFlow: null,
    keyFlows: [],
    orphanFiles: [],
    stats: {
      nodeCount: 0,
      edgeCount: 0,
      nodesByKind: {},
      edgesByKind: {}
    },
    summaryBullets: [],
    ...partial
  };
}

describe('mind map breakdown', () => {
  const insights = emptyInsights({
    entryPoints: [
      {
        id: 'f.py#main',
        name: 'main',
        kind: 'function',
        filePath: '/repo/f.py',
        startLine: 1,
        endLine: 20,
        score: 10,
        reason: 'entry'
      }
    ]
  });

  const graph: CodeGraph = {
    nodes: [
      {
        id: 'f.py#main',
        name: 'main',
        kind: 'function',
        filePath: '/repo/f.py',
        startLine: 1,
        endLine: 20
      },
      {
        id: 'f.py#rescore',
        name: 'rescore',
        kind: 'function',
        filePath: '/repo/f.py',
        startLine: 22,
        endLine: 40
      },
      {
        id: 'f.py#helper',
        name: 'helper',
        kind: 'function',
        filePath: '/repo/f.py',
        startLine: 42,
        endLine: 50
      }
    ],
    edges: [
      { from: 'f.py#main', to: 'f.py#rescore', kind: 'calls' },
      { from: 'f.py#rescore', to: 'f.py#helper', kind: 'calls' }
    ]
  };

  it('heuristicChildrenForLeaf returns callees', () => {
    const kids = heuristicChildrenForLeaf(
      { id: 'f.py#main', name: 'main', filePath: '/repo/f.py' },
      graph
    );
    assert.strictEqual(kids.length, 1);
    assert.strictEqual(kids[0].name, 'rescore');
  });

  it('attachHeuristicMindMapBreakdown nests children and skips empty', () => {
    const base = buildLearningMindMapModel(insights);
    const withKids = attachHeuristicMindMapBreakdown(base, graph, { depth: 2 });
    const main = withKids.branches[0].children[0];
    assert.ok(main.children && main.children.length > 0);
    assert.strictEqual(main.children![0].name, 'rescore');
    assert.ok(main.children![0].children && main.children![0].children!.length > 0);
    assert.strictEqual(main.children![0].children![0].name, 'helper');
  });

  it('mergeMindMapBreakdown ignores empty LLM kids', () => {
    const base = buildLearningMindMapModel(insights);
    const merged = mergeMindMapBreakdown(base, {
      'f.py#main': [],
      missing: [{ id: 'x', name: 'x' }]
    });
    assert.strictEqual(merged.branches[0].children[0].children, undefined);
    assert.deepStrictEqual(
      listMindMapLeavesNeedingBreakdown(merged).map((l) => l.id),
      ['f.py#main']
    );
  });
});
