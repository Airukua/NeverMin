import * as assert from 'assert';
import { buildGraphPayload } from '../../src/ui/webview/graphPayload';

describe('buildGraphPayload', () => {
  it('mengubah node/edge ke format cytoscape flat tanpa compound parent', () => {
    const payload = buildGraphPayload({
      nodes: [
        {
          id: '/workspace/src/index.ts',
          kind: 'file',
          name: 'index.ts',
          filePath: '/workspace/src/index.ts',
          startLine: 1,
          endLine: 10
        },
        {
          id: '/workspace/src/index.ts#bootstrap:1',
          kind: 'function',
          name: 'bootstrap',
          filePath: '/workspace/src/index.ts',
          startLine: 1,
          endLine: 3
        }
      ],
      edges: [
        {
          from: '/workspace/src/index.ts',
          to: '/workspace/src/index.ts#bootstrap:1',
          kind: 'defines'
        }
      ]
    });

    const fileNode = payload.nodes.find((node) => node.data.kind === 'file');
    const symbolNode = payload.nodes.find((node) => node.data.kind === 'function');

    assert.ok(fileNode);
    assert.ok(symbolNode);
    assert.strictEqual((fileNode?.data as { parent?: string }).parent, undefined);
    assert.strictEqual((symbolNode?.data as { parent?: string }).parent, undefined);
    assert.strictEqual(payload.edges[0]?.data.source, '/workspace/src/index.ts');
    assert.strictEqual(payload.edges[0]?.data.target, '/workspace/src/index.ts#bootstrap:1');
    assert.strictEqual(payload.edges[0]?.data.label, 'defines');
  });

  it('mengubah edge ke format source/target cytoscape', () => {
    const payload = buildGraphPayload({
      nodes: [
        {
          id: 'a',
          kind: 'function',
          name: 'a',
          filePath: 'a.ts',
          startLine: 1,
          endLine: 1
        },
        {
          id: 'b',
          kind: 'function',
          name: 'b',
          filePath: 'b.ts',
          startLine: 1,
          endLine: 1
        }
      ],
      edges: [{ from: 'a', to: 'b', kind: 'calls' }]
    });

    assert.strictEqual(payload.edges[0]?.data.source, 'a');
    assert.strictEqual(payload.edges[0]?.data.target, 'b');
    assert.strictEqual(payload.edges[0]?.data.label, 'calls');
    assert.strictEqual((payload.nodes[0]?.data as { parent?: string }).parent, undefined);
  });
});
