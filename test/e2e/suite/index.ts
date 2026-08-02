import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';

suite('NeverMIN e2e', function () {
  this.timeout(60_000);

  const fixtureWorkspace = path.resolve(__dirname, '../../../../test/fixtures/e2e-workspace');

  test('extension mengaktif dan command utama terdaftar', async () => {
    const extension = vscode.extensions.getExtension('nevermin');
    assert.ok(extension, 'extension nevermin harus ada');

    await extension!.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('nevermin.analyzeRepo'));
    assert.ok(commands.includes('nevermin.analyzeSelectedFiles'));
    assert.ok(commands.includes('nevermin.explainSelection'));
    assert.ok(commands.includes('nevermin.refreshSidebar'));
  });

  test('analisis repo pada workspace fixture tidak melempar error', async () => {
    const added = vscode.workspace.updateWorkspaceFolders(0, 0, {
      uri: vscode.Uri.file(fixtureWorkspace),
      name: 'nevermin-e2e-workspace'
    });

    assert.ok(added, 'workspace fixture harus bisa ditambahkan');

    await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
    await vscode.commands.executeCommand('nevermin.analyzeRepo');
  });

  test('refresh sidebar dan explainSelection aman saat tidak ada editor aktif', async () => {
    await vscode.commands.executeCommand('nevermin.refreshSidebar');
    await vscode.commands.executeCommand('nevermin.explainSelection');
  });
});
