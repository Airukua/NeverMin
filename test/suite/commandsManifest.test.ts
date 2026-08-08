import * as assert from 'assert';
import fs from 'fs';
import path from 'path';
import { SectionItem } from '../../src/ui/sidebar/treeDataProvider';
import { isIgnoredWorkspacePath } from '../../src/utils/workspace';

describe('commands / sidebar shallow', () => {
  it('package.json mendaftarkan command inti NeverMIN', () => {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      contributes: { commands: Array<{ command: string }> };
    };
    const commands = new Set(pkg.contributes.commands.map((item) => item.command));

    for (const required of [
      'nevermin.analyzeRepo',
      'nevermin.analyzeSelectedFiles',
      'nevermin.explainSelection',
      'nevermin.refreshSidebar',
      'nevermin.clearAnalysisSelection',
      'nevermin.setApiKey',
      'nevermin.selectProvider',
      'nevermin.selectOllamaModel',
      'nevermin.choosePrivacyMode',
      'nevermin.setPrivacyPrivate',
      'nevermin.setPrivacyPublic',
      'nevermin.openFileFunctionGraph',
      'nevermin.analyzeGitHistory',
      'nevermin.wipeWorkspaceData',
      'nevermin.openOutputLogs',
      'nevermin.clearActivityLogs'
    ]) {
      assert.ok(commands.has(required), `missing command ${required}`);
    }

    const pkgFull = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      contributes: {
        configuration: { properties: Record<string, { default?: unknown }> };
      };
    };
    const props = pkgFull.contributes.configuration.properties;
    assert.strictEqual(props['nevermin.provider']?.default, 'ollama');
    assert.strictEqual(props['nevermin.language']?.default, 'id');
    assert.ok(props['nevermin.ollamaBaseUrl']);
    assert.ok(props['nevermin.maxAnalysisFiles']);
  });

  it('SectionItem membuat tree item dengan contextValue section.*', () => {
    const item = new SectionItem('results', '3. Results', 'graph', 2, 'siap');
    assert.strictEqual(item.section, 'results');
    assert.strictEqual(item.contextValue, 'section.results');
    assert.strictEqual(item.description, 'siap');
  });

  it('lib/ source folder tidak lagi di-ignore buta', () => {
    assert.strictEqual(isIgnoredWorkspacePath('/app/src/lib/utils.ts'), false);
    assert.strictEqual(isIgnoredWorkspacePath('/app/libs/core/index.ts'), false);
    assert.strictEqual(isIgnoredWorkspacePath('/app/node_modules/foo/index.js'), true);
    assert.strictEqual(isIgnoredWorkspacePath('/app/dist/out.js'), true);
  });
});
