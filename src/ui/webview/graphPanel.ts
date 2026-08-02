import path from 'path';
import * as vscode from 'vscode';
import { CodeGraph, GraphNode } from '../../core/graph/types';
import { GraphInsights } from '../../core/graph/graphInsights';
import { buildGraphPayload, WebviewGraphPayload } from './graphPayload';
import { openGraphInExternalBrowser } from './standaloneGraphHtml';
import {
  DARK_GRAPH_THEME,
  LIGHT_GRAPH_THEME,
  getCytoscapeStyleBuilderScript,
  getSharedGraphUiCss,
  themeToCssVars,
  themeToJsObject
} from './graphTheme';
import { MARKDOWN_LITE_WEBVIEW_SCRIPT } from './markdownLite';

interface WebviewToExtensionMessage {
  type: 'nodeClick' | 'openExternal';
  node?: Partial<GraphNode>;
}

interface ExtensionToWebviewMessage {
  type: 'setGraph' | 'setState';
  graph?: WebviewGraphPayload;
  insights?: GraphInsights | null;
  state?: GraphPanelState;
  message?: string;
}

export type GraphPanelState = 'loading' | 'empty' | 'error' | 'ready';

export interface GraphPanelOptions {
  state?: GraphPanelState;
  message?: string;
  insights?: GraphInsights;
}

const panelGraphPayloads = new WeakMap<vscode.WebviewPanel, WebviewGraphPayload>();
const panelInsights = new WeakMap<vscode.WebviewPanel, GraphInsights>();

export function createGraphPanel(
  extensionUri: vscode.Uri,
  graph: CodeGraph,
  onNodeClick?: (node: GraphNode) => void | Promise<void>,
  options: GraphPanelOptions = {}
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'nevermin.graph',
    'NeverMIN — Code Graph',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'media'),
        vscode.Uri.file(path.dirname(require.resolve('cytoscape/dist/cytoscape.min.js')))
      ]
    }
  );

  const initialPayload = buildGraphPayload(graph);
  panelGraphPayloads.set(panel, initialPayload);
  if (options.insights) {
    panelInsights.set(panel, options.insights);
  }
  panel.webview.html = renderHtml(
    panel.webview,
    graph,
    options.state ?? (graph.nodes.length > 0 ? 'ready' : 'empty'),
    options.message,
    options.insights
  );

  panel.webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage) => {
    if (msg.type === 'openExternal') {
      const payload = panelGraphPayloads.get(panel);
      if (!payload) {
        vscode.window.showWarningMessage('Belum ada graph untuk dibuka di browser.');
        return;
      }

      await openGraphInExternalBrowser(payload, panelInsights.get(panel));
      return;
    }

    if (msg.type !== 'nodeClick') {
      return;
    }

    if (!msg.node) {
      vscode.window.showWarningMessage('NeverMIN menerima node graph yang tidak lengkap.');
      return;
    }

    if (onNodeClick) {
      await onNodeClick(msg.node as GraphNode);
      return;
    }

    await revealAndExplainNode(msg.node as GraphNode);
  });

  return panel;
}

export async function updateGraphPanel(
  panel: vscode.WebviewPanel,
  graph: CodeGraph,
  options: GraphPanelOptions = {}
): Promise<void> {
  const payload = buildGraphPayload(graph);
  panelGraphPayloads.set(panel, payload);
  if (options.insights) {
    panelInsights.set(panel, options.insights);
  }
  await panel.webview.postMessage({
    type: 'setGraph',
    graph: payload,
    insights: options.insights ?? null,
    state: options.state ?? (graph.nodes.length > 0 ? 'ready' : 'empty'),
    message: options.message
  } satisfies ExtensionToWebviewMessage);
}

export async function setGraphPanelState(
  panel: vscode.WebviewPanel,
  state: GraphPanelState,
  message?: string
): Promise<void> {
  await panel.webview.postMessage({
    type: 'setState',
    state,
    message
  } satisfies ExtensionToWebviewMessage);
}

export function resolveGraphNodeUri(node: Partial<GraphNode> | undefined): vscode.Uri | null {
  const candidate = typeof node?.filePath === 'string' && node.filePath.trim().length > 0
    ? node.filePath.trim()
    : typeof node?.id === 'string'
      ? node.id.trim()
      : '';

  if (!candidate) {
    return null;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate) || candidate.startsWith('file:')) {
    return vscode.Uri.parse(candidate);
  }

  return vscode.Uri.file(candidate);
}

