export type GraphThemeMode = 'light' | 'dark';

export interface GraphThemePalette {
  mode: GraphThemeMode;
  bg: string;
  bgAccentA: string;
  bgAccentB: string;
  panel: string;
  panelSolid: string;
  header: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  warn: string;
  error: string;
  inputBg: string;
  cardBg: string;
  badgeBg: string;
  nodeLabel: string;
  nodeOutline: string;
  edgeLabel: string;
  edgeLabelBg: string;
  function: string;
  class: string;
  method: string;
  file: string;
  fileBorder: string;
  fileText: string;
  variable: string;
  imports: string;
  calls: string;
  uses: string;
  extends: string;
  defines: string;
  selection: string;
}

/** Light: paper-cool dashboard with soft file cards and distinct semantic hues. */
export const LIGHT_GRAPH_THEME: GraphThemePalette = {
  mode: 'light',
  bg: '#F5F8FC',
  bgAccentA: 'rgba(37, 99, 235, 0.06)',
  bgAccentB: 'rgba(13, 148, 136, 0.05)',
  panel: '#FFFFFF',
  panelSolid: '#FFFFFF',
  header: '#FFFFFF',
  border: 'rgba(15, 23, 42, 0.10)',
  text: '#0F172A',
  muted: '#64748B',
  accent: '#2563EB',
  warn: '#B45309',
  error: '#DC2626',
  inputBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  badgeBg: '#F1F5F9',
  nodeLabel: '#0F172A',
  nodeOutline: 'rgba(255, 255, 255, 0.95)',
  edgeLabel: '#334155',
  edgeLabelBg: 'rgba(255, 255, 255, 0.92)',
  function: '#2563EB',
  class: '#7C3AED',
  method: '#0D9488',
  file: '#FFFFFF',
  fileBorder: '#F97316',
  fileText: '#9A3412',
  variable: '#15803D',
  imports: '#2563EB',
  calls: '#059669',
  uses: '#7C3AED',
  extends: '#DB2777',
  defines: '#CBD5E1',
  selection: '#0F172A'
};

/** Dark: keep existing night look with matched semantic hues. */
export const DARK_GRAPH_THEME: GraphThemePalette = {
  mode: 'dark',
  bg: '#0B1220',
  bgAccentA: 'rgba(87, 166, 255, 0.14)',
  bgAccentB: 'rgba(245, 158, 11, 0.1)',
  panel: 'rgba(8, 12, 20, 0.92)',
  panelSolid: '#111827',
  header: 'rgba(10, 15, 25, 0.92)',
  border: 'rgba(148, 163, 184, 0.22)',
  text: '#E2E8F0',
  muted: '#94A3B8',
  accent: '#57A6FF',
  warn: '#F59E0B',
  error: '#EF4444',
  inputBg: 'rgba(255, 255, 255, 0.04)',
  cardBg: 'rgba(11, 15, 24, 0.82)',
  badgeBg: 'rgba(17, 24, 39, 0.86)',
  nodeLabel: '#E2E8F0',
  nodeOutline: 'rgba(0, 0, 0, 0.75)',
  edgeLabel: '#CBD5E1',
  edgeLabelBg: 'rgba(8, 12, 20, 0.85)',
  function: '#57A6FF',
  class: '#8B5CF6',
  method: '#14B8A6',
  file: 'rgba(245, 158, 11, 0.16)',
  fileBorder: 'rgba(251, 191, 36, 0.65)',
  fileText: '#FCD34D',
  variable: '#22C55E',
  imports: '#57A6FF',
  calls: '#34D399',
  uses: '#A78BFA',
  extends: '#F472B6',
  defines: 'rgba(148, 163, 184, 0.55)',
  selection: '#FFFFFF'
};

export function getGraphTheme(mode: GraphThemeMode): GraphThemePalette {
  return mode === 'light' ? LIGHT_GRAPH_THEME : DARK_GRAPH_THEME;
}

