import path from 'path';
import * as vscode from 'vscode';
import { t, webviewUiMessages } from '../../i18n';
import { CodeGraph, GraphNode } from '../../core/graph/types';
import { GraphInsights } from '../../core/graph/graphInsights';
import {
  MermaidGraphView,
  MermaidNodeMeta,
  RepoMermaidBundle,
  buildRepoMermaidBundle
} from '../../core/graph/repoMermaid';
import { getLanguage } from '../../utils/config';
import { escapeJsonForScript } from './jsonScriptSafe';
import { openMainFlowDiagram } from './flowDiagramPanel';
import { openLearningMindMap } from './mindMapPanel';
import { MARKDOWN_LITE_WEBVIEW_SCRIPT } from './markdownLite';
import { Logger } from '../../utils/logger';
import { preferredViewColumn, showDocumentInActiveColumn } from '../../utils/editorLayout';

interface WebviewToExtensionMessage {
  type:
    | 'nodeClick'
    | 'openExternal'
    | 'openMainFlow'
    | 'openMindMap'
    | 'ready'
    | 'copySource'
    | 'renderStatus'
    | 'webviewLife';
  node?: Partial<GraphNode> & MermaidNodeMeta;
  flow?: GraphInsights['mainFlow'];
  source?: string;
  generation?: number;
  ok?: boolean;
  detail?: string;
  view?: string;
  phase?: string;
  elapsedMs?: number;
}

interface ExtensionToWebviewMessage {
  type: 'setGraph' | 'setState' | 'setTheme';
  bundle?: RepoMermaidBundle | null;
  insights?: GraphInsights | null;
  state?: GraphPanelState;
  message?: string;
  mode?: 'light' | 'dark';
  view?: MermaidGraphView;
}

export type GraphPanelState = 'loading' | 'empty' | 'error' | 'ready';

export interface GraphPanelOptions {
  state?: GraphPanelState;
  message?: string;
  insights?: GraphInsights;
  view?: MermaidGraphView;
  functionFilePath?: string;
  focusNodeId?: string;
}

const panelBundles = new WeakMap<vscode.WebviewPanel, RepoMermaidBundle>();
const panelInsights = new WeakMap<vscode.WebviewPanel, GraphInsights>();
const panelPendingMessages = new WeakMap<vscode.WebviewPanel, ExtensionToWebviewMessage[]>();
const panelWebviewReady = new WeakMap<vscode.WebviewPanel, boolean>();
const panelGeneration = new WeakMap<vscode.WebviewPanel, number>();
const panelHtmlAssignedAt = new WeakMap<vscode.WebviewPanel, number>();
const panelReadyWaitTimer = new WeakMap<vscode.WebviewPanel, ReturnType<typeof setTimeout>>();
const panelForceReloadCount = new WeakMap<vscode.WebviewPanel, number>();
const panelLastLifePhase = new WeakMap<vscode.WebviewPanel, string>();
let activeGraphPanel: vscode.WebviewPanel | undefined;

/** Timeout menunggu handshake ready sebelum fallback reload HTML. */
const WEBVIEW_READY_TIMEOUT_MS = 8000;
/** Batas force-reload per panel supaya tidak thrash saat Mermaid lambat (WSL). */
const WEBVIEW_MAX_FORCE_RELOADS = 1;

function nextPanelGeneration(panel: vscode.WebviewPanel): number {
  const generation = (panelGeneration.get(panel) ?? 0) + 1;
  panelGeneration.set(panel, generation);
  return generation;
}

function clearReadyWaitTimer(panel: vscode.WebviewPanel): void {
  const timer = panelReadyWaitTimer.get(panel);
  if (timer) {
    clearTimeout(timer);
    panelReadyWaitTimer.delete(panel);
  }
}

function logWebview(
  panel: vscode.WebviewPanel,
  event: string,
  detail?: string,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  const gen = panelGeneration.get(panel) ?? 0;
  const ready = panelWebviewReady.get(panel) ? 'ready' : 'not-ready';
  const pending = (panelPendingMessages.get(panel) ?? []).length;
  const assignedAt = panelHtmlAssignedAt.get(panel);
  const ageMs = assignedAt ? Date.now() - assignedAt : -1;
  const life = panelLastLifePhase.get(panel) || '-';
  const forceN = panelForceReloadCount.get(panel) ?? 0;
  const line = `[webview] ${event} · gen=${gen} · ${ready} · pending=${pending} · age=${ageMs}ms · life=${life} · force=${forceN}${
    detail ? ` · ${detail}` : ''
  }`;
  if (level === 'warn') {
    Logger.warn(line);
  } else if (level === 'error') {
    Logger.error(line);
  } else {
    Logger.info(line);
  }
}

function assignPanelHtml(
  panel: vscode.WebviewPanel,
  html: string,
  reason: string,
  meta?: { archChars?: number; state?: string }
): void {
  clearReadyWaitTimer(panel);
  panelWebviewReady.set(panel, false);
  panelHtmlAssignedAt.set(panel, Date.now());
  panelLastLifePhase.set(panel, 'html-assigned');
  panel.webview.html = html;
  logWebview(
    panel,
    'html-set',
    `reason=${reason} · html=${html.length}char · arch=${meta?.archChars ?? '?'} · state=${meta?.state ?? '?'}`
  );
}

function queuePanelMessage(panel: vscode.WebviewPanel, message: ExtensionToWebviewMessage): void {
  const pending = panelPendingMessages.get(panel) ?? [];
  // setGraph / setState menggantikan yang sejenis; setTheme selalu diantrikan
  if (message.type === 'setGraph' || message.type === 'setState') {
    const filtered = pending.filter((item) => item.type !== message.type);
    filtered.push(message);
    panelPendingMessages.set(panel, filtered);
    logWebview(panel, 'queue', `type=${message.type} · queue=${filtered.length}`);
    return;
  }
  pending.push(message);
  panelPendingMessages.set(panel, pending);
  logWebview(panel, 'queue', `type=${message.type} · queue=${pending.length}`);
}

async function flushPendingMessages(panel: vscode.WebviewPanel): Promise<void> {
  const pending = panelPendingMessages.get(panel) ?? [];
  panelPendingMessages.set(panel, []);
  if (pending.length === 0) {
    logWebview(panel, 'flush', 'kosong');
    return;
  }
  logWebview(panel, 'flush', `mengirim ${pending.length} pesan · ${pending.map((m) => m.type).join(',')}`);
  for (const message of pending) {
    const ok = await panel.webview.postMessage(message);
    if (!ok) {
      logWebview(panel, 'flush-reject', `type=${message.type}`, 'warn');
      reloadPanelHtml(panel, {}, 'flush-postMessage-failed');
      return;
    }
    logWebview(panel, 'flush-ok', `type=${message.type}`);
  }
}