function renderHtml(
  webview: vscode.Webview,
  graph: CodeGraph,
  initialState: GraphPanelState,
  initialMessage?: string,
  initialInsights?: GraphInsights
): string {
  const nonce = getNonce();
  const cytoscapePath = require.resolve('cytoscape/dist/cytoscape.min.js');
  const cytoscapeUri = webview.asWebviewUri(vscode.Uri.file(cytoscapePath));
  const graphPayload = JSON.stringify(buildGraphPayload(graph));
  const insightsPayload = JSON.stringify(initialInsights ?? null);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src ${webview.cspSource};
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src ${webview.cspSource} 'nonce-${nonce}';
  ">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <style>
    :root {
      ${themeToCssVars(LIGHT_GRAPH_THEME)}
    }
    ${getSharedGraphUiCss()}
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
    }
    .shell {
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      background: var(--header);
    }
    .title-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
    .title {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .subtitle {
      margin-top: 3px;
      color: var(--muted);
      font-size: 12px;
    }
    .left {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }
    .searchbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .searchbar input {
      width: min(360px, 52vw);
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--input-bg);
      color: var(--text);
      padding: 8px 12px;
      outline: none;
    }
    .searchbar input::placeholder {
      color: var(--muted);
    }
    .searchbar button {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--input-bg);
      color: var(--text);
      padding: 8px 12px;
      cursor: pointer;
      font-size: 12px;
    }
    .searchbar button:hover {
      background: color-mix(in srgb, var(--accent) 10%, var(--input-bg));
    }
    .searchbar button.primary {
      border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      color: var(--accent);
      font-weight: 600;
    }
    .legend-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      align-items: center;
    }
    .legend,
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      color: var(--muted);
      font-size: 11px;
    }
    .legend span,
    .swatches span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 9px;
      border-radius: 999px;
      background: var(--card-bg);
      border: 1px solid var(--border);
    }
    .legend i {
      width: 14px;
      height: 2px;
      border-radius: 999px;
      display: inline-block;
    }
    .legend .imports { background: var(--imports); }
    .legend .calls { background: var(--calls); }
    .legend .uses { background: var(--uses); }
    .legend .defines {
      background: transparent;
      border-top: 2px dashed var(--defines);
      height: 0;
      width: 14px;
    }
    .legend .extends { background: var(--extends); }
    .swatches i {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      display: inline-block;
    }
    .swatches .file {
      background: var(--file);
      border: 1.5px solid var(--file-border);
      border-radius: 3px;
    }
    .swatches .function { background: var(--function); border-radius: 3px; }
    .swatches .class { background: var(--class); }
    .swatches .method { background: var(--method); border-radius: 3px; }
    .swatches .variable { background: var(--variable); border-radius: 3px; }
    .badge {
      padding: 6px 11px;
      border-radius: 999px;
      font-size: 12px;
      background: var(--badge-bg);
      border: 1px solid var(--border);
      color: var(--muted);
      white-space: nowrap;
      align-self: flex-start;
    }
    .content {
      position: relative;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
    }
    .graph-area {
      position: relative;
      min-width: 0;
      min-height: 0;
    }
    #graph {
      width: 100%;
      height: 100%;
      display: none;
    }
    .zoom-toolbar {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 4;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 4px;
      border-radius: 12px;
      background: var(--panel-solid);
      border: 1px solid var(--border);
      box-shadow: 0 8px 24px color-mix(in srgb, var(--text) 8%, transparent);
    }
    .zoom-toolbar button {
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
    }
    .zoom-toolbar button:hover {
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      color: var(--accent);
    }
    .insights {
      border-left: 1px solid var(--border);
      background: var(--panel);
      overflow: auto;
      padding: 14px 14px 20px;
    }
    .insights h2 {
      margin: 0 0 8px;
      font-size: 14px;
    }
    .insights .muted,
    .insights .md-body {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.55;
      margin: 0 0 12px;
    }
    .insights .md-body {
      color: var(--text);
    }
    .insights .md-body p {
      margin: 0 0 10px;
      color: var(--text);
    }
    .insights .md-body h3,
    .insights .md-body h4,
    .insights .md-body h5 {
      margin: 12px 0 6px;
      font-size: 12px;
      color: var(--text);
      letter-spacing: 0.02em;
    }
    .insights .md-body ul {
      margin: 0 0 10px;
      padding-left: 18px;
    }
    .insights .md-body li {
      margin: 0 0 6px;
      color: var(--text);
    }
    .insights .md-body strong {
      color: var(--text);
      font-weight: 700;
    }
    .insights .md-body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      padding: 1px 5px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--accent) 12%, var(--input-bg));
      border: 1px solid var(--border);
    }
    .insights h3 {
      margin: 16px 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    .node-detail {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--card-bg);
      padding: 12px;
      font-size: 12px;
      line-height: 1.5;
      color: var(--text);
      min-height: 72px;
    }
    .node-detail.empty,
    .node-detail .placeholder {
      color: var(--muted);
    }
    .node-detail dl {
      margin: 0;
    }
    .node-detail dt {
      color: var(--muted);
      font-size: 11px;
      margin-top: 8px;
    }
    .node-detail dt:first-child {
      margin-top: 0;
    }
    .node-detail dd {
      margin: 2px 0 0;
      word-break: break-all;
      font-weight: 600;
    }
    .insight-list,
    .flow-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .insight-item {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--card-bg);
      color: var(--text);
      text-align: left;
      padding: 8px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .insight-item:hover,
    .insight-item.active {
      border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
      background: color-mix(in srgb, var(--accent) 10%, transparent);
    }
    .insight-item small,
    .flow-card small {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 400;
    }
    .flow-card {
      border: 1px solid var(--border);
      border-left-width: 4px;
      border-radius: 10px;
      background: var(--card-bg);
      color: var(--text);
      text-align: left;
      padding: 10px 12px;
      cursor: pointer;
      font-size: 12px;
      box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 4%, transparent);
    }
    .flow-card:hover,
    .flow-card.active {
      background: color-mix(in srgb, var(--accent) 6%, var(--card-bg));
    }
    .flow-card.flow-imports { border-left-color: var(--imports); }
    .flow-card.flow-calls { border-left-color: var(--calls); }
    .flow-card.flow-uses { border-left-color: var(--uses); }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .stat-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 11px;
      border-radius: 12px;
      background: var(--card-bg);
      border: 1px solid var(--border);
    }
    .stat-card strong {
      display: block;
      font-size: 16px;
      line-height: 1.2;
      color: var(--text);
    }
    .stat-card small {
      color: var(--muted);
      font-size: 11px;
    }
    .stat-icon {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .stat-icon.nodes { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); }
    .stat-icon.edges { background: color-mix(in srgb, var(--calls) 16%, transparent); color: var(--calls); }
    .stat-icon.files { background: color-mix(in srgb, var(--file-text) 14%, transparent); color: var(--file-text); }
    .stat-icon.functions { background: color-mix(in srgb, var(--class) 16%, transparent); color: var(--class); }
    .tip-box {
      margin-top: 16px;
      padding: 12px 13px;
      border-radius: 12px;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      color: #1E40AF;
      font-size: 12px;
      line-height: 1.45;
    }
    body[data-theme="dark"] .tip-box {
      background: rgba(87, 166, 255, 0.12);
      border-color: rgba(87, 166, 255, 0.35);
      color: #BFDBFE;
    }
    @media (max-width: 900px) {
      .content {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr auto;
      }
      .insights {
        border-left: none;
        border-top: 1px solid var(--border);
        max-height: 260px;
      }
    }
    .state {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      z-index: 3;
      background: color-mix(in srgb, var(--bg) 82%, transparent);
    }
    .card {
      max-width: 420px;
      padding: 24px 22px;
      border-radius: 18px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      box-shadow: 0 20px 60px color-mix(in srgb, var(--text) 18%, transparent);
    }
    .card h2 {
      margin: 0 0 10px;
      font-size: 18px;
    }
    .card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }
    .loading-dots {
      display: inline-flex;
      gap: 6px;
      margin-top: 16px;
    }
    .loading-dots span {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent);
      animation: bounce 1s infinite ease-in-out;
    }
    .loading-dots span:nth-child(2) { animation-delay: 0.12s; }
    .loading-dots span:nth-child(3) { animation-delay: 0.24s; }
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
      40% { transform: translateY(-6px); opacity: 1; }
    }
    .state[data-state="loading"] { display: flex; }
    .state[data-state="empty"] { display: flex; }
    .state[data-state="error"] { display: flex; }
    .state.error .card { border-color: color-mix(in srgb, var(--error) 65%, var(--border)); }
    .state.empty .card { border-color: color-mix(in srgb, var(--warn) 65%, var(--border)); }
    .hint {
      margin-top: 14px;
      display: inline-flex;
      gap: 8px;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
    }
    .hint code {
      padding: 2px 6px;
      border-radius: 999px;
      background: var(--badge-bg);
    }
  </style>
