import type {
  ContributionGap,
  GapDetectionInput
} from './contributionGaps';
import { makeGap, normalizePath, normKey, riskForPath } from './contributionGapShared';

function baseName(path: string): string {
  return normalizePath(path).split('/').pop() || path;
}

function isSkippedPath(path: string): boolean {
  return /(^|\/)(node_modules|dist|out|build|\.git|vendor|__pycache__|\.venv)(\/|$)/i.test(path);
}

function isConfigPath(path: string): boolean {
  return /(^|\/)(\.env|config|settings|application\.ya?ml|appsettings)/i.test(path);
}

function isMigrationPath(path: string): boolean {
  return /(^|\/)(migrations?|alembic|prisma\/migrations)(\/|$)/i.test(path);
}

function isSpecPath(path: string): boolean {
  return /\.(ya?ml|json)$/i.test(path) && /(openapi|swagger|api[-_]?spec|schema)/i.test(path);
}

function isDepManifest(path: string): boolean {
  const b = baseName(path).toLowerCase();
  return (
    b === 'package.json' ||
    b === 'package-lock.json' ||
    /^requirements.*\.txt$/i.test(b) ||
    b === 'pyproject.toml' ||
    b === 'poetry.lock' ||
    b === 'cargo.toml' ||
    b === 'go.mod'
  );
}

/** Normalize a code window for duplicate-logic fingerprinting. */
function fingerprintBlock(lines: string[]): string {
  return lines
    .map((l) =>
      l
        .replace(/\/\/.*$/, '')
        .replace(/#.*$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
    )
    .filter((l) => l.length > 2 && !/^(import |from |package |using )/i.test(l))
    .join('\n');
}

function detectDuplicateLogic(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const fpMap = new Map<string, Array<{ path: string; startLine: number; preview: string }>>();

  for (const file of files.slice(0, 300)) {
    const path = normalizePath(file.path);
    if (isSkippedPath(path) || isDepManifest(path) || isConfigPath(path)) continue;
    if (!/\.(py|ts|tsx|js|jsx|go|rs|java)$/i.test(path)) continue;
    const lines = (file.content || '').split(/\r?\n/);
    const WINDOW = 8;
    for (let i = 0; i + WINDOW <= lines.length; i += 4) {
      const chunk = lines.slice(i, i + WINDOW);
      const nonEmpty = chunk.filter((l) => l.trim().length > 0).length;
      if (nonEmpty < 6) continue;
      const fp = fingerprintBlock(chunk);
      if (fp.length < 80) continue;
      const list = fpMap.get(fp) ?? [];
      // one hit per file per fingerprint
      if (list.some((x) => normKey(x.path) === normKey(path))) continue;
      list.push({
        path,
        startLine: i + 1,
        preview: chunk.map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' | ').slice(0, 120)
      });
      fpMap.set(fp, list);
    }
  }

  const gaps: ContributionGap[] = [];
  for (const [, locs] of fpMap) {
    if (locs.length < 2) continue;
    const [a, b] = locs;
    gaps.push(
      makeGap({
        id: `duplicate-logic:${normKey(a.path)}::${normKey(b.path)}:${a.startLine}`,
        title:
          lang === 'en'
            ? `Near-duplicate logic in ${baseName(a.path)} and ${baseName(b.path)}`
            : `Logic nyaris duplikat di ${baseName(a.path)} dan ${baseName(b.path)}`,
        type: 'duplicate-logic',
        evidence: [
          lang === 'en'
            ? `${a.path}:${a.startLine} ≈ ${b.path}:${b.startLine}`
            : `${a.path}:${a.startLine} ≈ ${b.path}:${b.startLine}`,
          a.preview,
          ...(locs.length > 2
            ? [
                lang === 'en'
                  ? `Also seen in ${locs.length - 2} more file(s)`
                  : `Juga muncul di ${locs.length - 2} file lain`
              ]
            : [])
        ],
        opportunity:
          lang === 'en'
            ? 'Extract a shared helper/module so one fix updates all call sites.'
            : 'Ekstrak helper/modul bersama agar satu perbaikan menyentuh semua pemakai.',
        riskBadge: riskForPath(input.insights, a.path),
        filePath: a.path,
        name: baseName(a.path),
        kind: 'file',
        startLine: a.startLine,
        endLine: a.startLine + 7,
        evidenceStrength: Math.min(0.85, 0.55 + locs.length * 0.1),
        value: 0.7,
        effort: 0.45
      })
    );
    if (gaps.length >= 6) break;
  }
  return gaps;
}

