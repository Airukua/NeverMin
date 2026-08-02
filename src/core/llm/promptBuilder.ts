import { CodeChunk } from '../../types';
import { GraphInsights } from '../graph/graphInsights';

export function buildExplainPrompt(question: string, chunks: CodeChunk[]): string {
  const context = chunks
    .map(
      (c) =>
        [
          c.contextHeader?.trim() ?? '',
          `// File: ${c.filePath} (baris ${c.startLine}-${c.endLine})`,
          c.content
        ]
          .filter(Boolean)
          .join('\n')
    )
    .join('\n\n---\n\n');

  return [
    'Kamu adalah senior engineer yang membantu developer baru memahami codebase.',
    'Jawab dalam Bahasa Indonesia, jelas, dan singkat. Rujuk nama file/fungsi saat relevan.',
    '',
    '=== KONTEKS KODE ===',
    context,
    '',
    '=== PERTANYAAN ===',
    question
  ].join('\n');
}

export function buildGraphInsightsPrompt(insights: GraphInsights): string {
  const main = insights.mainFlow
    ? [
        `- Input: ${insights.mainFlow.input}`,
        insights.mainFlow.process.length > 0
          ? `- Proses: ${insights.mainFlow.process.join(' → ')}`
          : undefined,
        `- Output: ${insights.mainFlow.output}`
      ].filter(Boolean)
    : ['- (tidak terdeteksi)'];
  const flows = insights.keyFlows.slice(0, 5).map((flow, index) => {
    const process = flow.process.length > 0 ? ` | proses: ${flow.process.join(' → ')}` : '';
    return `${index + 1}. Input ${flow.input} → Output ${flow.output}${process}`;
  });
  const entries = insights.entryPoints.slice(0, 5).map((item) => `- ${item.name} (${item.filePath}) — ${item.reason}`);
  const hubs = insights.hubs.slice(0, 5).map((item) => `- ${item.name} (${item.filePath}) — ${item.reason}`);

  return [
    'Kamu adalah onboarding buddy untuk developer baru.',
    'Buat ringkasan singkat codebase berdasarkan insights graph di bawah.',
    'Bahasa Indonesia. Output WAJIB Markdown valid (bukan plain text).',
    'Format Markdown:',
    '## Overview',
    'satu paragraf overview (maks 3 kalimat)',
    '',
    '## Flow data utama',
    'Jelaskan Input → Proses → Output dalam 2-4 kalimat. Tekankan dari mana data masuk dan ke mana hasilnya keluar.',
    '',
    '## Cara baca codebase ini',
    '- bullet 1',
    '- bullet 2',
    '- bullet 3 (total 3-5 bullet)',
    'Gunakan **bold** untuk nama file/komponen penting.',
    'Jangan mengarang file/fungsi yang tidak ada di data.',
    'Jangan bungkus seluruh jawaban dalam code fence.',
    '',
    '=== BULLET STRUKTURAL ===',
    ...insights.summaryBullets.map((bullet) => `- ${bullet}`),
    '',
    '=== FLOW UTAMA (INPUT → OUTPUT) ===',
    ...main,
    '',
    '=== ENTRY POINTS ===',
    ...(entries.length > 0 ? entries : ['- (tidak terdeteksi)']),
    '',
    '=== HUBS ===',
    ...(hubs.length > 0 ? hubs : ['- (tidak terdeteksi)']),
    '',
    '=== KEY FLOWS ===',
    ...(flows.length > 0 ? flows : ['- (tidak terdeteksi)'])
  ].join('\n');
}
