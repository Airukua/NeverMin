import * as assert from 'assert';
import { escapeJsonForScript } from '../../src/ui/webview/jsonScriptSafe';
import { buildStandaloneGraphHtml } from '../../src/ui/webview/standaloneGraphHtml';

describe('escapeJsonForScript / webview payload', () => {
  it('mengganti < agar tidak bisa menutup tag script', () => {
    const payload = {
      label: '</script><img src=x onerror=alert(1)>',
      note: '<svg/onload=1>'
    };

    const escaped = escapeJsonForScript(payload);

    assert.ok(!escaped.includes('</script>'));
    assert.ok(escaped.includes('\\u003c/script>'));
    assert.ok(escaped.includes('\\u003csvg'));
  });

  it('standalone HTML memakai escape yang sama untuk payload berbahaya', () => {
    const html = buildStandaloneGraphHtml(
      {
        nodes: [
          {
            data: {
              id: 'evil',
              label: '</script><script>alert(1)</script>',
              kind: 'file',
              filePath: 'a.ts',
              startLine: 1,
              endLine: 1
            }
          }
        ],
        edges: []
      },
      'window.mermaid = {};'
    );

    assert.ok(!html.includes('</script><script>alert'));
    assert.ok(html.includes('\\u003c/script>') || html.includes('#quot;') || !html.includes('<script>alert'));
  });
});
