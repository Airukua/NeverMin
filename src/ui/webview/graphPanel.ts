import * as fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { t, buildWebviewI18n } from '../../i18n';
import { CodeGraph, GraphNode } from '../../core/graph/types';
import { GraphInsights } from '../../core/graph/graphInsights';
import { GitHistoryInsights } from '../../core/git/gitHistoryInsights';
import {
  GraphViewModel,
  MermaidGraphView,
  MermaidNodeMeta,
  RepoMermaidBundle,
  buildRepoMermaidBundle
} from '../../core/graph/repoMermaid';
import { getLanguage } from '../../utils/config';
import { escapeJsonForScript } from './jsonScriptSafe';
import { openLearningMindMap } from './mindMapPanel';
import { Logger } from '../../utils/logger';
import { preferredViewColumn, showDocumentInActiveColumn } from '../../utils/editorLayout';

interface WebviewToExtensionMessage {
  type:
    | 'nodeClick'
    | 'explainNode'
    | 'openNodeFlow'
    | 'openExternal'
    | 'openMainFlow'
    | 'openMindMap'
    | 'openGitFile'
    | 'openGitNarrative'
    | 'runGitHistory'
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
  repoRoot?: string;
  relativePath?: string;
}

interface ExtensionToWebviewMessage {
  type:
    | 'setGraph'
    | 'setState'
    | 'setTheme'
    | 'setLlmStatus'
    | 'setI18n'
    | 'setGitHistory'
    | 'setNodeFlow'
    | 'setNodeExplain';
  bundle?: RepoMermaidBundle | null;
  insights?: GraphInsights | null;
  gitHistory?: GitHistoryInsights | null;
  state?: GraphPanelState;
  message?: string;
  mode?: 'light' | 'dark';
  view?: MermaidGraphView;
  llmStatus?: LlmInsightsStatus;
  llmMessage?: string;
  gitLlmStatus?: LlmInsightsStatus;
  gitLlmMessage?: string;
  status?: LlmInsightsStatus;
  language?: string;
  i18n?: Record<string, string>;
  nodeFlow?: {
    title: string;
    filePath: string;
    model: GraphViewModel;
  } | null;
  nodeExplain?: GraphPanelNodeExplain | null;
}

export interface GraphPanelNodeFlow {
  title: string;
  filePath: string;
  model: GraphViewModel;
}

export interface GraphPanelNodeExplain {
  status: 'loading' | 'ready' | 'error' | 'cancelled';
  title?: string;
  filePath?: string;
  text?: string;
  /** Reasoning trace dari model thinking (Qwen3/Ollama). */
  thinking?: string;
  message?: string;
  scope?: 'file' | 'module' | 'function';
}

export type GraphPanelState = 'loading' | 'empty' | 'error' | 'ready';

/** Status generasi Insights oleh LLM (graph bisa sudah ready). */
export type LlmInsightsStatus = 'idle' | 'inspecting' | 'ready' | 'skipped' | 'error';

export interface GraphPanelOptions {
  state?: GraphPanelState;
  message?: string;
  insights?: GraphInsights;
  gitHistory?: GitHistoryInsights | null;
  view?: MermaidGraphView;
  functionFilePath?: string;
  focusNodeId?: string;
  llmStatus?: LlmInsightsStatus;
  llmMessage?: string;
}

const panelBundles = new WeakMap<vscode.WebviewPanel, RepoMermaidBundle>();
const panelInsights = new WeakMap<vscode.WebviewPanel, GraphInsights>();
const panelGitHistory = new WeakMap<vscode.WebviewPanel, GitHistoryInsights>();
const panelLlmStatus = new WeakMap<
  vscode.WebviewPanel,
  { status: LlmInsightsStatus; message?: string }
>();
const panelGitLlmStatus = new WeakMap<
  vscode.WebviewPanel,
  { status: LlmInsightsStatus; message?: string }
>();
const panelPendingMessages = new WeakMap<vscode.WebviewPanel, ExtensionToWebviewMessage[]>();
const panelWebviewReady = new WeakMap<vscode.WebviewPanel, boolean>();
const panelGeneration = new WeakMap<vscode.WebviewPanel, number>();
const panelHtmlAssignedAt = new WeakMap<vscode.WebviewPanel, number>();
const panelReadyWaitTimer = new WeakMap<vscode.WebviewPanel, ReturnType<typeof setTimeout>>();
const panelForceReloadCount = new WeakMap<vscode.WebviewPanel, number>();
const panelLastLifePhase = new WeakMap<vscode.WebviewPanel, string>();
const panelExtensionUri = new WeakMap<vscode.WebviewPanel, vscode.Uri>();
let activeGraphPanel: vscode.WebviewPanel | undefined;

