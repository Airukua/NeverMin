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

/**
 * Light: cool ink canvas + teal accent.
 * Avoids purple-gradient / cream-terracotta defaults.
 */
export const LIGHT_GRAPH_THEME: GraphThemePalette = {
  mode: 'light',
  bg: '#EEF2F6',
  bgAccentA: 'rgba(15, 118, 110, 0.07)',
  bgAccentB: 'rgba(30, 64, 175, 0.05)',
  panel: '#F8FAFC',
  panelSolid: '#FFFFFF',
  header: 'rgba(248, 250, 252, 0.94)',
  border: 'rgba(15, 23, 42, 0.10)',
  text: '#0F172A',
  muted: '#64748B',
  accent: '#0F766E',
  warn: '#B45309',
  error: '#DC2626',
  inputBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  badgeBg: '#E2E8F0',
  nodeLabel: '#0F172A',
  nodeOutline: 'rgba(255, 255, 255, 0.9)',
  edgeLabel: '#334155',
  edgeLabelBg: 'rgba(255, 255, 255, 0.92)',
  function: '#1D4ED8',
  class: '#0F766E',
  method: '#0369A1',
  file: '#FFFFFF',
  fileBorder: '#0F766E',
  fileText: '#134E4A',
  variable: '#4D7C0F',
  imports: '#1D4ED8',
  calls: '#0F766E',
  uses: '#7C3AED',
  extends: '#BE185D',
  defines: '#CBD5E1',
  selection: '#0F172A'
};

