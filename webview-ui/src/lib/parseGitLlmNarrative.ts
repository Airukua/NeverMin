/** Parse Git LLM markdown narrative into UI sections (EN/ID headings). */

export interface GitNarrativeWhyItem {
  title: string;
  detail: string;
  paths: string[];
}

export interface GitNarrativeWhoItem {
  name: string;
  detail: string;
  paths: string[];
}

export interface ParsedGitNarrative {
  aliveSummary: string;
  frozenSummary: string;
  alivePaths: string[];
  frozenPaths: string[];
  whyItems: GitNarrativeWhyItem[];
  whoItems: GitNarrativeWhoItem[];
  couplingSummary: string;
  nextSteps: string[];
  raw: string;
}

const ALIVE_HEAD =
  /^(what is alive|alive vs frozen|alive|mana yang hidup|hidup vs beku|hidup)/i;
const FROZEN_HEAD = /^(frozen|beku|stable|stabil)/i;
const WHY_HEAD = /^(why|kenapa)/i;
const WHO_HEAD = /^(who to ask|who|siapa)/i;
const COUPLING_HEAD = /^(hidden coupling|coupling|coupl)/i;
const NEXT_HEAD = /^(how to explore|cara eksplor|next)/i;

/** Remove markdown emphasis / code ticks for clean UI text. */
export function stripMarkdownNoise(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeHeading(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^\*\*(.+?)\*\*$/, '$1')
    .replace(/\*\*/g, '')
    .trim();
}

export function extractPaths(text: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /`([^`]+)`/g,
    // path with optional glob: folder/file.ext or messages/*.json
    /(?<![A-Za-z0-9_/.-])((?:[\w.-]+\/)+[\w.*-]+\.[\w*]+)(?![A-Za-z0-9_/.-])/g,
    /(?<![A-Za-z0-9_/.-])((?:[\w.-]+\/)+[\w.-]+)(?![A-Za-z0-9_/.-])/g
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const p = m[1].trim().replace(/^["']|["']$/g, '');
      if (!p || p.length < 3) continue;
      if (p.includes('/') || /\.\w{1,8}$/.test(p) || p.includes('*')) {
        found.add(p);
      }
    }
  }
  // Lines that are only a path
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().replace(/^[-*•]\s+/, '').replace(/`/g, '');
    if (/^(?:[\w.-]+\/)+[\w.*-]+(?:\.[\w*]+)?$/.test(t)) {
      found.add(t);
    }
  }
  return [...found].slice(0, 8);
}

function softTruncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  // Never cut inside a path-like token (has / or file extension)
  const tokens = t.split(/(\s+)/);
  let out = '';
  for (const tok of tokens) {
    if (!tok) continue;
    if (out.length + tok.length > max) {
      if (/[\\/]|\.\w{1,8}\b/.test(tok) && out.trim()) break;
      if (out.length >= max * 0.55) break;
      out += tok;
      break;
    }
    out += tok;
  }
  const trimmed = out.trim().replace(/[.,;:]+$/, '');
  return (trimmed || t.slice(0, max).trim()) + '…';
}

/** Turn a structural / LLM bullet into title + continuing detail (paths as chips). */
export function bulletToWhyItem(line: string): GitNarrativeWhyItem {
  const raw = line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim();
  const paths = extractPaths(raw);
  const cleaned = stripMarkdownNoise(raw);

  // "Most frozen: path (76d…)" → title label, detail = rest (full path kept)
  const labeled = cleaned.match(/^([^:\n]{2,48}):\s+(.+)$/);
  if (labeled && !labeled[1].includes('/') && !labeled[1].includes('\\')) {
    return {
      title: labeled[1].trim(),
      detail: labeled[2].trim(),
      paths
    };
  }

  // Em-dash / en-dash theme split
  const dash = cleaned.split(/\s+[—–]\s+/);
  if (dash.length >= 2 && dash[0].length >= 4 && dash[0].length <= 64) {
    return {
      title: dash[0].trim(),
      detail: dash.slice(1).join(' — ').trim(),
      paths
    };
  }

  // Short whole sentence → title only (no redundant detail)
  if (cleaned.length <= 90) {
    return { title: cleaned, detail: '', paths };
  }

  const words = cleaned.split(/\s+/);
  return {
    title: softTruncate(words.slice(0, 6).join(' '), 72),
    detail: cleaned,
    paths
  };
}

function parseBullet(line: string): { title: string; detail: string; paths: string[] } {
  return bulletToWhyItem(line);
}

