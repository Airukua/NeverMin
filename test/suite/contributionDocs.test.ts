import * as assert from 'assert';
import {
  collectContributionDocs,
  filterDocCandidatePaths,
  formatContributionDocsBlock
} from '../../src/core/graph/contributionDocs';

describe('contributionDocs', () => {
  it('memprioritaskan README dan membatasi ukuran', async () => {
    const paths = filterDocCandidatePaths([
      'src/index.ts',
      'README.md',
      'docs/guide.md',
      'node_modules/pkg/README.md',
      'CONTRIBUTING.md'
    ]);
    assert.ok(paths.includes('README.md'));
    assert.ok(paths.includes('CONTRIBUTING.md'));
    assert.ok(!paths.some((p) => p.includes('node_modules')));

    const files: Record<string, string> = {
      'README.md': 'A'.repeat(5000),
      'CONTRIBUTING.md': 'How to contribute…',
      'docs/guide.md': 'Guide body'
    };
    const { snippets, usedPaths } = await collectContributionDocs(
      ['README.md', 'CONTRIBUTING.md', 'docs/guide.md'],
      async (p) => files[p] || '',
      { maxTotalChars: 3000, maxPerFileChars: 2000, maxDocFiles: 2 }
    );
    assert.ok(usedPaths[0]?.toLowerCase().includes('readme'));
    assert.ok(snippets.length >= 1);
    const block = formatContributionDocsBlock(snippets, 'en');
    assert.ok(block.includes('DOC:'));
    assert.ok(block.length <= 3500);
  });
});
