import { CodeChunk } from '../../types';
import { GraphInsights } from '../graph/graphInsights';
import { NeverminLanguage } from '../../i18n/types';

const MAX_CONTEXT_CHARS = 24_000;

function redactSecrets(text: string): string {
  return text
    .replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]+['"]/gi, '$1: "***"')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer ***')
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, '[REDACTED_KEY]');
}

function buildContextBlock(chunks: CodeChunk[], lang: NeverminLanguage): string {
  const lineWord = lang === 'en' ? 'lines' : 'baris';
  const truncated =
    lang === 'en'
      ? '/* … context truncated to keep the prompt size safe … */'
      : '/* … konteks dipotong agar prompt tetap aman ukuran … */';

  const parts = chunks.map((c) =>
    [
      c.contextHeader?.trim() ?? '',
      `// File: ${c.filePath} (${lineWord} ${c.startLine}-${c.endLine})`,
      c.content
    ]
      .filter(Boolean)
      .join('\n')
  );

  let context = redactSecrets(parts.join('\n\n---\n\n'));
  if (context.length > MAX_CONTEXT_CHARS) {
    context = `${context.slice(0, MAX_CONTEXT_CHARS)}\n\n${truncated}`;
  }
  return context;
}

export function narrativePurposeHeading(lang: NeverminLanguage): string {
  return lang === 'en' ? 'What this codebase is for' : 'Kodingan ini untuk apa';
}

export function buildExplainPrompt(
  question: string,
  chunks: CodeChunk[],
  lang: NeverminLanguage = 'id'
): string {
  if (lang === 'en') {
    return [
      'You are a senior engineer helping a new developer understand a codebase.',
      'Answer in clear, concise English. Cite file/function names when relevant.',
      '',
      '=== CODE CONTEXT ===',
      buildContextBlock(chunks, lang),
      '',
      '=== QUESTION ===',
      question.trim() || 'Explain this code briefly.'
    ].join('\n');
  }

  return [
    'Kamu adalah senior engineer yang membantu developer baru memahami codebase.',
    'Jawab dalam Bahasa Indonesia, jelas, dan singkat. Rujuk nama file/fungsi saat relevan.',
    '',
    '=== KONTEKS KODE ===',
    buildContextBlock(chunks, lang),
    '',
    '=== PERTANYAAN ===',
    question.trim() || 'Jelaskan kode ini dengan singkat.'
  ].join('\n');
}

import type { GitHistoryInsights } from '../git/gitHistoryInsights';