function isHeadingResidue(text: string): boolean {
  const t = stripMarkdownNoise(text).trim();
  if (!t) return true;
  if (t.length < 12 && classifyHeading(t) !== 'unknown') return true;
  if (
    /^(why(?:\s+the\s+code(?:\s+looks\s+like\s+this)?)?|who(?:\s+to\s+ask)?|kenapa(?:\s+kode.*)?|siapa(?:\s+yang.*)?|the code looks like this|alive(?:\s+vs\s+frozen)?|frozen|hidup|beku|hidden coupling|how to explore.*)\.?$/i.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

function parseWhoLine(line: string): GitNarrativeWhoItem {
  const parsed = parseBullet(line);
  const cleaned = stripMarkdownNoise(line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''));
  const ask = cleaned.match(
    /^(?:Ask|Tanya)\s+([A-ZÀ-ÖØ-Þ][\w'’.\-]+(?:\s+[A-ZÀ-ÖØ-Þ][\w'’.\-]+){0,4})\s+(?:about|soal|mengenai)\b/i
  );
  const nameLead = cleaned.match(
    /^([A-ZÀ-ÖØ-Þ][\w'’.\-]+(?:\s+[A-ZÀ-ÖØ-Þ][\w'’.\-]+){0,4})\s*[—–:\-]\s+/
  );
  const name = ask?.[1] || nameLead?.[1] || parsed.title;
  const detail =
    ask || nameLead
      ? softTruncate(cleaned.replace(/^(?:Ask|Tanya)\s+/i, ''), 240)
      : parsed.detail;
  return {
    name: softTruncate(stripMarkdownNoise(name), 64),
    detail: stripMarkdownNoise(detail),
    paths: parsed.paths
  };
}

type SectionKey =
  | 'aliveSummary'
  | 'frozenSummary'
  | 'whyItems'
  | 'whoItems'
  | 'couplingSummary'
  | 'nextSteps'
  | 'unknown';

function classifyHeading(title: string): SectionKey {
  const t = title.trim();
  if (ALIVE_HEAD.test(t) && /frozen|beku|vs/i.test(t)) return 'aliveSummary';
  if (FROZEN_HEAD.test(t)) return 'frozenSummary';
  if (ALIVE_HEAD.test(t)) return 'aliveSummary';
  if (WHY_HEAD.test(t)) return 'whyItems';
  if (WHO_HEAD.test(t)) return 'whoItems';
  if (COUPLING_HEAD.test(t)) return 'couplingSummary';
  if (NEXT_HEAD.test(t)) return 'nextSteps';
  return 'unknown';
}

function isSectionBreakLine(trimmed: string): { heading: string } | null {
  if (/^#{1,3}\s+/.test(trimmed)) {
    return { heading: normalizeHeading(trimmed) };
  }
  // **Alive** / **Why the code…** as pseudo-headings
  const boldOnly = trimmed.match(/^\*\*(.+?)\*\*\s*:?\s*$/);
  if (boldOnly) {
    return { heading: normalizeHeading(boldOnly[1]) };
  }
  // **Alive** files are… → start of alive section mid-paragraph
  const boldLead = trimmed.match(/^\*\*(Alive|Frozen|Why|Who|Kenapa|Siapa|Hidup|Beku)[^*]*\*\*/i);
  if (boldLead && classifyHeading(boldLead[1]) !== 'unknown') {
    return { heading: boldLead[1] };
  }
  return null;
}

/**
 * Split freeform / markdown narrative into structured blocks for the Git LLM panel.
 */