function detectSilentFallback(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const gaps: ContributionGap[] = [];
  const patterns: Array<{ re: RegExp; label: string }> = [
    {
      re: /\.get\(\s*[^,)]+\s*,\s*(?:None|null|""|''|""{2}|'unknown'|"unknown"|'N\/A'|"N\/A"|0|False|false)\s*\)/i,
      label: '.get(key, default)'
    },
    {
      re: /\bor\s+(?:None|""|''|'unknown'|"unknown"|'N\/A'|"N\/A")\b/,
      label: 'or default'
    },
    {
      re: /\?\?\s*(?:null|undefined|'unknown'|"unknown"|'N\/A'|"N\/A"|''|""|\{\}|\[\])/i,
      label: '?? fallback'
    },
    {
      re: /\|\|\s*(?:'unknown'|"unknown"|'N\/A'|"N\/A"|''|"")/,
      label: '|| fallback'
    }
  ];

  for (const file of files.slice(0, 350)) {
    const path = normalizePath(file.path);
    if (isSkippedPath(path) || !/\.(py|ts|tsx|js|jsx)$/i.test(path)) continue;
    const lines = (file.content || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const p of patterns) {
        if (!p.re.test(line)) continue;
        // skip test fixtures
        if (/(\.test\.|\.spec\.|\/tests?\/)/i.test(path)) continue;
        gaps.push(
          makeGap({
            id: `silent-fallback:${normKey(path)}:${i + 1}`,
            title:
              lang === 'en'
                ? `Silent fallback may hide real errors in ${baseName(path)}`
                : `Silent fallback bisa nutupi error di ${baseName(path)}`,
            type: 'silent-fallback',
            evidence: [
              lang === 'en' ? `Pattern ${p.label} at L${i + 1}` : `Pola ${p.label} di L${i + 1}`,
              line.trim().slice(0, 160)
            ],
            opportunity:
              lang === 'en'
                ? 'Fail loudly or log when the key/value is missing; avoid opaque defaults on critical paths.'
                : 'Gagal eksplisit atau log saat nilai hilang; hindari default buram di critical path.',
            riskBadge: riskForPath(input.insights, path),
            filePath: path,
            name: baseName(path),
            kind: 'file',
            startLine: i + 1,
            endLine: i + 1,
            evidenceStrength: 0.62,
            value: 0.65,
            effort: 0.25
          })
        );
        break;
      }
      if (gaps.length >= 8) return gaps;
    }
  }
  return gaps;
}

function detectMissingObservability(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const byPath = new Map(files.map((f) => [normKey(f.path), f]));
  const obsRe = /\b(logger?|logging|structlog|console\.(log|info|warn|error)|metrics|prometheus|otel|opentelemetry|sentry|datadog)\b/i;
  const gaps: ContributionGap[] = [];

  for (const hub of (input.insights.hubs ?? []).slice(0, 10)) {
    const path = normalizePath(hub.filePath);
    const file = byPath.get(normKey(path));
    if (!file) continue;
    if (obsRe.test(file.content || '')) continue;
    gaps.push(
      makeGap({
        id: `missing-observability:hub:${hub.id}`,
        title:
          lang === 'en'
            ? `Hub “${hub.name}” has little/no logging or metrics`
            : `Hub “${hub.name}” minim/tidak ada logging atau metrics`,
        type: 'missing-observability',
        evidence: [
          lang === 'en' ? `Hub file: ${path}` : `File hub: ${path}`,
          lang === 'en'
            ? 'No logger/metrics/console/otel markers found in scanned content'
            : 'Tidak ketemu penanda logger/metrics/console/otel di konten yang di-scan'
        ],
        opportunity:
          lang === 'en'
            ? 'Add structured logs and/or metrics around entry/exit and failure paths.'
            : 'Tambah structured log dan/atau metrics di entry/exit dan failure path.',
        riskBadge: 'needs-review',
        filePath: path,
        name: hub.name,
        kind: hub.kind,
        startLine: hub.startLine,
        endLine: hub.endLine,
        evidenceStrength: 0.55,
        value: 0.7,
        effort: 0.4
      })
    );
  }
  return gaps;
}

