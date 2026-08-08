/** Shared types between extension host and webview-ui (no vscode imports). */

export type GraphPanelState = 'loading' | 'empty' | 'error' | 'ready';

export type LlmInsightsStatus = 'idle' | 'inspecting' | 'ready' | 'skipped' | 'error';
export type MermaidGraphView = 'architecture' | 'modules' | 'flow' | 'functions' | 'git';

export interface MermaidNodeMeta {
  id: string;
  mermaidId: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  summary?: string;
  /** Tab Functions overview: klik membuka grup file ini. */
  expandKey?: string;
}

export type GraphCardRole = 'entry' | 'hub' | 'pipeline' | 'support';

export interface GraphViewNode {
  id: string;
  name: string;
  filePath: string;
  kind: string;
  role: GraphCardRole;
  summary?: string;
  iconKey?: string;
  startLine: number;
  endLine: number;
  row: number;
  col: number;
  expandKey?: string;
}

export interface GraphViewEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
}

/** Label baris/grup di canvas (Entry / Hub / Pipeline, …). */
export interface GraphViewSection {
  row: number;
  label: string;
  hint?: string;
  role?: GraphCardRole;
}

export interface GraphViewModel {
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
  emptyMessage?: string;
  sections?: GraphViewSection[];
}

export interface RepoMermaidBundle {
  architecture: string;
  modules: string;
  flow: string;
  functions: string;
  nodeIndex: Record<string, MermaidNodeMeta>;
  views: {
    architecture: GraphViewModel;
    modules: GraphViewModel;
    flow: GraphViewModel;
    /** Overview file tertutup — klik kartu untuk buka isi fungsi. */
    functions: GraphViewModel;
  };
  /** Detail fungsi per file (key = path ternormalisasi). */
  functionGroups?: Record<string, GraphViewModel>;
  stats: {
    fileCount: number;
    shownFiles: number;
    edgeCount: number;
    truncated: boolean;
  };
}

