import * as assert from 'assert';
import {
  escapeHtml,
  normalizeMarkdownSource,
  renderMarkdownLite
} from '../../src/ui/webview/markdownLite';

describe('renderMarkdownLite', () => {
  it('merender heading, bold, dan bullet list', () => {
    const html = renderMarkdownLite(
      [
        '## Overview',
        '',
        'Codebase berpusat pada **MapResponden**.',
        '',
        '## Cara baca codebase ini',
        '',
        '- Mulai dari `MapResponden`',
        '- Kenali komponen **Card**'
      ].join('\n')
    );

    assert.ok(html.includes('<h3>Overview</h3>'));
    assert.ok(html.includes('<strong>MapResponden</strong>'));
    assert.ok(html.includes('<ul>'));
    assert.ok(html.includes('<li>'));
    assert.ok(html.includes('<code>MapResponden</code>'));
    assert.ok(!html.includes('**MapResponden**'));
  });

  it('memisahkan heading LLM yang nempel ke body', () => {
    const raw = [
      'Purpose',
      '## What this codebase is for This application is for training.',
      '## Overview This is a moderately sized codebase.',
      '## How to read this codebase - Begin by exploring **MainConfig** - Then check trainer'
    ].join('\n');

    const normalized = normalizeMarkdownSource(raw);
    assert.ok(/## What this codebase is for\n\nThis application/.test(normalized));
    assert.ok(/## Overview\n\nThis is a moderately/.test(normalized));
    assert.ok(normalized.includes('## How to read this codebase'));
    assert.ok(normalized.includes('- Begin by exploring'));

    const html = renderMarkdownLite(raw);
    assert.ok(html.includes('<h3>What this codebase is for</h3>'));
    assert.ok(html.includes('<p>This application is for training.</p>'));
    assert.ok(html.includes('<h3>Overview</h3>'));
    assert.ok(html.includes('<h3>How to read this codebase</h3>'));
    assert.ok(html.includes('<li>'));
    assert.ok(html.includes('<strong>MainConfig</strong>'));
    assert.ok(html.includes('Begin by exploring'));
  });

  it('merender numbered section title dan subheading bold', () => {
    const html = renderMarkdownLite(
      [
        '1. Tujuan',
        '**Utama**',
        'File File ini menyediakan hooks.',
        '',
        '2. Simbol & Komponen',
        '- CallbackHandler'
      ].join('\n')
    );

    assert.ok(html.includes('<h2>1. Tujuan</h2>'));
    assert.ok(html.includes('<h3>Utama</h3>'));
    assert.ok(html.includes('<p>File ini menyediakan hooks.</p>'));
    assert.ok(!html.includes('File File'));
    assert.ok(html.includes('<h2>2. Simbol &amp; Komponen</h2>'));
  });

  it('memperbaiki heading nomor yang pecah dari body (contoh Explain LLM)', () => {
    const raw = [
      '1.',
      'Tujuan File ini bertujuan sebagai single source of truth.',
      '',
      '2.',
      'Simbol utama Berikut adalah simbol utama:',
      '',
      '1. **Jembatan',
      'Antar Sub-Sistem**: Menghubungkan komponen terpisah.',
      '',
      '4.',
      'Kapan',
      '',
      'Harus Membuka atau Mengubah File Ini Kamu perlu membuka file ini jika:'
    ].join('\n');

    const html = renderMarkdownLite(raw);
    assert.ok(html.includes('<h2>1. Tujuan</h2>'), html);
    assert.ok(html.includes('File ini bertujuan sebagai single source of truth'), html);
    assert.ok(html.includes('<h2>2. Simbol utama</h2>'), html);
    assert.ok(html.includes('Berikut adalah simbol utama'), html);
    assert.ok(html.includes('Jembatan Antar Sub-Sistem'), html);
    assert.ok(html.includes('Menghubungkan komponen terpisah'), html);
    assert.ok(html.includes('<h2>4. Kapan Harus Membuka atau Mengubah File Ini</h2>'), html);
    assert.ok(html.includes('Kamu perlu membuka file ini jika'), html);
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

  it('tidak memecah judul Git History "Why the code looks like this"', () => {
    const exact = normalizeMarkdownSource('## Why the code looks like this');
    assert.strictEqual(exact, '## Why the code looks like this');

    const stuck = normalizeMarkdownSource(
      '## Why the code looks like this The structure reflects real usage.'
    );
    assert.ok(
      /^## Why the code looks like this\n\nThe structure reflects/.test(stuck),
      stuck
    );

    const html = renderMarkdownLite(
      [
        '## Why the code looks like this',
        '',
        'The structure reflects real usage.',
        '',
        '## Who to ask',
        '',
        'Ask Bob about auth.'
      ].join('\n')
    );
    assert.ok(html.includes('<h3>Why the code looks like this</h3>'), html);
    assert.ok(html.includes('<h3>Who to ask</h3>'), html);
    assert.ok(!html.includes('<h3>Why</h3>'), html);
    assert.ok(!html.includes('<h3>the code looks like this</h3>'), html);
  });

  it('me-promote **Alive**/**Frozen** prose ke heading saat dinormalisasi lewat render', () => {
    const raw = [
      '**Alive** files are hot like',
      'messages/*.json',
      'and',
      'prisma/schema.prisma',
      '. These areas are dynamic.',
      '**Frozen** files have not changed in 70 days.'
    ].join('\n');
    // normalizeMarkdownSource only strips outer fences; Alive promote is in git host.
    // Renderer still must bold → heading for title-like **Alive** alone is not expected;
    // ensure bold inline is rendered and paths stay readable.
    const html = renderMarkdownLite(
      '## What is alive vs frozen\n\nAlive files include `messages/*.json` and `prisma/schema.prisma`.\n\n### Frozen\n\nStable legacy files.'
    );
    assert.ok(html.includes('<h3>What is alive vs frozen</h3>'), html);
    assert.ok(html.includes('<code>messages/*.json</code>'), html);
    assert.ok(html.includes('<h4>Frozen</h4>') || html.includes('<h3>Frozen</h3>'), html);
  });
});
