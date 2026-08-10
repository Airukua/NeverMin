/**
 * Quick smoke for markdownLite explain sample (run via: npx ts-node --transpile-only scripts/smoke-markdownLite.ts)
 */
import { normalizeMarkdownSource, renderMarkdownLite } from '../src/ui/webview/markdownLite';

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
const stuck = normalizeMarkdownSource(
  '## Why the code looks like this The structure reflects real usage.'
);
const gitHtml = renderMarkdownLite(
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

const checks: Array<[string, boolean]> = [
  ['h2 1. Tujuan', html.includes('<h2>1. Tujuan</h2>')],
  ['body File ini', html.includes('File ini bertujuan')],
  ['h2 2. Simbol utama', html.includes('<h2>2. Simbol utama</h2>')],
  ['body Berikut', html.includes('Berikut adalah simbol utama')],
  ['Jembatan joined', html.includes('Jembatan Antar Sub-Sistem')],
  ['h2 4. Kapan…', html.includes('<h2>4. Kapan Harus Membuka atau Mengubah File Ini</h2>')],
  ['body Kamu', html.includes('Kamu perlu membuka')],
  [
    'Why heading intact when stuck',
    /^## Why the code looks like this\n\nThe structure reflects/.test(stuck)
  ],
  ['Why heading rendered', gitHtml.includes('<h3>Why the code looks like this</h3>')],
  ['Who heading rendered', gitHtml.includes('<h3>Who to ask</h3>')],
  ['no fragment Why h3', !gitHtml.includes('<h3>Why</h3>')],
  ['no fragment the code h3', !gitHtml.includes('<h3>the code looks like this</h3>')]
];

for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
}
console.log('---STUCK---');
console.log(stuck);
console.log('---GIT HTML---');
console.log(gitHtml);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