export function buildGitHistoryExplainPrompt(
  insights: GitHistoryInsights,
  lang: NeverminLanguage = 'id'
): string {
  const none = lang === 'en' ? '- (none)' : '- (tidak ada)';
  const alive = insights.aliveFiles
    .slice(0, 6)
    .map(
      (item) =>
        `- ${item.path} · ${item.commits} commits · last ${item.daysSinceChange}d · authors: ${item.authors.slice(0, 3).join(', ')}`
    );
  const frozen = insights.frozenFiles
    .slice(0, 6)
    .map((item) => `- ${item.path} · last change ${item.daysSinceChange}d ago · ${item.commits} commits in window`);
  const commits = insights.recentCommits
    .slice(0, 10)
    .map(
      (item) =>
        `- ${item.hash} · ${item.date} · ${item.author}: ${item.subject}${item.files.length ? ` [${item.files.slice(0, 4).join(', ')}]` : ''}`
    );
  const owners = insights.owners
    .slice(0, 6)
    .map((item) => `- ${item.path} → ${item.author} (${Math.round(item.share * 100)}% of file commits)`);
  const couplings = insights.couplings
    .slice(0, 6)
    .map((item) => `- ${item.a} ↔ ${item.b} · together ${item.together}x`);

  if (lang === 'en') {
    return [
      'You are an onboarding buddy explaining a codebase using Git history (not just AST).',
      'Answer these questions in Markdown:',
      '## What is alive vs frozen',
      '2-4 sentences on hotspots vs stable areas.',
      '## Why the code looks like this',
      'Infer intent from recent commit messages — not a file dump. 3-6 bullets.',
      '## Who to ask',
      'Point to likely owners from the data. 2-4 bullets.',
      '## Hidden coupling',
      'Explain co-changed file pairs that may not show up in imports. 2-4 bullets.',
      '## How to explore next',
      '3 concrete next steps for a newcomer.',
      'Use English. Do not invent files/authors not listed. Do not wrap the whole answer in a code fence.',
      '',
      '=== STRUCTURAL BULLETS ===',
      ...insights.summaryBullets.map((b) => `- ${b}`),
      '',
      '=== ALIVE FILES ===',
      ...(alive.length ? alive : [none]),
      '',
      '=== FROZEN FILES ===',
      ...(frozen.length ? frozen : [none]),
      '',
      '=== RECENT COMMITS (WHY) ===',
      ...(commits.length ? commits : [none]),
      '',
      '=== OWNERS (BLAME-LIKE) ===',
      ...(owners.length ? owners : [none]),
      '',
      '=== CO-CHANGED COUPLING ===',
      ...(couplings.length ? couplings : [none])
    ].join('\n');
  }

  return [
    'Kamu adalah onboarding buddy yang menjelaskan codebase lewat Git history (bukan cuma AST).',
    'Jawab pertanyaan berikut dalam Markdown:',
    '## Mana yang hidup vs beku',
    '2-4 kalimat tentang hotspot vs area stabil.',
    '## Kenapa kode ditulis begini',
    'Inferensi niat dari pesan commit terakhir — bukan dump file. 3-6 bullet.',
    '## Siapa yang paham',
    'Tunjuk owner yang paling masuk akal dari data. 2-4 bullet.',
    '## Coupling tersembunyi',
    'Jelaskan pasangan file yang sering di-commit barengan (mungkin tak terlihat di import). 2-4 bullet.',
    '## Cara eksplorasi berikutnya',
    '3 langkah konkret untuk developer baru.',
    'Bahasa Indonesia. Jangan mengarang file/author yang tidak ada di data. Jangan bungkus seluruh jawaban dalam code fence.',
    '',
    '=== BULLET STRUKTURAL ===',
    ...insights.summaryBullets.map((b) => `- ${b}`),
    '',
    '=== FILE HIDUP ===',
    ...(alive.length ? alive : [none]),
    '',
    '=== FILE BEKU ===',
    ...(frozen.length ? frozen : [none]),
    '',
    '=== COMMIT TERKINI (KENAPA) ===',
    ...(commits.length ? commits : [none]),
    '',
    '=== OWNER (MIRIP BLAME) ===',
    ...(owners.length ? owners : [none]),
    '',
    '=== COUPLING CO-CHANGE ===',
    ...(couplings.length ? couplings : [none])
  ].join('\n');
}

export function buildGraphInsightsPrompt(
  insights: GraphInsights,
  lang: NeverminLanguage = 'id'
): string {
  const none = lang === 'en' ? '- (not detected)' : '- (tidak terdeteksi)';
  const processLabel = lang === 'en' ? 'process' : 'proses';
  const main = insights.mainFlow
    ? [
        `- Input: ${insights.mainFlow.input}`,
        insights.mainFlow.process.length > 0
          ? `- ${lang === 'en' ? 'Process' : 'Proses'}: ${insights.mainFlow.process.join(' → ')}`
          : undefined,
        `- Output: ${insights.mainFlow.output}`
      ].filter(Boolean)
    : [none];
  const flows = insights.keyFlows.slice(0, 5).map((flow, index) => {
    const process = flow.process.length > 0 ? ` | ${processLabel}: ${flow.process.join(' → ')}` : '';
    return `${index + 1}. Input ${flow.input} → Output ${flow.output}${process}`;
  });
  const entries = insights.entryPoints
    .slice(0, 5)
    .map((item) => `- ${item.name} (${item.filePath}) — ${item.reason}`);
  const hubs = insights.hubs
    .slice(0, 5)
    .map((item) => `- ${item.name} (${item.filePath}) — ${item.reason}`);

  if (lang === 'en') {
    return [
      'You are an onboarding buddy for new developers.',
      'Write a short codebase summary from the graph insights below.',
      'Use English. Output MUST be valid Markdown (not plain text).',
      'Markdown format:',
      `## ${narrativePurposeHeading(lang)}`,
      'Start with: "This application is for …"',
      'Add 1-2 sentences describing the product/domain purpose (not file-level technical detail).',
      '',
      '## Overview',
      'one short technical overview paragraph (max 3 sentences)',
      '',
      '## Main data flow',
      'Explain Input → Process → Output in 2-4 sentences. Emphasize where data enters and where results leave.',
      '',
      '## How to read this codebase',
      '- bullet 1',
      '- bullet 2',
      '- bullet 3 (3-5 bullets total)',
      'Use **bold** for important file/component names.',
      'Do not invent files/functions that are not in the data.',
      'Do not wrap the entire answer in a code fence.',
      '',
      '=== STRUCTURAL BULLETS ===',
      ...insights.summaryBullets.map((bullet) => `- ${bullet}`),
      '',
      '=== MAIN FLOW (INPUT → OUTPUT) ===',
      ...main,
      '',
      '=== ENTRY POINTS ===',
      ...(entries.length > 0 ? entries : [none]),
      '',
      '=== HUBS ===',
      ...(hubs.length > 0 ? hubs : [none]),
      '',
      '=== KEY FLOWS ===',
      ...(flows.length > 0 ? flows : [none])
    ].join('\n');
  }

  return [
    'Kamu adalah onboarding buddy untuk developer baru.',
    'Buat ringkasan singkat codebase berdasarkan insights graph di bawah.',
    'Bahasa Indonesia. Output WAJIB Markdown valid (bukan plain text).',
    'Format Markdown:',
    `## ${narrativePurposeHeading(lang)}`,
    'Mulai dengan kalimat: "Aplikasi ini adalah aplikasi untuk …"',
    'Lanjutkan 1-2 kalimat yang menjelaskan tujuan produk/domain (bukan detail teknis file).',
    '',
    '## Overview',
    'satu paragraf overview teknis singkat (maks 3 kalimat)',
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
    ...(entries.length > 0 ? entries : [none]),
    '',
    '=== HUBS ===',
    ...(hubs.length > 0 ? hubs : [none]),
    '',
    '=== KEY FLOWS ===',
    ...(flows.length > 0 ? flows : [none])
  ].join('\n');
}

