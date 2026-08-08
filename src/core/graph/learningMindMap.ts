import { GraphInsights } from './graphInsights';
import { NeverminLanguage } from '../../i18n/types';
import { t } from '../../i18n';
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

export type MindMapBranchKind = 'start' | 'flow' | 'hubs' | 'modules' | 'later';

export interface LearningMindMapLeaf {
  id: string;
  name: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  role?: string;
  kind?: string;
}

export interface LearningMindMapBranch {
  id: MindMapBranchKind;
  label: string;
  accent: 'entry' | 'pipeline' | 'hub' | 'modules' | 'later';
  children: LearningMindMapLeaf[];
}

export interface LearningMindMapModel {
  rootTitle: string;
  subtitle: string;
  branches: LearningMindMapBranch[];
  mermaid: string;
  stats: {
    entryCount: number;
    hubCount: number;
    stageCount: number;
    moduleCount: number;
  };
}

export interface LearningMindMapOptions {
  lang?: NeverminLanguage;
  folders?: string[];
  rootTitle?: string;
}

function branchLabels(lang: NeverminLanguage) {
  return {
    root: t('mindmap.root', undefined, lang),
    start: t('mindmap.start', undefined, lang),
    flow: t('mindmap.flow', undefined, lang),
    hubs: t('mindmap.hubs', undefined, lang),
    modules: t('mindmap.modules', undefined, lang),
    later: t('mindmap.later', undefined, lang),
    empty: t('structure.needAnalyze', undefined, lang),
    subtitle: (e: number, h: number) => t('mindmap.subtitle', { entries: e, hubs: h }, lang)
  };
}

/**
 * Structured learning mind map for the React webview.
 */
export function buildLearningMindMapModel(
  insights: GraphInsights,
  options: LearningMindMapOptions = {}
): LearningMindMapModel {
  const lang = options.lang ?? 'id';
  const labels = branchLabels(lang);
  const rootTitle = options.rootTitle || labels.root;

  const entries = insights.entryPoints.slice(0, 5);
  const hubs = insights.hubs.slice(0, 5);
  const stages = insights.mainFlow ? uniqueMainFlowStages(insights.mainFlow).slice(0, 6) : [];
  const folders = (options.folders?.length ? options.folders : foldersFromInsights(insights)).slice(
    0,
    8
  );
  const orphans = (insights.orphanFiles ?? []).slice(0, 4);

  const branches: LearningMindMapBranch[] = [];

  if (entries.length > 0) {
    branches.push({
      id: 'start',
      label: labels.start,
      accent: 'entry',
      children: entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        filePath: entry.filePath,
        startLine: entry.startLine,
        endLine: entry.endLine,
        kind: entry.kind,
        role: 'entry'
      }))
    });
  }

  if (stages.length > 0) {
    branches.push({
      id: 'flow',
      label: labels.flow,
      accent: 'pipeline',
      children: stages.map((stage) => ({
        id: stage.nodeId,
        name: stage.name,
        filePath: stage.filePath || undefined,
        startLine: stage.startLine,
        endLine: stage.endLine,
        role: stage.role
      }))
    });
  }

  if (hubs.length > 0) {
    branches.push({
      id: 'hubs',
      label: labels.hubs,
      accent: 'hub',
      children: hubs.map((hub) => ({
        id: hub.id,
        name: hub.name,
        filePath: hub.filePath,
        startLine: hub.startLine,
        endLine: hub.endLine,
        kind: hub.kind,
        role: 'hub'
      }))
    });
  }

  if (folders.length > 0) {
    branches.push({
      id: 'modules',
      label: labels.modules,
      accent: 'modules',
      children: folders.map((folder, index) => ({
        id: `folder:${folder}:${index}`,
        name: folder,
        role: 'module'
      }))
    });
  }

  if (orphans.length > 0) {
    branches.push({
      id: 'later',
      label: labels.later,
      accent: 'later',
      children: orphans.map((orphan) => ({
        id: orphan.id,
        name: orphan.name,
        filePath: orphan.filePath,
        startLine: orphan.startLine,
        endLine: orphan.endLine,
        kind: orphan.kind
      }))
    });
  }

  if (branches.length === 0) {
    branches.push({
      id: 'start',
      label: labels.empty,
      accent: 'entry',
      children: []
    });
  }

  const mermaid = buildLearningMindMapMermaid(insights, options);

  return {
    rootTitle,
    subtitle: labels.subtitle(entries.length, hubs.length),
    branches,
    mermaid,
    stats: {
      entryCount: entries.length,
      hubCount: hubs.length,
      stageCount: stages.length,
      moduleCount: folders.length
    }
  };
}

/**
 * Mind map pecahan belajar: mulai dari entry → alur utama → hub → modul folder.
 * Mermaid mindmap (indent-based) — kept for Copy/Source.
 */
export function buildLearningMindMapMermaid(
  insights: GraphInsights,
  options: LearningMindMapOptions = {}
): string {
  const lang = options.lang ?? 'id';
  const labels = branchLabels(lang);
  const root = options.rootTitle || labels.root;

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