export function parseGitLlmNarrative(markdown: string): ParsedGitNarrative {
  const raw = markdown.trim();
  const empty: ParsedGitNarrative = {
    aliveSummary: '',
    frozenSummary: '',
    alivePaths: [],
    frozenPaths: [],
    whyItems: [],
    whoItems: [],
    couplingSummary: '',
    nextSteps: [],
    raw
  };
  if (!raw) return empty;

  // Special case: freeform **Alive** … **Frozen** … (no ## headings)
  const aliveFrozenSplit = raw.match(/\*\*Alive\*\*([\s\S]*?)\*\*Frozen\*\*([\s\S]*)/i);
  const hidupBekuSplit = raw.match(/\*\*Hidup\*\*([\s\S]*?)\*\*Beku\*\*([\s\S]*)/i);
  const proseSplit = aliveFrozenSplit || hidupBekuSplit;
  const hasHashHeadings = /^#{1,3}\s+/m.test(raw);

  if (proseSplit && !hasHashHeadings) {
    const aliveBody = (proseSplit[1] || '').replace(/^[\s:–—-]+/, '');
    const frozenBody = (proseSplit[2] || '').replace(/^[\s:–—-]+/, '');
    const before = raw.slice(0, raw.search(/\*\*(Alive|Hidup)\*\*/i)).trim();
    const aliveSummary = stripMarkdownNoise(
      [before, aliveBody].filter(Boolean).join(' ')
    ).slice(0, 500);
    const frozenSummary = stripMarkdownNoise(frozenBody).slice(0, 400);
    return {
      ...empty,
      aliveSummary,
      frozenSummary,
      alivePaths: extractPaths(aliveBody),
      frozenPaths: extractPaths(frozenBody)
    };
  }

  const lines = raw.split(/\r?\n/);
  type Block = { key: SectionKey; lines: string[] };
  const blocks: Block[] = [];
  let current: Block = { key: 'aliveSummary', lines: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    const br = isSectionBreakLine(trimmed);
    if (br) {
      const key = classifyHeading(br.heading);
      if (key !== 'unknown') {
        if (current.lines.length) blocks.push(current);
        // Heading text is metadata only — never keep it as section body
        // (except bold-lead prose: "**Alive** files are…")
        const boldLeadRest = trimmed.match(
          /^\*\*(?:Alive|Frozen|Why|Who|Kenapa|Siapa|Hidup|Beku)[^*]*\*\*\s+(.+)$/i
        );
        current = { key, lines: boldLeadRest ? [boldLeadRest[1]] : [] };
        continue;
      }
    }
    current.lines.push(line);
  }
  if (current.lines.length) blocks.push(current);

  const out = { ...empty };
  for (const block of blocks) {
    const body = block.lines.join('\n').trim();
    if (!body || block.key === 'unknown') continue;

    if (block.key === 'aliveSummary') {
      const fr = body.split(/\*\*Frozen\*\*|\*\*Beku\*\*/i);
      out.aliveSummary = stripMarkdownNoise(fr[0]).slice(0, 500);
      out.alivePaths = extractPaths(fr[0]);
      if (fr[1]) {
        out.frozenSummary = stripMarkdownNoise(fr[1]).slice(0, 400);
        out.frozenPaths = extractPaths(fr[1]);
      }
    } else if (block.key === 'frozenSummary') {
      out.frozenSummary = stripMarkdownNoise(body).slice(0, 400);
      out.frozenPaths = extractPaths(body);
    } else if (block.key === 'whyItems') {
      const bullets = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^[-*•]|\d+\./.test(l));
      const chunks = bullets.length
        ? bullets
        : body
            .split(/\n\s*\n/)
            .map((c) => c.replace(/\n+/g, ' ').trim())
            .filter(Boolean);
      out.whyItems = chunks
        .map(parseBullet)
        .map((item) => ({
          ...item,
          title: stripMarkdownNoise(item.title),
          detail: stripMarkdownNoise(item.detail)
        }))
        .filter((item) => !isHeadingResidue(item.title))
        .filter((item) => !item.detail || !isHeadingResidue(item.detail))
        .filter((item) => !(item.title === item.detail && item.title.length < 40))
        .slice(0, 6);
    } else if (block.key === 'whoItems') {
      const bullets = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^[-*•]|\d+\./.test(l));
      const chunks = bullets.length
        ? bullets
        : body
            .split(/\n\s*\n/)
            .map((c) => c.replace(/\n+/g, ' ').trim())
            .filter(Boolean);
      out.whoItems = chunks
        .map(parseWhoLine)
        .filter((item) => !isHeadingResidue(item.name) && item.name.length >= 2)
        .filter((item) => !(item.name === item.detail && item.name.length < 40))
        .slice(0, 4);
    } else if (block.key === 'couplingSummary') {
      out.couplingSummary = stripMarkdownNoise(body).slice(0, 400);
    } else if (block.key === 'nextSteps') {
      out.nextSteps = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^[-*•]|\d+\./.test(l))
        .map((l) =>
          stripMarkdownNoise(l.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''))
        )
        .filter((l) => !isHeadingResidue(l))
        .slice(0, 4);
    }
  }

  if (!out.aliveSummary && !out.frozenSummary && out.whyItems.length === 0 && raw) {
    const fr = raw.split(/\*\*Frozen\*\*|\*\*Beku\*\*/i);
    if (fr.length > 1) {
      out.aliveSummary = stripMarkdownNoise(fr[0].replace(/\*\*Alive\*\*|\*\*Hidup\*\*/i, '')).slice(
        0,
        500
      );
      out.frozenSummary = stripMarkdownNoise(fr[1]).slice(0, 400);
      out.alivePaths = extractPaths(fr[0]);
      out.frozenPaths = extractPaths(fr[1]);
    } else {
      out.aliveSummary = stripMarkdownNoise(raw).slice(0, 500);
      out.alivePaths = extractPaths(raw);
    }
  }

  return out;
}

export function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
