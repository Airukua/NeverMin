import * as assert from 'assert';
import {
  computePageRank,
  computeBetweenness,
  isGenericUtilityNode,
  callerModuleDiversity,
  folderKey
} from '../../src/core/graph/graphCentrality';
import { CodeGraph, GraphNode } from '../../src/core/graph/types';
import { buildRepoGraph } from '../../src/core/graph/graphBuilder';
import { buildGraphInsights } from '../../src/core/graph/graphInsights';

describe('graphCentrality', () => {
  it('PageRank mengangkat node yang banyak dituju (hub), reverse PageRank mengangkat caller (entry)', () => {
    const nodeIds = ['entry', 'mid', 'util'];
    const edges = [
      { from: 'entry', to: 'mid' },
      { from: 'mid', to: 'util' },
      { from: 'entry', to: 'util' }
    ];

    const pr = computePageRank(nodeIds, edges, { reverse: false, iterations: 30 });
    const rpr = computePageRank(nodeIds, edges, { reverse: true, iterations: 30 });

    assert.ok((pr.get('util') ?? 0) > (pr.get('entry') ?? 0), 'util harus PageRank tertinggi');
    assert.ok((rpr.get('entry') ?? 0) > (rpr.get('util') ?? 0), 'entry harus reverse PageRank tertinggi');
  });

  it('betweenness tinggi untuk jembatan antar jalur', () => {
    const nodeIds = ['a', 'bridge', 'b', 'c'];
    const edges = [
      { from: 'a', to: 'bridge' },
      { from: 'bridge', to: 'b' },
      { from: 'bridge', to: 'c' }
    ];
    const between = computeBetweenness(nodeIds, edges);
    assert.ok(
      (between.get('bridge') ?? 0) >= (between.get('a') ?? 0),
      'bridge harus betweenness >= leaf'
    );
    assert.ok((between.get('bridge') ?? 0) > 0, 'bridge harus punya betweenness > 0');
  });

  it('isGenericUtilityNode mendeteksi utils/format*', () => {
    const util: GraphNode = {
      id: 'src/utils/format.ts#formatLabel',
      kind: 'function',
      name: 'formatLabel',
      filePath: 'src/utils/format.ts',
      startLine: 1,
      endLine: 3
    };
    const domain: GraphNode = {
      id: 'src/auth/loginUser.ts#loginUser',
      kind: 'function',
      name: 'loginUser',
      filePath: 'src/auth/loginUser.ts',
      startLine: 1,
      endLine: 10
    };
    assert.strictEqual(isGenericUtilityNode(util), true);
    assert.strictEqual(isGenericUtilityNode(domain), false);
  });

  it('callerModuleDiversity lebih tinggi bila caller lintas folder', () => {
    const nodes: GraphNode[] = [
      { id: 'a', kind: 'function', name: 'a', filePath: 'src/auth/a.ts', startLine: 1, endLine: 1 },
      { id: 'b', kind: 'function', name: 'b', filePath: 'src/ui/b.ts', startLine: 1, endLine: 1 },
      { id: 'hub', kind: 'function', name: 'hub', filePath: 'src/core/hub.ts', startLine: 1, endLine: 1 }
    ];
    const graph: CodeGraph = {
      nodes,
      edges: [
        { from: 'a', to: 'hub', kind: 'calls' },
        { from: 'b', to: 'hub', kind: 'calls' }
      ]
    };
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const diversity = callerModuleDiversity('hub', graph, byId);
    assert.ok(diversity > 0.5, `diversity lintas folder harus tinggi, got ${diversity}`);
    assert.strictEqual(folderKey('src/auth/a.ts'), 'src/auth');
  });
});

describe('buildGraphInsights centrality wiring', () => {
  it('tetap menghasilkan entry/hub/flow setelah upgrade centrality', async () => {
    const graph = await buildRepoGraph([
      {
        path: 'src/utils/format.ts',
        content: [
          'export const formatLabel = (value: string) => {',
          '  return value.trim();',
          '};'
        ].join('\n')
      },
      {
        path: 'src/components/SidebarContext.tsx',
        content: [
          'export const SidebarContext = () => {',
          '  return { open: true };',
          '};'
        ].join('\n')
      },
      {
        path: 'src/components/Sidebar.tsx',
        content: [
          "import { formatLabel } from '@/utils/format';",
          "import SidebarContext from './SidebarContext';",
          '',
          'export const Sidebar = () => {',
          '  const label = formatLabel("menu");',
          '  return <SidebarContext />;',
          '};'
        ].join('\n')
      }
    ]);

    const insights = buildGraphInsights(graph);
    assert.ok(insights.entryPoints.length + insights.hubs.length > 0);
    assert.ok(insights.summaryBullets.length > 0);
  });
});
