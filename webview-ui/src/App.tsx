import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type {
  MermaidGraphView,
  MermaidNodeMeta,
  RepoMermaidBundle,
  WebviewInsights,
  GraphPanelState,
  InsightRef,
  GraphViewModel,
  LlmInsightsStatus,
  LearningMindMapModel,
  LearningMindMapLeaf,
  GitHistoryInsights,
  ContributionCompassModel
} from './types';
import { getBoot, onExtensionMessage, postToExtension } from './vscodeApi';
import { HeaderBar } from './components/HeaderBar';
import { InsightsPane } from './components/InsightsPane';
import { NodeActionMenu, type NodeActionMenuState } from './components/NodeActionMenu';
import { NodeExplainModal, type NodeExplainState } from './components/NodeExplainModal';
import { leafToMeta } from './lib/mindMapMeta';
import { setWebviewI18n, tw } from './i18n';

const GraphFlowCanvas = lazy(() =>
  import('./components/GraphFlowCanvas').then((m) => ({ default: m.GraphFlowCanvas }))
);
const MindMapView = lazy(() =>
  import('./components/MindMapView').then((m) => ({ default: m.MindMapView }))
);
const GitInsightsView = lazy(() =>
  import('./components/GitInsightsView').then((m) => ({ default: m.GitInsightsView }))
);
const CompassView = lazy(() =>
  import('./components/CompassView').then((m) => ({ default: m.CompassView }))
);

function ViewFallback() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--text-lo)]">
      …
    </div>
  );
}

function applyThemeMode(mode: 'light' | 'dark') {
  document.documentElement.dataset.theme = mode;
  document.body.dataset.theme = mode;
}

function emptyModel(message: string): GraphViewModel {
  return { nodes: [], edges: [], emptyMessage: message };
}

function shortFileLabel(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return parts.join('/') || filePath;
  return parts.slice(-2).join('/');
}

export function App() {
  const boot = getBoot();

  useEffect(() => {
    applyThemeMode(boot?.theme ?? 'dark');
  }, [boot?.theme]);

  if (boot?.mode === 'mindmap' && boot.mindMap) {
    return <MindMapApp model={boot.mindMap} generation={boot.generation ?? 0} />;
  }

  return <GraphApp />;
}