</head>
<body data-theme="light">
  <div class="shell">
    <div class="header">
      <div class="left">
        <div class="title-row">
          <div>
            <div class="title">NeverMIN Code Graph</div>
            <div class="subtitle">Default: Mode Ringkas (file + relasi antar file). Pakai Mode Detail untuk symbol, atau Browser untuk layar penuh.</div>
          </div>
          <div class="badge" id="badge">${graph.nodes.length} node · ${graph.edges.length} edge</div>
        </div>
        <div class="legend-row">
          <div class="legend" aria-label="Legenda relasi">
            <span><i class="imports"></i>imports</span>
            <span><i class="calls"></i>calls</span>
            <span><i class="uses"></i>uses / JSX</span>
            <span><i class="defines"></i>defines</span>
            <span><i class="extends"></i>extends</span>
          </div>
          <div class="swatches" aria-label="Jenis node">
            <span><i class="file"></i>file</span>
            <span><i class="function"></i>function</span>
            <span><i class="class"></i>class</span>
            <span><i class="method"></i>method</span>
            <span><i class="variable"></i>variable</span>
          </div>
        </div>
        <div class="searchbar">
          <input id="searchInput" type="search" placeholder="Cari file atau symbol..." aria-label="Cari file atau symbol" />
          <button id="viewModeToggle" class="primary" type="button" title="Ganti tampilan ringkas/detail">Mode Detail</button>
          <button id="fitView" class="primary" type="button" title="Tampilkan seluruh graph">View Utuh</button>
          <button id="openExternal" class="primary" type="button" title="Buka graph di browser">Buka di Browser</button>
          <button id="themeToggle" type="button" title="Ganti tema terang/gelap">Mode Gelap</button>
        </div>
      </div>
    </div>
    <div class="content">
      <div class="graph-area">
        <div class="zoom-toolbar" id="zoomToolbar">
          <button type="button" id="zoomIn" title="Zoom in">+</button>
          <button type="button" id="zoomOut" title="Zoom out">−</button>
          <button type="button" id="zoomFit" title="Fit">⤢</button>
        </div>
        <div id="graph"></div>
      </div>
      <aside class="insights" id="insightsPanel">
        <h2>Insights</h2>
        <div class="muted md-body" id="insightsSummary">Jalankan analisis untuk melihat entry point, hub, dan alur utama dari graph.</div>
        <h3>Detail node</h3>
        <div class="node-detail empty" id="nodeDetail"><span class="placeholder">Klik node di graph untuk melihat nama, jenis, file, dan baris.</span></div>
        <h3>Flow utama</h3>
        <div class="flow-list" id="mainFlowList"></div>
        <h3>Key flows</h3>
        <div class="flow-list" id="flowList"></div>
        <h3>Entry points</h3>
        <div class="insight-list" id="entryList"></div>
        <h3>Hubs</h3>
        <div class="insight-list" id="hubList"></div>
        <h3>Statistik</h3>
        <div class="stats-grid" id="statsGrid">
          <div class="stat-card"><span class="stat-icon nodes">N</span><div><strong id="statNodes">0</strong><small>Nodes</small></div></div>
          <div class="stat-card"><span class="stat-icon edges">E</span><div><strong id="statEdges">0</strong><small>Edges</small></div></div>
          <div class="stat-card"><span class="stat-icon files">F</span><div><strong id="statFiles">0</strong><small>Files</small></div></div>
          <div class="stat-card"><span class="stat-icon functions">ƒ</span><div><strong id="statFunctions">0</strong><small>Functions</small></div></div>
        </div>
        <div class="tip-box">Tip: Default Mode Ringkas = file + import antar file. Klik Mode Detail untuk lihat function/symbol. Scroll zoom, drag pan.</div>
      </aside>
      <div class="state" id="loadingState" data-state="loading">
        <div class="card">
          <h2>Menyiapkan graph</h2>
          <p id="loadingMessage">Memuat data dan merender relasi antar symbol.</p>
          <div class="loading-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
      <div class="state empty" id="emptyState" data-state="empty">
        <div class="card">
          <h2>Graph belum punya node</h2>
          <p id="emptyMessage">Jalankan analisis repo atau buka workspace yang berisi symbol agar graph bisa ditampilkan.</p>
          <div class="hint"><code>nevermin.analyzeRepo</code> untuk membangun ringkasan graph.</div>
        </div>
      </div>
      <div class="state error" id="errorState" data-state="error">
        <div class="card">
          <h2>Graph gagal dimuat</h2>
          <p id="errorMessage">Ada masalah saat merender graph.</p>
        </div>
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    ${MARKDOWN_LITE_WEBVIEW_SCRIPT}
    ${getCytoscapeStyleBuilderScript()}
    const THEMES = {
      light: ${themeToJsObject(LIGHT_GRAPH_THEME)},
      dark: ${themeToJsObject(DARK_GRAPH_THEME)}
    };
    let currentThemeMode = localStorage.getItem('nevermin.graphTheme') || 'light';
    let currentTheme = THEMES[currentThemeMode] || THEMES.light;
    if (!THEMES[currentThemeMode]) {
      currentThemeMode = 'light';
    }

    const vscode = acquireVsCodeApi();
    let cy = null;
    let currentGraph = ${graphPayload};
    let currentInsights = ${insightsPayload};
    let currentQuery = '';

    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const graphEl = document.getElementById('graph');
    const badge = document.getElementById('badge');
    const searchInput = document.getElementById('searchInput');
    const fitViewBtn = document.getElementById('fitView');
    const viewModeToggle = document.getElementById('viewModeToggle');
    const openExternalBtn = document.getElementById('openExternal');
    const themeToggle = document.getElementById('themeToggle');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const zoomFitBtn = document.getElementById('zoomFit');
    const insightsSummary = document.getElementById('insightsSummary');
    const nodeDetail = document.getElementById('nodeDetail');
    const entryList = document.getElementById('entryList');
    const hubList = document.getElementById('hubList');
    const mainFlowList = document.getElementById('mainFlowList');
    const flowList = document.getElementById('flowList');
    const statNodes = document.getElementById('statNodes');
    const statEdges = document.getElementById('statEdges');
    const statFiles = document.getElementById('statFiles');
    const statFunctions = document.getElementById('statFunctions');
    const loadingMessage = document.getElementById('loadingMessage');
    const emptyMessage = document.getElementById('emptyMessage');
    const errorMessage = document.getElementById('errorMessage');
    const LABEL_ZOOM_THRESHOLD = 0.85;
    const FLOW_BORDER_KINDS = ['imports', 'calls', 'uses'];
    let viewMode = localStorage.getItem('nevermin.graphViewMode') || 'overview';
    if (viewMode !== 'overview' && viewMode !== 'detail') {
      viewMode = 'overview';
    }

    function updateThemeToggleLabel() {
      if (!themeToggle) {
        return;
      }
      themeToggle.textContent = currentThemeMode === 'light' ? 'Mode Gelap' : 'Mode Terang';
    }

    function updateViewModeToggleLabel() {
      if (!viewModeToggle) {
        return;
      }
      // Tombol menunjukkan mode berikutnya
      viewModeToggle.textContent = viewMode === 'overview' ? 'Mode Detail' : 'Mode Ringkas';
    }

    applyThemeToDocument(currentTheme);
    updateThemeToggleLabel();
    updateViewModeToggleLabel();

    function setState(nextState, message) {
      loadingState.style.display = nextState === 'loading' ? 'flex' : 'none';
      emptyState.style.display = nextState === 'empty' ? 'flex' : 'none';
      errorState.style.display = nextState === 'error' ? 'flex' : 'none';
      graphEl.style.display = nextState === 'ready' ? 'block' : 'none';

      if (message) {
        if (nextState === 'loading') {
          loadingMessage.textContent = message;
        } else if (nextState === 'empty') {
          emptyMessage.textContent = message;
        } else if (nextState === 'error') {
          errorMessage.textContent = message;
        }
      }
    }

    function destroyGraph() {
      if (cy) {
        cy.destroy();
        cy = null;
      }
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function fillNodeDetail(data) {
      if (!nodeDetail || !data) {
        return;
      }
      nodeDetail.classList.remove('empty');
      nodeDetail.innerHTML =
        '<dl>' +
          '<dt>Nama</dt><dd>' + escapeHtml(data.label || data.id || 'Node') + '</dd>' +
          '<dt>Jenis</dt><dd>' + escapeHtml(data.kind || '-') + '</dd>' +
          '<dt>File</dt><dd>' + escapeHtml(data.filePath || '-') + '</dd>' +
          '<dt>Baris</dt><dd>' + escapeHtml(String(data.startLine || '-') + ' – ' + String(data.endLine || '-')) + '</dd>' +
        '</dl>';
    }

    function resetNodeDetail() {
      if (!nodeDetail) {
        return;
      }
      nodeDetail.classList.add('empty');
      nodeDetail.innerHTML = '<span class="placeholder">Klik node di graph untuk melihat nama, jenis, file, dan baris.</span>';
    }

    function focusNodes(nodeIds) {
      if (!cy || !Array.isArray(nodeIds) || nodeIds.length === 0) {
        return;
      }

      // Insights sering merujuk symbol — buka detail sementara agar node terlihat
      const needsDetail = nodeIds.some((id) => {
        const node = cy.getElementById(id);
        return node.nonempty() && node.data('kind') !== 'file';
      });
      if (needsDetail && viewMode === 'overview') {
        viewMode = 'detail';
        try {
          localStorage.setItem('nevermin.graphViewMode', viewMode);
        } catch (_) {}
        updateViewModeToggleLabel();
        runClusterLayout();
        applySearchFilter({ fit: false });
      }

      const targets = cy.nodes().filter((node) => nodeIds.includes(node.id()));
      if (targets.empty()) {
        return;
      }

      cy.elements().unselect();
      targets.select();
      targets.removeClass('cy-hide-label cy-node-hidden');
      cy.fit(targets, 80);
    }

    function renderInsightButtons(container, items, kind) {
      if (!container) {
        return;
      }

      container.innerHTML = '';
      if (!items || items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'Belum terdeteksi.';
        container.appendChild(empty);
        return;
      }

      items.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = kind === 'flow'
          ? 'flow-card flow-' + FLOW_BORDER_KINDS[container.children.length % FLOW_BORDER_KINDS.length]
          : 'insight-item';
        button.innerHTML = '<strong></strong><small></small>';
        if (kind === 'flow') {
          const processText = Array.isArray(item.process) && item.process.length
            ? item.process.join(' → ')
            : '';
          button.querySelector('strong').textContent = (item.input && item.output)
            ? ('Input: ' + item.input + ' → Output: ' + item.output)
            : (item.label || 'Flow');
          button.querySelector('small').textContent = processText
            ? ('Proses: ' + processText)
            : (item.steps || []).join(' → ');
        } else {
          button.querySelector('strong').textContent = item.name;
          button.querySelector('small').textContent = item.reason || item.filePath || '';
        }
        button.addEventListener('click', () => {
          container.querySelectorAll('button').forEach((el) => el.classList.remove('active'));
          button.classList.add('active');
          if (kind === 'flow') {
            focusNodes(item.nodeIds || []);
          } else {
            focusNodes([item.id]);
          }
        });
        container.appendChild(button);
      });
    }

    function renderStats(insights) {
      const stats = insights && insights.stats ? insights.stats : null;
      const nodeCount = stats ? stats.nodeCount : (currentGraph.nodes || []).length;
      const edgeCount = stats ? stats.edgeCount : (currentGraph.edges || []).length;
      const fileCount = stats && stats.nodesByKind ? (stats.nodesByKind.file || 0) : 0;
      const functionCount = stats && stats.nodesByKind ? (stats.nodesByKind.function || 0) : 0;
      if (statNodes) statNodes.textContent = String(nodeCount);
      if (statEdges) statEdges.textContent = String(edgeCount);
      if (statFiles) statFiles.textContent = String(fileCount);
      if (statFunctions) statFunctions.textContent = String(functionCount);
    }

    function renderInsights(insights) {
      currentInsights = insights;
      if (!insights) {
        if (insightsSummary) {
          insightsSummary.className = 'muted md-body';
          insightsSummary.textContent = 'Jalankan analisis untuk melihat entry point, hub, dan alur utama dari graph.';
        }
        renderInsightButtons(entryList, [], 'ref');
        renderInsightButtons(hubList, [], 'ref');
        renderInsightButtons(mainFlowList, [], 'flow');
        renderInsightButtons(flowList, [], 'flow');
        renderStats(null);
        return;
      }

      if (insightsSummary) {
        const markdownSource = insights.narrative
          || (insights.summaryBullets || []).map((bullet) => '- ' + bullet).join('\\n')
          || 'Insights struktural siap. Klik item untuk fokus ke node.';
        insightsSummary.className = 'md-body';
        insightsSummary.innerHTML = renderMarkdownLite(markdownSource);
      }
      renderInsightButtons(entryList, insights.entryPoints || [], 'ref');
      renderInsightButtons(hubList, insights.hubs || [], 'ref');
      renderInsightButtons(mainFlowList, insights.mainFlow ? [insights.mainFlow] : [], 'flow');
      renderInsightButtons(flowList, insights.keyFlows || [], 'flow');
      renderStats(insights);
    }

    function fitGraph(padding) {
      if (!cy) {
        return;
      }

      cy.resize();
      const visible = cy.nodes(':visible');
      if (visible.length > 0) {
        cy.fit(visible, padding ?? 56);
      } else {
        cy.fit(undefined, padding ?? 56);
      }
    }

    function updateLabelVisibility() {
      if (!cy) {
        return;
      }

      const zoom = cy.zoom();
      const showSymbols = viewMode === 'detail' && (zoom >= LABEL_ZOOM_THRESHOLD || Boolean(currentQuery.trim()));
      cy.batch(() => {
        cy.nodes().forEach((node) => {
          if (node.data('kind') === 'file') {
            node.removeClass('cy-hide-label');
            return;
          }

          if (showSymbols || node.hasClass('cy-node-match') || node.grabbed()) {
            node.removeClass('cy-hide-label');
          } else {
            node.addClass('cy-hide-label');
          }
        });
      });
    }

    function clearOverviewEdges() {
      if (!cy) {
        return;
      }
      cy.edges('.cy-overview-edge').remove();
    }

    function rebuildOverviewEdges() {
      if (!cy) {
        return;
      }

      clearOverviewEdges();
      if (viewMode !== 'overview') {
        return;
      }
      const fileByPath = new Map();
      cy.nodes().forEach((node) => {
        if (node.data('kind') !== 'file') {
          return;
        }
        fileByPath.set(String(node.data('filePath') || node.id()), node.id());
      });

      const seen = new Set();
      const additions = [];
      cy.edges().forEach((edge) => {
        if (edge.hasClass('cy-overview-edge')) {
          return;
        }
        const kind = String(edge.data('label') || '');
        if (kind === 'defines') {
          return;
        }
        const sourcePath = String(edge.source().data('filePath') || '');
        const targetPath = String(edge.target().data('filePath') || '');
        if (!sourcePath || !targetPath || sourcePath === targetPath) {
          return;
        }
        const sourceFileId = fileByPath.get(sourcePath);
        const targetFileId = fileByPath.get(targetPath);
        if (!sourceFileId || !targetFileId) {
          return;
        }
        const key = sourceFileId + '->' + targetFileId + ':' + kind;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        additions.push({
          group: 'edges',
          data: {
            id: 'ov-' + key,
            source: sourceFileId,
            target: targetFileId,
            label: kind
          },
          classes: 'cy-overview-edge'
        });
      });

      if (additions.length > 0) {
        cy.add(additions);
      }
    }

    function applyViewModeClasses() {
      if (!cy) {
        return;
      }

      cy.batch(() => {
        cy.nodes().removeClass('cy-node-hidden');
        cy.edges().removeClass('cy-edge-hidden');

        if (viewMode === 'overview') {
          cy.nodes().forEach((node) => {
            if (node.data('kind') !== 'file') {
              node.addClass('cy-node-hidden');
            }
          });
          cy.edges().forEach((edge) => {
            if (!edge.hasClass('cy-overview-edge')) {
              edge.addClass('cy-edge-hidden');
            }
          });
        } else {
          cy.edges('.cy-overview-edge').addClass('cy-edge-hidden');
        }
      });
    }

    /**
     * Layout: file-connected cluster di atas, orphan file di bawah (grid rapat).
     * Mode detail menaruh symbol di bawah masing-masing file.
     */
    function runClusterLayout() {
      if (!cy) {
        return;
      }

      rebuildOverviewEdges();
      applyViewModeClasses();

      const groups = new Map();
      cy.nodes().forEach((node) => {
        if (node.hasClass('cy-overview-edge')) {
          return;
        }
        const filePath = String(node.data('filePath') || node.id());
        if (!groups.has(filePath)) {
          groups.set(filePath, { file: null, symbols: [], neighbors: new Set() });
        }

        const group = groups.get(filePath);
        if (node.data('kind') === 'file') {
          group.file = node;
        } else {
          group.symbols.push(node);
        }
      });

      const neighborEdges = viewMode === 'overview'
        ? cy.edges('.cy-overview-edge')
        : cy.edges().filter((edge) => !edge.hasClass('cy-overview-edge') && String(edge.data('label')) !== 'defines');

      neighborEdges.forEach((edge) => {
        const sourcePath = String(edge.source().data('filePath') || '');
        const targetPath = String(edge.target().data('filePath') || '');
        if (!sourcePath || !targetPath || sourcePath === targetPath) {
          return;
        }

        if (groups.has(sourcePath) && groups.has(targetPath)) {
          groups.get(sourcePath).neighbors.add(targetPath);
          groups.get(targetPath).neighbors.add(sourcePath);
        }
      });

      const entries = Array.from(groups.entries()).sort((left, right) => {
        const leftScore = right[1].neighbors.size - left[1].neighbors.size;
        if (leftScore !== 0) {
          return leftScore;
        }
        return left[0].localeCompare(right[0]);
      });

      const placed = new Map();
      const order = [];
      const visit = (filePath) => {
        if (placed.has(filePath)) {
          return;
        }
        placed.set(filePath, true);
        order.push(filePath);
        const neighbors = Array.from(groups.get(filePath)?.neighbors ?? []).sort();
        for (const neighbor of neighbors) {
          visit(neighbor);
        }
      };

      for (const [filePath] of entries) {
        visit(filePath);
      }

      const connected = order.filter((filePath) => (groups.get(filePath)?.neighbors.size || 0) > 0);
      const isolated = order.filter((filePath) => (groups.get(filePath)?.neighbors.size || 0) === 0);
      const isOverview = viewMode === 'overview';
      const connectedCols = Math.max(2, Math.ceil(Math.sqrt(Math.max(connected.length, 1) * 1.15)));
      const maxSymbols = Math.max(1, ...order.map((filePath) => groups.get(filePath).symbols.length));
      const symbolCols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(maxSymbols))));
      const symbolRows = Math.max(1, Math.ceil(maxSymbols / symbolCols));
      const cellW = isOverview ? 168 : Math.max(190, 100 + symbolCols * 72);
      const cellH = isOverview ? 92 : Math.max(120, 56 + symbolRows * 34);
      const isoCols = Math.max(4, Math.ceil(Math.sqrt(Math.max(isolated.length, 1) * 1.8)));
      const isoCellW = isOverview ? 148 : 168;
      const isoCellH = isOverview ? 70 : Math.max(100, 48 + symbolRows * 30);

      cy.batch(() => {
        connected.forEach((filePath, index) => {
          const group = groups.get(filePath);
          const col = index % connectedCols;
          const row = Math.floor(index / connectedCols);
          const originX = col * cellW;
          const originY = row * cellH;
          const fileX = originX + cellW / 2;
          const fileY = isOverview ? originY + cellH / 2 : originY + 22;

          if (group.file) {
            group.file.position({ x: fileX, y: fileY });
          }

          if (!isOverview) {
            group.symbols
              .slice()
              .sort((left, right) => String(left.data('label')).localeCompare(String(right.data('label'))))
              .forEach((symbol, symbolIndex) => {
                const sc = symbolIndex % symbolCols;
                const sr = Math.floor(symbolIndex / symbolCols);
                symbol.position({
                  x: originX + 42 + sc * 68,
                  y: originY + 58 + sr * 32
                });
              });
          }
        });

        const connectedRows = Math.max(1, Math.ceil(connected.length / connectedCols));
        const isolatedOriginY = connected.length > 0 ? connectedRows * cellH + 56 : 0;

        isolated.forEach((filePath, index) => {
          const group = groups.get(filePath);
          const col = index % isoCols;
          const row = Math.floor(index / isoCols);
          const originX = col * isoCellW;
          const originY = isolatedOriginY + row * isoCellH;
          const fileX = originX + isoCellW / 2;
          const fileY = isOverview ? originY + isoCellH / 2 : originY + 20;

          if (group.file) {
            group.file.position({ x: fileX, y: fileY });
          }

          if (!isOverview) {
            group.symbols
              .slice()
              .sort((left, right) => String(left.data('label')).localeCompare(String(right.data('label'))))
              .forEach((symbol, symbolIndex) => {
                const sc = symbolIndex % symbolCols;
                const sr = Math.floor(symbolIndex / symbolCols);
                symbol.position({
                  x: originX + 36 + sc * 64,
                  y: originY + 52 + sr * 30
                });
              });
          } else {
            // Keep symbols parked near their file (hidden) so detail toggle doesn't jump wildly
            group.symbols.forEach((symbol, symbolIndex) => {
              symbol.position({
                x: fileX + (symbolIndex % 3) * 8,
                y: fileY + 40 + Math.floor(symbolIndex / 3) * 8
              });
            });
          }
        });

        // Park symbols for connected files in overview too
        if (isOverview) {
          connected.forEach((filePath) => {
            const group = groups.get(filePath);
            if (!group.file) {
              return;
            }
            const pos = group.file.position();
            group.symbols.forEach((symbol, symbolIndex) => {
              symbol.position({
                x: pos.x + (symbolIndex % 3) * 8,
                y: pos.y + 40 + Math.floor(symbolIndex / 3) * 8
              });
            });
          });
        }
      });

      updateLabelVisibility();
      fitGraph(72);
    }

    window.addEventListener('resize', () => fitGraph(64));

    function updateBadge(graphData) {
      if (!badge || !graphData) {
        return;
      }

      const nodeCount = Array.isArray(graphData.nodes) ? graphData.nodes.length : 0;
      const edgeCount = Array.isArray(graphData.edges) ? graphData.edges.length : 0;
      if (currentQuery.trim()) {
        const visibleCount = cy ? cy.nodes(':visible').length : nodeCount;
        badge.textContent = visibleCount + ' / ' + nodeCount + ' node · ' + edgeCount + ' edge';
        return;
      }

      badge.textContent = nodeCount + ' node · ' + edgeCount + ' edge';
    }

    function normalizeText(value) {
      return String(value ?? '').toLowerCase().trim();
    }

    function nodeSearchText(node) {
      return normalizeText([
        node.data('label'),
        node.data('kind'),
        node.data('filePath'),
        node.data('id')
      ].join(' '));
    }

    function applySearchFilter(options) {
      if (!cy) {
        return;
      }

      const shouldFit = !options || options.fit !== false;
      const query = normalizeText(currentQuery);
      const allNodes = cy.nodes();
      const allEdges = cy.edges();

      allNodes.removeClass('cy-node-hidden cy-node-match');
      allEdges.removeClass('cy-edge-hidden');
      applyViewModeClasses();

      if (!query) {
        updateBadge(currentGraph);
        updateLabelVisibility();
        if (shouldFit) {
          fitGraph(64);
        }
        return;
      }

      const matchedIds = new Set();
      const visibleIds = new Set();

      allNodes.forEach((node) => {
        if (node.hasClass('cy-overview-edge')) {
          return;
        }
        const text = nodeSearchText(node);
        const match = text.includes(query);
        if (!match) {
          return;
        }

        matchedIds.add(node.id());
        visibleIds.add(node.id());
        node.addClass('cy-node-match');
        node.removeClass('cy-node-hidden');

        const filePath = String(node.data('filePath') || '');
        if (filePath) {
          allNodes.forEach((candidate) => {
            if (candidate.data('kind') === 'file' && String(candidate.data('filePath') || candidate.id()) === filePath) {
              visibleIds.add(candidate.id());
              candidate.removeClass('cy-node-hidden');
            }
            if (viewMode === 'detail' && String(candidate.data('filePath') || '') === filePath) {
              visibleIds.add(candidate.id());
              candidate.removeClass('cy-node-hidden');
            }
          });
        }
      });

      allNodes.forEach((node) => {
        if (visibleIds.has(node.id())) {
          return;
        }

        node.addClass('cy-node-hidden');
      });

      allEdges.forEach((edge) => {
        if (viewMode === 'overview' && !edge.hasClass('cy-overview-edge')) {
          edge.addClass('cy-edge-hidden');
          return;
        }
        if (viewMode === 'detail' && edge.hasClass('cy-overview-edge')) {
          edge.addClass('cy-edge-hidden');
          return;
        }
        if (visibleIds.has(edge.source().id()) && visibleIds.has(edge.target().id())) {
          return;
        }

        edge.addClass('cy-edge-hidden');
      });

      updateBadge(currentGraph);
      updateLabelVisibility();
      if (shouldFit) {
        fitGraph(72);
      }
    }

    function renderGraph(graphData, preferredState, message) {
      destroyGraph();
      currentGraph = graphData;
      updateBadge(graphData);

      if (preferredState === 'loading') {
        setState('loading', message || 'Memproses analisis repo...');
        return;
      }

      if (!window.cytoscape) {
        setState('error', 'Cytoscape library tidak tersedia di webview.');
        return;
      }

      if (!graphData.nodes || graphData.nodes.length === 0) {
        setState('empty', message || 'Belum ada node untuk ditampilkan.');
        return;
      }

      try {
        setState('ready');
        currentGraph = graphData;
        cy = window.cytoscape({
          container: graphEl,
          elements: [...graphData.nodes, ...graphData.edges],
          layout: { name: 'preset' },
          minZoom: 0.15,
          maxZoom: 2.8,
          wheelSensitivity: 0.35,
          style: buildCytoscapeStyles(currentTheme)
        });

        cy.on('tap', 'node', (evt) => {
          const data = evt.target.data();
          fillNodeDetail(data);
          const nodeId = typeof data?.id === 'string' ? data.id : '';
          const filePath = typeof data?.filePath === 'string' && data.filePath.trim().length > 0
            ? data.filePath
            : nodeId.includes('#')
              ? nodeId.split('#')[0]
              : nodeId;

          vscode.postMessage({
            type: 'nodeClick',
            node: {
              ...data,
              filePath
            }
          });
        });

        cy.on('mouseover', 'node', (evt) => {
          evt.target.removeClass('cy-hide-label');
        });

        cy.on('mouseout', 'node', () => {
          updateLabelVisibility();
        });

        cy.on('zoom', () => {
          updateLabelVisibility();
        });

        cy.ready(() => {
          applySearchFilter({ fit: false });
          runClusterLayout();
        });
      } catch (error) {
        setState('error', error instanceof Error ? error.message : String(error));
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') {
        return;
      }

      if (msg.type === 'setGraph') {
        currentGraph = msg.graph ?? currentGraph;
        if (Object.prototype.hasOwnProperty.call(msg, 'insights')) {
          renderInsights(msg.insights);
        }
        resetNodeDetail();
        renderGraph(currentGraph, msg.state ?? 'ready', msg.message);
        return;
      }

      if (msg.type === 'setState') {
        setState(msg.state ?? 'loading', msg.message);
      }
    });

    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        currentQuery = event.target.value;
        applySearchFilter();
      });
    }

    if (fitViewBtn) {
      fitViewBtn.addEventListener('click', () => {
        fitGraph(64);
      });
    }

    if (viewModeToggle) {
      viewModeToggle.addEventListener('click', () => {
        viewMode = viewMode === 'overview' ? 'detail' : 'overview';
        try {
          localStorage.setItem('nevermin.graphViewMode', viewMode);
        } catch (_) {}
        updateViewModeToggleLabel();
        runClusterLayout();
        applySearchFilter({ fit: false });
      });
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        if (!cy) return;
        cy.zoom(cy.zoom() * 1.2);
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        if (!cy) return;
        cy.zoom(cy.zoom() / 1.2);
      });
    }

    if (zoomFitBtn) {
      zoomFitBtn.addEventListener('click', () => {
        fitGraph(64);
      });
    }

    if (openExternalBtn) {
      openExternalBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openExternal' });
      });
    }

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        currentThemeMode = currentThemeMode === 'light' ? 'dark' : 'light';
        currentTheme = THEMES[currentThemeMode];
        try {
          localStorage.setItem('nevermin.graphTheme', currentThemeMode);
        } catch (_) {}
        applyThemeToGraph(currentTheme);
        updateThemeToggleLabel();
      });
    }

    renderInsights(currentInsights);
    renderGraph(currentGraph, ${JSON.stringify(initialState)}, ${JSON.stringify(initialMessage ?? '')});
  </script>
</body>
</html>`;
}

async function revealAndExplainNode(node: GraphNode): Promise<void> {
  try {
    const resolvedUri = resolveGraphNodeUri(node);
    if (!resolvedUri) {
      vscode.window.showErrorMessage('NeverMIN tidak menemukan file path node yang dipilih.');
      return;
    }

    const document = await vscode.workspace.openTextDocument(resolvedUri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: true,
      preserveFocus: false
    });

    const lineCount = Math.max(1, document.lineCount);
    const startLine = Math.max(0, Math.min(lineCount - 1, (node.startLine ?? 1) - 1));
    const endLine = Math.max(startLine, Math.min(lineCount - 1, (node.endLine ?? node.startLine ?? 1) - 1));
    const start = new vscode.Position(startLine, 0);
    const endText = document.lineAt(endLine).text;
    const end = new vscode.Position(endLine, endText.length);
    const range = new vscode.Range(start, end);

    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    await vscode.commands.executeCommand('nevermin.explainSelection');
  } catch (error) {
    vscode.window.showErrorMessage(`NeverMIN gagal membuka symbol ${node.name}: ${error}`);
  }
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
