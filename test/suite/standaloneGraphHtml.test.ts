import * as assert from 'assert';
import { emptyGraphViews } from '../../src/core/graph/repoMermaid';
import { buildStandaloneGraphHtml, buildStandaloneMermaidHtml } from '../../src/ui/webview/standaloneGraphHtml';

describe('buildStandaloneGraphHtml', () => {
  it('membuat html mandiri berisi diagram Mermaid', () => {
    const html = buildStandaloneMermaidHtml(
      {
        architecture: 'flowchart TB\n  a_ts["a.ts"]',
        modules: 'flowchart LR\n  src["src"]',
        flow: 'flowchart LR\n  boot["boot"]',
        functions: 'flowchart TB\n  tip["Pick a file"]',
        nodeIndex: {},
        views: emptyGraphViews(),
        functionGroups: {},
        stats: { fileCount: 1, shownFiles: 1, edgeCount: 0, truncated: false }
      },
      'window.mermaid = { initialize(){}, async render(){ return { svg: "<svg></svg>" }; } };'
    );

    assert.ok(html.includes('NeverMIN Architecture'));
    assert.ok(html.includes('a.ts'));
    assert.ok(html.includes('window.mermaid') || html.includes('mermaid'));
    assert.ok(html.includes('data-view="architecture"'));
    assert.ok(html.includes('Arsitektur'));
  });

  it('wrapper lama tetap menghasilkan HTML Mermaid', () => {
    const html = buildStandaloneGraphHtml(
      {
        nodes: [{ data: { label: 'legacy.ts' } }],
        edges: []
      },
      'window.mermaid = {};'
    );
    assert.ok(html.includes('legacy.ts'));
    assert.ok(html.includes('mermaid'));
  });
});