function MindMapApp({ model: initialModel, generation }: { model: LearningMindMapModel; generation: number }) {
  const boot = getBoot();
  if (boot?.i18n) setWebviewI18n(boot.i18n);

  const [model, setModel] = useState(initialModel);
  const [statusMessage, setStatusMessage] = useState('');
  const [nodeMenu, setNodeMenu] = useState<NodeActionMenuState | null>(null);
  const [nodeExplain, setNodeExplain] = useState<NodeExplainState | null>(null);

  useEffect(() => {
    setModel(initialModel);
  }, [initialModel, generation]);

  useEffect(() => {
    postToExtension({ type: 'ready', generation });
    postToExtension({
      type: 'webviewLife',
      phase: 'react-mount-mindmap',
      generation,
      elapsedMs: 0
    });
  }, [generation]);

  useEffect(() => {
    return onExtensionMessage((msg) => {
      if (msg.type === 'setTheme') {
        applyThemeMode(msg.mode);
      }
      if (msg.type === 'setI18n' && msg.i18n) {
        setWebviewI18n(msg.i18n);
      }
      if (msg.type === 'setMindMap' && msg.mindMap) {
        setModel(msg.mindMap);
        setStatusMessage(typeof msg.message === 'string' ? msg.message : '');
      }
      if (msg.type === 'setNodeExplain') {
        const payload = msg.nodeExplain;
        if (!payload) {
          setNodeExplain(null);
          return;
        }
        setNodeExplain((prev) => {
          if (!prev) {
            const title = payload.title || 'node';
            return {
              meta: {
                id: title,
                mermaidId: title,
                name: title,
                kind: 'file',
                filePath: payload.filePath || '',
                startLine: 1,
                endLine: 1
              },
              x:
                typeof window !== 'undefined'
                  ? Math.min(window.innerWidth - 400, window.innerWidth * 0.5)
                  : 120,
              y:
                typeof window !== 'undefined'
                  ? Math.min(window.innerHeight - 220, 140)
                  : 120,
              status: payload.status,
              text: payload.text,
              thinking: payload.thinking,
              sensitivityLevel: payload.sensitivityLevel,
              sensitivityReason: payload.sensitivityReason,
              message: payload.message,
              scope: payload.scope
            };
          }
          return {
            ...prev,
            status: payload.status,
            text: payload.text ?? prev.text,
            thinking: payload.thinking ?? prev.thinking,
            sensitivityLevel: payload.sensitivityLevel ?? prev.sensitivityLevel,
            sensitivityReason: payload.sensitivityReason ?? prev.sensitivityReason,
            message: payload.message ?? prev.message,
            scope: payload.scope ?? prev.scope,
            meta: {
              ...prev.meta,
              name: payload.title || prev.meta.name,
              filePath: payload.filePath || prev.meta.filePath
            }
          };
        });
      }
    });
  }, []);

  const onLeafClick = useCallback((leaf: LearningMindMapLeaf, clientX: number, clientY: number) => {
    if (!leaf.filePath) return;
    // Hanya buka menu — jangan post nodeClick/openFile di sini.
    setNodeMenu({
      meta: leafToMeta(leaf),
      x: clientX,
      y: clientY
    });
  }, []);

  return (
    <>
      <Suspense fallback={<ViewFallback />}>
        <MindMapView model={model} onLeafClick={onLeafClick} statusMessage={statusMessage} />
      </Suspense>
      {nodeMenu ? (
        <NodeActionMenu
          menu={nodeMenu}
          onClose={() => setNodeMenu(null)}
          showFlowChart
          onExplain={(meta) => {
            setNodeExplain({
              meta,
              x: nodeMenu.x,
              y: nodeMenu.y + 12,
              status: 'loading',
              message: tw('explain.modal.loading')
            });
            setNodeMenu(null);
            postToExtension({ type: 'explainNode', node: meta, view: 'architecture' });
          }}
          onFlowChart={(meta) => {
            setNodeMenu(null);
            postToExtension({ type: 'openNodeFlow', node: meta });
          }}
          onOpenFile={(meta) => {
            setNodeMenu(null);
            postToExtension({ type: 'openFile', node: meta });
          }}
        />
      ) : null}
      {nodeExplain ? (
        <NodeExplainModal state={nodeExplain} onClose={() => setNodeExplain(null)} />
      ) : null}
    </>
  );
}

