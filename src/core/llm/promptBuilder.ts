import { CodeChunk } from '../../types';
import { GraphInsights } from '../graph/graphInsights';
import { isNodeCardIcon, NODE_CARD_ICONS } from '../graph/nodeCardIcons';
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

/** Architecture / Flow: jelaskan satu file utuh. */
export function buildExplainFilePrompt(options: {
  filePath: string;
  fileName: string;
  chunks: CodeChunk[];
  lang?: NeverminLanguage;
}): string {
  const lang = options.lang ?? 'id';
  const short = options.filePath.replace(/\\/g, '/').split('/').slice(-3).join('/');
  if (lang === 'en') {
    return [
      'You are a senior engineer onboarding a newcomer.',
      'Explain this **entire source file** as one unit — purpose, main exports/symbols, and how it fits the architecture.',
      'Format rules (strict):',
      '- Use Markdown headings on their own line: `## 1. Purpose`, `## 2. Key symbols`, …',
      '- Put body text on the next line(s); never glue the heading and the first sentence on one line.',
      '- Prefer bullet lists for symbols. Do not invent symbols missing from the context.',
      '- Do not wrap the whole answer in a code fence.',
      '',
      `=== FILE ===`,
      short || options.fileName,
      '',
      '=== CODE CONTEXT (full file / symbols) ===',
      buildContextBlock(options.chunks, lang),
      '',
      '=== QUESTION ===',
      `Explain the whole file "${options.fileName}" for a new developer: what it does, key parts, and when to open it.`
    ].join('\n');
  }
  return [
    'Kamu adalah senior engineer yang membantu onboarding developer baru.',
    'Jelaskan **satu file sumber utuh** ini sebagai satu unit — tujuan, simbol/export utama, dan perannya di arsitektur.',
    'Aturan format (wajib):',
    '- Pakai heading Markdown di baris sendiri: `## 1. Tujuan`, `## 2. Simbol utama`, …',
    '- Isi penjelasan di baris berikutnya; jangan menempelkan judul dan kalimat pertama di satu baris.',
    '- Simbol lebih baik sebagai bullet list. Jangan mengarang simbol yang tidak ada di konteks.',
    '- Jangan membungkus seluruh jawaban dalam code fence.',
    '',
    '=== FILE ===',
    short || options.fileName,
    '',
    '=== KONTEKS KODE (file utuh / simbol) ===',
    buildContextBlock(options.chunks, lang),
    '',
    '=== PERTANYAAN ===',
    `Jelaskan file utuh "${options.fileName}" untuk developer baru: fungsinya, bagian penting, dan kapan file ini dibuka.`
  ].join('\n');
}

/** Functions tab: hanya fungsi/method/class yang diklik. */
export function buildExplainFunctionPrompt(options: {
  symbolName: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  chunks: CodeChunk[];
  lang?: NeverminLanguage;
}): string {
  const lang = options.lang ?? 'id';
  const short = options.filePath.replace(/\\/g, '/').split('/').slice(-3).join('/');
  if (lang === 'en') {
    return [
      'You are a senior engineer explaining one symbol.',
      'Focus only on this function/method/class — inputs, outputs, side effects, and how callers use it.',
      'Format: short Markdown with `##` headings on their own lines; body on following lines. No whole-answer code fence.',
      '',
      `=== SYMBOL ===`,
      `${options.kind} ${options.symbolName} · ${short} · L${options.startLine}-${options.endLine}`,
      '',
      '=== CODE CONTEXT ===',
      buildContextBlock(options.chunks, lang),
      '',
      '=== QUESTION ===',
      `Explain ${options.kind} "${options.symbolName}" clearly for a newcomer.`
    ].join('\n');
  }
  return [
    'Kamu adalah senior engineer yang menjelaskan satu simbol.',
    'Fokus hanya pada fungsi/method/class ini — input, output, side effect, dan bagaimana dipanggil.',
    'Format: Markdown singkat, heading `##` di baris sendiri, isi di baris berikutnya. Jangan code-fence seluruh jawaban.',
    '',
    '=== SIMBOL ===',
    `${options.kind} ${options.symbolName} · ${short} · L${options.startLine}-${options.endLine}`,
    '',
    '=== KONTEKS KODE ===',
    buildContextBlock(options.chunks, lang),
    '',
    '=== PERTANYAAN ===',
    `Jelaskan ${options.kind} "${options.symbolName}" dengan jelas untuk developer baru.`
  ].join('\n');
}

