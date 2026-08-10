import type { NeverminLanguage } from '../../i18n/types';
import type {
  ContributionCompassLlmPayload,
  ContributionCompassModel
} from '../graph/contributionCompass';
import { formatContributionDocsBlock, type ContributionDocSnippet } from '../graph/contributionDocs';

function formatGaps(model: ContributionCompassModel): string {
  if (model.gaps.length === 0) return '- (no gaps detected)';
  return model.gaps
    .slice(0, 20)
    .map((g, i) =>
      [
        `${i + 1}. id=${g.id}`,
        `   type=${g.type} risk=${g.riskBadge} priority=${g.priorityScore.toFixed(2)}`,
        `   title=${g.title}`,
        `   evidence=${g.evidence.join(' | ')}`,
        `   opportunity=${g.opportunity}`,
        g.filePath ? `   file=${g.filePath}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n');
}

/** LLM: explain gaps + filter intentional false positives. Do not invent new gaps. */
export function buildContributionCompassPrompt(options: {
  model: ContributionCompassModel;
  docs: ContributionDocSnippet[];
  lang?: NeverminLanguage;
}): string {
  const lang = options.lang ?? 'id';
  const docsBlock = formatContributionDocsBlock(options.docs, lang);
  const jsonShape = [
    '{',
    '  "advice": "2-4 sentences: which gaps to close first and why",',
    '  "gaps": [{"id": "exact-id-from-list", "keep": true, "explanation": "why this is/is not a real gap", "opportunity": "refined action"}],',
    '  "firstSteps": [{"title": "short action", "detail": "one sentence", "target": "optional gap id or path"}]',
    '}'
  ].join('\n');

  if (lang === 'en') {
    return [
      'You are a contribution agent. Your job is Gaps & Opportunities — not a danger map.',
      'You receive DETECTED gaps from static analysis. You MUST only reference those gap ids.',
      'Do NOT invent new gaps. Set keep=false when docs/code show the gap is intentional (ADR, comment, deliberate stub).',
      'Prefer refining opportunity text and explaining semantic importance using README/docs.',
      'Return ONE JSON object only.',
      '',
      'JSON schema:',
      jsonShape,
      '',
      '=== DETECTED GAPS ===',
      formatGaps(options.model),
      '',
      '=== PROJECT DOCS ===',
      docsBlock,
      '',
      '=== QUESTION ===',
      'Which gaps are real contribution opportunities for a day-1 researcher, and in what order?'
    ].join('\n');
  }

  return [
    'Kamu adalah agen kontribusi. Tugasmu Gaps & Opportunities — bukan peta bahaya.',
    'Kamu menerima gap yang sudah DETECTED dari analisis statis. Hanya boleh merujuk id gap tersebut.',
    'JANGAN mengarang gap baru. Set keep=false jika docs/kode menunjukkan gap itu sengaja (ADR, komentar, stub disengaja).',
    'Utamakan memperbaiki teks opportunity dan menjelaskan pentingnya secara semantik dari README/docs.',
    'Kembalikan SATU objek JSON saja.',
    '',
    'JSON schema:',
    jsonShape,
    '',
    '=== GAP TERDETEKSI ===',
    formatGaps(options.model),
    '',
    '=== DOCS PROYEK ===',
    docsBlock,
    '',
    '=== PERTANYAAN ===',
    'Gap mana yang peluang kontribusi nyata untuk researcher hari-1, dan urutannya?'
  ].join('\n');
}

export function parseContributionCompassLlmResponse(
  raw: string
): ContributionCompassLlmPayload | null {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const advice = typeof obj.advice === 'string' ? obj.advice.trim() : undefined;

  const gaps: ContributionCompassLlmPayload['gaps'] = [];
  if (Array.isArray(obj.gaps)) {
    for (const item of obj.gaps) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? '').trim();
      if (!id) continue;
      gaps.push({
        id,
        keep: typeof row.keep === 'boolean' ? row.keep : undefined,
        explanation: typeof row.explanation === 'string' ? row.explanation.trim() : undefined,
        opportunity: typeof row.opportunity === 'string' ? row.opportunity.trim() : undefined
      });
    }
  }

  const firstSteps: Array<{ title: string; detail: string; target?: string }> = [];
  if (Array.isArray(obj.firstSteps)) {
    for (const step of obj.firstSteps) {
      if (!step || typeof step !== 'object') continue;
      const row = step as Record<string, unknown>;
      const title = String(row.title ?? '').trim();
      if (!title) continue;
      const targetRaw = typeof row.target === 'string' ? row.target.trim() : '';
      firstSteps.push({
        title: title.slice(0, 120),
        detail: String(row.detail ?? '').trim().slice(0, 240),
        ...(targetRaw ? { target: targetRaw } : {})
      });
    }
  }

  const payload: ContributionCompassLlmPayload = {
    advice,
    gaps: gaps.length ? gaps : undefined,
    firstSteps: firstSteps.length ? firstSteps : undefined
  };
  if (!payload.advice && !payload.gaps && !payload.firstSteps) return null;
  return payload;
}