export interface FlowStage {
  role: string;
  name: string;
  nodeId: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface MainFlow {
  id: string;
  label: string;
  input: string;
  process: string[];
  output: string;
  stages?: FlowStage[];
  mermaid?: string;
}

export interface GitFileChurn {
  path: string;
  commits: number;
  lastCommitAt: string;
  daysSinceChange: number;
  authors: string[];
}

export interface GitOwnerInsight {
  path: string;
  author: string;
  commits: number;
  share: number;
}

export interface GitCouplingInsight {
  a: string;
  b: string;
  together: number;
  support: number;
}

export interface GitHistoryInsights {
  generatedAt: string;
  repoRoot: string;
  windowDays: number;
  commitCountSampled: number;
  aliveFiles: GitFileChurn[];
  frozenFiles: GitFileChurn[];
  recentCommits: Array<{
    hash: string;
    subject: string;
    author: string;
    date: string;
    files: string[];
  }>;
  owners: GitOwnerInsight[];
  couplings: GitCouplingInsight[];
  summaryBullets: string[];
  narrative?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface InsightRef {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  score?: number;
  reason?: string;
}

export interface InsightPanelContent {
  purpose: string;
  overview: string;
  flowSteps: string[];
  readingGuide: {
    startHere: string;
    followModules: string;
    trackExecution: string;
  };
}

export interface WebviewInsights {
  generatedAt?: string;
  entryPoints: InsightRef[];
  hubs: InsightRef[];
  mainFlow: MainFlow | null;
  keyFlows?: unknown[];
  orphanFiles?: InsightRef[];
  stats?: {
    nodeCount: number;
    edgeCount: number;
    nodesByKind?: Record<string, number>;
    edgesByKind?: Record<string, number>;
  };
  summaryBullets: string[];
  narrative?: string;
  panel?: InsightPanelContent;
  nodeSummaries?: Record<string, string>;
  nodeIcons?: Record<string, string>;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface NeverminBoot {
  mode?: 'graph' | 'mindmap';
  bundle: RepoMermaidBundle | null;
  insights: WebviewInsights | null;
  mindMap?: LearningMindMapModel | null;
  gitHistory?: GitHistoryInsights | null;
  state: GraphPanelState;
  message: string;
  view: MermaidGraphView;
  theme: 'light' | 'dark';
  generation: number;
  llmStatus?: LlmInsightsStatus;
  llmMessage?: string;
  gitLlmStatus?: LlmInsightsStatus;
  gitLlmMessage?: string;
  language?: 'id' | 'en';
  i18n?: Record<string, string>;
}

export type MindMapBranchKind = 'start' | 'flow' | 'hubs' | 'modules' | 'later';

export interface LearningMindMapLeaf {
  id: string;
  name: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  role?: string;
  kind?: string;
}

export interface LearningMindMapBranch {
  id: MindMapBranchKind;
  label: string;
  accent: 'entry' | 'pipeline' | 'hub' | 'modules' | 'later';
  children: LearningMindMapLeaf[];
}

export interface LearningMindMapModel {
  rootTitle: string;
  subtitle: string;
  branches: LearningMindMapBranch[];
  mermaid: string;
  stats: {
    entryCount: number;
    hubCount: number;
    stageCount: number;
    moduleCount: number;
  };
}

export type ExtensionToWebviewMessage =
  | {
      type: 'setGraph';
      bundle?: RepoMermaidBundle | null;
      insights?: WebviewInsights | null;
      gitHistory?: GitHistoryInsights | null;
      state?: GraphPanelState;
      message?: string;
      view?: MermaidGraphView;
      llmStatus?: LlmInsightsStatus;
      llmMessage?: string;
      gitLlmStatus?: LlmInsightsStatus;
      gitLlmMessage?: string;
      language?: 'id' | 'en';
      i18n?: Record<string, string>;
    }
  | { type: 'setState'; state: GraphPanelState; message?: string }
  | { type: 'setTheme'; mode: 'light' | 'dark' }
  | {
      type: 'setLlmStatus';
      status?: LlmInsightsStatus;
      llmStatus?: LlmInsightsStatus;
      llmMessage?: string;
      message?: string;
    }
  | { type: 'setI18n'; language?: 'id' | 'en'; i18n?: Record<string, string> }
  | {
      type: 'setGitHistory';
      gitHistory?: GitHistoryInsights | null;
      gitLlmStatus?: LlmInsightsStatus;
      gitLlmMessage?: string;
    }
  | {
      type: 'setNodeFlow';
      nodeFlow?: {
        title: string;
        filePath: string;
        model: GraphViewModel;
      } | null;
    }
  | {
      type: 'setNodeExplain';
      nodeExplain?: {
        status: 'loading' | 'ready' | 'error' | 'cancelled';
        title?: string;
        filePath?: string;
        text?: string;
        thinking?: string;
        message?: string;
        scope?: 'file' | 'module' | 'function';
      } | null;
    };

export type WebviewToExtensionMessage =
  | { type: 'ready'; generation: number }
  | { type: 'webviewLife'; phase: string; detail?: string; generation?: number; elapsedMs?: number }
  | { type: 'renderStatus'; ok: boolean; detail?: string; view?: string }
  | { type: 'nodeClick'; node: Partial<MermaidNodeMeta> }
  | { type: 'copySource'; source: string }
  | { type: 'openExternal' }
  | { type: 'openMainFlow'; flow?: MainFlow | null }
  | { type: 'openMindMap' }
  | { type: 'openGitFile'; repoRoot: string; relativePath: string }
  | { type: 'openGitNarrative' }
  | { type: 'runGitHistory' }
  | { type: 'explainNode'; node: Partial<MermaidNodeMeta>; view?: MermaidGraphView }
  | { type: 'openNodeFlow'; node: Partial<MermaidNodeMeta> };