const WEBVIEW_READY_TIMEOUT_MS = 8000;
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
  if (message.type === 'setGraph' || message.type === 'setState' || message.type === 'setLlmStatus') {
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
  const extensionUri = panelExtensionUri.get(panel);
  if (!extensionUri) {
    logWebview(panel, 'reload-fail', 'extensionUri missing', 'error');
    return;
  }
  const bundle = panelBundles.get(panel) ?? buildRepoMermaidBundle({ nodes: [], edges: [] });
  const insights = panelInsights.get(panel);
  const state =
    options.state ??
    (bundle.stats.fileCount > 0 || (bundle.architecture?.trim().length ?? 0) > 0 ? 'ready' : 'empty');
  const generation = nextPanelGeneration(panel);
  panelPendingMessages.set(panel, []);
  const html = renderHtml(
    panel.webview,
    extensionUri,
    bundle,
    state,
    options.message,
    toWebviewInsights(insights) ?? undefined,
    options.view ?? 'architecture',
    generation,
    panelGitHistory.get(panel) ?? null
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
    panel: insights.panel,
    nodeSummaries: insights.nodeSummaries,
    nodeIcons: insights.nodeIcons,
    tokenUsage: insights.tokenUsage
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
  const webviewRoot = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');

  if (activeGraphPanel) {
    const panel = activeGraphPanel;
    panel.iconPath = iconPath;
    panelExtensionUri.set(panel, extensionUri);
    panelBundles.set(panel, bundle);
    if (options.insights) {
      panelInsights.set(panel, options.insights);
    } else {
      panelInsights.delete(panel);
    }
    if (options.gitHistory) {
      panelGitHistory.set(panel, options.gitHistory);
      panelGitLlmStatus.set(panel, {
        status: inferBootGitLlmStatus(options.gitHistory),
        message: ''
      });
    } else if (options.gitHistory === null) {
      panelGitHistory.delete(panel);
      panelGitLlmStatus.delete(panel);
    }
    const generation = nextPanelGeneration(panel);
    panelPendingMessages.set(panel, []);
    panelForceReloadCount.set(panel, 0);
    const html = renderHtml(
      panel.webview,
      extensionUri,
      bundle,
      state,
      options.message,
      options.insights,
      options.view,
      generation,
      options.gitHistory ?? panelGitHistory.get(panel) ?? null
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
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media'), webviewRoot]
    }
  );
  panel.iconPath = iconPath;

  activeGraphPanel = panel;
  panelExtensionUri.set(panel, extensionUri);
  const generation = nextPanelGeneration(panel);
  panelPendingMessages.set(panel, []);
  panelForceReloadCount.set(panel, 0);
  panelBundles.set(panel, bundle);
  if (options.insights) {
    panelInsights.set(panel, options.insights);
  }
  if (options.gitHistory) {
    panelGitHistory.set(panel, options.gitHistory);
    panelGitLlmStatus.set(panel, {
      status: inferBootGitLlmStatus(options.gitHistory),
      message: ''
    });
  }
  const html = renderHtml(
    panel.webview,
    extensionUri,
    bundle,
    state,
    options.message,
    options.insights,
    options.view,
    generation,
    options.gitHistory ?? null
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
      await postToGraphPanel(panel, { type: 'setGraph', view: 'flow' });
      return;
    }

    if (msg.type === 'openMindMap') {
      const insights = panelInsights.get(panel);
      const extensionUri = panelExtensionUri.get(panel);
      if (insights && extensionUri) {
        openLearningMindMap(extensionUri, insights);
      } else {
        vscode.window.showWarningMessage(t('msg.noMindMap'));
      }
      return;
    }

    if (msg.type === 'openGitFile' && msg.repoRoot && msg.relativePath) {
      await vscode.commands.executeCommand(
        'nevermin.openGitHistoryFile',
        msg.repoRoot,
        msg.relativePath
      );
      return;
    }

    if (msg.type === 'openGitNarrative') {
      const narrative = panelGitHistory.get(panel)?.narrative;
      await vscode.commands.executeCommand('nevermin.openGitHistoryNarrative', narrative);
      return;
    }

    if (msg.type === 'runGitHistory') {
      await vscode.commands.executeCommand('nevermin.analyzeGitHistory');
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
        expandKey: msg.node.expandKey,
        view: msg.view
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
    panelExtensionUri.delete(panel);
  });

  return panel;
}

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
  if (options.gitHistory) {
    panelGitHistory.set(panel, options.gitHistory);
    if (!panelGitLlmStatus.get(panel)) {
      panelGitLlmStatus.set(panel, {
        status: inferBootGitLlmStatus(options.gitHistory),
        message: ''
      });
    }
  } else if (options.gitHistory === null) {
    panelGitHistory.delete(panel);
    panelGitLlmStatus.delete(panel);
  }

  const state = options.state ?? (graph.nodes.length > 0 ? 'ready' : 'empty');
  if (options.llmStatus) {
    panelLlmStatus.set(panel, { status: options.llmStatus, message: options.llmMessage });
  }
  const llm = panelLlmStatus.get(panel);
  const gitLlm = panelGitLlmStatus.get(panel);
  const insights = toWebviewInsights(options.insights ?? panelInsights.get(panel) ?? null);
  const gitHistory = options.gitHistory ?? panelGitHistory.get(panel) ?? null;
  const message: ExtensionToWebviewMessage = {
    type: 'setGraph',
    bundle,
    insights,
    gitHistory,
    state,
    message: options.message,
    view: options.view,
    llmStatus: llm?.status,
    llmMessage: llm?.message,
    gitLlmStatus: gitLlm?.status ?? inferBootGitLlmStatus(gitHistory),
    gitLlmMessage: gitLlm?.message ?? '',
    language: getLanguage(),
    i18n: buildWebviewI18n()
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

export async function setGraphPanelLlmStatus(
  panel: vscode.WebviewPanel,
  status: LlmInsightsStatus,
  message?: string
): Promise<void> {
  panelLlmStatus.set(panel, { status, message });
  await postToGraphPanel(panel, {
    type: 'setLlmStatus',
    status,
    llmStatus: status,
    llmMessage: message,
    message
  });
}

/** Push fresh UI strings after language change (open panel). */
export async function pushGraphPanelI18n(): Promise<void> {
  if (!activeGraphPanel) return;
  await postToGraphPanel(activeGraphPanel, {
    type: 'setI18n',
    language: getLanguage(),
    i18n: buildWebviewI18n()
  });
}

/** Push / refresh Git History on the open Code Graph panel. */
export async function setGraphPanelGitHistory(
  insights: GitHistoryInsights | null,
  options: { gitLlmStatus?: LlmInsightsStatus; gitLlmMessage?: string } = {}
): Promise<void> {
  if (!activeGraphPanel) return;
  if (insights) {
    panelGitHistory.set(activeGraphPanel, insights);
  } else {
    panelGitHistory.delete(activeGraphPanel);
  }
  const status =
    options.gitLlmStatus ??
    (insights?.narrative?.trim()
      ? 'ready'
      : insights
        ? panelGitLlmStatus.get(activeGraphPanel)?.status ?? 'idle'
        : 'idle');
  const message = options.gitLlmMessage ?? panelGitLlmStatus.get(activeGraphPanel)?.message ?? '';
  panelGitLlmStatus.set(activeGraphPanel, { status, message });
  await postToGraphPanel(activeGraphPanel, {
    type: 'setGitHistory',
    gitHistory: insights,
    gitLlmStatus: status,
    gitLlmMessage: message
  });
}

/**
 * Tampilkan Flow Chart node di panel graph yang sama (GraphFlowCanvas),
 * bukan panel Mermaid terpisah.
 */
export async function setGraphPanelNodeFlow(
  nodeFlow: GraphPanelNodeFlow | null
): Promise<boolean> {
  if (!activeGraphPanel) return false;
  activeGraphPanel.reveal(preferredViewColumn(), false);
  await postToGraphPanel(activeGraphPanel, {
    type: 'setNodeFlow',
    nodeFlow
  });
  return true;
}

/** Pindah tab view di panel Code Graph yang sedang terbuka (Architecture/Flow/…). */
export async function setGraphPanelView(view: MermaidGraphView): Promise<boolean> {
  if (!activeGraphPanel) return false;
  activeGraphPanel.reveal(preferredViewColumn(), false);
  await postToGraphPanel(activeGraphPanel, { type: 'setGraph', view });
  return true;
}

/** Push Explain With LLM result into the open Code Graph modal. */
export async function setGraphPanelNodeExplain(
  nodeExplain: GraphPanelNodeExplain | null
): Promise<boolean> {
  if (!activeGraphPanel) return false;
  await postToGraphPanel(activeGraphPanel, {
    type: 'setNodeExplain',
    nodeExplain
  });
  return true;
}

function inferBootLlmStatus(insights?: GraphInsights | null): LlmInsightsStatus {
  if (insights?.panel?.purpose || insights?.narrative?.trim()) {
    return 'ready';
  }
  return 'idle';
}

function inferBootGitLlmStatus(insights?: GitHistoryInsights | null): LlmInsightsStatus {
  return insights?.narrative?.trim() ? 'ready' : 'idle';
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

async function revealAndExplainNode(node: GraphNode): Promise<void> {
  const uri = resolveGraphNodeUri(node);
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
    Logger.warn(`[webview] open node failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function renderHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  bundle: RepoMermaidBundle,
  initialState: GraphPanelState,
  initialMessage?: string,
  initialInsights?: GraphInsights | null,
  initialView: MermaidGraphView = 'architecture',
  generation = 1,
  initialGitHistory?: GitHistoryInsights | null
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

  html = html.replace(/(href|src)="(\.\/[^"]+|\/assets\/[^"]+)"/g, (_match, attr: string, rel: string) => {
    const clean = rel.replace(/^\.\//, '').replace(/^\//, '');
    const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(distDir, clean));
    return `${attr}="${assetUri}"`;
  });

  html = html.replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);

  const boot = escapeJsonForScript({
    bundle,
    insights: toWebviewInsights(initialInsights),
    gitHistory: initialGitHistory ?? null,
    state: initialState,
    message: initialMessage ?? '',
    view: initialView,
    theme: hostThemeMode(),
    generation,
    llmStatus: inferBootLlmStatus(initialInsights),
    llmMessage: '',
    gitLlmStatus: inferBootGitLlmStatus(initialGitHistory),
    gitLlmMessage: '',
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
