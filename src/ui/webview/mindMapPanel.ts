import path from 'path';
import * as vscode from 'vscode';
import { t } from '../../i18n';
import { GraphInsights } from '../../core/graph/graphInsights';
import { buildLearningMindMapMermaid } from '../../core/graph/learningMindMap';
import { getLanguage } from '../../utils/config';
import { preferredViewColumn } from '../../utils/editorLayout';
import { escapeJsonForScript } from './jsonScriptSafe';

let activeMindMapPanel: vscode.WebviewPanel | undefined;

export function openLearningMindMap(
  insights: GraphInsights,
  options: { folders?: string[] } = {}
): void {
  const lang = getLanguage();
  const mermaidSource = buildLearningMindMapMermaid(insights, {
    lang,
    folders: options.folders
  });
  const title = lang === 'en' ? 'Learning Mind Map' : 'Mind Map Belajar';

  if (activeMindMapPanel) {
    activeMindMapPanel.title = title;
    activeMindMapPanel.webview.html = renderMindMapHtml(
      activeMindMapPanel.webview,
      mermaidSource,
      insights
    );
    activeMindMapPanel.reveal(activeMindMapPanel.viewColumn ?? preferredViewColumn(), false);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'nevermin.mindMap',
    title,
    preferredViewColumn(),
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.dirname(require.resolve('mermaid/dist/mermaid.min.js')))
      ]
    }
  );

  activeMindMapPanel = panel;
  panel.webview.html = renderMindMapHtml(panel.webview, mermaidSource, insights);
  panel.onDidDispose(() => {
    if (activeMindMapPanel === panel) {
      activeMindMapPanel = undefined;
    }
  });
}

function renderMindMapHtml(
  webview: vscode.Webview,
  mermaidSource: string,
  insights: GraphInsights
): string {
  const mermaidPath = require.resolve('mermaid/dist/mermaid.min.js');
  const mermaidUri = webview.asWebviewUri(vscode.Uri.file(mermaidPath));
  const lang = getLanguage();
  const subtitle =
    lang === 'en'
      ? `${insights.entryPoints.length} entries · ${insights.hubs.length} hubs · learn in this order`
      : `${insights.entryPoints.length} entry · ${insights.hubs.length} hub · pelajari berurutan`;

  const payload = escapeJsonForScript({
    mermaid: mermaidSource,
    subtitle
  });
  const nonce = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(
    ''
  );

  const heading = t('webview.mindMap');
  const mermaidMissing = t('webview.mermaidMissing');
  const renderFail = t('flow.renderFail');
  const openSource = t('webview.openSource');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src ${webview.cspSource} 'nonce-${nonce}';
  ">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
  <script nonce="${nonce}" src="${mermaidUri}"></script>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1220;
      --panel: #111827;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --border: rgba(148, 163, 184, 0.22);
      --accent: #38bdf8;
      --accent-2: #a78bfa;
    }
    html, body {
      margin: 0;
      height: 100%;
      background:
        radial-gradient(ellipse 55% 40% at 0% 0%, rgba(56,189,248,0.12), transparent 55%),
        radial-gradient(ellipse 50% 35% at 100% 10%, rgba(167,139,250,0.10), transparent 50%),
        var(--bg);
      color: var(--text);
      font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
    }
    .shell {
      min-height: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
      align-content: start;
    }
    header {
      display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      padding: 10px 14px; border-bottom: 1px solid var(--border);
      background: rgba(17, 24, 39, 0.92);
    }
    h1 { margin: 0; font-size: 15px; font-weight: 750; letter-spacing: -0.02em; }
    .meta { color: var(--muted); font-size: 12px; }
    .canvas {
      padding: 10px 12px 14px; overflow: auto;
      display: flex; justify-content: center; align-items: flex-start;
    }
    .diagram {
      width: min(100%, 1100px);
      background: color-mix(in srgb, var(--panel) 92%, transparent);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 12px 12px;
    }
    .diagram svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    .error { color: #fca5a5; font-size: 13px; }
    details { margin-top: 14px; color: var(--muted); font-size: 12px; }
    pre {
      margin: 8px 0 0; padding: 10px 12px; border-radius: 10px;
      background: #0b1220; border: 1px solid var(--border);
      overflow: auto; color: #cbd5e1; white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <h1>${heading}</h1>
      <div class="meta" id="meta"></div>
    </header>
    <div class="canvas">
      <div class="diagram">
        <div id="mount"></div>
        <details>
          <summary>${openSource}</summary>
          <pre id="source"></pre>
        </details>
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    const payload = ${payload};
    const mermaidMissing = ${JSON.stringify(mermaidMissing)};
    const renderFail = ${JSON.stringify(renderFail)};
    document.getElementById('meta').textContent = payload.subtitle || '';
    document.getElementById('source').textContent = payload.mermaid || '';
    const mount = document.getElementById('mount');

    async function render() {
      if (!window.mermaid) {
        mount.innerHTML = '<p class="error">' + mermaidMissing + '</p>';
        return;
      }
      if (!payload.mermaid || !String(payload.mermaid).trim()) {
        mount.innerHTML = '<p class="error">' + renderFail + '</p>';
        return;
      }
      try {
        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'dark',
          mindmap: { padding: 12, maxNodeWidth: 180 }
        });
        const id = 'mind_' + Date.now();
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