export interface DiagramSummaryTarget {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  role: string;
}

/**
 * Prompt untuk penjelasan singkat tiap node di diagram arsitektur.
 * Output diharapkan JSON: { "<id>": "penjelasan singkat", ... }
 */
export function buildNodeSummariesPrompt(
  targets: DiagramSummaryTarget[],
  lang: NeverminLanguage = 'id'
): string {
  const list = targets.map(
    (item, index) =>
      `${index + 1}. id=${item.id} | name=${item.name} | kind=${item.kind} | role=${item.role} | file=${item.filePath}`
  );

  if (lang === 'en') {
    return [
      'You explain codebase components for an onboarding diagram.',
      'For EACH item, write one short sentence (max 14 words) in English.',
      'Format: "Acts as …" or "Handles …" — focus on purpose, not implementation detail.',
      'Do not invent components that are not in the list.',
      'Output ONLY a valid JSON object, no markdown fence, no other text.',
      'Keys MUST use the id field exactly as listed.',
      'Example shape:',
      '{"src/a.ts#Foo:1":"Acts as the UI entry for creating inspections."}',
      '',
      '=== COMPONENTS ===',
      ...list
    ].join('\n');
  }

  return [
    'Kamu menjelaskan komponen codebase untuk diagram onboarding.',
    'Untuk SETIAP item, tulis satu kalimat singkat (maks 14 kata) dalam Bahasa Indonesia.',
    'Format: "Berfungsi sebagai …" atau "Menangani …" — fokus kegunaan, bukan implementasi detail.',
    'Jangan mengarang komponen yang tidak ada di daftar.',
    'Output HANYA JSON object valid, tanpa markdown fence, tanpa teks lain.',
    'Key WAJIB memakai field id persis seperti di daftar.',
    'Contoh bentuk:',
    '{"src/a.ts#Foo:1":"Berfungsi sebagai entry UI untuk membuat inspeksi."}',
    '',
    '=== KOMPONEN ===',
    ...list
  ].join('\n');
}

export function parseNodeSummariesResponse(
  raw: string,
  targets: DiagramSummaryTarget[]
): Record<string, string> {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const byId = new Map(targets.map((item) => [item.id, item]));
  const byName = new Map(targets.map((item) => [item.name, item]));
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      continue;
    }
    const summary = value.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!summary) {
      continue;
    }
    const match = byId.get(key) ?? byName.get(key);
    if (match) {
      out[match.id] = summary;
      out[match.name] = summary;
    } else {
      out[key] = summary;
    }
  }

  return out;
}
