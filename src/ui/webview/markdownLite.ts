/**
 * Lightweight Markdown → HTML for Insights / Explain narrative.
 * Escapes HTML first to avoid XSS from model output.
 *
 * Keep in sync with webview-ui/src/lib/markdownLite.ts (webview render path).
 */
export function renderMarkdownLite(source: string): string {
  const normalized = normalizeMarkdownSource(source);
  if (!normalized) {
    return '';
  }

  const escaped = escapeHtml(normalized);
  const lines = escaped.split('\n');
  const html: string[] = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let paragraph: string[] = [];

  const closeLists = (): void => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  const flushParagraph = (): void => {
    if (paragraph.length === 0) {
      return;
    }
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushCode = (): void => {
    if (!inCode) return;
    const body = codeLines.join('\n');
    const langClass = codeLang ? ` class="language-${codeLang}"` : '';
    html.push(`<pre><code${langClass}>${body}</code></pre>`);
    inCode = false;
    codeLang = '';
    codeLines = [];
  };

  const pushHeading = (title: string, level: number): void => {
    flushParagraph();
    closeLists();
    const tag = Math.min(4, Math.max(2, level));
    html.push(`<h${tag}>${inlineMarkdown(title.trim())}</h${tag}>`);
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    const fence = trimmed.match(/^```([\w-]*)\s*$/);
    if (fence) {
      if (inCode) {
        flushCode();
      } else {
        flushParagraph();
        closeLists();
        inCode = true;
        codeLang = fence[1] || '';
        codeLines = [];
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeLists();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      pushHeading(heading[2], heading[1].length + 1);
      continue;
    }

    const boldOnly = trimmed.match(/^\*\*(.+?)\*\*$/);
    if (boldOnly && isTitleLike(boldOnly[1])) {
      pushHeading(boldOnly[1], 3);
      continue;
    }

    // "1. **Title**: body" → heading + body
    const numberedBold = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*:?\s*(.*)$/);
    if (numberedBold && isTitleLike(numberedBold[2])) {
      pushHeading(`${numberedBold[1]}. ${numberedBold[2]}`, 3);
      if (numberedBold[3]?.trim()) {
        paragraph.push(numberedBold[3].trim());
      }
      continue;
    }

    const numberedTitle = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (
      numberedTitle &&
      isTitleLike(numberedTitle[2]) &&
      !looksLikeListSentence(numberedTitle[2])
    ) {
      pushHeading(`${numberedTitle[1]}. ${numberedTitle[2]}`, 2);
      continue;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${inlineMarkdown(numbered[1])}</li>`);
      continue;
    }

    closeLists();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeLists();
  flushCode();
  return html.join('\n');
}

/**
 * Fix common LLM markdown glitches (heading stuck to previous/body text).
 */
export function normalizeMarkdownSource(source: string): string {
  let text = source.replace(/\r\n/g, '\n').trim();
  if (!text) {
    return '';
  }

  if (text.startsWith('```')) {
    text = text.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Join broken **bold** split across newlines: **Jembatan\nAntar Sub-Sistem**
  text = text.replace(/\*\*([^*\n][^*\n]*?)\n+([^*\n]+?)\*\*/g, '**$1 $2**');

  // "1.\nTitle…" → "1. Title…"
  text = text.replace(/^(\d+)\.\s*\n+(?=\S)/gm, '$1. ');

  // Merge short title fragments after a number before the real body paragraph
  text = repairFragmentedNumberedTitles(text);

  // "## Title - bullet" before other heading rewrites
  text = text.replace(/^(#{1,4}\s+[^\n]+?)\s+(-\s+\S)/gm, '$1\n\n$2');

  text = text.replace(/([^\n#])\s+(#{1,4}\s+)/g, '$1\n\n$2');
  text = text.replace(/(^|[.!?]\s+)(\*\*[^*\n]{3,48}\*\*)(?=\s*$|\s*\n)/gm, '$1\n\n$2');

  text = text.replace(/^(#{1,4}\s+)([^\n]+)$/gm, (_full, hashes: string, rest: string) => {
    // Keep "Title - bullet" for the bullet-split pass (do not treat "-" as a word boundary)
    if (/\s+-\s+\S/.test(rest)) {
      return `${hashes}${rest}`;
    }
    const split = splitShortTitleFromBody(rest);
    if (!split) return `${hashes}${rest}`;
    return `${hashes}${split.title}\n\n${split.body}`;
  });

  text = text.replace(
    /^\*\*([^*\n]{2,48})\*\*\s*:?\s+([A-ZÀ-ÖØ-Þ][^\n]+)$/gm,
    (_f, title: string, body: string) => {
      if (!isTitleLike(title) || looksLikeListSentence(title)) return `**${title}** ${body}`;
      return `**${title}**\n\n${body}`;
    }
  );

  // "1. **Title**: body" keep for renderer; also plain "1. Title body…"
  text = text.replace(/^(\d+)\.\s+([^\n]+)$/gm, (_f, num: string, rest: string) => {
    const boldLead = rest.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/);
    if (boldLead && isTitleLike(boldLead[1])) {
      const body = boldLead[2].trim();
      return body
        ? `${num}. **${boldLead[1]}**\n\n${body}`
        : `${num}. **${boldLead[1]}**`;
    }
    const split = splitShortTitleFromBody(rest);
    if (!split) return `${num}. ${rest}`;
    return `${num}. ${split.title}\n\n${split.body}`;
  });

  text = text.replace(/^(#{1,4}\s+[^\n]+?)([.!?])\s+([A-ZÀ-ÖØ-Þ])/gm, '$1$2\n\n$3');
  text = text.replace(/([.!?`])\s+(-\s+\S)/g, '$1\n$2');
  text = text.replace(/\b([A-Za-zÀ-ÖØ-öø-ÿ]{3,})\s+\1\b/g, '$1');

  // Final pass: heading stuck to bullet list
  text = text.replace(/^(#{1,4}\s+[^\n]+?)\s+(-\s+\S)/gm, '$1\n\n$2');

  return text.trim();
}

/** Join "4. Kapan" + "Harus Membuka …" fragments into one numbered line. */
function repairFragmentedNumberedTitles(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    const start = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (!start) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    const num = start[1];
    const chunks: string[] = [];
    if (start[2].trim()) {
      chunks.push(start[2].trim());
    }
    i += 1;

    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next) {
        // Allow blank lines between short title fragments only
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j += 1;
        const peek = j < lines.length ? lines[j].trim() : '';
        if (
          peek &&
          !/^(\d+)\.\s*/.test(peek) &&
          !/^#{1,4}\s/.test(peek) &&
          !/^[-*•]\s/.test(peek) &&
          !/^\*\*[^*].*\*\*:?\s*$/.test(peek) &&
          chunks.join(' ').length < 70 &&
          peek.length <= 56 &&
          !isBodyStart(peek)
        ) {
          i = j;
          continue;
        }
        break;
      }
      if (/^(\d+)\.\s*/.test(next) || /^#{1,4}\s/.test(next) || /^[-*•]\s/.test(next)) {
        break;
      }
      // Subheading / bold label on its own line — jangan digabung ke judul section
      if (/^\*\*[^*].*\*\*:?\s*$/.test(next)) {
        break;
      }
      if (chunks.length > 0 && (isBodyStart(next) || next.length > 72)) {
        break;
      }
      if (chunks.join(' ').length + next.length > 80) {
        break;
      }
      chunks.push(next);
      i += 1;
      if (chunks.join(' ').length >= 48 && !isBodyStart(chunks[chunks.length - 1] || '')) {
        const last = chunks[chunks.length - 1] || '';
        if (last.length > 40) break;
      }
    }

    // Jika judul masih sangat pendek (atau kosong), gabungkan 1 baris lanjutan
    // agar splitShortTitleFromBody bisa memisahkan "… File Ini Kamu perlu…"
    if (i < lines.length && chunks.join(' ').length < 40) {
      const cont = lines[i].trim();
      if (
        cont &&
        !/^(\d+)\.\s*/.test(cont) &&
        !/^#{1,4}\s/.test(cont) &&
        !/^[-*•]\s/.test(cont) &&
        !/^\*\*/.test(cont) &&
        (chunks.length === 0 || !isBodyStart(cont))
      ) {
        chunks.push(cont);
        i += 1;
      }
    }

    out.push(`${num}. ${chunks.join(' ')}`.trim());
  }

  return out.join('\n');
}

function isBodyStart(value: string): boolean {
  // Hindari "the/this/it" di sini — terlalu agresif memotong judul
  // seperti "Why the code looks like this".
  return /^(file|fungsi|ini|berikut|dalam|kamu|anda|hal|saat|ketika|here|you)\b/i.test(
    value.trim()
  );
}

function isStrongBodyStart(value: string): boolean {
  return /^(berikut|dalam|kamu|anda|hal|saat|ketika|here|you)\b/i.test(value.trim());
}

/**
 * Judul section Git History / Insights yang harus utuh.
 * Urutkan panjang menurun supaya prefix terpanjang menang.
 */
const PRESERVED_SECTION_TITLES = [
  'what is alive vs frozen',
  'mana yang hidup vs beku',
  'why the code looks like this',
  'kenapa kode ditulis begini',
  'cara eksplorasi berikutnya',
  'how to explore next',
  'alive vs frozen',
  'what is alive',
  'mana yang hidup',
  'hidden coupling',
  'coupling tersembunyi',
  'siapa yang paham',
  'who to ask',
  'how to explore',
  'cara eksplorasi',
  'kenapa kode'
].sort((a, b) => b.length - a.length);

/**
 * Jika rest diawali judul section yang dilindungi:
 * - exact match → jangan dipecah (return null dari caller via 'keep')
 * - judul + body nempel → pecah hanya setelah judul lengkap
 */
function splitPreservedSectionHeading(
  rest: string
): { title: string; body: string } | 'keep' | null {
  const trimmed = rest.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const prefix of PRESERVED_SECTION_TITLES) {
    if (lower === prefix) return 'keep';
    if (!lower.startsWith(prefix)) continue;
    const after = trimmed.slice(prefix.length);
    if (!/^(\s+|[.:–—-])/.test(after)) continue;
    const body = after.replace(/^[\s.:–—-]+/, '').trim();
    const title = trimmed.slice(0, prefix.length);
    if (!body) return 'keep';
    return { title, body };
  }
  return null;
}

function splitShortTitleFromBody(rest: string): { title: string; body: string } | null {
  const preserved = splitPreservedSectionHeading(rest);
  if (preserved === 'keep') return null;
  if (preserved) return preserved;

  const words = rest.trim().split(/\s+/);
  if (words.length < 3) return null;

  const preferred: Array<{ title: string; body: string; n: number }> = [];
  const fallback: Array<{ title: string; body: string; n: number }> = [];

  for (let n = 1; n <= Math.min(8, words.length - 2); n += 1) {
    const title = words.slice(0, n).join(' ');
    const body = words.slice(n).join(' ');
    if (!isTitleLike(title)) continue;
    // Jangan potong di tengah judul yang dilindungi (mis. "Why" | "the code…")
    if (splitPreservedSectionHeading(title) === 'keep' || isPreservedTitlePrefix(title)) {
      continue;
    }
    if (/^(adalah|adalahnya|yang|untuk|dengan|dari|dan|atau|in|of|for|to|with|is|are|the|this|it)\b/i.test(body)) {
      continue;
    }
    if (isBodyStart(body)) {
      preferred.push({ title, body, n });
      continue;
    }
    if (/^[A-ZÀ-ÖØ-Þ`*]/.test(body) && n >= 2) {
      fallback.push({ title, body, n });
    }
  }

  if (preferred.length > 0) {
    // "… File Ini Kamu perlu…" → pecah sebelum Kamu/Berikut (bukan sebelum Ini)
    const strong = preferred.filter((p) => isStrongBodyStart(p.body));
    if (strong.length > 0) {
      strong.sort((a, b) => b.n - a.n);
      return { title: strong[0].title, body: strong[0].body };
    }
    // "Tujuan File ini…" → judul pendek sebelum File/Fungsi
    const fileBody = preferred.filter((p) => /^(file|fungsi)\b/i.test(p.body));
    if (fileBody.length > 0) {
      fileBody.sort((a, b) => a.n - b.n);
      return { title: fileBody[0].title, body: fileBody[0].body };
    }
    preferred.sort((a, b) => b.n - a.n);
    return { title: preferred[0].title, body: preferred[0].body };
  }
  if (fallback.length > 0) {
    fallback.sort((a, b) => b.n - a.n);
    return { title: fallback[0].title, body: fallback[0].body };
  }
  return null;
}

/** True jika title adalah awalan judul section yang belum lengkap. */
function isPreservedTitlePrefix(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return false;
  return PRESERVED_SECTION_TITLES.some(
    (full) => full.startsWith(t + ' ') || full === t
  );
}

function isTitleLike(value: string): boolean {
  const clean = value.replace(/\*\*/g, '').trim();
  if (!clean || clean.length < 3 || clean.length > 72) return false;
  const words = clean.split(/\s+/);
  if (words.length > 10) return false;
  if (/[.!?]$/.test(clean)) return false;
  if (words.length >= 6 && /\b(adalah|merupakan|provides|contains|bertujuan|menyediakan)\b/i.test(clean)) {
    return false;
  }
  return true;
}

function looksLikeListSentence(value: string): boolean {
  const clean = value.replace(/\*\*/g, '').trim();
  return (
    clean.length > 72 ||
    /[.!?]$/.test(clean) ||
    /\b(adalah|merupakan|yang|dengan|provides|contains|bertujuan|menyediakan)\b/i.test(clean)
  );
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
