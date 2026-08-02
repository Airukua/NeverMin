import * as assert from 'assert';
import { buildStandaloneGraphHtml } from '../../src/ui/webview/standaloneGraphHtml';

describe('buildStandaloneGraphHtml', () => {
  it('membuat html mandiri berisi payload graph dan cytoscape', () => {
    const html = buildStandaloneGraphHtml(
      {
        nodes: [
          {
            data: {
              id: 'a.ts',
              label: 'a.ts',
              kind: 'file',
              filePath: 'a.ts',
              startLine: 1,
              endLine: 2
            }
          }
        ],
        edges: []
      },
      'window.cytoscape = function(){ return { on(){}, nodes(){ return []; }, edges(){ return []; }, batch(fn){ fn(); }, fit(){}, resize(){}, zoom(){ return 1; } }; };'
    );

    assert.ok(html.includes('NeverMIN Code Graph'));
    assert.ok(html.includes('a.ts'));
    assert.ok(html.includes('window.cytoscape'));
    assert.ok(html.includes('View Utuh'));
    assert.ok(html.includes('Insights'));
  });
});
