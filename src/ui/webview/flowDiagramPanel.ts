import * as vscode from 'vscode';
import { t } from '../../i18n';
import { GraphInsightFlow } from '../../core/graph/graphInsights';
import { buildMainFlowMermaid } from '../../core/graph/flowMermaid';
import { getLanguage } from '../../utils/config';
import { preferredViewColumn } from '../../utils/editorLayout';
import { escapeJsonForScript } from './jsonScriptSafe';

let activeFlowPanel: vscode.WebviewPanel | undefined;

export function openMainFlowDiagram(flow: GraphInsightFlow): void {
  const mermaidSource = flow.mermaid?.trim() || buildMainFlowMermaid(flow);
  const title = `Flow: ${flow.input} → ${flow.output}`;

  if (activeFlowPanel) {
    activeFlowPanel.title = title;
    activeFlowPanel.webview.html = renderFlowHtml(activeFlowPanel.webview, mermaidSource, flow);
    activeFlowPanel.reveal(activeFlowPanel.viewColumn ?? preferredViewColumn(), false);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'nevermin.mainFlow',
    title,
    preferredViewColumn(),
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(require('path').dirname(require.resolve('mermaid/dist/mermaid.min.js')))]
    }
  );

  activeFlowPanel = panel;
  panel.webview.html = renderFlowHtml(panel.webview, mermaidSource, flow);
  panel.onDidDispose(() => {
    if (activeFlowPanel === panel) {
      activeFlowPanel = undefined;
    }
  });
}

function renderFlowHtml(webview: vscode.Webview, mermaidSource: string, flow: GraphInsightFlow): string {
  const mermaidPath = require.resolve('mermaid/dist/mermaid.min.js');
  const mermaidUri = webview.asWebviewUri(vscode.Uri.file(mermaidPath));
  const payload = escapeJsonForScript({
    mermaid: mermaidSource,
    label: `${flow.input} → ${flow.output}`,
    nodeIds: flow.nodeIds
  });
  const nonce = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  const mermaidMissing = t('webview.mermaidMissing');
  const renderFail = t('flow.renderFail');
  const flowTitle = t('webview.mainFlowHeading');

  return `<!DOCTYPE html>
<html lang="${getLanguage()}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src ${webview.cspSource} 'nonce-${nonce}';
  ">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${flowTitle}</title>
  <script nonce="${nonce}" src="${mermaidUri}"></script>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1220;
      --panel: #111827;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --border: rgba(148, 163, 184, 0.22);
      --accent: #2dd4bf;
    }
    html, body {
      margin: 0;
      height: 100%;
      background: radial-gradient(ellipse 70% 50% at 100% 0%, rgba(45,212,191,0.08), transparent 55%), var(--bg);
      color: var(--text);
      font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
    }
    .shell {
      min-height: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      background: rgba(17, 24, 39, 0.92);
    }
    h1 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .meta { color: var(--muted); font-size: 12px; }
    .canvas {
      padding: 20px;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .diagram {
      width: min(100%, 960px);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
    }
    .diagram svg { max-width: 100%; height: auto; }
    .error { color: #fca5a5; font-size: 13px; }
    details {
      margin-top: 14px;
      color: var(--muted);
      font-size: 12px;
    }
    pre {
      margin: 8px 0 0;
      padding: 10px 12px;
      border-radius: 10px;
      background: #0b1220;
      border: 1px solid var(--border);
      overflow: auto;
      color: #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <h1>${flowTitle}</h1>
      <div class="meta" id="meta"></div>
    </header>
    <div class="canvas">
      <div class="diagram">
        <div id="mount"></div>
        <details>
          <summary>${t('webview.openSource')}</summary>
          <pre id="source"></pre>
        </details>
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    const payload = ${payload};
    const mermaidMissing = ${JSON.stringify(mermaidMissing)};
    const renderFail = ${JSON.stringify(renderFail)};
    document.getElementById('meta').textContent = payload.label || '';
    document.getElementById('source').textContent = payload.mermaid || '';
    const mount = document.getElementById('mount');

    async function render() {
      if (!window.mermaid) {
        mount.innerHTML = '<p class="error">' + mermaidMissing + '</p>';
        return;
      }
      try {
        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'dark',
          flowchart: { curve: 'basis', htmlLabels: false, padding: 12 }
        });
        const id = 'flow_' + Date.now();
        const { svg } = await window.mermaid.render(id, payload.mermaid);
        mount.innerHTML = svg;
      } catch (error) {
        mount.innerHTML = '<p class="error">' + renderFail + ' ' + String(error) + '</p>';
      }
    }
    render();
  </script>
</body>
</html>`;
}