function reloadPanelHtml(
  panel: vscode.WebviewPanel,
  options: {
    state?: GraphPanelState;
    message?: string;
    view?: MermaidGraphView;
  } = {},
  reason = 'reload'
): void {
  const bundle = panelBundles.get(panel) ?? buildRepoMermaidBundle({ nodes: [], edges: [] });
  const insights = panelInsights.get(panel);
  const state =
    options.state ?? (bundle.stats.fileCount > 0 || (bundle.architecture?.trim().length ?? 0) > 0 ? 'ready' : 'empty');
  const generation = nextPanelGeneration(panel);
  panelPendingMessages.set(panel, []);
  const html = renderHtml(
    panel.webview,
    bundle,
    state,
    options.message,
    toWebviewInsights(insights) ?? undefined,
    options.view ?? 'architecture',
    generation
  );
  assignPanelHtml(panel, html, reason, {
    archChars: bundle.architecture.length,
    state
  });
}

async function postToGraphPanel(
  panel: vscode.WebviewPanel,
  message: ExtensionToWebviewMessage
): Promise<void> {
  if (panelWebviewReady.get(panel)) {
    const ok = await panel.webview.postMessage(message);
    if (!ok) {
      logWebview(panel, 'postMessage-fail', `type=${message.type}`, 'warn');
      if (message.type === 'setGraph' && message.bundle) {
        panelBundles.set(panel, message.bundle);
        if (message.insights) {
          panelInsights.set(panel, message.insights);
        }
      }
      reloadPanelHtml(
        panel,
        {
          state: message.state,
          message: message.message,
          view: message.view
        },
        `postMessage-${message.type}-failed`
      );
    }
    return;
  }
  queuePanelMessage(panel, message);
}

function hostThemeMode(): 'light' | 'dark' {
  const kind = vscode.window.activeColorTheme.kind;
  if (kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast) {
    return 'dark';
  }
  return 'light';
}

/** Payload Insights yang cukup untuk panel (hindari HTML/postMessage membengkak). */
function toWebviewInsights(insights?: GraphInsights | null): GraphInsights | null {
  if (!insights) {
    return null;
  }
  return {
    generatedAt: insights.generatedAt,
    entryPoints: (insights.entryPoints ?? []).slice(0, 8),
    hubs: (insights.hubs ?? []).slice(0, 8),
    mainFlow: insights.mainFlow
      ? {
          ...insights.mainFlow,
          stages: (insights.mainFlow.stages ?? []).slice(0, 8)
        }
      : null,
    keyFlows: [],
    orphanFiles: [],
    stats: insights.stats,
    summaryBullets: (insights.summaryBullets ?? []).slice(0, 12),
    narrative: insights.narrative,
    nodeSummaries: undefined
  };
}

export function createGraphPanel(
  extensionUri: vscode.Uri,
  graph: CodeGraph,
  onNodeClick?: (node: GraphNode) => void | Promise<void>,
  options: GraphPanelOptions = {}
): vscode.WebviewPanel {
  const bundle = buildRepoMermaidBundle(graph, options.insights, {
    functionFilePath: options.functionFilePath,
    focusNodeId: options.focusNodeId
  });
  const state = options.state ?? (graph.nodes.length > 0 ? 'ready' : 'empty');
  const iconUri = vscode.Uri.joinPath(extensionUri, 'media', 'icon.png');
  const iconPath = { light: iconUri, dark: iconUri };

  if (activeGraphPanel) {
    const panel = activeGraphPanel;
    panel.iconPath = iconPath;
    panelBundles.set(panel, bundle);
    if (options.insights) {
      panelInsights.set(panel, options.insights);
    } else {
      panelInsights.delete(panel);
    }
    const generation = nextPanelGeneration(panel);
    panelPendingMessages.set(panel, []);
    panelForceReloadCount.set(panel, 0);
    const html = renderHtml(
      panel.webview,
      bundle,
      state,
      options.message,
      options.insights,
      options.view,
      generation
    );
    assignPanelHtml(panel, html, 'reuse-panel', {
      archChars: bundle.architecture.length,
      state
    });
    panel.reveal(panel.viewColumn ?? preferredViewColumn(), false);
    return panel;
  }

  const panel = vscode.window.createWebviewPanel(
    'nevermin.graph',
    'Code Graph',
    preferredViewColumn(),
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'media'),
        vscode.Uri.file(path.dirname(require.resolve('mermaid/dist/mermaid.min.js')))
      ]
    }
  );
  panel.iconPath = iconPath;

  activeGraphPanel = panel;
  const generation = nextPanelGeneration(panel);
  panelPendingMessages.set(panel, []);
  panelForceReloadCount.set(panel, 0);
  panelBundles.set(panel, bundle);
  if (options.insights) {
    panelInsights.set(panel, options.insights);
  }
  const html = renderHtml(
    panel.webview,
    bundle,
    state,
    options.message,
    options.insights,
    options.view,
    generation
  );
  assignPanelHtml(panel, html, 'create-panel', {
    archChars: bundle.architecture.length,
    state
  });

  const messageSub = panel.webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage) => {
    if (msg.type === 'webviewLife') {
      const phase = msg.phase || 'unknown';
      panelLastLifePhase.set(panel, phase);
      logWebview(
        panel,
        'life',
        `phase=${phase} · clientGen=${msg.generation ?? '?'} · t=${msg.elapsedMs ?? '?'}ms${
          msg.detail ? ` · ${msg.detail}` : ''
        }`
      );
      return;
    }

    if (msg.type === 'ready') {
      const expected = panelGeneration.get(panel);
      if (typeof msg.generation === 'number' && expected !== undefined && msg.generation !== expected) {
        logWebview(
          panel,
          'ready-ignored',
          `gotGen=${msg.generation} · expectedGen=${expected}`,
          'warn'
        );
        return;
      }
      clearReadyWaitTimer(panel);
      panelWebviewReady.set(panel, true);
      panelForceReloadCount.set(panel, 0);
      panelLastLifePhase.set(panel, 'ready');
      logWebview(panel, 'ready-accepted', `gotGen=${msg.generation ?? expected ?? '?'}`);
      await flushPendingMessages(panel);
      return;
    }

    if (msg.type === 'renderStatus') {
      if (msg.ok) {
        logWebview(
          panel,
          'render-ok',
          `view=${msg.view || 'architecture'} · ${msg.detail || ''}`.trim()
        );
      } else {
        logWebview(panel, 'render-fail', msg.detail || 'unknown', 'error');
      }
      return;
    }

    if (msg.type === 'copySource' && msg.source) {
      await vscode.env.clipboard.writeText(msg.source);
      vscode.window.showInformationMessage(t('webview.copied'));
      return;
    }

    if (msg.type === 'openExternal') {
      const current = panelBundles.get(panel);
      if (!current) {
        vscode.window.showWarningMessage(t('webview.noDiagramYet'));
        return;
      }
      const doc = await vscode.workspace.openTextDocument({
        content: current.architecture,
        language: 'markdown'
      });
      await showDocumentInActiveColumn(doc, { preview: true });
      return;
    }

    if (msg.type === 'openMainFlow') {
      const insights = panelInsights.get(panel);
      if (insights?.mainFlow) {
        openMainFlowDiagram(insights.mainFlow);
      } else if (msg.flow) {
        openMainFlowDiagram(msg.flow);
      }
      return;
    }

    if (msg.type === 'openMindMap') {
      const insights = panelInsights.get(panel);
      if (insights) {
        openLearningMindMap(insights);
      } else {
        vscode.window.showWarningMessage(t('msg.noMindMap'));
      }
      return;
    }

    if (msg.type !== 'nodeClick' || !msg.node) {
      return;
    }

    const asNode = {
      id: msg.node.id || msg.node.filePath || '',
      kind: (msg.node.kind as GraphNode['kind']) || 'file',
      name: msg.node.name || 'node',
      filePath: msg.node.filePath || '',
      startLine: msg.node.startLine ?? 1,
      endLine: msg.node.endLine ?? 1
    } satisfies GraphNode;

    if (onNodeClick) {
      await onNodeClick(asNode);
      return;
    }
    await revealAndExplainNode(asNode);
  });

  const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
    void postToGraphPanel(panel, { type: 'setTheme', mode: hostThemeMode() });
  });

  panel.onDidDispose(() => {
    messageSub.dispose();
    themeSub.dispose();
    clearReadyWaitTimer(panel);
    if (activeGraphPanel === panel) {
      activeGraphPanel = undefined;
    }
    panelBundles.delete(panel);
    panelInsights.delete(panel);
    panelPendingMessages.delete(panel);
    panelWebviewReady.delete(panel);
    panelGeneration.delete(panel);
    panelHtmlAssignedAt.delete(panel);
    panelForceReloadCount.delete(panel);
    panelLastLifePhase.delete(panel);
  });

  return panel;
}

