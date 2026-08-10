import * as fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { t, buildWebviewI18n } from '../../i18n';
import { GraphInsights } from '../../core/graph/graphInsights';
import { GraphNode } from '../../core/graph/types';
import {
  buildLearningMindMapModel,
  attachHeuristicMindMapBreakdown,
  LearningMindMapModel
} from '../../core/graph/learningMindMap';
import { getCachedCodeGraph } from '../../utils/codeGraphCache';
import { enrichMindMapBreakdownWithLlm } from '../../commands/mindMapBreakdownLlm';
import { prepareLlmSession } from '../../utils/llmSession';
import { getLanguage } from '../../utils/config';
import { preferredViewColumn, showDocumentInActiveColumn } from '../../utils/editorLayout';
import { escapeJsonForScript } from './jsonScriptSafe';
import { Logger } from '../../utils/logger';

let activeMindMapPanel: vscode.WebviewPanel | undefined;
let mindMapGeneration = 0;

interface MindMapFromWebview {
  type: 'ready' | 'nodeClick' | 'openFile' | 'explainNode' | 'openNodeFlow' | 'copySource' | 'webviewLife';
  node?: Partial<GraphNode> & {
    id?: string;
    filePath?: string;
    name?: string;
    kind?: string;
    startLine?: number;
    endLine?: number;
    mermaidId?: string;
  };
  source?: string;
  generation?: number;
  phase?: string;
  view?: string;
}

function hostThemeMode(): 'light' | 'dark' {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
    ? 'light'
    : 'dark';
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveMindMapNodeUri(node: { filePath?: string; id?: string }): vscode.Uri | null {
  const candidate =
    typeof node.filePath === 'string' && node.filePath.trim().length > 0
      ? node.filePath.trim()
      : typeof node.id === 'string'
        ? node.id.trim()
        : '';
  if (!candidate || candidate.startsWith('folder:')) {
    return null;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate) || candidate.startsWith('file:')) {
    return vscode.Uri.parse(candidate);
  }
  return vscode.Uri.file(candidate);
}

async function openMindMapNode(node: {
  id?: string;
  filePath?: string;
  name?: string;
  startLine?: number;
  endLine?: number;
  kind?: string;
}): Promise<void> {
  if (!node.filePath) {
    return;
  }
  const uri = resolveMindMapNodeUri(node);
  if (!uri) {
    return;
  }
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await showDocumentInActiveColumn(doc, { preview: false });
    const line = Math.max(0, (node.startLine || 1) - 1);
    const pos = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  } catch (err) {
    Logger.warn(`[mindmap] open node failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function renderMindMapHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  model: LearningMindMapModel,
  generation: number
): string {
  const nonce = getNonce();
  const lang = getLanguage();
  const distDir = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
  const indexFsPath = path.join(distDir.fsPath, 'index.html');

  if (!fs.existsSync(indexFsPath)) {
    return `<!DOCTYPE html><html lang="${escapeHtmlAttr(lang)}"><body style="font-family:sans-serif;padding:24px;background:#0A0E17;color:#E8ECF4">
      <h2>${escapeHtmlAttr(t('webview.buildMissing'))}</h2>
      <p>${escapeHtmlAttr(t('webview.buildHint'))}</p>
    </body></html>`;
  }

  let html = fs.readFileSync(indexFsPath, 'utf8');

  html = html.replace(
    /(href|src)=["'](\.\/[^"']+|\/assets\/[^"']+)["']/g,
    (_match, attr: string, rel: string) => {
      const clean = rel.replace(/^\.\//, '').replace(/^\//, '');
      const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(distDir, clean));
      return `${attr}="${assetUri}"`;
    }
  );

  html = html.replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);

  const boot = escapeJsonForScript({
    mode: 'mindmap',
    mindMap: model,
    insights: null,
    bundle: null,
    state: 'ready',
    message: '',
    view: 'architecture',
    theme: hostThemeMode(),
    generation,
    llmStatus: 'ready',
    llmMessage: '',
    language: lang,
    i18n: buildWebviewI18n(lang)
  });

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data: blob:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    `worker-src ${webview.cspSource} blob:`,
    `font-src ${webview.cspSource} data:`
  ].join('; ');

  const inject = `
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <script nonce="${nonce}">window.__NEVERMIN_BOOT__=${boot};</script>
`;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${inject}</head>`);
  } else {
    html = inject + html;
  }

  return html;
}