/** Dark: deep slate with teal/cyan accents. */
export const DARK_GRAPH_THEME: GraphThemePalette = {
  mode: 'dark',
  bg: '#0B1220',
  bgAccentA: 'rgba(45, 212, 191, 0.10)',
  bgAccentB: 'rgba(96, 165, 250, 0.08)',
  panel: 'rgba(8, 12, 20, 0.94)',
  panelSolid: '#111827',
  header: 'rgba(10, 15, 25, 0.94)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#E2E8F0',
  muted: '#94A3B8',
  accent: '#2DD4BF',
  warn: '#F59E0B',
  error: '#EF4444',
  inputBg: 'rgba(255, 255, 255, 0.04)',
  cardBg: 'rgba(15, 23, 42, 0.88)',
  badgeBg: 'rgba(30, 41, 59, 0.9)',
  nodeLabel: '#E2E8F0',
  nodeOutline: 'rgba(0, 0, 0, 0.7)',
  edgeLabel: '#CBD5E1',
  edgeLabelBg: 'rgba(8, 12, 20, 0.88)',
  function: '#60A5FA',
  class: '#2DD4BF',
  method: '#38BDF8',
  file: 'rgba(45, 212, 191, 0.10)',
  fileBorder: 'rgba(45, 212, 191, 0.55)',
  fileText: '#99F6E4',
  variable: '#A3E635',
  imports: '#60A5FA',
  calls: '#2DD4BF',
  uses: '#C4B5FD',
  extends: '#F472B6',
  defines: 'rgba(148, 163, 184, 0.45)',
  selection: '#F8FAFC'
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
        radial-gradient(ellipse 80% 50% at 100% -10%, var(--bg-accent-a), transparent 55%),
        radial-gradient(ellipse 60% 40% at -10% 110%, var(--bg-accent-b), transparent 50%),
        var(--bg);
      background-attachment: fixed;
    }
    body[data-theme="light"] { color-scheme: light; }
    body[data-theme="dark"] { color-scheme: dark; }
    #graph {
      background-image:
        radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--text) 6%, transparent) 1px, transparent 0);
      background-size: 28px 28px;
    }
    body[data-theme="light"] #graph {
      background-image:
        radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.045) 1px, transparent 0);
      background-size: 28px 28px;
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
            width: 56,
            height: 26,
            'font-size': 10,
            'font-weight': 600,
            'font-family': 'ui-sans-serif, system-ui, sans-serif',
            'text-wrap': 'ellipsis',
            'text-max-width': 50,
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': theme.function,
            'border-width': 0,
            'text-outline-width': 0,
            'overlay-padding': 6,
            'transition-property': 'opacity, border-width, width, height',
            'transition-duration': '120ms'
          }
        },
        {
          selector: 'node[kind = "function"]',
          style: {
            'background-color': theme.function,
            shape: 'round-rectangle',
            width: 72,
            height: 28,
            'text-max-width': 64
          }
        },
        {
          selector: 'node[kind = "class"]',
          style: {
            'background-color': theme.class,
            shape: 'round-rectangle',
            width: 68,
            height: 28,
            'text-max-width': 60
          }
        },
        {
          selector: 'node[kind = "method"]',
          style: {
            'background-color': theme.method,
            shape: 'round-rectangle',
            width: 58,
            height: 24,
            'font-size': 9,
            'text-max-width': 50
          }
        },
        {
          selector: 'node[kind = "variable"]',
          style: {
            'background-color': theme.variable,
            shape: 'round-rectangle',
            width: 52,
            height: 22,
            'font-size': 9,
            'text-max-width': 44
          }
        },
        {
          selector: 'node[kind = "file"]',
          style: {
            'background-color': isLight ? '#FFFFFF' : theme.file,
            shape: 'round-rectangle',
            width: 'mapData(degree, 0, 12, 112, 168)',
            height: 'mapData(degree, 0, 12, 38, 48)',
            'font-size': 11,
            'font-weight': 700,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-max-width': 148,
            'border-width': 1.5,
            'border-color': theme.fileBorder,
            color: theme.fileText,
            'text-outline-width': 0,
            'background-opacity': 1,
            'underlay-color': theme.fileBorder,
            'underlay-opacity': isLight ? 0.08 : 0.16,
            'underlay-padding': 4
          }
        },
        { selector: 'node.cy-hide-label', style: { label: '' } },
        {
          selector: 'edge',
          style: {
            width: 1.4,
            'line-color': theme.muted,
            'target-arrow-color': theme.muted,
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.7,
            'curve-style': 'bezier',
            'control-point-step-size': 56,
            opacity: 0.42,
            label: '',
            'font-size': 8,
            'font-weight': 600,
            color: theme.edgeLabel,
            'text-rotation': 'autorotate',
            'text-margin-y': -7,
            'text-background-color': theme.edgeLabelBg,
            'text-background-opacity': 0.92,
            'text-background-padding': 2,
            'text-background-shape': 'roundrectangle',
            'transition-property': 'opacity, width',
            'transition-duration': '120ms'
          }
        },
        {
          selector: 'edge.cy-overview-edge',
          style: {
            'curve-style': 'round-taxi',
            'taxi-direction': 'auto',
            'taxi-turn': 24,
            'taxi-turn-min-distance': 16,
            width: 'mapData(weight, 1, 8, 1.6, 3.2)',
            opacity: 0.55
          }
        },
        {
          selector: 'edge[label = "imports"], edge[kind = "imports"]',
          style: { 'line-color': theme.imports, 'target-arrow-color': theme.imports }
        },
        {
          selector: 'edge[label = "calls"], edge[kind = "calls"]',
          style: { 'line-color': theme.calls, 'target-arrow-color': theme.calls }
        },
        {
          selector: 'edge[label = "uses"], edge[kind = "uses"]',
          style: { 'line-color': theme.uses, 'target-arrow-color': theme.uses, opacity: 0.38 }
        },
        {
          selector: 'edge[label = "extends"], edge[kind = "extends"]',
          style: { 'line-color': theme.extends, 'target-arrow-color': theme.extends }
        },
        {
          selector: 'edge[label = "defines"], edge[kind = "defines"]',
          style: { display: 'none' }
        },
        {
          selector: 'edge.cy-show-label',
          style: { label: 'data(label)', opacity: 0.9 }
        },
        { selector: '.cy-node-hidden', style: { display: 'none' } },
        { selector: '.cy-edge-hidden', style: { display: 'none' } },
        {
          selector: '.cy-faded',
          style: { opacity: 0.14 }
        },
        {
          selector: '.cy-node-match',
          style: {
            'border-width': 2.5,
            'border-color': theme.selection,
            label: 'data(label)',
            opacity: 1
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 2.5,
            'border-color': theme.selection,
            'overlay-color': theme.accent,
            'overlay-opacity': 0.16,
            label: 'data(label)',
            opacity: 1
          }
        },
        {
          selector: 'edge:selected',
          style: {
            label: 'data(label)',
            opacity: 1,
            width: 2.8
          }
        },
        {
          selector: 'node:active',
          style: { label: 'data(label)', opacity: 1 }
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