/**
 * Kirim bundle Mermaid ke webview via postMessage (HTML reload hanya fallback).
 * Reload full HTML setiap update sering bikin panel blank saat payload insights besar.
 */
export async function updateGraphPanel(
  panel: vscode.WebviewPanel,
  graph: CodeGraph,
  options: GraphPanelOptions = {}
): Promise<void> {
  const bundle = buildRepoMermaidBundle(graph, options.insights, {
    functionFilePath: options.functionFilePath,
    focusNodeId: options.focusNodeId
  });
  panelBundles.set(panel, bundle);
  if (options.insights) {
    panelInsights.set(panel, options.insights);
  } else {
    panelInsights.delete(panel);
  }

  const state = options.state ?? (graph.nodes.length > 0 ? 'ready' : 'empty');
  const insights = toWebviewInsights(options.insights ?? panelInsights.get(panel) ?? null);
  const message: ExtensionToWebviewMessage = {
    type: 'setGraph',
    bundle,
    insights,
    state,
    message: options.message,
    view: options.view
  };

  if (panelWebviewReady.get(panel)) {
    const ok = await panel.webview.postMessage(message);
    if (!ok) {
      logWebview(panel, 'postMessage-fail', 'setGraph — fallback reload', 'warn');
      reloadPanelHtml(
        panel,
        {
          state,
          message: options.message,
          view: options.view
        },
        'postMessage-setGraph-failed'
      );
    } else {
      logWebview(
        panel,
        'setGraph-sent',
        `${state} · ${bundle.stats.shownFiles}/${bundle.stats.fileCount} file · arch=${bundle.architecture.length} char`
      );
    }
    return;
  }

  queuePanelMessage(panel, message);
  logWebview(
    panel,
    'setGraph-queued',
    `${bundle.stats.shownFiles}/${bundle.stats.fileCount} file · arch=${bundle.architecture.length} char`
  );

  // Jika handshake ready gagal (script crash), jangan stuck forever di loading.
  clearReadyWaitTimer(panel);
  const timer = setTimeout(() => {
    panelReadyWaitTimer.delete(panel);
    if (panelWebviewReady.get(panel)) {
      return;
    }
    if (panelBundles.get(panel) !== bundle) {
      logWebview(panel, 'ready-timeout-skip', 'bundle sudah diganti');
      return;
    }
    const forces = panelForceReloadCount.get(panel) ?? 0;
    if (forces >= WEBVIEW_MAX_FORCE_RELOADS) {
      logWebview(
        panel,
        'ready-timeout',
        `sudah ${forces}x force-reload — berhenti thrash · life=${panelLastLifePhase.get(panel) || '-'}`,
        'error'
      );
      return;
    }
    panelForceReloadCount.set(panel, forces + 1);
    logWebview(
      panel,
      'ready-timeout',
      `force reload HTML (${forces + 1}/${WEBVIEW_MAX_FORCE_RELOADS})`,
      'warn'
    );
    reloadPanelHtml(
      panel,
      {
        state,
        message: options.message,
        view: options.view
      },
      'ready-timeout-force-reload'
    );
  }, WEBVIEW_READY_TIMEOUT_MS);
  panelReadyWaitTimer.set(panel, timer);
}

export async function setGraphPanelState(
  panel: vscode.WebviewPanel,
  state: GraphPanelState,
  message?: string
): Promise<void> {
  await postToGraphPanel(panel, { type: 'setState', state, message });
}

