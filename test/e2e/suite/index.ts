import * as assert from 'assert';
import path from 'path';
import * as vscode from 'vscode';
import { getLatestRepoAnalysis, getRepoAnalysisStatus } from '../../../src/utils/repoAnalysis';

suite('NeverMIN e2e', function () {
  this.timeout(90_000);

  const fixtureWorkspace = path.resolve(__dirname, '../../../../test/fixtures/e2e-workspace');

  test('extension mengaktif dan command utama terdaftar', async () => {
    const extension = vscode.extensions.getExtension('abdul-wahid-rukua.nevermin');
    assert.ok(extension, 'extension abdul-wahid-rukua.nevermin harus ada');

    const api = (await extension!.activate()) as { context: vscode.ExtensionContext };
    assert.ok(api?.context, 'activate harus mengekspor context');

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('nevermin.analyzeRepo'));
    assert.ok(commands.includes('nevermin.analyzeSelectedFiles'));
    assert.ok(commands.includes('nevermin.explainSelection'));
    assert.ok(commands.includes('nevermin.refreshSidebar'));
    assert.ok(commands.includes('nevermin.clearAnalysisSelection'));
  });

  test('analisis repo pada workspace fixture menghasilkan status ready + insights', async () => {
    const extension = vscode.extensions.getExtension('abdul-wahid-rukua.nevermin');
    assert.ok(extension);
    const api = (await extension!.activate()) as { context: vscode.ExtensionContext };

    const added = vscode.workspace.updateWorkspaceFolders(0, 0, {
      uri: vscode.Uri.file(fixtureWorkspace),
      name: 'nevermin-e2e-workspace'
    });
    assert.ok(added, 'workspace fixture harus bisa ditambahkan');

    await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
    await vscode.commands.executeCommand('nevermin.analyzeRepo');

    const deadline = Date.now() + 60_000;
    let status = getRepoAnalysisStatus(api.context);
    while (Date.now() < deadline && status === 'loading') {
      await new Promise((resolve) => setTimeout(resolve, 400));
      status = getRepoAnalysisStatus(api.context);
    }

    assert.strictEqual(status, 'ready', `status analisis harus ready, dapat: ${status}`);
    const analysis = getLatestRepoAnalysis(api.context);
    assert.ok(analysis, 'hasil analisis harus tersimpan');
    assert.ok(analysis!.fileCount >= 1, 'minimal satu file teranalisis');
    assert.ok(analysis!.insights, 'insights harus ada');
    assert.ok(
      analysis!.insights.summaryBullets.length >= 1 || analysis!.insights.mainFlow,
      'insights harus punya summary atau mainFlow'
    );
  });

  test('refresh sidebar dan explainSelection aman saat tidak ada editor aktif', async () => {
    await vscode.commands.executeCommand('nevermin.refreshSidebar');
    await vscode.commands.executeCommand('nevermin.explainSelection');
  });
});
