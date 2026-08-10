/** Shared types between extension host and webview-ui (no vscode imports). */

export type GraphPanelState = 'loading' | 'empty' | 'error' | 'ready';

export type LlmInsightsStatus = 'idle' | 'inspecting' | 'ready' | 'skipped' | 'error';
export type MermaidGraphView = 'architecture' | 'modules' | 'flow' | 'functions' | 'sensitive' | 'compass' | 'git';

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
  sensitivityLevel?: SensitivityLevel;
  sensitivityReason?: string;
}

export type GraphCardRole = 'entry' | 'hub' | 'pipeline' | 'support';

export type SensitivityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface NodeSensitivity {
  level: SensitivityLevel;
  reason: string;
  signals: string[];
  score: number;
}

export interface GraphViewNode {
  id: string;
  name: string;
  filePath: string;
  kind: string;
  role: GraphCardRole;
  summary?: string;
  iconKey?: string;
  sensitivityLevel?: SensitivityLevel;
  sensitivityReason?: string;
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
  /** Warna aksen section (mis. level sensitivitas). */
  accent?: string;
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
    /** Kode sensitif — dikelompokkan critical / high / medium. */
    sensitive: GraphViewModel;
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
  nodeSensitivity?: Record<string, NodeSensitivity>;
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
  compass?: ContributionCompassModel | null;
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

export type CompassTier = 'safe' | 'caution' | 'avoid' | 'read';
export type CompassLlmStatus = 'idle' | 'pending' | 'ready' | 'skipped' | 'error';

export type GapType =
  | 'orphan-promise'
  | 'bug-pattern'
  | 'yagni'
  | 'incomplete-feature'
  | 'coupling'
  | 'test-gap'
  | 'dead-config'
  | 'misleading-contract'
  | 'duplicate-logic'
  | 'silent-fallback'
  | 'missing-observability'
  | 'unbounded-resource'
  | 'missing-idempotency'
  | 'schema-api-drift'
  | 'dependency-risk'
  | 'feature-flag-graveyard'
  | 'ownership-gap'
  | 'convention-drift'
  | 'migration-incomplete'
  | 'naming-mismatch'
  | 'circular-dependency'
  | 'magic-value'
  | 'inconsistent-error-handling'
  | 'copy-pasted-config';

export type RiskBadge = 'safe' | 'needs-review' | 'critical-zone';
export type GapConfidence = 'low' | 'medium' | 'high';
export type GapExplainStatus = 'idle' | 'loading' | 'streaming' | 'ready' | 'error';
export type GapExplainEffort = 'low' | 'medium' | 'high';

export interface GapExplainOption {
  title: string;
  detail: string;
  effort: GapExplainEffort;
}

export interface GapExplainDetail {
  whyItMatters: string;
  concreteExample: string;
  contributionOptions: GapExplainOption[];
  confidenceJustification: string;
  generatedAt: string;
}

export interface ContributionGap {
  id: string;
  title: string;
  type: GapType;
  evidence: string[];
  opportunity: string;
  riskBadge: RiskBadge;
  confidence: GapConfidence;
  evidenceStrength: number;
  value: number;
  effort: number;
  priorityScore: number;
  filePath?: string;
  name?: string;
  kind?: string;
  startLine?: number;
  endLine?: number;
  llmExplanation?: string;
  dismissed?: boolean;
  explainStatus?: GapExplainStatus;
  explainDetail?: GapExplainDetail;
  explainDraft?: string;
  explainError?: string;
}

export interface CompassItem {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  score: number;
  reasons: string[];
  llmReason?: string;
  tier: CompassTier;
}

export interface CompassStep {
  id: string;
  title: string;
  detail: string;
  action?: 'openMindMap' | 'runGitHistory' | 'openNode';
  targetId?: string;
  targetName?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  kind?: string;
}

export interface ContributionCompassModel {
  generatedAt: string;
  hasGit: boolean;
  llmStatus: CompassLlmStatus;
  summary: {
    gaps: number;
    highPriority: number;
    byType?: Partial<Record<GapType, number>>;
    safe: number;
    caution: number;
    avoid: number;
  };
  agentAdvice?: string;
  docsUsed?: string[];
  gaps: ContributionGap[];
  readFirst: CompassItem[];
  firstSteps: CompassStep[];
  /** @deprecated legacy lists — may be empty */
  safeToTouch?: CompassItem[];
  caution?: CompassItem[];
  avoid?: CompassItem[];
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
  /** Deeper breakdown — omit/empty means no further split. */
  children?: LearningMindMapLeaf[];
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
      compass?: ContributionCompassModel | null;
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
        status: 'loading' | 'streaming' | 'ready' | 'error' | 'cancelled';
        title?: string;
        filePath?: string;
        text?: string;
        thinking?: string;
        sensitivityLevel?: SensitivityLevel;
        sensitivityReason?: string;
        message?: string;
        scope?: 'file' | 'module' | 'function' | 'sensitivity';
      } | null;
    }
  | {
      type: 'setGapExplain';
      gapId: string;
      gapExplain: {
        status: 'loading' | 'streaming' | 'ready' | 'error';
        detail?: GapExplainDetail;
        draft?: string;
        message?: string;
      };
    }
  | {
      type: 'setMindMap';
      mindMap?: LearningMindMapModel | null;
      message?: string;
    };

export type WebviewToExtensionMessage =
  | { type: 'ready'; generation: number }
  | { type: 'webviewLife'; phase: string; detail?: string; generation?: number; elapsedMs?: number }
  | { type: 'renderStatus'; ok: boolean; detail?: string; view?: string }
  | { type: 'nodeClick'; node: Partial<MermaidNodeMeta> }
  /** Explicit open-from-menu (Mind Map). Prefer this over nodeClick. */
  | { type: 'openFile'; node: Partial<MermaidNodeMeta> }
  | { type: 'copySource'; source: string }
  | { type: 'openExternal' }
  | { type: 'openMainFlow'; flow?: MainFlow | null }
  | { type: 'openMindMap' }
  | { type: 'openGitFile'; repoRoot: string; relativePath: string }
  | { type: 'openGitNarrative' }
  | { type: 'runGitHistory' }
  | { type: 'explainNode'; node: Partial<MermaidNodeMeta>; view?: MermaidGraphView; force?: boolean }
  | { type: 'explainGap'; gapId: string }
  | { type: 'openNodeFlow'; node: Partial<MermaidNodeMeta> };