export function openLearningMindMap(
  extensionUri: vscode.Uri,
  insights: GraphInsights,
  options: { folders?: string[]; context?: vscode.ExtensionContext } = {}
): void {
  const lang = getLanguage();
  let model = buildLearningMindMapModel(insights, {
    lang,
    folders: options.folders
  });

  const graph = options.context ? getCachedCodeGraph(options.context) : undefined;
  model = attachHeuristicMindMapBreakdown(model, graph, { maxPerLeaf: 5, depth: 2 });

  const title = lang === 'en' ? 'Learning Mind Map' : 'Mind Map Belajar';
  mindMapGeneration += 1;
  const generation = mindMapGeneration;
  const webviewRoot = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
  const iconUri = vscode.Uri.joinPath(extensionUri, 'media', 'icon.png');

  if (activeMindMapPanel) {
    // Tutup panel lama supaya message handler + webview bundle tidak stale.
    const prev = activeMindMapPanel;
    activeMindMapPanel = undefined;
    prev.dispose();
  }

  const panel = vscode.window.createWebviewPanel(
    'nevermin.mindMap',
    title,
    preferredViewColumn(),
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media'), webviewRoot]
    }
  );

  panel.iconPath = { light: iconUri, dark: iconUri };
  activeMindMapPanel = panel;
  panel.webview.html = renderMindMapHtml(panel.webview, extensionUri, model, generation);

  const messageSub = panel.webview.onDidReceiveMessage(async (msg: MindMapFromWebview) => {
    if (msg.type === 'ready' || msg.type === 'webviewLife') {
      return;
    }
    if (msg.type === 'copySource' && typeof msg.source === 'string') {
      await vscode.env.clipboard.writeText(msg.source);
      vscode.window.showInformationMessage(t('webview.copied'));
      return;
    }
    if (msg.type === 'explainNode' && msg.node) {
      await vscode.commands.executeCommand('nevermin.explainNode', {
        id: msg.node.id,
        name: msg.node.name,
        filePath: msg.node.filePath,
        startLine: msg.node.startLine,
        endLine: msg.node.endLine,
        kind: msg.node.kind,
        view: msg.view || 'architecture'
      });
      return;
    }
    if (msg.type === 'openNodeFlow' && msg.node) {
      await vscode.commands.executeCommand('nevermin.openNodeFlow', {
        id: msg.node.id || msg.node.mermaidId,
        name: msg.node.name,
        filePath: msg.node.filePath,
        kind: msg.node.kind
      });
      return;
    }
    // Hanya buka file dari aksi menu eksplisit — legacy nodeClick diabaikan
    // (bundle lama sempat kirim nodeClick langsung saat klik leaf).
    if (msg.type === 'openFile' && msg.node) {
      await openMindMapNode(msg.node);
      return;
    }
    if (msg.type === 'nodeClick') {
      Logger.info('[mindmap] ignore legacy nodeClick — pakai menu Open file');
    }
  });

  const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
    void panel.webview.postMessage({ type: 'setTheme', mode: hostThemeMode() });
  });

  panel.onDidDispose(() => {
    messageSub.dispose();
    themeSub.dispose();
    if (activeMindMapPanel === panel) {
      activeMindMapPanel = undefined;
    }
  });

  // LLM breakdown async — hanya mengisi leaf yang masih datar; yang kosong tetap kosong.
  if (options.context) {
    const context = options.context;
    const openedGeneration = generation;
    void (async () => {
      try {
        await panel.webview.postMessage({
          type: 'setMindMap',
          mindMap: model,
          message:
            lang === 'en' ? 'Deepening map with LLM…' : 'Memperdalam mind map dengan LLM…'
        });
        const prepared = await prepareLlmSession(context);
        if (!prepared.ok) {
          await panel.webview.postMessage({
            type: 'setMindMap',
            mindMap: model,
            message:
              lang === 'en'
                ? 'Graph breakdown ready (LLM skipped).'
                : 'Breakdown graph siap (LLM dilewati).'
          });
          return;
        }
        const enriched = await enrichMindMapBreakdownWithLlm({
          model,
          session: prepared.session
        });
        if (activeMindMapPanel !== panel || mindMapGeneration !== openedGeneration) {
          return;
        }
        await panel.webview.postMessage({
          type: 'setMindMap',
          mindMap: enriched,
          message: lang === 'en' ? 'Breakdown ready' : 'Breakdown siap'
        });
      } catch (error) {
        Logger.warn(
          `[mindmap] LLM breakdown: ${error instanceof Error ? error.message : String(error)}`
        );
        if (activeMindMapPanel === panel) {
          await panel.webview.postMessage({
            type: 'setMindMap',
            mindMap: model,
            message:
              lang === 'en' ? 'Graph breakdown ready' : 'Breakdown graph siap'
          });
        }
      }
    })();
  }
}

/** Push Explain With LLM result into the open Mind Map panel (if any). */
export async function setMindMapNodeExplain(
  nodeExplain: {
    status: 'loading' | 'streaming' | 'ready' | 'error' | 'cancelled';
    title?: string;
    filePath?: string;
    text?: string;
    thinking?: string;
    sensitivityLevel?: 'critical' | 'high' | 'medium' | 'low';
    sensitivityReason?: string;
    message?: string;
    scope?: 'file' | 'module' | 'function' | 'sensitivity';
  } | null
): Promise<boolean> {
  if (!activeMindMapPanel) return false;
  await activeMindMapPanel.webview.postMessage({
    type: 'setNodeExplain',
    nodeExplain
  });
  return true;
}
