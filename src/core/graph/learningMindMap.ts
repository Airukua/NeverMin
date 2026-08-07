import { GraphInsights } from './graphInsights';
import { NeverminLanguage } from '../../i18n/types';
import { uniqueMainFlowStages } from './flowMermaid';

function sanitizeMindLabel(value: string, max = 36): string {
  return value
    .replace(/[()[\]{}]/g, '')
    .replace(/["'`]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'item';
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function foldersFromInsights(insights: GraphInsights, limit = 8): string[] {
  const counts = new Map<string, number>();
  const bump = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2) {
      return;
    }
    // Ambil folder relatif pendek (2 segmen terakhir sebelum file)
    const folder = parts.slice(0, -1).slice(-2).join('/');
    if (!folder) {
      return;
    }
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  };

  for (const ref of [...insights.entryPoints, ...insights.hubs]) {
    if (ref.filePath) {
      bump(ref.filePath);
    }
  }
  for (const stage of insights.mainFlow?.stages ?? []) {
    if (stage.filePath) {
      bump(stage.filePath);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([folder]) => folder);
}

export interface LearningMindMapOptions {
  lang?: NeverminLanguage;
  folders?: string[];
  rootTitle?: string;
}

/**
 * Mind map pecahan belajar: mulai dari entry → alur utama → hub → modul folder.
 * Mermaid mindmap (indent-based).
 */
export function buildLearningMindMapMermaid(
  insights: GraphInsights,
  options: LearningMindMapOptions = {}
): string {
  const lang = options.lang ?? 'id';
  const root =
    options.rootTitle ||
    (lang === 'en' ? 'Learning breakdown' : 'Pecahan belajar');

  const labels =
    lang === 'en'
      ? {
          start: 'Start here',
          flow: 'Main flow',
          hubs: 'Core hubs',
          modules: 'Modules to explore',
          later: 'Check later',
          empty: 'Run analysis first'
        }
      : {
          start: 'Mulai di sini',
          flow: 'Alur utama',
          hubs: 'Konsep inti (hub)',
          modules: 'Modul untuk dijelajahi',
          later: 'Cek belakangan',
          empty: 'Jalankan analisis dulu'
        };

  const lines: string[] = ['mindmap', `${indent(1)}root((${sanitizeMindLabel(root, 40)}))`];

  const entries = insights.entryPoints.slice(0, 5);
  const hubs = insights.hubs.slice(0, 5);
  const stages = insights.mainFlow ? uniqueMainFlowStages(insights.mainFlow).slice(0, 6) : [];
  const folders = (options.folders?.length ? options.folders : foldersFromInsights(insights)).slice(
    0,
    8
  );
  const orphans = (insights.orphanFiles ?? []).slice(0, 4);

  if (entries.length === 0 && hubs.length === 0 && stages.length === 0 && folders.length === 0) {
    lines.push(`${indent(2)}${sanitizeMindLabel(labels.empty)}`);
    return lines.join('\n');
  }

  if (entries.length > 0) {
    lines.push(`${indent(2)}${sanitizeMindLabel(labels.start)}`);
    for (const entry of entries) {
      lines.push(`${indent(3)}${sanitizeMindLabel(entry.name)}`);
    }
  }

  if (stages.length > 0) {
    lines.push(`${indent(2)}${sanitizeMindLabel(labels.flow)}`);
    for (const stage of stages) {
      const prefix =
        stage.role === 'input' ? 'in: ' : stage.role === 'output' ? 'out: ' : '';
      lines.push(`${indent(3)}${sanitizeMindLabel(prefix + stage.name)}`);
    }
  }

  if (hubs.length > 0) {
    lines.push(`${indent(2)}${sanitizeMindLabel(labels.hubs)}`);
    for (const hub of hubs) {
      lines.push(`${indent(3)}${sanitizeMindLabel(hub.name)}`);
    }
  }

  if (folders.length > 0) {
    lines.push(`${indent(2)}${sanitizeMindLabel(labels.modules)}`);
    for (const folder of folders) {
      lines.push(`${indent(3)}${sanitizeMindLabel(folder, 42)}`);
    }
  }

  if (orphans.length > 0) {
    lines.push(`${indent(2)}${sanitizeMindLabel(labels.later)}`);
    for (const orphan of orphans) {
      lines.push(`${indent(3)}${sanitizeMindLabel(orphan.name)}`);
    }
  }

  return lines.join('\n');
}
