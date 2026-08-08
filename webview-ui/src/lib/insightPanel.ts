import type { InsightPanelContent, WebviewInsights } from '../types';
import { normalizeMarkdownSource } from './markdownLite';

/** Resolve structured Insights panel from LLM `panel` or by parsing `narrative`. */
export function resolveInsightPanel(insights: WebviewInsights | null): InsightPanelContent | null {
  if (!insights) {
    return null;
  }
  const fromPanel = insights.panel;
  if (
    fromPanel &&
    (fromPanel.purpose.trim() ||
      fromPanel.overview.trim() ||
      fromPanel.flowSteps.length > 0 ||
      fromPanel.readingGuide.startHere.trim())
  ) {
    return fromPanel;
  }
  if (insights.narrative?.trim()) {
    return parsePanelFromNarrative(insights.narrative);
  }
  return null;
}

export function parsePanelFromNarrative(raw: string): InsightPanelContent {
  const text = normalizeMarkdownSource(raw);
  const sections = splitMarkdownSections(text);

  const purpose =
    findSection(sections, [/what this codebase is for/i, /kodingan ini untuk apa/i, /purpose/i]) ||
    '';
  const overview = findSection(sections, [/^overview$/i]) || '';
  const flowBody =
    findSection(sections, [/main data flow/i, /flow data utama/i, /data flow/i]) || '';
  const readBody =
    findSection(sections, [/how to read/i, /cara baca/i]) || '';

  const flowSteps = extractSteps(flowBody);
  const bullets = extractBullets(readBody);
  return {
    purpose: purpose || firstParagraph(text),
    overview,
    flowSteps: flowSteps.length ? flowSteps : sentencesAsSteps(flowBody),
    readingGuide: {
      startHere: bullets[0] || '',
      followModules: bullets[1] || '',
      trackExecution: bullets[2] || bullets.slice(2).join(' ') || ''
    }
  };
}

function splitMarkdownSections(text: string): Array<{ title: string; body: string }> {
  const lines = text.split('\n');
  const sections: Array<{ title: string; body: string }> = [];
  let title = '';
  let body: string[] = [];

  const flush = () => {
    if (!title && body.length === 0) {
      return;
    }
    sections.push({ title, body: body.join('\n').trim() });
    title = '';
    body = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flush();
      title = heading[1].trim();
      continue;
    }
    body.push(line);
  }
  flush();
  return sections;
}

function findSection(
  sections: Array<{ title: string; body: string }>,
  patterns: RegExp[]
): string {
  for (const section of sections) {
    if (patterns.some((p) => p.test(section.title))) {
      return section.body;
    }
  }
  return '';
}

function extractBullets(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*•]|\d+\./.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean);
}

function extractSteps(body: string): string[] {
  const bullets = extractBullets(body);
  if (bullets.length >= 2) {
    return bullets.slice(0, 6);
  }
  return [];
}

function sentencesAsSteps(body: string): string[] {
  const cleaned = body.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return [];
  }
  const parts = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  return parts.slice(0, 5);
}

function firstParagraph(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/^#{1,3}\s+.+$/m, '').trim())
    .find((p) => p.length > 0) ?? '';
}

const EXT_LANG: Record<string, string> = {
  '.py': 'Python',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C'
};

export function inferPrimaryLanguage(insights: WebviewInsights): string | null {
  const counts = new Map<string, number>();
  const paths = [
    ...(insights.entryPoints ?? []).map((r) => r.filePath),
    ...(insights.hubs ?? []).map((r) => r.filePath)
  ];
  for (const path of paths) {
    const m = path.toLowerCase().match(/(\.[a-z0-9]+)$/);
    if (!m) continue;
    const lang = EXT_LANG[m[1]];
    if (!lang) continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [lang, n] of counts) {
    if (n > bestN) {
      best = lang;
      bestN = n;
    }
  }
  return best;
}

/** Inline markdown-ish highlights for panel body text. */
export function formatInsightInline(text: string, accentColor: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(
      /\*\*(.+?)\*\*/g,
      `<strong style="color:${accentColor};font-weight:650">$1</strong>`
    )
    .replace(
      /(\d[\d,]*)\s+(components?|nodes?|komponen)/gi,
      `<strong style="color:${accentColor};font-weight:650">$1 $2</strong>`
    )
    .replace(
      /`([^`]+)`/g,
      `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;padding:0 4px;border-radius:3px;background:rgba(0,0,0,.3)">$1</code>`
    );
}