/** Modules tab: folder utuh + inventory + Mermaid + cuplikan file. */
export function buildExplainModulePrompt(options: {
  folder: string;
  inventory: string;
  mermaid: string;
  chunks: CodeChunk[];
  lang?: NeverminLanguage;
}): string {
  const lang = options.lang ?? 'id';
  if (lang === 'en') {
    return [
      'You are a senior engineer explaining a **module folder**.',
      'Cover: folder purpose, what each file is for, important functions inside, and how data/control flows (use the Mermaid diagram).',
      'Format: Markdown sections with `##` headings on their own lines; body below. Do not invent files/functions missing from the inventory. No whole-answer code fence.',
      '',
      `=== MODULE FOLDER ===`,
      options.folder,
      '',
      '=== FILES & PARSED FUNCTIONS (AST/WASM) ===',
      options.inventory,
      '',
      '=== MERMAID FLOWCHART ===',
      '```mermaid',
      options.mermaid.trim(),
      '```',
      '',
      '=== FILE CONTENTS (samples) ===',
      buildContextBlock(options.chunks, lang),
      '',
      '=== QUESTION ===',
      `Explain module folder "${options.folder}": purpose, contents, key functions, and internal flow.`
    ].join('\n');
  }
  return [
    'Kamu adalah senior engineer yang menjelaskan **satu folder module**.',
    'Bahas: tujuan folder, peran tiap file, fungsi penting di dalamnya, dan alur data/kontrol (pakai diagram Mermaid).',
    'Format: section Markdown dengan heading `##` di baris sendiri; isi di bawahnya. Jangan mengarang file/fungsi di luar inventory. Jangan code-fence seluruh jawaban.',
    '',
    '=== FOLDER MODULE ===',
    options.folder,
    '',
    '=== FILE & FUNGSI TERPARSING (AST/WASM) ===',
    options.inventory,
    '',
    '=== MERMAID FLOWCHART ===',
    '```mermaid',
    options.mermaid.trim(),
    '```',
    '',
    '=== ISI FILE (sampel) ===',
    buildContextBlock(options.chunks, lang),
    '',
    '=== PERTANYAAN ===',
    `Jelaskan folder module "${options.folder}": tujuan, isi, fungsi penting, dan alur internalnya.`
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

export interface GraphInsightsLlmPayload {
  narrative: string;
  purpose?: string;
  overview?: string;
  flowSteps?: string[];
  readingGuide?: {
    startHere: string;
    followModules: string;
    trackExecution: string;
  };
  /** LLM-written bullets that replace heuristic summaryBullets. */
  summaryBullets?: string[];
  entries?: Array<{ name: string; reason: string }>;
  hubs?: Array<{ name: string; reason: string }>;
  /** Optional one-line main-flow label shown in Open flow / nav. */
  mainFlowLabel?: string;
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
    .slice(0, 8)
    .map((item) => `- ${item.name} (${item.filePath})`);
  const hubs = insights.hubs
    .slice(0, 8)
    .map((item) => `- ${item.name} (${item.filePath})`);
  const statsLine =
    lang === 'en'
      ? `- ${insights.stats.nodeCount} nodes, ${insights.stats.edgeCount} edges`
      : `- ${insights.stats.nodeCount} node, ${insights.stats.edgeCount} edge`;

  const jsonShape = [
    '{',
    '  "purpose": "This application is for … (1-2 sentences)",',
    '  "overview": "Technical overview (max 3 sentences; mention component count if useful)",',
    '  "flowSteps": ["step 1", "step 2", "step 3", "step 4"],',
    '  "readingGuide": {',
    '    "startHere": "one short tip",',
    '    "followModules": "one short tip",',
    '    "trackExecution": "one short tip"',
    '  },',
    '  "entries": [{"name": "ExactNameFromList", "reason": "why start here"}],',
    '  "hubs": [{"name": "ExactNameFromList", "reason": "why it matters"}],',
    '  "mainFlowLabel": "Input → … → Output",',
    '  "narrative": optional markdown fallback if you also want a combined doc',
    '}'
  ].join('\n');

  if (lang === 'en') {
    return [
      'You are an onboarding buddy for new developers.',
      'Using ONLY the structural facts below, produce the full Insights panel content.',
      'Your JSON REPLACES the heuristic summary — do not echo metric jargon (revPR, betw, PR %).',
      'Use English. Return ONE JSON object only (optional ```json fence). No prose outside JSON.',
      '',
      'JSON schema:',
      jsonShape,
      '',
      'Field rules:',
      '- purpose: start with "This application is for …" (product/domain, not file dump).',
      '- overview: max 3 technical sentences; you may cite node/component count from STATS.',
      '- flowSteps: 3-5 ordered steps for Input → Process → Output; **bold** key symbols in text.',
      '- readingGuide: exactly 3 short tips (startHere / followModules / trackExecution).',
      '- entries/hubs: ExactNameFromList only; reason = one plain sentence each.',
      '- mainFlowLabel: one short Input → Output line.',
      '- narrative: optional; if omitted it will be assembled from the fields above.',
      'Do not invent files/functions that are not in the data.',
      '',
      '=== STATS ===',
      statsLine,
      '',
      '=== STRUCTURAL BULLETS (reference only — rewrite, do not copy) ===',
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
    'Dari fakta struktural di bawah, hasilkan SELURUH konten panel Insights.',
    'JSON-mu MENIMPA ringkasan heuristik — jangan meniru jargon metrik (revPR, betw, PR %).',
    'Bahasa Indonesia. Kembalikan SATU objek JSON saja (opsional fence ```json). Tanpa teks di luar JSON.',
    '',
    'Skema JSON:',
    jsonShape,
    '',
    'Aturan field:',
    '- purpose: mulai "Aplikasi ini adalah aplikasi untuk …" (produk/domain).',
    '- overview: maks 3 kalimat teknis; boleh sebut jumlah komponen dari STATS.',
    '- flowSteps: 3-5 langkah berurutan Input → Proses → Output; **tebal** simbol penting.',
    '- readingGuide: tepat 3 tips singkat (startHere / followModules / trackExecution).',
    '- entries/hubs: ExactNameFromList saja; reason = satu kalimat biasa.',
    '- mainFlowLabel: satu baris Input → Output singkat.',
    '- narrative: opsional; jika kosong akan disusun dari field di atas.',
    'Jangan mengarang file/fungsi yang tidak ada di data.',
    '',
    '=== STATS ===',
    statsLine,
    '',
    '=== BULLET STRUKTURAL (referensi saja — tulis ulang, jangan copy) ===',
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

/** Parse LLM Insights JSON; falls back to treating the whole reply as narrative markdown. */
export function parseGraphInsightsLlmResponse(raw: string): GraphInsightsLlmPayload | null {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();

  const asNameReason = (
    value: unknown
  ): Array<{ name: string; reason: string }> | undefined => {
    if (!Array.isArray(value)) {
      return undefined;
    }
    return value
      .filter(
        (e): e is { name: string; reason: string } =>
          !!e &&
          typeof e === 'object' &&
          typeof (e as { name?: unknown }).name === 'string' &&
          typeof (e as { reason?: unknown }).reason === 'string'
      )
      .map((e) => ({ name: e.name.trim(), reason: e.reason.trim() }))
      .filter((e) => e.name && e.reason);
  };

  const tryParse = (source: string): GraphInsightsLlmPayload | null => {
    try {
      const parsed = JSON.parse(source) as Partial<GraphInsightsLlmPayload> & Record<string, unknown>;
      const purpose = typeof parsed.purpose === 'string' ? parsed.purpose.trim() : '';
      const overview = typeof parsed.overview === 'string' ? parsed.overview.trim() : '';
      const flowSteps = Array.isArray(parsed.flowSteps)
        ? parsed.flowSteps
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map((s) => s.trim())
            .slice(0, 6)
        : undefined;
      const rg = parsed.readingGuide;
      const readingGuide =
        rg &&
        typeof rg === 'object' &&
        typeof (rg as { startHere?: unknown }).startHere === 'string' &&
        typeof (rg as { followModules?: unknown }).followModules === 'string' &&
        typeof (rg as { trackExecution?: unknown }).trackExecution === 'string'
          ? {
              startHere: String((rg as { startHere: string }).startHere).trim(),
              followModules: String((rg as { followModules: string }).followModules).trim(),
              trackExecution: String((rg as { trackExecution: string }).trackExecution).trim()
            }
          : undefined;

      let narrative = typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '';
      if (!narrative && (purpose || overview || (flowSteps && flowSteps.length))) {
        narrative = assembleNarrativeFromPanel({
          purpose,
          overview,
          flowSteps: flowSteps ?? [],
          readingGuide: readingGuide ?? {
            startHere: '',
            followModules: '',
            trackExecution: ''
          }
        });
      }
      if (!narrative && !purpose) {
        return null;
      }
      return {
        narrative: narrative || purpose,
        purpose: purpose || undefined,
        overview: overview || undefined,
        flowSteps,
        readingGuide,
        summaryBullets: Array.isArray(parsed.summaryBullets)
          ? parsed.summaryBullets
              .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
              .map((b) => b.trim())
              .slice(0, 10)
          : undefined,
        entries: asNameReason(parsed.entries),
        hubs: asNameReason(parsed.hubs),
        mainFlowLabel:
          typeof parsed.mainFlowLabel === 'string' && parsed.mainFlowLabel.trim()
            ? parsed.mainFlowLabel.trim()
            : undefined
      };
    } catch {
      return null;
    }
  };

  const direct = tryParse(candidate);
  if (direct) {
    return direct;
  }

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = tryParse(candidate.slice(start, end + 1));
    if (sliced) {
      return sliced;
    }
  }

  if (candidate.includes('##') || candidate.length > 40) {
    return { narrative: candidate };
  }
  return null;
}

function assembleNarrativeFromPanel(panel: {
  purpose: string;
  overview: string;
  flowSteps: string[];
  readingGuide: { startHere: string; followModules: string; trackExecution: string };
}): string {
  const parts: string[] = [];
  if (panel.purpose) {
    parts.push(`## What this codebase is for\n\n${panel.purpose}`);
  }
  if (panel.overview) {
    parts.push(`## Overview\n\n${panel.overview}`);
  }
  if (panel.flowSteps.length) {
    parts.push(
      `## Main data flow\n\n${panel.flowSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    );
  }
  const tips = [
    panel.readingGuide.startHere,
    panel.readingGuide.followModules,
    panel.readingGuide.trackExecution
  ].filter(Boolean);
  if (tips.length) {
    parts.push(`## How to read this codebase\n\n${tips.map((t) => `- ${t}`).join('\n')}`);
  }
  return parts.join('\n\n').trim();
}

export function applyGraphInsightsLlmPayload(
  insights: GraphInsights,
  payload: GraphInsightsLlmPayload
): GraphInsights {
  const reasonByName = (items: Array<{ name: string; reason: string }> | undefined) => {
    const map = new Map<string, string>();
    for (const item of items ?? []) {
      map.set(item.name.toLowerCase(), item.reason);
    }
    return map;
  };
  const entryReasons = reasonByName(payload.entries);
  const hubReasons = reasonByName(payload.hubs);

  const patchReasons = <T extends { name: string; reason: string }>(
    refs: T[],
    reasons: Map<string, string>
  ): T[] =>
    refs.map((ref) => {
      const next = reasons.get(ref.name.toLowerCase());
      return next ? { ...ref, reason: next } : { ...ref, reason: '' };
    });

  const panelFromPayload =
    payload.purpose || payload.overview || payload.flowSteps?.length || payload.readingGuide
      ? {
          purpose: payload.purpose ?? '',
          overview: payload.overview ?? '',
          flowSteps: payload.flowSteps ?? [],
          readingGuide: payload.readingGuide ?? {
            startHere: '',
            followModules: '',
            trackExecution: ''
          }
        }
      : undefined;

  return {
    ...insights,
    narrative: payload.narrative,
    panel: panelFromPayload,
    summaryBullets: payload.summaryBullets?.length ? payload.summaryBullets : [],
    entryPoints: entryReasons.size
      ? patchReasons(insights.entryPoints, entryReasons)
      : insights.entryPoints.map((r) => ({ ...r, reason: '' })),
    hubs: hubReasons.size
      ? patchReasons(insights.hubs, hubReasons)
      : insights.hubs.map((r) => ({ ...r, reason: '' })),
    mainFlow:
      insights.mainFlow && payload.mainFlowLabel
        ? { ...insights.mainFlow, label: payload.mainFlowLabel }
        : insights.mainFlow
  };
}

export interface DiagramSummaryTarget {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  role: string;
}

/**
 * Prompt untuk penjelasan singkat + ikon tiap node di diagram arsitektur.
 * Output JSON: { "<id>": { "summary": "...", "icon": "map" }, ... }
 * (string lama masih diterima parser sebagai summary saja)
 */
export function buildNodeSummariesPrompt(
  targets: DiagramSummaryTarget[],
  lang: NeverminLanguage = 'id'
): string {
  const iconList = NODE_CARD_ICONS.join(', ');
  const list = targets.map(
    (item, index) =>
      `${index + 1}. id=${item.id} | name=${item.name} | kind=${item.kind} | role=${item.role} | file=${item.filePath}`
  );

  if (lang === 'en') {
    return [
      'You explain codebase components for an onboarding diagram card.',
      'For EACH item return: summary + icon.',
      'summary: one short English sentence (max 14 words). Format "Acts as …" or "Handles …".',
      `icon: pick ONE from this exact set: ${iconList}`,
      'Choose icon from NAME/purpose (MapResponden→map, Navbar→nav, Sidebar→sidebar, Dropdown→menu, goToMonth→calendar).',
      'Lucide keys: map, nav, sidebar, menu, user, card, data, api, config, chart, list, form, calendar, auth, hook, file, fn, class, generic.',
      'Do not invent components that are not in the list.',
      'Output ONLY a valid JSON object, no markdown fence, no other text.',
      'Keys MUST use the id field exactly as listed.',
      'Example shape:',
      '{"src/a.ts#Foo:1":{"summary":"Acts as the UI entry for creating inspections.","icon":"form"}}',
      '',
      '=== COMPONENTS ===',
      ...list
    ].join('\n');
  }

  return [
    'Kamu menjelaskan komponen codebase untuk kartu diagram onboarding.',
    'Untuk SETIAP item kembalikan: summary + icon.',
    'summary: satu kalimat singkat Bahasa Indonesia (maks 14 kata). Format "Berfungsi sebagai …" atau "Menangani …".',
    `icon: pilih PERSIS salah satu dari: ${iconList}`,
    'Pilih icon dari NAMA dan kegunaan (MapResponden→map, Navbar→nav, Sidebar→sidebar, Dropdown→menu, goToMonth→calendar).',
    'Icon Lucide: map, nav, sidebar, menu, user, card, data, api, config, chart, list, form, calendar, auth, hook, file, fn, class, generic.',
    'Jangan mengarang komponen yang tidak ada di daftar.',
    'Output HANYA JSON object valid, tanpa markdown fence, tanpa teks lain.',
    'Key WAJIB memakai field id persis seperti di daftar.',
    'Contoh bentuk:',
    '{"src/a.ts#Foo:1":{"summary":"Berfungsi sebagai entry UI untuk membuat inspeksi.","icon":"form"}}',
    '',
    '=== KOMPONEN ===',
    ...list
  ].join('\n');
}

export interface NodeSummariesParseResult {
  summaries: Record<string, string>;
  icons: Record<string, string>;
}

export function parseNodeSummariesResponse(
  raw: string,
  targets: DiagramSummaryTarget[]
): NodeSummariesParseResult {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return { summaries: {}, icons: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { summaries: {}, icons: {} };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { summaries: {}, icons: {} };
  }

  const byId = new Map(targets.map((item) => [item.id, item]));
  const byName = new Map(targets.map((item) => [item.name, item]));
  const byFileName = new Map(
    targets.map((item) => {
      const file = item.filePath.replace(/\\/g, '/').split('/').pop() || item.filePath;
      return [`${file}#${item.name}`, item] as const;
    })
  );

  const resolveTarget = (key: string): DiagramSummaryTarget | undefined => {
    const direct = byId.get(key) ?? byName.get(key);
    if (direct) {
      return direct;
    }
    const normalized = key.replace(/\\/g, '/');
    const hash = normalized.indexOf('#');
    if (hash >= 0) {
      const namePart = normalized.slice(hash + 1).replace(/:\d+$/, '');
      const filePart = normalized.slice(0, hash).split('/').pop() || '';
      const byCombo = byFileName.get(`${filePart}#${namePart}`);
      if (byCombo) {
        return byCombo;
      }
      const byNameOnly = byName.get(namePart);
      if (byNameOnly) {
        return byNameOnly;
      }
    }
    // Suffix match against full id (model sering memotong / mengubah path prefix).
    for (const item of targets) {
      if (item.id.endsWith(normalized) || normalized.endsWith(item.id) || normalized.endsWith(item.name)) {
        return item;
      }
    }
    return undefined;
  };

  const summaries: Record<string, string> = {};
  const icons: Record<string, string> = {};

  const assign = (key: string, summary?: string, icon?: string): void => {
    const match = resolveTarget(key);
    const ids = match ? [match.id, match.name] : [key];
    if (summary) {
      for (const id of ids) {
        summaries[id] = summary;
      }
    }
    if (icon && isNodeCardIcon(icon)) {
      for (const id of ids) {
        icons[id] = icon;
      }
    }
  };

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'string') {
      const summary = value.replace(/\s+/g, ' ').trim().slice(0, 120);
      if (summary) {
        assign(key, summary);
      }
      continue;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const row = value as Record<string, unknown>;
    const summaryRaw =
      typeof row.summary === 'string'
        ? row.summary
        : typeof row.text === 'string'
          ? row.text
          : typeof row.description === 'string'
            ? row.description
            : '';
    const summary = summaryRaw.replace(/\s+/g, ' ').trim().slice(0, 120);
    const iconRaw =
      typeof row.icon === 'string'
        ? row.icon
        : typeof row.iconId === 'string'
          ? row.iconId
          : '';
    assign(key, summary || undefined, iconRaw.trim().toLowerCase() || undefined);
  }

  return { summaries, icons };
}
