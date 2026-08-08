import * as assert from 'assert';
import {
  buildSymbolTree,
  folderKeyForFile,
  relativePathForFile
} from '../../src/core/graph/symbolTree';
import { CodeGraph } from '../../src/core/graph/types';

describe('symbolTree', () => {
  it('relative path & folder key mengikuti workspace root', () => {
    assert.strictEqual(relativePathForFile('/app/repo/src/utils/a.ts', ['/app/repo']), 'src/utils/a.ts');
    assert.strictEqual(folderKeyForFile('/app/repo/src/utils/a.ts', ['/app/repo']), 'src/utils');
    assert.strictEqual(folderKeyForFile('/app/repo/main.ts', ['/app/repo']), '.');
  });

  it('buildSymbolTree nested seperti explorer (bukan flat path)', () => {
    const graph: CodeGraph = {
      nodes: [
        {
          id: '/app/repo/src/core/graph.ts#build:1',
          kind: 'function',
          name: 'build',
          filePath: '/app/repo/src/core/graph.ts',
          startLine: 1,
          endLine: 10
        },
        {
          id: '/app/repo/src/app/(auth)/login.ts#Login:1',
          kind: 'function',
          name: 'Login',
          filePath: '/app/repo/src/app/(auth)/login.ts',
          startLine: 1,
          endLine: 20
        },
        {
          id: '/app/repo/readme.md#noop:1',
          kind: 'function',
          name: 'noop',
          filePath: '/app/repo/root.ts',
          startLine: 1,
          endLine: 2
        }
      ],
      edges: []
    };

    const tree = buildSymbolTree(graph, { workspaceRoots: ['/app/repo'] });

    assert.strictEqual(tree.folders.length, 1);
    assert.strictEqual(tree.folders[0].name, 'src');
    assert.strictEqual(tree.folders[0].folderPath, 'src');

    const childNames = tree.folders[0].folders.map((f) => f.name).sort();
    assert.deepStrictEqual(childNames, ['app', 'core']);

    const core = tree.folders[0].folders.find((f) => f.name === 'core');
    assert.ok(core);
    assert.strictEqual(core!.files[0].displayName, 'graph.ts');

    const auth = tree.folders[0].folders
      .find((f) => f.name === 'app')
      ?.folders.find((f) => f.name === '(auth)');
    assert.ok(auth);
    assert.strictEqual(auth!.folderPath, 'src/app/(auth)');
    assert.strictEqual(auth!.files[0].displayName, 'login.ts');

    assert.strictEqual(tree.files.length, 1);
    assert.strictEqual(tree.files[0].displayName, 'root.ts');
  });
});
