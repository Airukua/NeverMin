import fs from 'fs/promises';
import http from 'http';
import crypto from 'crypto';
import * as vscode from 'vscode';
import { GraphInsights } from '../../core/graph/graphInsights';
import { RepoMermaidBundle } from '../../core/graph/repoMermaid';
import { escapeJsonForScript } from './jsonScriptSafe';

const activeServers = new Set<http.Server>();
const SERVER_TTL_MS = 30 * 60 * 1000;

export async function openMermaidBundleInExternalBrowser(
  bundle: RepoMermaidBundle,
  insights?: GraphInsights
): Promise<void> {
  if (!bundle.architecture.trim()) {
    vscode.window.showWarningMessage('Belum ada diagram untuk dibuka di browser.');
    return;
  }

  const mermaidPath = require.resolve('mermaid/dist/mermaid.min.js');
  const mermaidJs = await fs.readFile(mermaidPath, 'utf8');
  const html = buildStandaloneMermaidHtml(bundle, mermaidJs, insights);
  const accessToken = crypto.randomBytes(24).toString('hex');
  const port = await serveHtml(html, accessToken);
  const localUri = vscode.Uri.parse(`http://127.0.0.1:${port}/?t=${accessToken}`);
  const externalUri = await vscode.env.asExternalUri(localUri);
  const opened = await vscode.env.openExternal(externalUri);

  if (!opened) {
    vscode.window.showWarningMessage(`Browser gagal dibuka. Coba buka manual: ${externalUri.toString()}`);
    return;
  }

  vscode.window.showInformationMessage(`NeverMIN membuka diagram di browser: ${externalUri.toString()}`);
}

/** @deprecated gunakan openMermaidBundleInExternalBrowser */
export async function openGraphInExternalBrowser(): Promise<void> {
  vscode.window.showWarningMessage('Graph Cytoscape diganti Mermaid. Pakai panel Architecture / Salin Mermaid.');
}

export function disposeExternalGraphServers(): void {
  for (const server of activeServers) {
    server.close();
  }
  activeServers.clear();
}

async function serveHtml(html: string, accessToken: string): Promise<number> {
  const server = http.createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const token = requestUrl.searchParams.get('t') ?? '';
      if (!token || token !== accessToken) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
      }

      if (requestUrl.pathname !== '/' && requestUrl.pathname !== '/index.html') {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }

      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(html);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Internal error');
    }
  });

  activeServers.add(server);
  setTimeout(() => {
    server.close();
    activeServers.delete(server);
  }, SERVER_TTL_MS).unref?.();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Gagal binding server diagram lokal.');
  }
  return address.port;
}

export function buildStandaloneMermaidHtml(
  bundle: RepoMermaidBundle,
  mermaidJs: string,
  insights?: GraphInsights
): string {
  const payload = escapeJsonForScript({ bundle, insights: insights ?? null });
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>NeverMIN Architecture</title>
  <style>
    body { margin: 0; font-family: Segoe UI, sans-serif; background: #0b1220; color: #e2e8f0; }
    header { padding: 12px 16px; border-bottom: 1px solid rgba(148,163,184,.22); display: flex; gap: 8px; align-items: center; }
    button { background: #134e4a; color: #ecfeff; border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
    #diagram { padding: 20px; overflow: auto; }
    #diagram svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <header>
    <strong>NeverMIN</strong>
    <button data-view="architecture">Arsitektur</button>
    <button data-view="modules">Modul</button>
    <button data-view="flow">Flow</button>
  </header>
  <div id="diagram"></div>
  <script>${mermaidJs}</script>
  <script>
    const boot = ${payload};
    let view = 'architecture';
    const diagram = document.getElementById('diagram');
    function source() {
      if (view === 'modules') return boot.bundle.modules;
      if (view === 'flow') return boot.bundle.flow;
      return boot.bundle.architecture;
    }
    async function render() {
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
      const id = 'standalone_' + Date.now();
      const { svg } = await mermaid.render(id, source());
      diagram.innerHTML = svg;
    }
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => { view = btn.getAttribute('data-view'); render(); });
    });
    render();
  </script>
</body>
</html>`;
}

/** Kompatibilitas test lama — sekarang merender Mermaid, bukan Cytoscape. */
export function buildStandaloneGraphHtml(
  payload: { nodes?: Array<{ data?: { label?: string } }> } | unknown,
  mermaidOrCytoscapeJs: string,
  insights?: GraphInsights
): string {
  const label =
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { nodes?: unknown[] }).nodes) &&
    (payload as { nodes: Array<{ data?: { label?: string } }> }).nodes[0]?.data?.label
      ? String((payload as { nodes: Array<{ data?: { label?: string } }> }).nodes[0].data?.label)
      : 'NeverMIN Mermaid';

  const emptyBundle: RepoMermaidBundle = {
    architecture: `flowchart TB\n  demo["${label.replace(/"/g, '#quot;')}"]`,
    modules: 'flowchart LR\n  demo["modules"]',
    flow: 'flowchart LR\n  demo["flow"]',
    functions: 'flowchart TB\n  demo["functions"]',
    nodeIndex: {},
    stats: { fileCount: 0, shownFiles: 0, edgeCount: 0, truncated: false }
  };
  return buildStandaloneMermaidHtml(emptyBundle, mermaidOrCytoscapeJs, insights);
}
