import fs from 'fs/promises';
import http from 'http';
import * as vscode from 'vscode';
import { GraphInsights } from '../../core/graph/graphInsights';
import { WebviewGraphPayload } from './graphPayload';
import {
  DARK_GRAPH_THEME,
  LIGHT_GRAPH_THEME,
  getCytoscapeStyleBuilderScript,
  getSharedGraphUiCss,
  themeToCssVars,
  themeToJsObject
} from './graphTheme';
import { MARKDOWN_LITE_WEBVIEW_SCRIPT } from './markdownLite';

const activeServers = new Set<http.Server>();
const SERVER_TTL_MS = 2 * 60 * 60 * 1000;

export async function openGraphInExternalBrowser(
  payload: WebviewGraphPayload,
  insights?: GraphInsights
): Promise<void> {
  if (!payload.nodes.length) {
    vscode.window.showWarningMessage('Belum ada graph untuk dibuka di browser.');
    return;
  }

  const cytoscapePath = require.resolve('cytoscape/dist/cytoscape.min.js');
  const cytoscapeJs = await fs.readFile(cytoscapePath, 'utf8');
  const html = buildStandaloneGraphHtml(payload, cytoscapeJs, insights);

  // Di WSL/remote, file:// jadi vscode-remote:// yang Windows tidak bisa buka.
  // Serve lewat localhost + asExternalUri agar browser host bisa akses.
  const port = await serveHtml(html);
  const localUri = vscode.Uri.parse(`http://127.0.0.1:${port}/`);
  const externalUri = await vscode.env.asExternalUri(localUri);
  const opened = await vscode.env.openExternal(externalUri);

  if (!opened) {
    vscode.window.showWarningMessage(`Browser gagal dibuka. Coba buka manual: ${externalUri.toString()}`);
    return;
  }

  vscode.window.showInformationMessage(`NeverMIN membuka graph di browser: ${externalUri.toString()}`);
}

export function disposeExternalGraphServers(): void {
  for (const server of activeServers) {
    server.close();
  }
  activeServers.clear();
}

async function serveHtml(html: string): Promise<number> {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(html);
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Gagal mendapatkan port server graph.'));
        return;
      }
      resolve(address.port);
    });
  });

  activeServers.add(server);
  const timer = setTimeout(() => {
    server.close();
    activeServers.delete(server);
  }, SERVER_TTL_MS);
  timer.unref?.();

  server.on('close', () => {
    activeServers.delete(server);
  });

  return port;
}

