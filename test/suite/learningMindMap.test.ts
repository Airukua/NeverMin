import * as assert from 'assert';
import {
  buildLearningMindMapMermaid,
  buildLearningMindMapModel
} from '../../src/core/graph/learningMindMap';
import { GraphInsights } from '../../src/core/graph/graphInsights';

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

describe('learning mind map', () => {
  it('membangun mindmap Mermaid dengan cabang belajar', () => {
    const insights = emptyInsights({
      entryPoints: [
        {
          id: '1',
          name: 'App',
          kind: 'function',
          filePath: '/src/app/App.tsx',
          startLine: 1,
          endLine: 10,
          score: 10,
          reason: 'entry'
        }
      ],
      hubs: [
        {
          id: '2',
          name: 'Store',
          kind: 'class',
          filePath: '/src/core/Store.ts',
          startLine: 1,
          endLine: 20,
          score: 8,
          reason: 'hub'
        }
      ],
      mainFlow: {
        id: 'flow-1',
        label: 'main',
        input: 'Form',
        process: ['Validate'],
        output: 'API',
        steps: ['Form', 'Validate', 'API'],
        nodeIds: ['a', 'b', 'c'],
        ioScore: 3,
        mermaid: 'flowchart LR',
        stages: [
          {
            role: 'input',
            name: 'Form',
            nodeId: 'a',
            filePath: '/src/ui/Form.tsx',
            startLine: 1,
            endLine: 5
          },
          {
            role: 'process',
            name: 'Validate',
            nodeId: 'b',
            filePath: '/src/core/validate.ts',
            startLine: 1,
            endLine: 5
          },
          {
            role: 'output',
            name: 'API',
            nodeId: 'c',
            filePath: '/src/api/client.ts',
            startLine: 1,
            endLine: 5
          }
        ]
      }
    });

    const source = buildLearningMindMapMermaid(insights, { lang: 'id' });
    assert.ok(source.startsWith('mindmap'));
    assert.ok(source.includes('Pecahan belajar') || source.includes('root(('));
    assert.ok(source.includes('Mulai di sini'));
    assert.ok(source.includes('App'));
    assert.ok(source.includes('Alur utama'));
    assert.ok(source.includes('Konsep inti'));
    assert.ok(source.includes('Store'));

    const model = buildLearningMindMapModel(insights, { lang: 'id' });
    assert.strictEqual(model.rootTitle, 'Pecahan belajar');
    assert.ok(model.branches.some((b) => b.id === 'start' && b.children[0]?.name === 'App'));
    assert.ok(model.branches.some((b) => b.id === 'hubs' && b.children[0]?.name === 'Store'));
    assert.ok(model.mermaid.startsWith('mindmap'));
  });

  it('versi English memakai label EN', () => {
    const source = buildLearningMindMapMermaid(emptyInsights(), { lang: 'en' });
    assert.ok(source.includes('Learning breakdown') || source.includes('Run analysis first'));
    const model = buildLearningMindMapModel(emptyInsights(), { lang: 'en' });
    assert.strictEqual(model.rootTitle, 'Learning breakdown');
  });
});