export function resolveGraphNodeUri(node: Partial<GraphNode> | undefined): vscode.Uri | null {
  const candidate =
    typeof node?.filePath === 'string' && node.filePath.trim().length > 0
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

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function renderHtml(
  webview: vscode.Webview,
  bundle: RepoMermaidBundle,
  initialState: GraphPanelState,
  initialMessage?: string,
  initialInsights?: GraphInsights,
  initialView: MermaidGraphView = 'architecture',
  generation = 1
): string {
  const nonce = getNonce();
  const mermaidPath = require.resolve('mermaid/dist/mermaid.min.js');
  const mermaidUri = webview.asWebviewUri(vscode.Uri.file(mermaidPath));
  const ui = webviewUiMessages();
  const payload = escapeJsonForScript({
    bundle,
    insights: toWebviewInsights(initialInsights),
    state: initialState,
    message: initialMessage ?? '',
    view: initialView,
    theme: hostThemeMode(),
    generation,
    mermaidUri: String(mermaidUri),
    scriptNonce: nonce,
    ui
  });
  const badgeLabel = `${bundle.stats.shownFiles || 0} file`;
  const lang = ui.lang || getLanguage();

  return `<!DOCTYPE html>
<html lang="${escapeHtmlAttr(lang)}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src ${webview.cspSource} data:;
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src ${webview.cspSource} 'nonce-${nonce}';
    worker-src ${webview.cspSource} blob:;
    font-src ${webview.cspSource} data:;
  ">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b1220;
      --panel: #111827;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --border: rgba(148, 163, 184, 0.22);
      --accent: #2dd4bf;
      --accent-2: #38bdf8;
      --error: #f87171;
      --warn: #fbbf24;
      --card: rgba(17, 24, 39, 0.92);
    }
    body[data-theme="light"] {
      color-scheme: light;
      --bg: #f8fafc;
      --panel: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: rgba(15, 23, 42, 0.12);
      --accent: #0f766e;
      --accent-2: #0369a1;
      --card: rgba(255, 255, 255, 0.94);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      height: 100%;
      background:
        radial-gradient(ellipse 60% 40% at 100% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 55%),
        var(--bg);
      color: var(--text);
      font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
    }
    .shell { height: 100%; display: grid; grid-template-rows: auto 1fr; }
    .header {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 14px; border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 88%, transparent);
      backdrop-filter: blur(10px);
    }
    .brand { display: flex; align-items: baseline; gap: 8px; }
    .title { font-size: 14px; font-weight: 750; letter-spacing: -0.02em; }
    .badge {
      font-size: 11px; padding: 3px 8px; border-radius: 999px;
      border: 1px solid var(--border); color: var(--muted);
    }
    .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .seg button {
      border: 0; background: transparent; color: var(--muted);
      padding: 6px 10px; font-size: 12px; cursor: pointer;
    }
    .seg button.active { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--text); }
    .ghost, .primary {
      border: 1px solid var(--border); background: transparent; color: var(--text);
      border-radius: 10px; padding: 6px 10px; font-size: 12px; cursor: pointer;
    }
    .primary { background: color-mix(in srgb, var(--accent) 22%, transparent); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
    .content {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      min-height: 0;
      height: 100%;
    }
    .canvas-wrap {
      position: relative;
      min-height: 0;
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
      overflow: hidden;
    }
    .zoom-bar {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      padding: 8px 12px; border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 80%, transparent);
    }
    .zoom-bar .hint { color: var(--muted); font-size: 11px; margin-left: 4px; }
    .zoom-bar button {
      border: 1px solid var(--border); background: transparent; color: var(--text);
      border-radius: 8px; min-width: 32px; height: 28px; cursor: pointer; font-size: 13px;
    }
    .zoom-bar button:hover { border-color: var(--accent); }
    .zoom-bar #zoomLabel {
      min-width: 48px; text-align: center; font-size: 12px; color: var(--muted);
    }
    .viewport-host {
      position: relative;
      min-height: 0;
      overflow: hidden;
      cursor: grab;
      touch-action: none;
      background:
        radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--border) 70%, transparent) 1px, transparent 0) 0 0 / 18px 18px;
    }
    .viewport-host.is-panning { cursor: grabbing; }
    .viewport {
      transform-origin: 0 0;
      padding: 24px;
      width: max-content;
      min-width: 100%;
      min-height: 100%;
    }
    #diagram {
      min-height: 200px;
      display: inline-block;
    }
    #diagram svg {
      max-width: none;
      height: auto;
      display: block;
      shape-rendering: geometricPrecision;
      text-rendering: geometricPrecision;
    }
    #diagram .node, #diagram .node * { cursor: pointer !important; }
    #diagram .node:hover > rect,
    #diagram .node:hover > polygon,
    #diagram .node:hover > circle,
    #diagram .node:hover > path {
      stroke: var(--accent) !important;
      stroke-width: 2.5px !important;
    }
    .insights {
      display: none;
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(360px, 42vw);
      z-index: 6;
      border-left: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 96%, transparent);
      backdrop-filter: blur(12px);
      overflow: auto;
      padding: 12px 14px 20px;
    }
    .content.insights-open .insights { display: block; }
    .content.insights-collapsed .insights { display: none; }
    .insights h2 { margin: 0 0 8px; font-size: 13px; }
    .insights h3 { margin: 14px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .md-body { font-size: 12px; line-height: 1.5; color: var(--text); }
    .muted { color: var(--muted); font-size: 12px; }
    .chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      border: 1px solid var(--border); border-radius: 999px; padding: 4px 8px;
      font-size: 11px; background: transparent; color: var(--text); cursor: pointer;
    }
    .chip:hover { border-color: var(--accent); }
    .stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
    .stat {
      border: 1px solid var(--border); border-radius: 12px; padding: 8px 10px;
      background: color-mix(in srgb, var(--panel) 80%, transparent);
    }
    .stat strong { display: block; font-size: 16px; }
    .stat small { color: var(--muted); }
    .state {
      position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--bg) 82%, transparent); z-index: 3; padding: 24px; text-align: center;
    }
    .state.is-active { display: flex; }
    .card {
      max-width: 420px; padding: 22px; border-radius: 16px; border: 1px solid var(--border);
      background: var(--card); box-shadow: 0 18px 50px color-mix(in srgb, var(--text) 12%, transparent);
    }
    .card h2 { margin: 0 0 8px; font-size: 17px; }
    .card p { margin: 0; color: var(--muted); line-height: 1.5; }
    .source {
      margin-top: 12px; width: 100%; max-height: 140px; overflow: auto;
      border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px;
      background: color-mix(in srgb, var(--panel) 88%, transparent);
      color: var(--muted); font-size: 11px; white-space: pre-wrap;
    }
    @media (max-width: 900px) {
      .insights {
        width: 100%;
        max-height: 45%;
        top: auto;
        border-left: none;
        border-top: 1px solid var(--border);
      }
    }
  </style>
</head>
<body data-theme="${hostThemeMode()}">
  <div class="shell">
    <div class="header">
      <div class="badge" id="badge">${escapeHtmlAttr(badgeLabel)}</div>
      <div class="seg" role="group" aria-label="${escapeHtmlAttr(t('webview.flow'))}">
        <button type="button" data-view="modules">${escapeHtmlAttr(t('webview.modules'))}</button>
        <button type="button" data-view="flow">${escapeHtmlAttr(t('webview.flow'))}</button>
        <button type="button" data-view="functions">${escapeHtmlAttr(t('webview.functions'))}</button>
      </div>
      <button type="button" class="ghost" id="insightsToggle">${escapeHtmlAttr(t('webview.insights'))}</button>
      <button type="button" class="ghost" id="copySource">${escapeHtmlAttr(t('webview.copyMermaid'))}</button>
      <button type="button" class="ghost" id="openSource">${escapeHtmlAttr(t('webview.openSource'))}</button>
      <button type="button" class="ghost" id="themeToggle">${escapeHtmlAttr(t('webview.theme'))}</button>
      <button type="button" class="primary" id="openFlow">${escapeHtmlAttr(t('webview.fullFlow'))}</button>
      <button type="button" class="ghost" id="openMindMap">${escapeHtmlAttr(t('webview.mindMap'))}</button>
    </div>
    <div class="content insights-collapsed" id="contentShell">
      <div class="canvas-wrap">
        <div class="zoom-bar" aria-label="Zoom">
          <button type="button" id="zoomOut" title="Zoom out (−)">−</button>
          <span id="zoomLabel">100%</span>
          <button type="button" id="zoomIn" title="Zoom in (+)">+</button>
          <button type="button" id="zoomFit" title="Fit diagram">Fit</button>
          <button type="button" id="zoomReset" title="Reset 100%">1:1</button>
          <span class="hint">${escapeHtmlAttr(t('webview.zoomHint'))}</span>
        </div>
        <div class="viewport-host" id="viewportHost">
          <div class="viewport" id="viewport">
            <div id="diagram"></div>
          </div>
        </div>
        <pre class="source" id="sourcePreview" hidden></pre>
        <div class="state${initialState === 'loading' ? ' is-active' : ''}" id="loadingState">
          <div class="card"><h2>${escapeHtmlAttr(t('webview.loadingTitle'))}</h2><p id="loadingMessage">${escapeHtmlAttr(initialMessage && initialState === 'loading' ? initialMessage : t('webview.loadingBody'))}</p></div>
        </div>
        <div class="state${initialState === 'empty' ? ' is-active' : ''}" id="emptyState">
          <div class="card"><h2>${escapeHtmlAttr(t('webview.emptyTitle'))}</h2><p id="emptyMessage">${escapeHtmlAttr(initialMessage && initialState === 'empty' ? initialMessage : t('webview.emptyBody'))}</p></div>
        </div>
        <div class="state${initialState === 'error' ? ' is-active' : ''}" id="errorState">
          <div class="card"><h2>${escapeHtmlAttr(t('webview.errorTitle'))}</h2><p id="errorMessage">${escapeHtmlAttr(initialMessage && initialState === 'error' ? initialMessage : t('webview.errorBody'))}</p></div>
        </div>
      </div>
      <aside class="insights" id="insightsPane">
        <h2>${escapeHtmlAttr(t('webview.insightsTitle'))}</h2>
        <h3>${escapeHtmlAttr(t('webview.purposeHeading'))}</h3>
        <div class="md-body" id="insightsPurpose">${escapeHtmlAttr(t('webview.noInsightsPurpose'))}</div>
        <h3>${escapeHtmlAttr(t('webview.summaryHeading'))}</h3>
        <div class="md-body" id="insightsSummary">${escapeHtmlAttr(t('webview.noInsightsSummary'))}</div>
        <h3>${escapeHtmlAttr(t('webview.mainFlowHeading'))}</h3>
        <div class="stat" id="mainFlowCard">
          <strong id="mainFlowTitle">${escapeHtmlAttr(t('webview.mainFlowEmpty'))}</strong>
          <small id="mainFlowMeta">${escapeHtmlAttr(t('webview.mainFlowEmptyHint'))}</small>
          <div class="chip-list" id="mainFlowStages"></div>
          <button type="button" class="chip" id="openFlowInline" style="margin-top:8px;">${escapeHtmlAttr(t('webview.openFullFlow'))}</button>
          <button type="button" class="chip" id="openMindMapInline" style="margin-top:8px;">${escapeHtmlAttr(t('webview.openMindMap'))}</button>
        </div>
        <h3>${escapeHtmlAttr(t('webview.entryHeading'))}</h3>
        <div class="chip-list" id="entryList"></div>
        <h3>${escapeHtmlAttr(t('webview.hubHeading'))}</h3>
        <div class="chip-list" id="hubList"></div>
        <h3>${escapeHtmlAttr(t('webview.statsHeading'))}</h3>
        <div class="stat-row">
          <div class="stat"><strong id="statFiles">0</strong><small>${escapeHtmlAttr(t('webview.statFiles'))}</small></div>
          <div class="stat"><strong id="statEdges">0</strong><small>${escapeHtmlAttr(t('webview.statEdges'))}</small></div>
          <div class="stat"><strong id="statTotal">0</strong><small>${escapeHtmlAttr(t('webview.statTotal'))}</small></div>
          <div class="stat"><strong id="statNodes">0</strong><small>${escapeHtmlAttr(t('webview.statNodes'))}</small></div>
        </div>
        <p class="muted" id="truncateNote" hidden></p>
      </aside>
    </div>
  </div>
  <script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const bootStartedAt = Date.now();
  let bootGeneration = 0;
  function life(phase, detail) {
    try {
      vscode.postMessage({
        type: 'webviewLife',
        phase: phase,
        detail: detail ? String(detail) : undefined,
        generation: bootGeneration,
        elapsedMs: Date.now() - bootStartedAt
      });
    } catch (_) {}
  }
  life('script-start');
  try {
    ${MARKDOWN_LITE_WEBVIEW_SCRIPT}
    const boot = ${payload};
    const ui = boot.ui || {};
    bootGeneration = boot.generation || 0;
    life('boot-parsed', 'arch=' + ((boot.bundle && boot.bundle.architecture) || '').length + ' state=' + (boot.state || ''));
    let bundle = boot.bundle;
    let insights = boot.insights;
    let view = boot.view || 'architecture';
    let theme = boot.theme || 'dark';
    let renderToken = 0;
    let mermaidLoadPromise = null;

    const diagramEl = document.getElementById('diagram');
    const viewport = document.getElementById('viewport');
    const viewportHost = document.getElementById('viewportHost');
    const zoomLabel = document.getElementById('zoomLabel');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const loadingMessage = document.getElementById('loadingMessage');
    const emptyMessage = document.getElementById('emptyMessage');
    const errorMessage = document.getElementById('errorMessage');
    const badge = document.getElementById('badge');
    const insightsSummary = document.getElementById('insightsSummary');
    const insightsPurpose = document.getElementById('insightsPurpose');
    const mainFlowTitle = document.getElementById('mainFlowTitle');
    const mainFlowMeta = document.getElementById('mainFlowMeta');
    const mainFlowStages = document.getElementById('mainFlowStages');
    const openFlowInline = document.getElementById('openFlowInline');
    const openMindMapInline = document.getElementById('openMindMapInline');
    const entryList = document.getElementById('entryList');
    const hubList = document.getElementById('hubList');
    const contentShell = document.getElementById('contentShell');
    const sourcePreview = document.getElementById('sourcePreview');

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let panMoved = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let baseSvgWidth = 0;
    let baseSvgHeight = 0;

    function currentSvg() {
      return diagramEl.querySelector('svg');
    }

    function captureSvgBaseSize(svg) {
      // Simpan ukuran intrinsik sekali; zoom mengubah width/height (vektor tetap tajam)
      const widthAttr = svg.getAttribute('width');
      const heightAttr = svg.getAttribute('height');
      let w = widthAttr ? parseFloat(widthAttr) : NaN;
      let h = heightAttr ? parseFloat(heightAttr) : NaN;
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        try {
          const bbox = svg.getBBox();
          w = bbox.width || svg.clientWidth || 800;
          h = bbox.height || svg.clientHeight || 600;
        } catch (_) {
          w = svg.clientWidth || 800;
          h = svg.clientHeight || 600;
        }
      }
      baseSvgWidth = w;
      baseSvgHeight = h;
      svg.removeAttribute('style');
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
    }

    function applyTransform() {
      // Hanya translate untuk pan — scale lewat atribut SVG agar tidak buram
      viewport.style.transform = 'translate(' + Math.round(panX) + 'px,' + Math.round(panY) + 'px)';
      zoomLabel.textContent = Math.round(scale * 100) + '%';
      const svg = currentSvg();
      if (svg && baseSvgWidth > 0 && baseSvgHeight > 0) {
        svg.setAttribute('width', String(Math.max(40, baseSvgWidth * scale)));
        svg.setAttribute('height', String(Math.max(40, baseSvgHeight * scale)));
      }
    }

    function setZoom(next, anchorX, anchorY) {
      const prev = scale;
      scale = Math.min(3.5, Math.max(0.35, next));
      if (typeof anchorX === 'number' && typeof anchorY === 'number' && prev > 0) {
        const ratio = scale / prev;
        panX = anchorX - (anchorX - panX) * ratio;
        panY = anchorY - (anchorY - panY) * ratio;
      }
      applyTransform();
    }

    function zoomBy(factor) {
      const rect = viewportHost.getBoundingClientRect();
      setZoom(scale * factor, rect.width / 2, rect.height / 2);
    }

    function fitDiagram() {
      const svg = currentSvg();
      if (!svg) {
        scale = 1; panX = 0; panY = 0; applyTransform();
        return;
      }
      if (!baseSvgWidth || !baseSvgHeight) {
        captureSvgBaseSize(svg);
      }
      const hostRect = viewportHost.getBoundingClientRect();
      const pad = 56;
      const availW = Math.max(120, hostRect.width - pad);
      const availH = Math.max(120, hostRect.height - pad);
      const next = Math.min(availW / baseSvgWidth, availH / baseSvgHeight, 1.35);
      scale = Math.max(0.35, Math.min(2.2, next));
      panX = Math.round((hostRect.width - baseSvgWidth * scale) / 2);
      panY = Math.round((hostRect.height - baseSvgHeight * scale) / 2);
      applyTransform();
    }

    function resetZoom() {
      scale = 1;
      panX = 24;
      panY = 24;
      applyTransform();
    }

    function setState(next, message) {
      loadingState.classList.toggle('is-active', next === 'loading');
      emptyState.classList.toggle('is-active', next === 'empty');
      errorState.classList.toggle('is-active', next === 'error');
      diagramEl.style.opacity = next === 'ready' ? '1' : '0.35';
      if (message) {
        if (next === 'loading') loadingMessage.textContent = message;
        if (next === 'empty') emptyMessage.textContent = message;
        if (next === 'error') errorMessage.textContent = message;
      }
    }

    function currentSource() {
      if (!bundle) return '';
      if (view === 'modules') return bundle.modules || '';
      if (view === 'flow') return bundle.flow || '';
      if (view === 'functions') return bundle.functions || '';
      return bundle.architecture || '';
    }

    function sourceWithClicks(source) {
      // Jangan sisipkan click directive Mermaid — sering bikin parse gagal.
      // Klik node di-handle lewat wireSvgClicks pada SVG.
      return source;
    }

    function loadMermaidLibrary() {
      if (window.mermaid) {
        return Promise.resolve(true);
      }
      if (mermaidLoadPromise) {
        return mermaidLoadPromise;
      }
      const src = boot.mermaidUri;
      if (!src) {
        life('mermaid-missing-uri');
        return Promise.resolve(false);
      }
      life('mermaid-load-start', src.slice(-48));
      mermaidLoadPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        if (boot.scriptNonce) {
          script.setAttribute('nonce', boot.scriptNonce);
        }
        script.onload = () => {
          life('mermaid-load-ok', window.mermaid ? 'defined' : 'undefined-after-load');
          resolve(!!window.mermaid);
        };
        script.onerror = () => {
          life('mermaid-load-error', src.slice(-64));
          resolve(false);
        };
        document.head.appendChild(script);
      });
      return mermaidLoadPromise;
    }

    async function renderDiagram() {
      const token = ++renderToken;
      const source = currentSource();
      sourcePreview.textContent = source;
      updateViewButtons();
      renderStats();

      function report(ok, detail) {
        try {
          vscode.postMessage({
            type: 'renderStatus',
            ok: !!ok,
            detail: String(detail || ''),
            view: view
          });
        } catch (_) {}
      }

      if (!bundle || !source.trim()) {
        setState('empty', ui['webview.noMermaid'] || 'Belum ada konten Mermaid.');
        diagramEl.innerHTML = '';
        sourcePreview.hidden = false;
        report(false, 'sumber Mermaid kosong');
        return;
      }

      setState('ready');
      diagramEl.innerHTML = '<p class="muted">' + (ui['webview.rendering'] || 'Merender…') + '</p>';

      const mermaidOk = await loadMermaidLibrary();
      if (token !== renderToken) return;
      if (!mermaidOk || !window.mermaid) {
        setState('error', ui['webview.mermaidMissing'] || 'Library Mermaid tidak tersedia di webview. Cek CSP / path mermaid.min.js.');
        sourcePreview.hidden = false;
        report(false, 'window.mermaid undefined');
        return;
      }

      try {
        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: theme === 'dark' ? 'dark' : 'default',
          flowchart: {
            curve: 'basis',
            htmlLabels: true,
            padding: 16,
            nodeSpacing: 36,
            rankSpacing: 48,
            diagramPadding: 16
          }
        });
        const id = 'nm_' + Date.now() + '_' + token;
        life('mermaid-render-start', 'chars=' + source.length);
        const { svg } = await window.mermaid.render(id, sourceWithClicks(source));
        if (token !== renderToken) return;
        diagramEl.innerHTML = svg;
        const svgEl = diagramEl.querySelector('svg');
        if (svgEl) {
          wireSvgClicks(svgEl);
          captureSvgBaseSize(svgEl);
          scale = 1;
          panX = 24;
          panY = 24;
          requestAnimationFrame(() => fitDiagram());
        }
        life('mermaid-render-ok', 'svg=' + (svg ? svg.length : 0));
        report(true, 'svg=' + (svg ? svg.length : 0) + 'char');
      } catch (error) {
        if (token !== renderToken) return;
        console.warn('NeverMIN mermaid render error', error);
        // Fallback: tanpa htmlLabels
        try {
          window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: theme === 'dark' ? 'dark' : 'default',
            flowchart: {
              curve: 'basis',
              htmlLabels: false,
              padding: 12,
              nodeSpacing: 28,
              rankSpacing: 40
            }
          });
          const plainSource = source
            .replace(/<br\\s*\\/?>/gi, ' - ')
            .replace(/#amp;/g, 'and')
            .replace(/#quot;/g, "'");
          const id = 'nm_fallback_' + Date.now();
          const { svg } = await window.mermaid.render(id, plainSource);
          if (token !== renderToken) return;
          diagramEl.innerHTML = svg;
          const svgEl = diagramEl.querySelector('svg');
          if (svgEl) {
            wireSvgClicks(svgEl);
            captureSvgBaseSize(svgEl);
            requestAnimationFrame(() => fitDiagram());
          }
          setState('ready');
          life('mermaid-render-fallback-ok');
          report(true, 'fallback svg ok');
        } catch (inner) {
          const detail = inner instanceof Error ? inner.message : String(inner || error);
          const failTpl = ui['webview.mermaidFail'] || 'Mermaid gagal dirender: {detail}';
          setState('error', failTpl.replace('{detail}', detail));
          sourcePreview.hidden = false;
          life('mermaid-render-fail', detail);
          report(false, detail);
        }
      }
    }

    function updateViewButtons() {
      document.querySelectorAll('[data-view]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
      });
    }

    function applyTheme() {
      document.body.setAttribute('data-theme', theme);
      document.getElementById('themeToggle').textContent =
        theme === 'dark'
          ? (ui['webview.themeLight'] || 'Terang')
          : (ui['webview.themeDark'] || 'Gelap');
    }

    function openNode(meta) {
      if (!meta || !meta.filePath) return;
      vscode.postMessage({ type: 'nodeClick', node: meta });
    }

    window.neverminOpen = function(mermaidId) {
      const index = (bundle && bundle.nodeIndex) || {};
      openNode(index[mermaidId]);
    };

    function renderChips(host, refs) {
      host.innerHTML = '';
      if (!refs || !refs.length) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = '—';
        host.appendChild(p);
        return;
      }
      refs.slice(0, 8).forEach((ref) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip';
        btn.textContent = ref.name;
        btn.title = ref.reason || ref.filePath || '';
        btn.addEventListener('click', () => {
          openNode({
            id: ref.id,
            name: ref.name,
            kind: ref.kind,
            filePath: ref.filePath,
            startLine: ref.startLine,
            endLine: ref.endLine
          });
        });
        host.appendChild(btn);
      });
    }

    function splitNarrativeSections(markdown) {
      const source = String(markdown || '').trim();
      if (!source) {
        return { purpose: '', rest: '' };
      }

      // Penting: di dalam template literal host, setiap \\ harus digandakan
      // supaya webview menerima regex/string yang valid (\\n jangan jadi newline).
      const purposeMatch = source.match(/##\\s*(?:Kodingan ini untuk apa|What this codebase is for)\\s*([\\s\\S]*?)(?=\\n##\\s|$)/i);
      if (!purposeMatch) {
        // Fallback: paragraf pertama sebagai tujuan aplikasi
        const parts = source.split(/\\n##\\s+/);
        const first = parts[0].replace(/^#+\\s*[^\\n]*\\n?/, '').trim();
        const rest = parts.length > 1 ? '## ' + parts.slice(1).join('\\n## ') : '';
        return { purpose: first, rest };
      }

      const purpose = purposeMatch[1].trim();
      const rest = (source.slice(0, purposeMatch.index) + source.slice(purposeMatch.index + purposeMatch[0].length))
        .replace(/^\\s+/, '')
        .trim();
      return { purpose, rest };
    }

    function renderInsights() {
      if (!insights) {
        if (insightsPurpose) {
          insightsPurpose.textContent = ui['webview.noInsightsPurpose'] || 'Jalankan analisis + API key untuk penjelasan aplikasi.';
        }
        insightsSummary.textContent = ui['webview.noInsightsSummary'] || 'Jalankan analisis untuk ringkasan.';
        if (mainFlowTitle) {
          mainFlowTitle.textContent = ui['webview.mainFlowEmpty'] || 'Belum ada alur';
          mainFlowMeta.textContent = ui['webview.mainFlowEmptyHint'] || 'Jalankan analisis untuk melihat input, proses, dan output.';
        }
        renderChips(mainFlowStages, []);
        renderChips(entryList, []);
        renderChips(hubList, []);
        return;
      }
      const markdown = insights.narrative
        || (insights.summaryBullets || []).map((b) => '- ' + b).join('\\n')
        || (ui['webview.insights'] || 'Insights');
      const sections = splitNarrativeSections(markdown);
      if (insightsPurpose) {
        insightsPurpose.innerHTML = renderMarkdownLite(
          sections.purpose || ui['webview.purposeFallback'] || 'Aplikasi ini adalah aplikasi untuk (belum terdeteksi — jalankan ulang analisis dengan API key).'
        );
      }
      insightsSummary.innerHTML = renderMarkdownLite(sections.rest || markdown);
      const flow = insights.mainFlow;
      if (flow) {
        const stageLabels = uniqueFlowStageLabels(flow);
        if (mainFlowTitle) {
          mainFlowTitle.textContent = flow.input + ' → ' + flow.output;
        }
        if (mainFlowMeta) {
          mainFlowMeta.textContent = stageLabels.length + ' tahap · io score ' + String(flow.ioScore || 0);
        }
        renderChips(
          mainFlowStages,
          (flow.stages || []).map((stage) => ({
            id: stage.nodeId,
            name: stage.name,
            kind: 'function',
            filePath: stage.filePath,
            startLine: stage.startLine,
            endLine: stage.endLine,
            reason: stage.role
          }))
        );
      } else {
        if (mainFlowTitle) {
          mainFlowTitle.textContent = ui['webview.mainFlowEmpty'] || 'Belum ada alur';
        }
        if (mainFlowMeta) {
          mainFlowMeta.textContent = ui['webview.mainFlowWeak'] || 'Analisis belum menemukan input, proses, dan output yang kuat.';
        }
        renderChips(mainFlowStages, []);
      }
      renderChips(entryList, insights.entryPoints || []);
      renderChips(hubList, insights.hubs || []);
      document.getElementById('statNodes').textContent = String(insights.stats?.nodeCount || 0);
    }

    function uniqueFlowStageLabels(flow) {
      const seen = new Set();
      const labels = [];
      (flow.stages || []).forEach((stage) => {
        const key = stage.role + ':' + stage.name;
        if (seen.has(key)) return;
        seen.add(key);
        labels.push(stage.name);
      });
      return labels;
    }

    function renderStats() {
      if (!bundle) return;
      document.getElementById('statFiles').textContent = String(bundle.stats.shownFiles);
      document.getElementById('statEdges').textContent = String(bundle.stats.edgeCount);
      document.getElementById('statTotal').textContent = String(bundle.stats.fileCount);
      badge.textContent = bundle.stats.shownFiles + ' file';
      const note = document.getElementById('truncateNote');
      if (bundle.stats.truncated) {
        note.hidden = false;
        const tpl = ui['webview.truncateNote'] || 'Ditampilkan {shown} dari {total} file (prioritas entry/hub/relasi).';
        note.textContent = tpl
          .replace('{shown}', String(bundle.stats.shownFiles))
          .replace('{total}', String(bundle.stats.fileCount));
      } else {
        note.hidden = true;
      }
    }

    function resolveMetaFromSvgNode(el) {
      const index = (bundle && bundle.nodeIndex) || {};
      const keys = Object.keys(index);
      let cur = el;
      while (cur && cur !== diagramEl) {
        const rawId = cur.id || '';
        if (rawId) {
          if (index[rawId]) return index[rawId];
          const hit = keys.find((k) => rawId === k || rawId.endsWith('-' + k) || rawId.includes('-' + k + '-') || rawId.startsWith(k));
          if (hit) return index[hit];
        }
        // Mermaid kadang menyimpan id di data-id / title
        const dataId = cur.getAttribute && (cur.getAttribute('data-id') || cur.getAttribute('data-node'));
        if (dataId && index[dataId]) return index[dataId];
        cur = cur.parentElement;
      }

      // Fallback: cocokkan label teks
      const text = (el.closest && el.closest('.node') ? el.closest('.node') : el).textContent || '';
      const label = text.replace(/\\s+/g, ' ').trim();
      if (!label) return null;
      return keys.map((k) => index[k]).find((meta) => meta && (meta.name === label || String(meta.name).endsWith(label) || label.endsWith(meta.name))) || null;
    }

    function wireSvgClicks(svg) {
      svg.querySelectorAll('g.node').forEach((nodeEl) => {
        nodeEl.style.cursor = 'pointer';
        nodeEl.addEventListener('click', (event) => {
          if (panMoved) return;
          event.preventDefault();
          event.stopPropagation();
          const meta = resolveMetaFromSvgNode(nodeEl);
          openNode(meta);
        });
      });
    }

    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-view') || 'architecture';
        // Klik ulang tab aktif → kembali ke arsitektur default
        view = view === next ? 'architecture' : next;
        renderDiagram();
      });
    });

    document.getElementById('insightsToggle').addEventListener('click', () => {
      const open = !contentShell.classList.contains('insights-open');
      contentShell.classList.toggle('insights-open', open);
      contentShell.classList.toggle('insights-collapsed', !open);
      document.getElementById('insightsToggle').textContent = open
        ? (ui['webview.closeInsights'] || 'Tutup Insights')
        : (ui['webview.insights'] || 'Insights');
      // Canvas tetap full width (insights overlay) — cukup re-fit
      setTimeout(() => fitDiagram(), 80);
    });

    document.getElementById('themeToggle').addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      renderDiagram();
    });

    document.getElementById('copySource').addEventListener('click', () => {
      vscode.postMessage({ type: 'copySource', source: currentSource() });
    });

    document.getElementById('openSource').addEventListener('click', () => {
      sourcePreview.hidden = !sourcePreview.hidden;
      vscode.postMessage({ type: 'openExternal' });
    });

    document.getElementById('openFlow').addEventListener('click', () => {
      vscode.postMessage({ type: 'openMainFlow', flow: insights && insights.mainFlow });
    });
    document.getElementById('openMindMap').addEventListener('click', () => {
      vscode.postMessage({ type: 'openMindMap' });
    });
    if (openFlowInline) {
      openFlowInline.addEventListener('click', () => {
        vscode.postMessage({ type: 'openMainFlow', flow: insights && insights.mainFlow });
      });
    }
    if (openMindMapInline) {
      openMindMapInline.addEventListener('click', () => {
        vscode.postMessage({ type: 'openMindMap' });
      });
    }

    document.getElementById('zoomIn').addEventListener('click', () => zoomBy(1.2));
    document.getElementById('zoomOut').addEventListener('click', () => zoomBy(1 / 1.2));
    document.getElementById('zoomFit').addEventListener('click', () => fitDiagram());
    document.getElementById('zoomReset').addEventListener('click', () => resetZoom());

    viewportHost.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = viewportHost.getBoundingClientRect();
      const anchorX = event.clientX - rect.left;
      const anchorY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom(scale * factor, anchorX, anchorY);
    }, { passive: false });

    viewportHost.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      // Jangan mulai pan jika klik langsung di node (biar click tetap jalan)
      if (event.target && event.target.closest && event.target.closest('g.node')) {
        panMoved = false;
        return;
      }
      isPanning = true;
      panMoved = false;
      startX = event.clientX;
      startY = event.clientY;
      originX = panX;
      originY = panY;
      viewportHost.classList.add('is-panning');
      viewportHost.setPointerCapture(event.pointerId);
    });

    viewportHost.addEventListener('pointermove', (event) => {
      if (!isPanning) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) panMoved = true;
      panX = originX + dx;
      panY = originY + dy;
      applyTransform();
    });

    function endPan(event) {
      if (!isPanning) return;
      isPanning = false;
      viewportHost.classList.remove('is-panning');
      try { viewportHost.releasePointerCapture(event.pointerId); } catch (_) {}
    }
    viewportHost.addEventListener('pointerup', endPan);
    viewportHost.addEventListener('pointercancel', endPan);

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      try {
        if (msg.type === 'setGraph') {
          life('msg-setGraph', 'state=' + (msg.state || '') + ' arch=' + ((msg.bundle && msg.bundle.architecture) || '').length);
          bundle = msg.bundle || bundle;
          if (Object.prototype.hasOwnProperty.call(msg, 'insights')) {
            insights = msg.insights;
          }
          if (msg.view) view = msg.view;
          try {
            renderInsights();
          } catch (err) {
            console.warn('NeverMIN insights render error', err);
          }
          if (msg.state === 'loading' || msg.state === 'empty' || msg.state === 'error') {
            setState(msg.state, msg.message);
            return;
          }
          void renderDiagram();
          return;
        }
        if (msg.type === 'setState') {
          setState(msg.state || 'loading', msg.message);
          return;
        }
        if (msg.type === 'setTheme' && (msg.mode === 'light' || msg.mode === 'dark')) {
          theme = msg.mode;
          applyTheme();
          void renderDiagram();
        }
      } catch (err) {
        const detail = err && err.message ? err.message : String(err);
        setState('error', 'Gagal memproses update diagram: ' + detail);
      }
    });

    applyTheme();
    applyTransform();
    try {
      renderInsights();
    } catch (err) {
      console.warn('NeverMIN insights bootstrap error', err);
    }

    // Handshake SEBELUM Mermaid load — supaya setGraph tidak stuck di queue.
    life('shell-ready');
    try {
      vscode.postMessage({ type: 'ready', generation: bootGeneration });
    } catch (_) {}

    if (boot.state === 'loading' || boot.state === 'empty' || boot.state === 'error') {
      setState(boot.state, boot.message);
    } else {
      void renderDiagram();
    }
  } catch (bootErr) {
    var detail = bootErr && bootErr.message ? bootErr.message : String(bootErr);
    life('boot-crash', detail);
    document.body.innerHTML = '<pre style="padding:16px;color:#f87171;white-space:pre-wrap;font:12px/1.45 monospace">NeverMIN webview crash:\\n' + detail + '</pre>';
    try {
      vscode.postMessage({ type: 'renderStatus', ok: false, detail: 'boot: ' + detail });
      vscode.postMessage({ type: 'ready', generation: bootGeneration });
    } catch (_) {}
  }
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
    const editor = await showDocumentInActiveColumn(document, { preview: true });

    const lineCount = Math.max(1, document.lineCount);
    const startLine = Math.max(0, Math.min(lineCount - 1, (node.startLine ?? 1) - 1));
    const endLine = Math.max(startLine, Math.min(lineCount - 1, (node.endLine ?? node.startLine ?? 1) - 1));
    const start = new vscode.Position(startLine, 0);
    const endText = document.lineAt(endLine).text;
    const end = new vscode.Position(endLine, endText.length);
    const range = new vscode.Range(start, end);

    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } catch (error) {
    vscode.window.showErrorMessage(`NeverMIN gagal membuka ${node.name}: ${error}`);
  }
}