export function themeToCssVars(theme: GraphThemePalette): string {
  return [
    `--bg: ${theme.bg};`,
    `--bg-accent-a: ${theme.bgAccentA};`,
    `--bg-accent-b: ${theme.bgAccentB};`,
    `--panel: ${theme.panel};`,
    `--panel-solid: ${theme.panelSolid};`,
    `--header: ${theme.header};`,
    `--border: ${theme.border};`,
    `--text: ${theme.text};`,
    `--muted: ${theme.muted};`,
    `--accent: ${theme.accent};`,
    `--warn: ${theme.warn};`,
    `--error: ${theme.error};`,
    `--input-bg: ${theme.inputBg};`,
    `--card-bg: ${theme.cardBg};`,
    `--badge-bg: ${theme.badgeBg};`,
    `--imports: ${theme.imports};`,
    `--calls: ${theme.calls};`,
    `--uses: ${theme.uses};`,
    `--defines: ${theme.defines};`,
    `--extends: ${theme.extends};`,
    `--file: ${theme.file};`,
    `--file-border: ${theme.fileBorder};`,
    `--file-text: ${theme.fileText};`,
    `--function: ${theme.function};`,
    `--class: ${theme.class};`,
    `--method: ${theme.method};`,
    `--variable: ${theme.variable};`
  ].join('\n      ');
}

/** Serialized into webview JS so Cytoscape styles can switch with the theme. */
export function themeToJsObject(theme: GraphThemePalette): string {
  return JSON.stringify(theme);
}

export function getSharedGraphUiCss(): string {
  return `
    html, body {
      margin: 0;
      height: 100%;
      color: var(--text);
      background:
        radial-gradient(circle at top right, var(--bg-accent-a), transparent 34%),
        radial-gradient(circle at bottom left, var(--bg-accent-b), transparent 28%),
        var(--bg);
      background-attachment: fixed;
    }
    body[data-theme="light"] {
      color-scheme: light;
    }
    body[data-theme="dark"] {
      color-scheme: dark;
    }
    #graph {
      background-image:
        radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--text) 8%, transparent) 1px, transparent 0);
      background-size: 22px 22px;
    }
    body[data-theme="light"] #graph {
      background-image:
        radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.06) 1px, transparent 0);
      background-size: 22px 22px;
    }
  `;
}