export function buildStandaloneGraphHtml(
  payload: WebviewGraphPayload,
  cytoscapeJs: string,
  insights?: GraphInsights
): string {
  const graphJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const insightsJson = JSON.stringify(insights ?? null).replace(/</g, '\\u003c');
  const nodeCount = payload.nodes.length;
  const edgeCount = payload.edges.length;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NeverMIN Code Graph</title>
  <style>
    :root {
      ${themeToCssVars(LIGHT_GRAPH_THEME)}
    }
    ${getSharedGraphUiCss()}
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", sans-serif;
    }
    .shell {
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--border);
      background: var(--header);
    }
    .title-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
    .title { font-size: 16px; font-weight: 700; }
    .subtitle { margin-top: 4px; color: var(--muted); font-size: 13px; }
    .left { min-width: 0; display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .searchbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .searchbar input {
      width: min(420px, 56vw);
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--input-bg);
      color: var(--text);
      padding: 9px 14px;
      outline: none;
    }
    .searchbar button {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--input-bg);
      color: var(--text);
      padding: 9px 14px;
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
      padding: 7px 12px;
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
      grid-template-columns: 1fr 300px;
    }
    .graph-area {
      position: relative;
      min-width: 0;
      min-height: 0;
    }
    #graph { width: 100%; height: 100%; }
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
    .detail {
      border-left: 1px solid var(--border);
      padding: 16px;
      background: var(--panel);
      overflow: auto;
    }
    .detail h2 { margin: 0 0 8px; font-size: 15px; }
    .detail h3 {
      margin: 16px 0 8px;
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .detail p, .detail dl { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
    .detail .md-body { color: var(--text); font-size: 13px; line-height: 1.55; margin: 0 0 12px; }
    .detail .md-body p { margin: 0 0 10px; color: var(--text); white-space: normal; }
    .detail .md-body h3, .detail .md-body h4, .detail .md-body h5 {
      margin: 12px 0 6px; font-size: 13px; color: var(--text);
    }
    .detail .md-body ul { margin: 0 0 10px; padding-left: 18px; }
    .detail .md-body li { margin: 0 0 6px; color: var(--text); }
    .detail .md-body strong { font-weight: 700; color: var(--text); }
    .detail .md-body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px; padding: 1px 5px; border-radius: 6px;
      background: color-mix(in srgb, var(--accent) 12%, var(--input-bg));
      border: 1px solid var(--border);
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
    .node-detail .placeholder { color: var(--muted); }
    .node-detail dt { color: var(--muted); font-size: 11px; margin-top: 8px; font-weight: 500; }
    .node-detail dt:first-child { margin-top: 0; }
    .node-detail dd { margin: 2px 0 0; word-break: break-all; font-weight: 600; color: var(--text); }
    .insight-list, .flow-list { display: flex; flex-direction: column; gap: 8px; }
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
    .insight-item:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
    .insight-item small, .flow-card small { color: var(--muted); display: block; margin-top: 4px; font-size: 11px; }
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
    .flow-card:hover { background: color-mix(in srgb, var(--accent) 6%, var(--card-bg)); }
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
    .stat-card strong { display: block; font-size: 16px; line-height: 1.2; color: var(--text); }
    .stat-card small { color: var(--muted); font-size: 11px; }
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
      .content { grid-template-columns: 1fr; }
      .detail { border-left: none; border-top: 1px solid var(--border); max-height: 240px; }
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
            <div class="subtitle">Tampilan penuh di browser. Zoom, drag, cari symbol, lalu klik node untuk detail.</div>
          </div>
          <div class="badge" id="badge">${nodeCount} node · ${edgeCount} edge</div>
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
          <input id="searchInput" type="search" placeholder="Cari file atau symbol..." />
          <button id="viewModeToggle" class="primary" type="button" title="Ganti tampilan ringkas/detail">Mode Detail</button>
          <button id="fitView" class="primary" type="button">View Utuh</button>
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
      <aside class="detail" id="detail">
        <h2>Insights</h2>
        <div class="md-body" id="insightsSummary">Klik node atau item insight untuk melihat detail.</div>
        <h3>Detail node</h3>
        <div class="node-detail empty" id="nodeDetail"><span class="placeholder">Klik node di graph untuk melihat path dan rentang baris.</span></div>
        <div id="insightsBody"></div>
        <h3>Statistik</h3>
        <div class="stats-grid" id="statsGrid">
          <div class="stat-card"><span class="stat-icon nodes">N</span><div><strong id="statNodes">0</strong><small>Nodes</small></div></div>
          <div class="stat-card"><span class="stat-icon edges">E</span><div><strong id="statEdges">0</strong><small>Edges</small></div></div>
          <div class="stat-card"><span class="stat-icon files">F</span><div><strong id="statFiles">0</strong><small>Files</small></div></div>
          <div class="stat-card"><span class="stat-icon functions">ƒ</span><div><strong id="statFunctions">0</strong><small>Functions</small></div></div>
        </div>
        <div class="tip-box">Tip: Default Mode Ringkas = file + import antar file. Klik Mode Detail untuk lihat function/symbol.</div>
      </aside>
    </div>
  </div>
  <script>${cytoscapeJs}</script>
  <script>
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

    const currentGraph = ${graphJson};
    const currentInsights = ${insightsJson};
    let cy = null;
    let currentQuery = '';
    const LABEL_ZOOM_THRESHOLD = 0.85;
    const FLOW_BORDER_KINDS = ['imports', 'calls', 'uses'];
    const graphEl = document.getElementById('graph');
    const badge = document.getElementById('badge');
    const insightsSummary = document.getElementById('insightsSummary');
    const insightsBody = document.getElementById('insightsBody');
    const nodeDetail = document.getElementById('nodeDetail');
    const searchInput = document.getElementById('searchInput');
    const fitViewBtn = document.getElementById('fitView');
    const viewModeToggle = document.getElementById('viewModeToggle');
    const themeToggle = document.getElementById('themeToggle');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const zoomFitBtn = document.getElementById('zoomFit');
    const statNodes = document.getElementById('statNodes');
    const statEdges = document.getElementById('statEdges');
    const statFiles = document.getElementById('statFiles');
    const statFunctions = document.getElementById('statFunctions');
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
      viewModeToggle.textContent = viewMode === 'overview' ? 'Mode Detail' : 'Mode Ringkas';
    }

    applyThemeToDocument(currentTheme);
    updateThemeToggleLabel();
    updateViewModeToggleLabel();

    function fitGraph(padding) {
      if (!cy) return;
      cy.resize();
      const visible = cy.nodes(':visible');
      cy.fit(visible.length ? visible : undefined, padding ?? 64);
    }

    function updateBadge() {
      const nodeCount = currentGraph.nodes.length;
      const edgeCount = currentGraph.edges.length;
      if (currentQuery.trim()) {
        badge.textContent = cy.nodes(':visible').length + ' / ' + nodeCount + ' node · ' + edgeCount + ' edge';
        return;
      }
      badge.textContent = nodeCount + ' node · ' + edgeCount + ' edge';
    }

    function updateLabelVisibility() {
      if (!cy) return;
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
      if (!cy) return;
      cy.edges('.cy-overview-edge').remove();
    }

    function rebuildOverviewEdges() {
      if (!cy) return;
      clearOverviewEdges();
      if (viewMode !== 'overview') return;
      const fileByPath = new Map();
      cy.nodes().forEach((node) => {
        if (node.data('kind') !== 'file') return;
        fileByPath.set(String(node.data('filePath') || node.id()), node.id());
      });
      const seen = new Set();
      const additions = [];
      cy.edges().forEach((edge) => {
        if (edge.hasClass('cy-overview-edge')) return;
        const kind = String(edge.data('label') || '');
        if (kind === 'defines') return;
        const sourcePath = String(edge.source().data('filePath') || '');
        const targetPath = String(edge.target().data('filePath') || '');
        if (!sourcePath || !targetPath || sourcePath === targetPath) return;
        const sourceFileId = fileByPath.get(sourcePath);
        const targetFileId = fileByPath.get(targetPath);
        if (!sourceFileId || !targetFileId) return;
        const key = sourceFileId + '->' + targetFileId + ':' + kind;
        if (seen.has(key)) return;
        seen.add(key);
        additions.push({
          group: 'edges',
          data: { id: 'ov-' + key, source: sourceFileId, target: targetFileId, label: kind },
          classes: 'cy-overview-edge'
        });
      });
      if (additions.length) cy.add(additions);
    }

    function applyViewModeClasses() {
      if (!cy) return;
      cy.batch(() => {
        cy.nodes().removeClass('cy-node-hidden');
        cy.edges().removeClass('cy-edge-hidden');
        if (viewMode === 'overview') {
          cy.nodes().forEach((node) => {
            if (node.data('kind') !== 'file') node.addClass('cy-node-hidden');
          });
          cy.edges().forEach((edge) => {
            if (!edge.hasClass('cy-overview-edge')) edge.addClass('cy-edge-hidden');
          });
        } else {
          cy.edges('.cy-overview-edge').addClass('cy-edge-hidden');
        }
      });
    }

    function runClusterLayout() {
      if (!cy) return;
      rebuildOverviewEdges();
      applyViewModeClasses();

      const groups = new Map();
      cy.nodes().forEach((node) => {
        const filePath = String(node.data('filePath') || node.id());
        if (!groups.has(filePath)) {
          groups.set(filePath, { file: null, symbols: [], neighbors: new Set() });
        }
        const group = groups.get(filePath);
        if (node.data('kind') === 'file') group.file = node;
        else group.symbols.push(node);
      });

      const neighborEdges = viewMode === 'overview'
        ? cy.edges('.cy-overview-edge')
        : cy.edges().filter((edge) => !edge.hasClass('cy-overview-edge') && String(edge.data('label')) !== 'defines');

      neighborEdges.forEach((edge) => {
        const sourcePath = String(edge.source().data('filePath') || '');
        const targetPath = String(edge.target().data('filePath') || '');
        if (!sourcePath || !targetPath || sourcePath === targetPath) return;
        if (groups.has(sourcePath) && groups.has(targetPath)) {
          groups.get(sourcePath).neighbors.add(targetPath);
          groups.get(targetPath).neighbors.add(sourcePath);
        }
      });

      const entries = Array.from(groups.entries()).sort((left, right) => {
        const score = right[1].neighbors.size - left[1].neighbors.size;
        return score || left[0].localeCompare(right[0]);
      });

      const placed = new Map();
      const order = [];
      const visit = (filePath) => {
        if (placed.has(filePath)) return;
        placed.set(filePath, true);
        order.push(filePath);
        for (const neighbor of Array.from(groups.get(filePath)?.neighbors ?? []).sort()) {
          visit(neighbor);
        }
      };
      for (const [filePath] of entries) visit(filePath);

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
          if (group.file) group.file.position({ x: fileX, y: fileY });
          if (!isOverview) {
            group.symbols
              .slice()
              .sort((a, b) => String(a.data('label')).localeCompare(String(b.data('label'))))
              .forEach((symbol, symbolIndex) => {
                const sc = symbolIndex % symbolCols;
                const sr = Math.floor(symbolIndex / symbolCols);
                symbol.position({ x: originX + 42 + sc * 68, y: originY + 58 + sr * 32 });
              });
          } else if (group.file) {
            const pos = group.file.position();
            group.symbols.forEach((symbol, symbolIndex) => {
              symbol.position({
                x: pos.x + (symbolIndex % 3) * 8,
                y: pos.y + 40 + Math.floor(symbolIndex / 3) * 8
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
          if (group.file) group.file.position({ x: fileX, y: fileY });
          if (!isOverview) {
            group.symbols
              .slice()
              .sort((a, b) => String(a.data('label')).localeCompare(String(b.data('label'))))
              .forEach((symbol, symbolIndex) => {
                const sc = symbolIndex % symbolCols;
                const sr = Math.floor(symbolIndex / symbolCols);
                symbol.position({ x: originX + 36 + sc * 64, y: originY + 52 + sr * 30 });
              });
          } else {
            group.symbols.forEach((symbol, symbolIndex) => {
              symbol.position({
                x: fileX + (symbolIndex % 3) * 8,
                y: fileY + 40 + Math.floor(symbolIndex / 3) * 8
              });
            });
          }
        });
      });

      updateLabelVisibility();
      fitGraph(72);
    }

    function applySearchFilter(options) {
      if (!cy) return;
      const shouldFit = !options || options.fit !== false;
      const query = String(currentQuery || '').toLowerCase().trim();
      cy.nodes().removeClass('cy-node-hidden cy-node-match');
      cy.edges().removeClass('cy-edge-hidden');
      applyViewModeClasses();

      if (!query) {
        updateBadge();
        updateLabelVisibility();
        if (shouldFit) fitGraph(64);
        return;
      }

      const visibleIds = new Set();
      cy.nodes().forEach((node) => {
        const text = [
          node.data('label'),
          node.data('kind'),
          node.data('filePath'),
          node.data('id')
        ].join(' ').toLowerCase();
        if (!text.includes(query)) return;
        visibleIds.add(node.id());
        node.addClass('cy-node-match');
        node.removeClass('cy-node-hidden');
        const filePath = String(node.data('filePath') || '');
        if (!filePath) return;
        cy.nodes().forEach((candidate) => {
          if (candidate.data('kind') === 'file' && String(candidate.data('filePath') || candidate.id()) === filePath) {
            visibleIds.add(candidate.id());
            candidate.removeClass('cy-node-hidden');
          }
          if (viewMode === 'detail' && String(candidate.data('filePath') || '') === filePath) {
            visibleIds.add(candidate.id());
            candidate.removeClass('cy-node-hidden');
          }
        });
      });

      cy.nodes().forEach((node) => {
        if (!visibleIds.has(node.id())) node.addClass('cy-node-hidden');
      });
      cy.edges().forEach((edge) => {
        if (viewMode === 'overview' && !edge.hasClass('cy-overview-edge')) {
          edge.addClass('cy-edge-hidden');
          return;
        }
        if (viewMode === 'detail' && edge.hasClass('cy-overview-edge')) {
          edge.addClass('cy-edge-hidden');
          return;
        }
        if (!(visibleIds.has(edge.source().id()) && visibleIds.has(edge.target().id()))) {
          edge.addClass('cy-edge-hidden');
        }
      });

      updateBadge();
      updateLabelVisibility();
      if (shouldFit) fitGraph(72);
    }

    function showDetail(data) {
      nodeDetail.classList.remove('empty');
      nodeDetail.innerHTML =
        '<dl>' +
          '<dt>Nama</dt><dd>' + escapeHtml(data.label || data.id || 'Node') + '</dd>' +
          '<dt>Jenis</dt><dd>' + escapeHtml(data.kind || '-') + '</dd>' +
          '<dt>File</dt><dd>' + escapeHtml(data.filePath || '-') + '</dd>' +
          '<dt>Baris</dt><dd>' + escapeHtml(String(data.startLine || '-') + ' – ' + String(data.endLine || '-')) + '</dd>' +
        '</dl>';
    }

    function focusNodes(nodeIds) {
      if (!cy || !nodeIds || !nodeIds.length) return;
      const needsDetail = nodeIds.some((id) => {
        const node = cy.getElementById(id);
        return node.nonempty() && node.data('kind') !== 'file';
      });
      if (needsDetail && viewMode === 'overview') {
        viewMode = 'detail';
        try { localStorage.setItem('nevermin.graphViewMode', viewMode); } catch (_) {}
        updateViewModeToggleLabel();
        runClusterLayout();
        applySearchFilter({ fit: false });
      }
      const targets = cy.nodes().filter((node) => nodeIds.includes(node.id()));
      if (targets.empty()) return;
      cy.elements().unselect();
      targets.select();
      targets.removeClass('cy-hide-label cy-node-hidden');
      cy.fit(targets, 80);
    }

    function renderStats(insights) {
      const stats = insights && insights.stats ? insights.stats : null;
      const n = stats ? stats.nodeCount : currentGraph.nodes.length;
      const e = stats ? stats.edgeCount : currentGraph.edges.length;
      const files = stats && stats.nodesByKind ? (stats.nodesByKind.file || 0) : 0;
      const fns = stats && stats.nodesByKind ? (stats.nodesByKind.function || 0) : 0;
      if (statNodes) statNodes.textContent = String(n);
      if (statEdges) statEdges.textContent = String(e);
      if (statFiles) statFiles.textContent = String(files);
      if (statFunctions) statFunctions.textContent = String(fns);
    }

    function renderInsights(insights) {
      if (!insights) {
        insightsSummary.className = 'md-body';
        insightsSummary.textContent = 'Belum ada insights. Jalankan analisis dulu di VS Code.';
        insightsBody.innerHTML = '';
        renderStats(null);
        return;
      }
      const markdownSource = insights.narrative
        || (insights.summaryBullets || []).map((bullet) => '- ' + bullet).join('\\n')
        || 'Insights siap.';
      insightsSummary.className = 'md-body';
      insightsSummary.innerHTML = renderMarkdownLite(markdownSource);

      const sections = [
        ['Flow utama', insights.mainFlow ? [insights.mainFlow] : [], 'flow'],
        ['Key flows', insights.keyFlows || [], 'flow'],
        ['Entry points', insights.entryPoints || [], 'ref'],
        ['Hubs', insights.hubs || [], 'ref']
      ];
      insightsBody.innerHTML = sections.map(([title, items, kind]) => {
        const list = (items || []).map((item, index) => {
          const label = kind === 'flow'
            ? (item.input && item.output
              ? ('Input: ' + item.input + ' → Output: ' + item.output)
              : item.label)
            : item.name;
          const meta = kind === 'flow'
            ? (Array.isArray(item.process) && item.process.length
              ? ('Proses: ' + item.process.join(' → '))
              : (item.steps || []).join(' → '))
            : (item.reason || item.filePath || '');
          const ids = kind === 'flow' ? JSON.stringify(item.nodeIds || []) : JSON.stringify([item.id]);
          const cls = kind === 'flow'
            ? 'flow-card flow-' + FLOW_BORDER_KINDS[index % FLOW_BORDER_KINDS.length]
            : 'insight-item';
          return '<button type="button" class="' + cls + '" data-ids="' + encodeURIComponent(ids) + '"><strong>' +
            escapeHtml(label) + '</strong><small>' + escapeHtml(meta) + '</small></button>';
        }).join('') || '<p>Belum terdeteksi.</p>';
        const listClass = kind === 'flow' ? 'flow-list' : 'insight-list';
        return '<h3>' + title + '</h3><div class="' + listClass + '">' + list + '</div>';
      }).join('');
      insightsBody.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          try {
            focusNodes(JSON.parse(decodeURIComponent(button.getAttribute('data-ids') || '%5B%5D')));
          } catch (_) {}
        });
      });
      renderStats(insights);
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    cy = cytoscape({
      container: graphEl,
      elements: [...currentGraph.nodes, ...currentGraph.edges],
      layout: { name: 'preset' },
      minZoom: 0.12,
      maxZoom: 3,
      wheelSensitivity: 0.35,
      style: buildCytoscapeStyles(currentTheme)
    });

    cy.on('tap', 'node', (evt) => showDetail(evt.target.data()));
    cy.on('mouseover', 'node', (evt) => evt.target.removeClass('cy-hide-label'));
    cy.on('mouseout', 'node', () => updateLabelVisibility());
    cy.on('zoom', () => updateLabelVisibility());
    window.addEventListener('resize', () => fitGraph(64));

    searchInput.addEventListener('input', (event) => {
      currentQuery = event.target.value;
      applySearchFilter();
    });
    fitViewBtn.addEventListener('click', () => fitGraph(72));

    if (viewModeToggle) {
      viewModeToggle.addEventListener('click', () => {
        viewMode = viewMode === 'overview' ? 'detail' : 'overview';
        try { localStorage.setItem('nevermin.graphViewMode', viewMode); } catch (_) {}
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
      zoomFitBtn.addEventListener('click', () => fitGraph(72));
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

    applySearchFilter({ fit: false });
    runClusterLayout();
    renderInsights(currentInsights);
  </script>
</body>
</html>`;
}
