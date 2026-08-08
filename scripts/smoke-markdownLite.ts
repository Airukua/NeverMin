/**
 * Quick smoke for markdownLite explain sample (run via: npx ts-node --transpile-only scripts/smoke-markdownLite.ts)
 */
import { renderMarkdownLite } from '../src/ui/webview/markdownLite';

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
const checks: Array<[string, boolean]> = [
  ['h2 1. Tujuan', html.includes('<h2>1. Tujuan</h2>')],
  ['body File ini', html.includes('File ini bertujuan')],
  ['h2 2. Simbol utama', html.includes('<h2>2. Simbol utama</h2>')],
  ['body Berikut', html.includes('Berikut adalah simbol utama')],
  ['Jembatan joined', html.includes('Jembatan Antar Sub-Sistem')],
  ['h2 4. Kapan…', html.includes('<h2>4. Kapan Harus Membuka atau Mengubah File Ini</h2>')],
  ['body Kamu', html.includes('Kamu perlu membuka')]
];

for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
}
console.log('---HTML---');
console.log(html);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
