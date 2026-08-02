import * as assert from 'assert';
import { resolveGraphNodeUri } from '../../src/ui/webview/graphPanel';

describe('resolveGraphNodeUri', () => {
  it('mempertahankan remote uri tanpa memaksa Uri.file', () => {
    const node = {
      id: 'vscode-remote://wsl+ubuntu/home/user/project/src/index.ts',
      filePath: 'vscode-remote://wsl+ubuntu/home/user/project/src/index.ts'
    };

    const resolved = resolveGraphNodeUri(node);

    assert.ok(resolved);
    assert.strictEqual(resolved?.scheme, 'vscode-remote');
    assert.strictEqual(resolved?.toString(true), node.filePath);
  });

  it('menerjemahkan path lokal menjadi file uri', () => {
    const node = {
      id: '/home/user/project/src/index.ts',
      filePath: '/home/user/project/src/index.ts'
    };

    const resolved = resolveGraphNodeUri(node);

    assert.ok(resolved);
    assert.strictEqual(resolved?.scheme, 'file');
    assert.strictEqual(resolved?.fsPath, node.filePath);
  });
});