function detectUnboundedResource(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const gaps: ContributionGap[] = [];

  for (const file of files.slice(0, 300)) {
    const path = normalizePath(file.path);
    if (isSkippedPath(path) || !/\.(py|ts|tsx|js|jsx|go|sql)$/i.test(path)) continue;
    const content = file.content || '';
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const window = lines.slice(i, Math.min(lines.length, i + 8)).join('\n');

      const selectStar = /select\s+\*\s+from/i.test(line);
      const findMany = /\.findMany\s*\(/i.test(line) || /\.all\(\s*\)/.test(line);
      const whileTrue = /while\s*\(\s*true\s*\)|while\s+True\s*:/i.test(line);
      const fetchCall = /\bfetch\s*\(/i.test(line) || /\baxios\.(get|post)/i.test(line);
      const openCall = /\bopen\s*\(|\bfs\.createReadStream|\bcreateConnection\s*\(/i.test(line);

      let kind = '';
      if (selectStar && !/\blimit\b|\btake\b|\boffset\b/i.test(window)) kind = 'SELECT * without LIMIT';
      else if (findMany && !/\b(take|limit|skip|pageSize|pagination)\b/i.test(window))
        kind = 'collection query without limit/pagination';
      else if (whileTrue && !/\b(break|timeout|deadline|max_?iter|sleep)\b/i.test(window))
        kind = 'while True without timeout/break nearby';
      else if (fetchCall && !/\b(timeout|AbortSignal|signal\s*:)\b/i.test(window))
        kind = 'HTTP call without timeout/AbortSignal nearby';
      else if (
        openCall &&
        !/\b(with\s+|close\s*\(|\.close\b|finally|await using|using\s*\()/i.test(window)
      )
        kind = 'resource open without explicit close nearby';

      if (!kind) continue;
      gaps.push(
        makeGap({
          id: `unbounded-resource:${normKey(path)}:${i + 1}:${kind.slice(0, 24)}`,
          title:
            lang === 'en'
              ? `Possibly unbounded resource use in ${baseName(path)}`
              : `Pemakaian resource mungkin unbounded di ${baseName(path)}`,
          type: 'unbounded-resource',
          evidence: [
            lang === 'en' ? `${kind} at L${i + 1}` : `${kind} di L${i + 1}`,
            line.trim().slice(0, 160)
          ],
          opportunity:
            lang === 'en'
              ? 'Add limit/pagination, timeout, or explicit close/dispose on this path.'
              : 'Tambah limit/pagination, timeout, atau close/dispose eksplisit di path ini.',
          riskBadge: riskForPath(input.insights, path),
          filePath: path,
          name: baseName(path),
          kind: 'file',
          startLine: i + 1,
          endLine: i + 1,
          evidenceStrength: 0.58,
          value: 0.75,
          effort: 0.35
        })
      );
      break;
    }
    if (gaps.length >= 8) break;
  }
  return gaps;
}

function detectMissingIdempotency(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const gaps: ContributionGap[] = [];
  const handlerName =
    /\b(def|async\s+def|function|async\s+function|const|let)\s+(\w*(retry|webhook|consumer|handler|on_message|onMessage|process_event|processEvent)\w*)/i;
  const idem =
    /\b(idempoten|idempotent|dedupe|deduplicat|once|lock|setnx|idempotency[_-]?key|exactly[_-]?once)\b/i;

  for (const file of files.slice(0, 300)) {
    const path = normalizePath(file.path);
    if (isSkippedPath(path) || !/\.(py|ts|tsx|js|jsx)$/i.test(path)) continue;
    const lines = (file.content || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(handlerName);
      if (!m) continue;
      const name = m[2];
      const body = lines.slice(i, Math.min(lines.length, i + 40)).join('\n');
      if (idem.test(body)) continue;
      gaps.push(
        makeGap({
          id: `missing-idempotency:${normKey(path)}:${name}`,
          title:
            lang === 'en'
              ? `Handler “${name}” may lack idempotency guards`
              : `Handler “${name}” mungkin tanpa guard idempotency`,
          type: 'missing-idempotency',
          evidence: [
            lang === 'en'
              ? `Retry/webhook-style name at L${i + 1}`
              : `Nama bergaya retry/webhook di L${i + 1}`,
            lang === 'en'
              ? 'No idempotency/dedupe/lock keywords in the next ~40 lines'
              : 'Tidak ada keyword idempotency/dedupe/lock di ~40 baris berikutnya'
          ],
          opportunity:
            lang === 'en'
              ? 'Add idempotency keys, dedupe store, or transactional outbox for safe retries.'
              : 'Tambah idempotency key, store dedupe, atau transactional outbox untuk retry aman.',
          riskBadge: riskForPath(input.insights, path),
          filePath: path,
          name,
          kind: 'function',
          startLine: i + 1,
          endLine: i + 1,
          evidenceStrength: 0.5,
          value: 0.8,
          effort: 0.55
        })
      );
      if (gaps.length >= 6) return gaps;
    }
  }
  return gaps;
}

function extractQuotedKeys(text: string): Set<string> {
  const keys = new Set<string>();
  const re = /["']([a-zA-Z_][\w-]{2,})["']\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    keys.add(m[1]);
  }
  // openapi properties
  const prop = /^\s{2,}([a-zA-Z_][\w-]{2,})\s*:/gm;
  while ((m = prop.exec(text))) {
    if (!/^(type|properties|items|required|description|schema|responses|content)$/i.test(m[1])) {
      keys.add(m[1]);
    }
  }
  return keys;
}

function detectSchemaApiDrift(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const specs = files.filter((f) => isSpecPath(normalizePath(f.path)));
  if (specs.length === 0) return [];

  const codeFiles = files.filter((f) =>
    /\.(ts|tsx|js|py)$/i.test(normalizePath(f.path)) && !isSkippedPath(normalizePath(f.path))
  );
  const codeCorpus = codeFiles.map((f) => f.content).join('\n');
  const gaps: ContributionGap[] = [];

  for (const spec of specs.slice(0, 4)) {
    const path = normalizePath(spec.path);
    const keys = [...extractQuotedKeys(spec.content || '')].filter((k) => k.length >= 4);
    if (keys.length < 5) continue;
    const missing = keys.filter((k) => !new RegExp(`\\b${k}\\b`).test(codeCorpus)).slice(0, 8);
    if (missing.length < 3) continue;
    const ratio = missing.length / Math.min(keys.length, 40);
    if (ratio < 0.25) continue;
    gaps.push(
      makeGap({
        id: `schema-api-drift:${normKey(path)}`,
        title:
          lang === 'en'
            ? `Spec fields in ${baseName(path)} look underused in code`
            : `Field spec di ${baseName(path)} tampak jarang dipakai di kode`,
        type: 'schema-api-drift',
        evidence: [
          lang === 'en'
            ? `Spec: ${path}`
            : `Spec: ${path}`,
          lang === 'en'
            ? `Example unused/rare keys: ${missing.slice(0, 5).join(', ')}`
            : `Contoh key jarang/unused: ${missing.slice(0, 5).join(', ')}`
        ],
        opportunity:
          lang === 'en'
            ? 'Align OpenAPI/schema with serializers/types, or remove stale fields from the contract.'
            : 'Selaraskan OpenAPI/schema dengan serializer/type, atau hapus field usang dari kontrak.',
        riskBadge: 'needs-review',
        filePath: path,
        name: baseName(path),
        kind: 'file',
        startLine: 1,
        endLine: 1,
        evidenceStrength: 0.48,
        value: 0.6,
        effort: 0.5
      })
    );
  }
  return gaps.slice(0, 4);
}

function detectDependencyRisk(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const gaps: ContributionGap[] = [];

  for (const file of files) {
    const path = normalizePath(file.path);
    const b = baseName(path).toLowerCase();
    const content = file.content || '';

    if (b === 'package.json') {
      try {
        const json = JSON.parse(content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const deps = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
        for (const [name, ver] of Object.entries(deps)) {
          if (ver === '*' || ver === 'latest' || ver === '' || /^latest$/i.test(ver)) {
            gaps.push(
              makeGap({
                id: `dependency-risk:npm:${name}`,
                title:
                  lang === 'en'
                    ? `Unpinned dependency “${name}” (${ver || 'empty'})`
                    : `Dependency “${name}” tidak di-pin (${ver || 'kosong'})`,
                type: 'dependency-risk',
                evidence: [`package.json → ${name}: ${ver || '(empty)'}`],
                opportunity:
                  lang === 'en'
                    ? 'Pin a semver range and audit for known CVEs.'
                    : 'Pin rentang semver dan audit CVE yang diketahui.',
                riskBadge: 'needs-review',
                filePath: path,
                name,
                kind: 'file',
                startLine: 1,
                endLine: 1,
                evidenceStrength: 0.72,
                value: 0.7,
                effort: 0.3
              })
            );
          }
        }
      } catch {
        /* ignore invalid json */
      }
    }

    if (/^requirements.*\.txt$/i.test(b)) {
      const lines = content.split(/\r?\n/);
      lines.forEach((line, idx) => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return;
        if (/^[A-Za-z0-9_.-]+$/.test(t) || /==\s*$/.test(t) || /@latest/i.test(t)) {
          const name = t.split(/[=<>!~@]/)[0];
          gaps.push(
            makeGap({
              id: `dependency-risk:pip:${name}`,
              title:
                lang === 'en'
                  ? `Unpinned Python dependency “${name}”`
                  : `Dependency Python “${name}” tidak di-pin`,
              type: 'dependency-risk',
              evidence: [`${path}:${idx + 1} → ${t.slice(0, 80)}`],
              opportunity:
                lang === 'en'
                  ? 'Pin versions (==x.y.z) for reproducible, auditable installs.'
                  : 'Pin versi (==x.y.z) agar install reproducible dan bisa diaudit.',
              riskBadge: 'needs-review',
              filePath: path,
              name,
              kind: 'file',
              startLine: idx + 1,
              endLine: idx + 1,
              evidenceStrength: 0.7,
              value: 0.65,
              effort: 0.25
            })
          );
        }
      });
    }

    if (b === 'pyproject.toml') {
      const lines = content.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (/"[^"]+"\s*=\s*"(?:\*|latest)"/i.test(line) || /^\s*[A-Za-z0-9_.-]+\s*$/.test(line)) {
          /* poetry style "*" */
        }
        const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*"(?:\*|latest)"/i);
        if (m) {
          gaps.push(
            makeGap({
              id: `dependency-risk:pyproject:${m[1]}`,
              title:
                lang === 'en'
                  ? `Unpinned dependency “${m[1]}” in pyproject.toml`
                  : `Dependency “${m[1]}” tidak di-pin di pyproject.toml`,
              type: 'dependency-risk',
              evidence: [`${path}:${idx + 1} → ${line.trim()}`],
              opportunity:
                lang === 'en'
                  ? 'Replace * / latest with a bounded version constraint.'
                  : 'Ganti * / latest dengan constraint versi terbatas.',
              riskBadge: 'needs-review',
              filePath: path,
              name: m[1],
              kind: 'file',
              startLine: idx + 1,
              endLine: idx + 1,
              evidenceStrength: 0.72,
              value: 0.65,
              effort: 0.25
            })
          );
        }
      });
    }
  }
  return gaps.slice(0, 8);
}

function detectFeatureFlagGraveyard(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const gaps: ContributionGap[] = [];
  const defRe =
    /\b((?:FEATURE_|FF_|FLAG_)[A-Z0-9_]+|enable[A-Z]\w*|isFeature\w*)\s*=\s*(True|False|true|false)\b/g;

  const defs = new Map<string, { path: string; line: number; value: string }>();
  const allText = files.map((f) => f.content).join('\n');

  for (const file of files.slice(0, 350)) {
    const path = normalizePath(file.path);
    if (isSkippedPath(path)) continue;
    const lines = (file.content || '').split(/\r?\n/);
    lines.forEach((line, idx) => {
      defRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      const re = new RegExp(defRe.source, 'g');
      while ((m = re.exec(line))) {
        const name = m[1];
        if (!defs.has(name)) {
          defs.set(name, { path, line: idx + 1, value: m[2] });
        }
      }
    });
  }

  for (const [name, loc] of defs) {
    const usages = allText.match(new RegExp(`\\b${name}\\b`, 'g')) || [];
    // definition + few references, always constant true/false
    if (usages.length <= 4) {
      gaps.push(
        makeGap({
          id: `feature-flag-graveyard:${name}`,
          title:
            lang === 'en'
              ? `Feature flag “${name}” looks stuck at ${loc.value}`
              : `Feature flag “${name}” tampak stuck di ${loc.value}`,
          type: 'feature-flag-graveyard',
          evidence: [
            lang === 'en'
              ? `Defined ${loc.path}:${loc.line} = ${loc.value}`
              : `Didefinisikan ${loc.path}:${loc.line} = ${loc.value}`,
            lang === 'en'
              ? `Occurrences in corpus: ${usages.length}`
              : `Kemunculan di korpus: ${usages.length}`
          ],
          opportunity:
            lang === 'en'
              ? 'Remove the dead flag and delete the unused branch, or document why it must stay.'
              : 'Hapus flag mati dan cabang tak terpakai, atau dokumentasikan kenapa harus tetap.',
          riskBadge: riskForPath(input.insights, loc.path),
          filePath: loc.path,
          name,
          kind: 'variable',
          startLine: loc.line,
          endLine: loc.line,
          evidenceStrength: 0.55,
          value: 0.45,
          effort: 0.3
        })
      );
    }
    if (gaps.length >= 6) break;
  }
  return gaps;
}

function detectOwnershipGap(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const hubs = input.insights.hubs ?? [];
  if (hubs.length === 0) return [];
  const files = input.fileContents ?? [];
  // Without a file corpus we cannot honestly claim CODEOWNERS is missing.
  if (files.length === 0) return [];
  const codeowners = files.find((f) => /(?:^|\/)CODEOWNERS$/i.test(normalizePath(f.path)));

  if (!codeowners) {
    return [
      makeGap({
        id: 'ownership-gap:missing-codeowners',
        title:
          lang === 'en'
            ? 'Critical modules exist but CODEOWNERS is missing'
            : 'Ada modul kritis tapi CODEOWNERS tidak ditemukan',
        type: 'ownership-gap',
        evidence: [
          lang === 'en'
            ? `Hubs present: ${hubs
                .slice(0, 3)
                .map((h) => h.name)
                .join(', ')}`
            : `Hub ada: ${hubs
                .slice(0, 3)
                .map((h) => h.name)
                .join(', ')}`,
          lang === 'en'
            ? 'No CODEOWNERS file in the analyzed file set'
            : 'Tidak ada file CODEOWNERS di set file yang dianalisis'
        ],
        opportunity:
          lang === 'en'
            ? 'Add CODEOWNERS for hubs so day-1 contributors know whom to ask.'
            : 'Tambah CODEOWNERS untuk hub agar kontributor hari-1 tahu siapa yang ditanya.',
        riskBadge: 'needs-review',
        filePath: hubs[0]?.filePath,
        name: hubs[0]?.name,
        kind: hubs[0]?.kind,
        startLine: hubs[0]?.startLine,
        endLine: hubs[0]?.endLine,
        evidenceStrength: files.length > 0 ? 0.7 : 0.45,
        value: 0.6,
        effort: 0.2
      })
    ];
  }

  const rules = (codeowners.content || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const gaps: ContributionGap[] = [];
  for (const hub of hubs.slice(0, 8)) {
    const path = normalizePath(hub.filePath);
    const covered = rules.some((rule) => {
      const pat = rule.split(/\s+/)[0]?.replace(/^\//, '') || '';
      if (!pat) return false;
      if (pat === '*') return true;
      const re = new RegExp(
        '^' +
          pat
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
      );
      return re.test(path) || path.includes(pat.replace(/\*$/, ''));
    });
    if (covered) continue;
    gaps.push(
      makeGap({
        id: `ownership-gap:hub:${hub.id}`,
        title:
          lang === 'en'
            ? `Hub “${hub.name}” has no CODEOWNERS match`
            : `Hub “${hub.name}” tidak punya match CODEOWNERS`,
        type: 'ownership-gap',
        evidence: [
          lang === 'en' ? `Hub path: ${path}` : `Path hub: ${path}`,
          lang === 'en'
            ? `CODEOWNERS rules checked: ${rules.length}`
            : `Rule CODEOWNERS dicek: ${rules.length}`
        ],
        opportunity:
          lang === 'en'
            ? 'Add an ownership rule for this hub path.'
            : 'Tambah rule ownership untuk path hub ini.',
        riskBadge: 'needs-review',
        filePath: path,
        name: hub.name,
        kind: hub.kind,
        startLine: hub.startLine,
        endLine: hub.endLine,
        evidenceStrength: 0.65,
        value: 0.55,
        effort: 0.2
      })
    );
  }
  return gaps.slice(0, 5);
}

function detectConventionDrift(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = (input.fileContents ?? []).filter(
    (f) => /\.(py|ts|tsx|js|jsx)$/i.test(normalizePath(f.path)) && !isSkippedPath(normalizePath(f.path))
  );
  if (files.length < 8) return [];

  let snake = 0;
  let camel = 0;
  const folderCounts = new Map<string, number>();

  for (const f of files) {
    const path = normalizePath(f.path);
    const parts = path.split('/');
    if (parts.length >= 2) {
      const top = parts.slice(0, 2).join('/');
      folderCounts.set(top, (folderCounts.get(top) ?? 0) + 1);
    }
    const name = baseName(path).replace(/\.[^.]+$/, '');
    if (/^[a-z]+(_[a-z0-9]+)+$/.test(name)) snake++;
    if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(name)) camel++;
  }

  const gaps: ContributionGap[] = [];
  const styleMajor = snake >= camel * 2 ? 'snake' : camel >= snake * 2 ? 'camel' : null;
  if (styleMajor) {
    const outliers = files.filter((f) => {
      const name = baseName(normalizePath(f.path)).replace(/\.[^.]+$/, '');
      if (styleMajor === 'snake') return /^[a-z]+([A-Z][a-z0-9]*)+$/.test(name);
      return /^[a-z]+(_[a-z0-9]+)+$/.test(name);
    });
    for (const f of outliers.slice(0, 4)) {
      const path = normalizePath(f.path);
      gaps.push(
        makeGap({
          id: `convention-drift:name:${normKey(path)}`,
          title:
            lang === 'en'
              ? `Naming style outlier: ${baseName(path)} (repo leans ${styleMajor}_case)`
              : `Outlier gaya penamaan: ${baseName(path)} (repo cenderung ${styleMajor}_case)`,
          type: 'convention-drift',
          evidence: [
            lang === 'en'
              ? `Dominant style: ${styleMajor} (snake=${snake}, camel=${camel})`
              : `Gaya dominan: ${styleMajor} (snake=${snake}, camel=${camel})`
          ],
          opportunity:
            lang === 'en'
              ? 'Rename to match the dominant convention or document the exception.'
              : 'Rename agar ikut konvensi dominan, atau dokumentasikan pengecualian.',
          riskBadge: 'safe',
          filePath: path,
          name: baseName(path),
          kind: 'file',
          startLine: 1,
          endLine: 1,
          evidenceStrength: 0.5,
          value: 0.35,
          effort: 0.35
        })
      );
    }
  }

  const sortedFolders = [...folderCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (sortedFolders.length >= 3 && sortedFolders[0][1] >= 5) {
    const dominant = sortedFolders[0][0];
    const rare = sortedFolders.filter(([, n]) => n === 1).slice(0, 3);
    for (const [folder] of rare) {
      // only if under same root prefix mismatch like src/ vs lib/
      if (folder.split('/')[0] === dominant.split('/')[0]) continue;
      gaps.push(
        makeGap({
          id: `convention-drift:folder:${normKey(folder)}`,
          title:
            lang === 'en'
              ? `Layout outlier folder “${folder}” vs dominant “${dominant}”`
              : `Folder outlier “${folder}” vs dominan “${dominant}”`,
          type: 'convention-drift',
          evidence: [
            lang === 'en'
              ? `Dominant layout bucket: ${dominant} (${sortedFolders[0][1]} files)`
              : `Bucket layout dominan: ${dominant} (${sortedFolders[0][1]} file)`
          ],
          opportunity:
            lang === 'en'
              ? 'Move the module under the common layout or explain why it is special.'
              : 'Pindahkan modul ke layout umum atau jelaskan kenapa spesial.',
          riskBadge: 'safe',
          filePath: folder,
          name: folder,
          kind: 'file',
          startLine: 1,
          endLine: 1,
          evidenceStrength: 0.45,
          value: 0.3,
          effort: 0.4
        })
      );
    }
  }

  return gaps.slice(0, 5);
}

function detectMigrationIncomplete(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const migrations = files.filter((f) => isMigrationPath(normalizePath(f.path)));
  if (migrations.length === 0) return [];

  const nonMig = files
    .filter((f) => !isMigrationPath(normalizePath(f.path)) && !isSkippedPath(normalizePath(f.path)))
    .map((f) => f.content)
    .join('\n');

  const gaps: ContributionGap[] = [];
  const addCol =
    /\b(?:add_column|ADD\s+COLUMN|op\.add_column)\s*\(?\s*['"`]?(\w+)['"`]?/gi;
  const createTable =
    /\b(?:create_table|CREATE\s+TABLE|op\.create_table)\s*\(?\s*['"`]?(\w+)['"`]?/gi;

  for (const mig of migrations.slice(0, 20)) {
    const path = normalizePath(mig.path);
    const content = mig.content || '';
    const names = new Set<string>();
    for (const re of [addCol, createTable]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      const r = new RegExp(re.source, 'gi');
      while ((m = r.exec(content))) {
        const n = m[1];
        if (n && n.length >= 3 && !/^(if|table|nullable|server|default)$/i.test(n)) names.add(n);
      }
    }
    for (const name of names) {
      if (new RegExp(`\\b${name}\\b`).test(nonMig)) continue;
      gaps.push(
        makeGap({
          id: `migration-incomplete:${normKey(path)}:${name}`,
          title:
            lang === 'en'
              ? `Migration introduces “${name}” but app code barely references it`
              : `Migration memperkenalkan “${name}” tapi kode app hampir tidak merujuknya`,
          type: 'migration-incomplete',
          evidence: [
            lang === 'en' ? `Migration file: ${path}` : `File migration: ${path}`,
            lang === 'en'
              ? `Symbol/table/column “${name}” not found outside migrations`
              : `Simbol/tabel/kolom “${name}” tidak ketemu di luar migrations`
          ],
          opportunity:
            lang === 'en'
              ? 'Wire models/queries to the new schema, or remove the unused migration artifact.'
              : 'Hubungkan model/query ke schema baru, atau hapus artefak migration yang tidak dipakai.',
          riskBadge: 'needs-review',
          filePath: path,
          name,
          kind: 'file',
          startLine: 1,
          endLine: 1,
          evidenceStrength: 0.55,
          value: 0.7,
          effort: 0.5
        })
      );
      if (gaps.length >= 6) return gaps;
    }
  }
  return gaps;
}

function detectNamingMismatch(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const gaps: ContributionGap[] = [];
  const fnRe =
    /\b(?:def|async\s+def|function|async\s+function)\s+((?:get|is|load|fetch|read|find)\w*)\s*\(/g;
  const mutate = /\b(save|update|delete|remove|write|insert|upsert|mutate|setState|commit)\s*\(/i;

  for (const file of files.slice(0, 300)) {
    const path = normalizePath(file.path);
    if (isSkippedPath(path) || !/\.(py|ts|tsx|js|jsx)$/i.test(path)) continue;
    const lines = (file.content || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      fnRe.lastIndex = 0;
      const re = new RegExp(fnRe.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(lines[i]))) {
        const name = m[1];
        const body = lines.slice(i, Math.min(lines.length, i + 35)).join('\n');
        if (!mutate.test(body)) continue;
        // require at least 2 mutate hits to reduce FP
        const hits = body.match(
          /\b(save|update|delete|remove|write|insert|upsert|mutate|commit)\s*\(/gi
        );
        if (!hits || hits.length < 2) continue;
        gaps.push(
          makeGap({
            id: `naming-mismatch:${normKey(path)}:${name}`,
            title:
              lang === 'en'
                ? `“${name}” reads like a getter but mutates state`
                : `“${name}” terdengar getter tapi mengubah state`,
            type: 'naming-mismatch',
            evidence: [
              lang === 'en' ? `Defined at L${i + 1}` : `Didefinisikan di L${i + 1}`,
              lang === 'en'
                ? `Mutation-like calls nearby: ${hits.slice(0, 3).join(', ')}`
                : `Panggilan bergaya mutasi di dekatnya: ${hits.slice(0, 3).join(', ')}`
            ],
            opportunity:
              lang === 'en'
                ? 'Rename to reflect side effects, or split read vs write APIs.'
                : 'Rename agar mencerminkan side effect, atau pisahkan API baca vs tulis.',
            riskBadge: riskForPath(input.insights, path),
            filePath: path,
            name,
            kind: 'function',
            startLine: i + 1,
            endLine: i + 1,
            evidenceStrength: 0.52,
            value: 0.5,
            effort: 0.35
          })
        );
        if (gaps.length >= 6) return gaps;
      }
    }
  }
  return gaps;
}

function detectCircularDependency(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const graph = input.graph;
  if (!graph) return [];
  const imports = graph.edges.filter((e) => e.kind === 'imports');
  const pair = new Set(imports.map((e) => `${e.from}→${e.to}`));
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const gaps: ContributionGap[] = [];
  const seen = new Set<string>();

  for (const e of imports) {
    const back = `${e.to}→${e.from}`;
    if (!pair.has(back)) continue;
    const key = [e.from, e.to].sort().join('::');
    if (seen.has(key)) continue;
    seen.add(key);
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    if (!a || !b) continue;
    gaps.push(
      makeGap({
        id: `circular-dependency:${key}`,
        title:
          lang === 'en'
            ? `Circular import: ${a.name} ↔ ${b.name}`
            : `Import sirkular: ${a.name} ↔ ${b.name}`,
        type: 'circular-dependency',
        evidence: [
          `${a.filePath} ↔ ${b.filePath}`,
          lang === 'en'
            ? 'Bidirectional imports edge detected in code graph'
            : 'Edge imports dua arah terdeteksi di code graph'
        ],
        opportunity:
          lang === 'en'
            ? 'Extract a shared boundary module or invert one dependency direction.'
            : 'Ekstrak modul boundary bersama atau balik arah salah satu dependency.',
        riskBadge: riskForPath(input.insights, a.filePath, a.name),
        filePath: a.filePath,
        name: a.name,
        kind: a.kind,
        startLine: a.startLine,
        endLine: a.endLine,
        evidenceStrength: 0.8,
        value: 0.7,
        effort: 0.55
      })
    );
    if (gaps.length >= 6) break;
  }
  return gaps;
}

function detectMagicValue(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const litMap = new Map<string, Array<{ path: string; line: number }>>();

  for (const file of files.slice(0, 300)) {
    const path = normalizePath(file.path);
    if (isSkippedPath(path) || isDepManifest(path) || isConfigPath(path)) continue;
    if (!/\.(py|ts|tsx|js|jsx|go)$/i.test(path)) continue;
    const lines = (file.content || '').split(/\r?\n/);
    const seenInFile = new Set<string>();
    lines.forEach((line, idx) => {
      const nums = line.match(/\b\d{3,}\b/g) || [];
      for (const n of nums) {
        if (['100', '200', '201', '204', '301', '302', '400', '401', '403', '404', '500'].includes(n))
          continue;
        const key = `n:${n}`;
        if (seenInFile.has(key)) continue;
        seenInFile.add(key);
        const list = litMap.get(key) ?? [];
        list.push({ path, line: idx + 1 });
        litMap.set(key, list);
      }
      const strs = line.match(/['"]([A-Za-z][A-Za-z0-9_-]{3,})['"]/g) || [];
      for (const raw of strs) {
        const s = raw.slice(1, -1);
        if (/^(true|false|null|none|undefined|utf-?8|application\/json)$/i.test(s)) continue;
        const key = `s:${s.toLowerCase()}`;
        if (seenInFile.has(key)) continue;
        seenInFile.add(key);
        const list = litMap.get(key) ?? [];
        list.push({ path, line: idx + 1 });
        litMap.set(key, list);
      }
    });
  }

  const gaps: ContributionGap[] = [];
  for (const [key, locs] of litMap) {
    const filesHit = new Set(locs.map((l) => normKey(l.path)));
    if (filesHit.size < 3) continue;
    const lit = key.slice(2);
    const sample = locs.slice(0, 3);
    gaps.push(
      makeGap({
        id: `magic-value:${key}`,
        title:
          lang === 'en'
            ? `Magic value “${lit}” repeated across ${filesHit.size} files`
            : `Magic value “${lit}” berulang di ${filesHit.size} file`,
        type: 'magic-value',
        evidence: sample.map((s) => `${s.path}:${s.line}`),
        opportunity:
          lang === 'en'
            ? 'Extract a named constant/shared config so updates stay consistent.'
            : 'Ekstrak named constant/config bersama agar update konsisten.',
        riskBadge: riskForPath(input.insights, sample[0].path),
        filePath: sample[0].path,
        name: lit,
        kind: 'variable',
        startLine: sample[0].line,
        endLine: sample[0].line,
        evidenceStrength: Math.min(0.8, 0.5 + filesHit.size * 0.08),
        value: 0.5,
        effort: 0.25
      })
    );
    if (gaps.length >= 6) break;
  }
  return gaps;
}

function detectInconsistentErrorHandling(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = input.fileContents ?? [];
  const gaps: ContributionGap[] = [];

  for (const file of files.slice(0, 300)) {
    const path = normalizePath(file.path);
    if (isSkippedPath(path) || !/\.(py|ts|tsx|js|jsx)$/i.test(path)) continue;
    const content = file.content || '';
    const throws = (content.match(/\b(throw\s+new|raise\s+\w+)/g) || []).length;
    const soft = (
      content.match(/\breturn\s+(None|null|undefined|false|False|\{\s*ok:\s*false)/g) || []
    ).length;
    const resultErr = (content.match(/\b(Err\(|Result\.error|Ok\()/g) || []).length;
    const styles = [throws > 1, soft > 1, resultErr > 1].filter(Boolean).length;
    if (styles < 2) continue;
    gaps.push(
      makeGap({
        id: `inconsistent-error-handling:${normKey(path)}`,
        title:
          lang === 'en'
            ? `Mixed error-handling styles in ${baseName(path)}`
            : `Gaya error-handling campur di ${baseName(path)}`,
        type: 'inconsistent-error-handling',
        evidence: [
          lang === 'en'
            ? `throw/raise≈${throws}, soft-return≈${soft}, Result-style≈${resultErr}`
            : `throw/raise≈${throws}, soft-return≈${soft}, Result-style≈${resultErr}`
        ],
        opportunity:
          lang === 'en'
            ? 'Pick one error convention for the module and migrate call sites.'
            : 'Pilih satu konvensi error untuk modul ini dan migrasikan call site.',
        riskBadge: riskForPath(input.insights, path),
        filePath: path,
        name: baseName(path),
        kind: 'file',
        startLine: 1,
        endLine: 1,
        evidenceStrength: 0.55,
        value: 0.55,
        effort: 0.5
      })
    );
    if (gaps.length >= 6) break;
  }
  return gaps;
}

function detectCopyPastedConfig(input: GapDetectionInput): ContributionGap[] {
  const lang = input.lang ?? 'id';
  const files = (input.fileContents ?? []).filter((f) => isConfigPath(normalizePath(f.path)));
  if (files.length < 2) return [];

  const keyLocs = new Map<string, Array<{ path: string; line: number; value: string }>>();
  const assign =
    /^\s*(?:export\s+)?(?:const\s+)?([A-Z][A-Z0-9_]{2,})\s*=\s*(.+)$|^\s*([A-Z][A-Z0-9_]{2,})\s*[:=]\s*(.+)$/;

  for (const file of files) {
    const path = normalizePath(file.path);
    const lines = (file.content || '').split(/\r?\n/);
    lines.forEach((line, idx) => {
      const m = line.match(assign);
      if (!m) return;
      const key = (m[1] || m[3] || '').trim();
      const value = (m[2] || m[4] || '').trim().slice(0, 80);
      if (!key) return;
      const list = keyLocs.get(key) ?? [];
      list.push({ path, line: idx + 1, value });
      keyLocs.set(key, list);
    });
  }

  const gaps: ContributionGap[] = [];
  for (const [key, locs] of keyLocs) {
    const paths = new Set(locs.map((l) => normKey(l.path)));
    if (paths.size < 2) continue;
    const values = new Set(locs.map((l) => l.value));
    gaps.push(
      makeGap({
        id: `copy-pasted-config:${key}`,
        title:
          lang === 'en'
            ? `Config key “${key}” duplicated across ${paths.size} files`
            : `Config key “${key}” terduplikasi di ${paths.size} file`,
        type: 'copy-pasted-config',
        evidence: [
          ...locs.slice(0, 3).map((l) => `${l.path}:${l.line} = ${l.value}`),
          values.size > 1
            ? lang === 'en'
              ? 'Values differ — drift risk'
              : 'Nilai berbeda — risiko drift'
            : lang === 'en'
              ? 'Same value copied — no single source of truth'
              : 'Nilai sama di-copy — belum single source of truth'
        ],
        opportunity:
          lang === 'en'
            ? 'Centralize the setting in one shared config module/env schema.'
            : 'Pusatkan setting di satu modul config/env schema bersama.',
        riskBadge: riskForPath(input.insights, locs[0].path),
        filePath: locs[0].path,
        name: key,
        kind: 'variable',
        startLine: locs[0].line,
        endLine: locs[0].line,
        evidenceStrength: 0.68,
        value: 0.55,
        effort: 0.35
      })
    );
    if (gaps.length >= 6) break;
  }
  return gaps;
}

/** Extra gap detectors (evidence-first). */
export function detectExtraContributionGaps(input: GapDetectionInput): ContributionGap[] {
  return [
    ...detectDuplicateLogic(input),
    ...detectSilentFallback(input),
    ...detectMissingObservability(input),
    ...detectUnboundedResource(input),
    ...detectMissingIdempotency(input),
    ...detectSchemaApiDrift(input),
    ...detectDependencyRisk(input),
    ...detectFeatureFlagGraveyard(input),
    ...detectOwnershipGap(input),
    ...detectConventionDrift(input),
    ...detectMigrationIncomplete(input),
    ...detectNamingMismatch(input),
    ...detectCircularDependency(input),
    ...detectMagicValue(input),
    ...detectInconsistentErrorHandling(input),
    ...detectCopyPastedConfig(input)
  ];
}