export function getCytoscapeStyleBuilderScript(): string {
  return `
    function buildCytoscapeStyles(theme) {
      const isLight = theme.mode === 'light';
      return [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            cursor: 'pointer',
            color: '#FFFFFF',
            width: 52,
            height: 24,
            'font-size': 10,
            'font-weight': 650,
            'text-wrap': 'ellipsis',
            'text-max-width': 46,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-margin-y': 0,
            'background-color': theme.function,
            'border-width': 0,
            'text-outline-width': 0,
            'overlay-padding': 4
          }
        },
        {
          selector: 'node[kind = "function"]',
          style: {
            'background-color': theme.function,
            shape: 'round-rectangle',
            width: 64,
            height: 26
          }
        },
        {
          selector: 'node[kind = "class"]',
          style: {
            'background-color': theme.class,
            shape: 'round-rectangle',
            width: 58,
            height: 26
          }
        },
        {
          selector: 'node[kind = "method"]',
          style: {
            'background-color': theme.method,
            shape: 'round-rectangle',
            width: 52,
            height: 22,
            'font-size': 9,
            'text-max-width': 44
          }
        },
        {
          selector: 'node[kind = "variable"]',
          style: {
            'background-color': theme.variable,
            shape: 'round-rectangle',
            width: 48,
            height: 20,
            'font-size': 9,
            'text-max-width': 40
          }
        },
        {
          selector: 'node[kind = "file"]',
          style: {
            'background-color': isLight ? '#FFFFFF' : theme.file,
            shape: 'round-rectangle',
            width: 124,
            height: 36,
            padding: 0,
            'font-size': 11,
            'font-weight': 700,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-margin-y': 0,
            'text-max-width': 112,
            'border-width': 2,
            'border-color': theme.fileBorder,
            color: theme.fileText,
            'text-outline-width': 0,
            'background-opacity': 1,
            'underlay-color': theme.fileBorder,
            'underlay-opacity': isLight ? 0.12 : 0.2,
            'underlay-padding': 3
          }
        },
        { selector: 'node.cy-hide-label', style: { label: '' } },
        {
          selector: 'edge',
          style: {
            width: 1.8,
            'line-color': theme.muted,
            'target-arrow-color': theme.muted,
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.75,
            'curve-style': 'bezier',
            'control-point-step-size': 48,
            opacity: 0.72,
            label: '',
            'font-size': 8,
            'font-weight': 600,
            color: theme.edgeLabel,
            'text-rotation': 'autorotate',
            'text-margin-y': -6,
            'text-background-color': theme.edgeLabelBg,
            'text-background-opacity': 0.95,
            'text-background-padding': 2,
            'text-background-shape': 'roundrectangle'
          }
        },
        {
          selector: 'edge[label = "imports"]',
          style: { 'line-color': theme.imports, 'target-arrow-color': theme.imports, width: 2, opacity: 0.8 }
        },
        {
          selector: 'edge[label = "calls"]',
          style: { 'line-color': theme.calls, 'target-arrow-color': theme.calls, width: 2, opacity: 0.8 }
        },
        {
          selector: 'edge[label = "uses"]',
          style: { 'line-color': theme.uses, 'target-arrow-color': theme.uses, width: 1.6, opacity: 0.7 }
        },
        {
          selector: 'edge[label = "extends"]',
          style: { 'line-color': theme.extends, 'target-arrow-color': theme.extends, width: 2, opacity: 0.8 }
        },
        {
          selector: 'edge[label = "defines"]',
          style: { display: 'none' }
        },
        {
          selector: 'edge.cy-show-label',
          style: { label: 'data(label)' }
        },
        { selector: '.cy-node-hidden', style: { display: 'none' } },
        { selector: '.cy-edge-hidden', style: { display: 'none' } },
        {
          selector: '.cy-node-match',
          style: {
            'border-width': 3,
            'border-color': theme.selection,
            label: 'data(label)'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': theme.selection,
            'overlay-color': theme.accent,
            'overlay-opacity': 0.14,
            label: 'data(label)'
          }
        },
        {
          selector: 'edge:selected',
          style: {
            label: 'data(label)',
            opacity: 1,
            width: 2.6
          }
        },
        {
          selector: 'node:active',
          style: { label: 'data(label)' }
        }
      ];
    }

    function applyThemeToDocument(theme) {
      document.body.dataset.theme = theme.mode;
      const root = document.documentElement;
      root.style.setProperty('--bg', theme.bg);
      root.style.setProperty('--bg-accent-a', theme.bgAccentA);
      root.style.setProperty('--bg-accent-b', theme.bgAccentB);
      root.style.setProperty('--panel', theme.panel);
      root.style.setProperty('--panel-solid', theme.panelSolid);
      root.style.setProperty('--header', theme.header);
      root.style.setProperty('--border', theme.border);
      root.style.setProperty('--text', theme.text);
      root.style.setProperty('--muted', theme.muted);
      root.style.setProperty('--accent', theme.accent);
      root.style.setProperty('--warn', theme.warn);
      root.style.setProperty('--error', theme.error);
      root.style.setProperty('--input-bg', theme.inputBg);
      root.style.setProperty('--card-bg', theme.cardBg);
      root.style.setProperty('--badge-bg', theme.badgeBg);
      root.style.setProperty('--imports', theme.imports);
      root.style.setProperty('--calls', theme.calls);
      root.style.setProperty('--uses', theme.uses);
      root.style.setProperty('--defines', theme.defines);
      root.style.setProperty('--extends', theme.extends);
      root.style.setProperty('--file', theme.file);
      root.style.setProperty('--file-border', theme.fileBorder);
      root.style.setProperty('--file-text', theme.fileText);
      root.style.setProperty('--function', theme.function);
      root.style.setProperty('--class', theme.class);
      root.style.setProperty('--method', theme.method);
      root.style.setProperty('--variable', theme.variable);
    }

    function applyThemeToGraph(theme) {
      applyThemeToDocument(theme);
      if (!cy) {
        return;
      }
      cy.style().fromJson(buildCytoscapeStyles(theme)).update();
    }
  `;
}