function GraphApp() {
  const boot = getBoot();
  if (boot?.i18n) setWebviewI18n(boot.i18n);
  const [view, setView] = useState<MermaidGraphView>(boot?.view ?? 'architecture');
  const [bundle, setBundle] = useState<RepoMermaidBundle | null>(boot?.bundle ?? null);
  const [insights, setInsights] = useState<WebviewInsights | null>(boot?.insights ?? null);
  const [panelState, setPanelState] = useState<GraphPanelState>(boot?.state ?? 'loading');
  const [message, setMessage] = useState(boot?.message ?? '');
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [llmStatus, setLlmStatus] = useState<LlmInsightsStatus>(boot?.llmStatus ?? 'idle');
  const [llmMessage, setLlmMessage] = useState(boot?.llmMessage ?? '');
  const [gitLlmStatus, setGitLlmStatus] = useState<LlmInsightsStatus>(boot?.gitLlmStatus ?? 'idle');
  const [gitLlmMessage, setGitLlmMessage] = useState(boot?.gitLlmMessage ?? '');
  const [expandedFunctionsFile, setExpandedFunctionsFile] = useState<string | null>(null);
  const [i18nTick, setI18nTick] = useState(0);
  const [gitHistory, setGitHistory] = useState<GitHistoryInsights | null>(boot?.gitHistory ?? null);
  const [compass, setCompass] = useState<ContributionCompassModel | null>(boot?.compass ?? null);
  const [nodeMenu, setNodeMenu] = useState<NodeActionMenuState | null>(null);
  const [nodeFlow, setNodeFlow] = useState<{
    title: string;
    filePath: string;
    model: GraphViewModel;
  } | null>(null);
  const [nodeExplain, setNodeExplain] = useState<NodeExplainState | null>(null);

  useEffect(() => {
    postToExtension({ type: 'ready', generation: boot?.generation ?? 0 });
    postToExtension({
      type: 'webviewLife',
      phase: 'react-mount',
      generation: boot?.generation,
      elapsedMs: 0
    });
  }, [boot?.generation]);

  useEffect(() => {
    return onExtensionMessage((msg) => {
      switch (msg.type) {
        case 'setGraph':
          if (msg.i18n) {
            setWebviewI18n(msg.i18n);
            setI18nTick((n) => n + 1);
          }
          if (msg.bundle !== undefined) {
            setBundle(msg.bundle ?? null);
            setExpandedFunctionsFile(null);
            setNodeFlow(null);
            setNodeExplain(null);
          }
          if (msg.insights !== undefined) setInsights(msg.insights ?? null);
          if (msg.view) {
            setView(msg.view);
            setExpandedFunctionsFile(null);
            setNodeFlow(null);
          }
          if (msg.state) setPanelState(msg.state);
          if (msg.message !== undefined) setMessage(msg.message);
          if (msg.llmStatus) setLlmStatus(msg.llmStatus);
          if (msg.llmMessage !== undefined) setLlmMessage(msg.llmMessage);
          if (msg.gitHistory !== undefined) setGitHistory(msg.gitHistory ?? null);
          if (msg.compass !== undefined) setCompass(msg.compass ?? null);
          if (msg.gitLlmStatus) setGitLlmStatus(msg.gitLlmStatus);
          if (msg.gitLlmMessage !== undefined) setGitLlmMessage(msg.gitLlmMessage);
          break;
        case 'setGitHistory':
          setGitHistory(msg.gitHistory ?? null);
          if (msg.gitLlmStatus) setGitLlmStatus(msg.gitLlmStatus);
          if (msg.gitLlmMessage !== undefined) setGitLlmMessage(msg.gitLlmMessage);
          break;
        case 'setNodeFlow':
          setNodeFlow(msg.nodeFlow ?? null);
          setNodeMenu(null);
          if (msg.nodeFlow) {
            setExpandedFunctionsFile(null);
          }
          break;
        case 'setNodeExplain': {
          const payload = msg.nodeExplain;
          if (!payload) {
            setNodeExplain(null);
            break;
          }
          setNodeExplain((prev) => {
            if (!prev) {
              const title = payload.title || 'node';
              return {
                meta: {
                  id: title,
                  mermaidId: title,
                  name: title,
                  kind: 'file',
                  filePath: payload.filePath || '',
                  startLine: 1,
                  endLine: 1
                },
                x:
                  typeof window !== 'undefined'
                    ? Math.min(window.innerWidth - 400, window.innerWidth * 0.5)
                    : 120,
                y:
                  typeof window !== 'undefined'
                    ? Math.min(window.innerHeight - 220, 140)
                    : 120,
                status: payload.status,
                text: payload.text,
                thinking: payload.thinking,
                sensitivityLevel: payload.sensitivityLevel,
                sensitivityReason: payload.sensitivityReason,
                message: payload.message,
                scope: payload.scope
              };
            }
            return {
              ...prev,
              status: payload.status,
              text: payload.text ?? prev.text,
              thinking: payload.thinking ?? prev.thinking,
              sensitivityLevel: payload.sensitivityLevel ?? prev.sensitivityLevel,
              sensitivityReason: payload.sensitivityReason ?? prev.sensitivityReason,
              message: payload.message ?? prev.message,
              scope: payload.scope ?? prev.scope,
              meta: {
                ...prev.meta,
                name: payload.title || prev.meta.name,
                filePath: payload.filePath || prev.meta.filePath,
                sensitivityLevel:
                  payload.sensitivityLevel ?? prev.meta.sensitivityLevel,
                sensitivityReason:
                  payload.sensitivityReason ?? prev.meta.sensitivityReason
              }
            };
          });
          break;
        }
        case 'setGapExplain': {
          const { gapId, gapExplain } = msg;
          if (!gapId || !gapExplain) break;
          setCompass((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              gaps: (prev.gaps ?? []).map((g) =>
                g.id === gapId
                  ? {
                      ...g,
                      explainStatus: gapExplain.status,
                      explainDetail: gapExplain.detail ?? g.explainDetail,
                      explainDraft:
                        gapExplain.status === 'ready'
                          ? undefined
                          : gapExplain.draft !== undefined
                            ? gapExplain.draft
                            : g.explainDraft,
                      explainError:
                        gapExplain.status === 'error' ? gapExplain.message : undefined
                    }
                  : g
              )
            };
          });
          break;
        }
        case 'setI18n':
          if (msg.i18n) setWebviewI18n(msg.i18n);
          setI18nTick((n) => n + 1);
          break;
        case 'setState':
          setPanelState(msg.state);
          if (msg.message !== undefined) setMessage(msg.message);
          break;
        case 'setLlmStatus': {
          const next = msg.llmStatus ?? msg.status;
          if (next) setLlmStatus(next);
          const detail = msg.llmMessage ?? msg.message;
          if (detail !== undefined) setLlmMessage(detail);
          if (next === 'inspecting') setInsightsOpen(true);
          break;
        }
        case 'setTheme':
          applyThemeMode(msg.mode);
          break;
        default:
          break;
      }
    });
  }, []);

  const onViewChange = useCallback((next: MermaidGraphView) => {
    setView(next);
    setExpandedFunctionsFile(null);
    setNodeFlow(null);
    setNodeExplain(null);
  }, []);

  const onNodeClick = useCallback(
    (meta: MermaidNodeMeta, event: { clientX: number; clientY: number }) => {
      if (nodeFlow) {
        setNodeMenu({
          meta,
          x: event.clientX,
          y: event.clientY
        });
        return;
      }
      if (view === 'functions' && !expandedFunctionsFile && meta.expandKey) {
        setExpandedFunctionsFile(meta.expandKey);
        setNodeMenu(null);
        return;
      }
      setNodeMenu({
        meta,
        x: event.clientX,
        y: event.clientY
      });
    },
    [view, expandedFunctionsFile, nodeFlow]
  );

  const onSelectRef = useCallback((ref: InsightRef) => {
    setNodeMenu({
      meta: {
        id: ref.id,
        mermaidId: ref.id,
        name: ref.name,
        kind: ref.kind,
        filePath: ref.filePath,
        startLine: ref.startLine,
        endLine: ref.endLine
      },
      x: typeof window !== 'undefined' ? Math.min(window.innerWidth - 260, window.innerWidth * 0.55) : 240,
      y: typeof window !== 'undefined' ? Math.min(window.innerHeight - 200, 120) : 120
    });
  }, []);

  const onOpenMainFlow = useCallback(() => {
    setNodeMenu(null);
    setNodeExplain(null);
    setNodeFlow(null);
    setExpandedFunctionsFile(null);
    setView('flow');
  }, []);

  const statusLabel =
    panelState === 'ready'
      ? nodeFlow
        ? `${nodeFlow.title} · flow`
        : view === 'git'
          ? gitHistory
            ? tw('git.ui.statsCommits', { count: gitHistory.commitCountSampled })
            : tw('view.git')
          : view === 'compass'
            ? compass
              ? `${compass.summary.gaps ?? compass.gaps?.length ?? 0}/${compass.summary.highPriority ?? 0} · ${tw('view.compass')}`
              : tw('view.compass')
          : view === 'sensitive'
            ? `${bundle?.views.sensitive?.nodes.length ?? 0} · ${tw('view.sensitive')}`
            : view === 'functions' && expandedFunctionsFile
            ? `${shortFileLabel(expandedFunctionsFile)} · functions`
            : view === 'functions'
              ? `${bundle?.views.functions.nodes.length ?? 0} file · functions`
              : `${bundle?.stats.shownFiles ?? 0} file · ${view}`
      : message || panelState;

  const activeModel = useMemo(() => {
    if (nodeFlow) {
      return nodeFlow.model;
    }
    if (view === 'git' || view === 'compass') {
      return emptyModel('');
    }
    const views = bundle?.views;
    if (!views) {
      return emptyModel(tw('graph.reactMissing'));
    }
    if (view === 'sensitive') {
      return views.sensitive ?? emptyModel(tw('graph.sensitive.empty'));
    }
    if (view === 'functions' && expandedFunctionsFile) {
      const detail = bundle?.functionGroups?.[expandedFunctionsFile];
      if (detail) return detail;
      return emptyModel(
        tw('graph.functions.noneInFile', { file: shortFileLabel(expandedFunctionsFile) })
      );
    }
    return views[view] ?? emptyModel(tw('graph.view.empty'));
  }, [bundle, view, expandedFunctionsFile, nodeFlow, i18nTick]);

  return (
    <div className="flex h-screen w-screen flex-col bg-[var(--void)] text-[var(--text-hi)]">
      <HeaderBar
        view={view}
        onViewChange={(next) => {
          setNodeMenu(null);
          onViewChange(next);
        }}
        insightsOpen={insightsOpen}
        onToggleInsights={() => setInsightsOpen((v) => !v)}
        status={statusLabel}
        bundle={bundle}
        llmStatus={llmStatus}
        i18nTick={i18nTick}
      />
      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {panelState === 'loading' ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--text-lo)]">
              {message || tw('graph.loading')}
            </div>
          ) : panelState === 'error' ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-red-300">
              {message || tw('graph.error')}
            </div>
          ) : panelState === 'empty' ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--text-lo)]">
              {message || tw('graph.none')}
            </div>
          ) : (
            <div className="relative h-full w-full">
              <Suspense fallback={<ViewFallback />}>
                {view === 'git' && !nodeFlow ? (
                  <GitInsightsView
                    gitHistory={gitHistory}
                    gitLlmStatus={gitLlmStatus}
                    gitLlmMessage={gitLlmMessage}
                    i18nTick={i18nTick}
                  />
                ) : view === 'compass' && !nodeFlow ? (
                  <CompassView compass={compass} i18nTick={i18nTick} />
                ) : (
                  <>
                    {nodeFlow ? (
                      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNodeFlow(null)}
                          className="pointer-events-auto inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--text-lo)_35%,transparent)] bg-[color-mix(in_srgb,var(--panel)_94%,transparent)] px-2.5 py-1.5 text-xs text-[var(--text-hi)] transition hover:bg-[var(--panel-l2)]"
                        >
                          <ChevronLeft size={14} strokeWidth={2.25} aria-hidden />
                          {tw('graph.backNodeFlow')}
                        </button>
                        <span className="pointer-events-none rounded-md bg-[color-mix(in_srgb,var(--panel)_88%,transparent)] px-2 py-1 font-mono text-[11px] text-[var(--text-lo)]">
                          {nodeFlow.title}
                        </span>
                      </div>
                    ) : view === 'functions' && expandedFunctionsFile ? (
                      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedFunctionsFile(null)}
                          className="pointer-events-auto inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--text-lo)_35%,transparent)] bg-[color-mix(in_srgb,var(--panel)_94%,transparent)] px-2.5 py-1.5 text-xs text-[var(--text-hi)] transition hover:bg-[var(--panel-l2)]"
                        >
                          <ChevronLeft size={14} strokeWidth={2.25} aria-hidden />
                          {tw('graph.backAllFiles')}
                        </button>
                        <span className="pointer-events-none rounded-md bg-[color-mix(in_srgb,var(--panel)_88%,transparent)] px-2 py-1 font-mono text-[11px] text-[var(--text-lo)]">
                          {shortFileLabel(expandedFunctionsFile)}
                        </span>
                      </div>
                    ) : null}
                    <GraphFlowCanvas
                      model={activeModel}
                      onNodeClick={onNodeClick}
                      llmInspecting={llmStatus === 'inspecting'}
                    />
                  </>
                )}
              </Suspense>
            </div>
          )}
          {(view !== 'git' && view !== 'compass') || nodeFlow ? (
            <InsightsPane
              insights={insights}
              open={insightsOpen}
              llmStatus={llmStatus}
              llmMessage={llmMessage}
              onOpenMainFlow={onOpenMainFlow}
              onSelectRef={onSelectRef}
              i18nTick={i18nTick}
            />
          ) : null}
        </main>
      </div>
      {nodeMenu ? (
        <NodeActionMenu
          menu={nodeMenu}
          onClose={() => setNodeMenu(null)}
          showFlowChart={
            !nodeFlow &&
            view !== 'flow' &&
            view !== 'modules' &&
            !(view === 'functions' && !!expandedFunctionsFile)
          }
          onExplain={(meta) => {
            setNodeExplain({
              meta,
              x: nodeMenu.x,
              y: nodeMenu.y + 12,
              status: 'loading',
              sensitivityLevel: meta.sensitivityLevel,
              sensitivityReason: meta.sensitivityReason,
              message: tw('explain.modal.loading')
            });
            setNodeMenu(null);
            postToExtension({ type: 'explainNode', node: meta, view });
          }}
          onFlowChart={(meta) => postToExtension({ type: 'openNodeFlow', node: meta })}
          onOpenFile={(meta) => postToExtension({ type: 'nodeClick', node: meta })}
        />
      ) : null}
      {nodeExplain ? (
        <NodeExplainModal state={nodeExplain} onClose={() => setNodeExplain(null)} />
      ) : null}
    </div>
  );
}
