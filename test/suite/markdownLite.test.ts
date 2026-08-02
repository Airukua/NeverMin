import * as assert from 'assert';
import { escapeHtml, renderMarkdownLite } from '../../src/ui/webview/markdownLite';

describe('renderMarkdownLite', () => {
  it('merender heading, bold, dan bullet list', () => {
    const html = renderMarkdownLite([
      '## Overview',
      '',
      'Codebase berpusat pada **MapResponden**.',
      '',
      '## Cara baca codebase ini',
      '',
      '- Mulai dari `MapResponden`',
      '- Kenali komponen **Card**'
    ].join('\n'));

    assert.ok(html.includes('<h4>Overview</h4>'));
    assert.ok(html.includes('<strong>MapResponden</strong>'));
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<li>'));
    assert.ok(html.includes('<code>MapResponden</code>'));
    assert.ok(!html.includes('**MapResponden**'));
  });

  it('meng-escape HTML berbahaya sebelum render', () => {
    const html = renderMarkdownLite('Hello <script>alert(1)</script> **ok**');
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>alert'));
    assert.ok(html.includes('<strong>ok</strong>'));
  });

  it('escapeHtml mengamankan karakter khusus', () => {
    assert.strictEqual(escapeHtml(`a&b<"'>`), 'a&amp;b&lt;&quot;&#39;&gt;');
  });
});
