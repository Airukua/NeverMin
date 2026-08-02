import * as assert from 'assert';
import { analyzeRepoFiles } from '../../src/core/analysis/repoAnalyzer';

describe('analyzeRepoFiles', () => {
  it('merangkum folder, file penting, dan symbol utama', async () => {
    const analysis = await analyzeRepoFiles([
      {
        workspaceRoot: '/workspace/app',
        filePath: '/workspace/app/src/index.ts',
        content: [
          'export function bootstrap() {',
          '  return true;',
          '}'
        ].join('\n')
      },
      {
        workspaceRoot: '/workspace/app',
        filePath: '/workspace/app/src/utils/math.ts',
        content: [
          'export function add(left: number, right: number) {',
          '  return left + right;',
          '}'
        ].join('\n')
      },
      {
        workspaceRoot: '/workspace/app',
        filePath: '/workspace/app/package.json',
        content: '{ "name": "app" }'
      }
    ]);

    assert.strictEqual(analysis.workspaceRootCount, 1);
    assert.strictEqual(analysis.fileCount, 3);
    assert.ok(analysis.folderCount >= 2);
    assert.ok(analysis.symbolCount >= 2);
    assert.ok(analysis.topFolders.some((folder) => folder.folderPath === 'app'));
    assert.ok(analysis.importantFiles[0]?.filePath.includes('package.json'));
    assert.ok(analysis.mainSymbols.some((symbol) => symbol.name === 'bootstrap'));
    assert.ok(analysis.mainSymbols.some((symbol) => symbol.name === 'add'));
  });
});
