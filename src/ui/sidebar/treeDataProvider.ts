import path from 'path';
import * as vscode from 'vscode';
import { t } from '../../i18n';
import {
  ApiKeyState,
  getApiKeyState,
  getLanguageLabel,
  getLlmModel,
  getProviderDefaultModel,
  getProviderLabel,
  getProviderName
} from '../../utils/config';
import { getWorkspaceAnalysisFiles, getWorkspaceCodeFiles, hasWorkspaceFolders } from '../../utils/workspace';
import {
  getLastAnalysisMode,
  getLatestRepoAnalysis,
  getRepoAnalysisStatus
} from '../../utils/repoAnalysis';
import {
  getGitHistoryStatus,
  getLatestGitHistory
} from '../../utils/gitHistoryAnalysis';
import { GitHistoryInsights } from '../../core/git/gitHistoryInsights';
import { getSelectedAnalysisFilePaths } from '../../utils/repoAnalysisSelection';
import { getPrivacyMode, hasChosenPrivacyMode } from '../../utils/privacyMode';
import {
  ActivityEntry,
  formatActivityTime,
  getActivityCount,
  getRecentActivity
} from '../../utils/activityLog';
import { RepoAnalysis } from '../../core/analysis/repoAnalyzer';
import { GraphInsightFlow, GraphInsightFlowStage } from '../../core/graph/graphInsights';
import { buildSymbolTree, SymbolTreeFile, SymbolTreeFolder, SymbolTreeSymbol } from '../../core/graph/symbolTree';
import { getCachedCodeGraph } from '../../utils/codeGraphCache';

type SectionId = 'status' | 'actions' | 'files' | 'structure' | 'results' | 'gitHistory' | 'logs' | 'settings';
type ResultsGroupId =
  | 'flow'
  | 'summary'
  | 'entries'
  | 'hubs'
  | 'otherFlows'
  | 'folders'
  | 'files'
  | 'symbols'
  | 'gitAlive'
  | 'gitFrozen'
  | 'gitWhy'
  | 'gitOwners'
  | 'gitCoupling';
type ExplorerNode =
  | SectionItem
  | FolderItem
  | StatusItem
  | AnalysisFileItem
  | ResultsGroupItem
  | StructureFolderItem
  | StructureFileItem
  | StructureSymbolItem;

abstract class SidebarItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    icon?: string | vscode.ThemeIcon
  ) {
    super(label, collapsibleState);
    this.iconPath = typeof icon === 'string' ? new vscode.ThemeIcon(icon) : icon;
  }
}

export class SectionItem extends SidebarItem {
  constructor(
    public readonly section: SectionId,
    label: string,
    icon: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed,
    description?: string
  ) {
    super(label, collapsibleState, icon);
    this.description = description;
    this.contextValue = `section.${section}`;
  }
}

export class FolderItem extends SidebarItem {
  constructor(
    public readonly folderKey: string,
    label: string,
    public readonly files: vscode.Uri[],
    selectedCount: number
  ) {
    super(
      label,
      selectedCount > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
      'folder'
    );
    const total = files.length;
    const allSelected = total > 0 && selectedCount === total;
    this.description =
      selectedCount > 0
        ? t('sidebar.folder.selected', { selected: selectedCount, total })
        : t('sidebar.folder.files', { count: total });
    this.tooltip = t('sidebar.folder.checkboxHint', { folder: folderKey || '.', count: total });
    this.contextValue = 'analysisFolder';
    // Checklist folder: centang = pilih semua file di dalam folder
    this.checkboxState = allSelected
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
  }
}

class ResultsGroupItem extends SidebarItem {
  constructor(
    public readonly groupId: ResultsGroupId,
    label: string,
    icon: string,
    public readonly children: ExplorerNode[],
    description?: string,
    expanded = true
  ) {
    super(
      label,
      expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
      icon
    );
    this.description = description;
    this.contextValue = `results.${groupId}`;
  }
}

class StatusItem extends SidebarItem {
  constructor(
    label: string,
    icon: string,
    description?: string,
    command?: vscode.Command,
    tooltip?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None, icon);
    this.description = description;
    this.command = command;
    this.tooltip = tooltip;
  }
}

export class AnalysisFileItem extends SidebarItem {
  constructor(
    public readonly filePath: string,
    label: string,
    checked: boolean,
    description?: string,
    tooltip?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None, 'file-code');
    this.id = filePath;
    this.description = description;
    this.checkboxState = checked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
    this.tooltip = tooltip;
    this.contextValue = 'analysisFile';
  }
}

class StructureFolderItem extends SidebarItem {
  constructor(
    public readonly folder: SymbolTreeFolder
  ) {
    super(
      folder.folderPath === '.' ? '(root)' : folder.folderPath,
      vscode.TreeItemCollapsibleState.Collapsed,
      'folder'
    );
    this.description = t('structure.folder.files', { count: folder.files.length });
    this.tooltip = folder.folderPath;
    this.contextValue = 'structureFolder';
  }
}

class StructureFileItem extends SidebarItem {
  constructor(
    public readonly file: SymbolTreeFile
  ) {
    super(file.displayName, vscode.TreeItemCollapsibleState.Collapsed, 'file-code');
    this.description = t('structure.file.symbols', { count: file.symbols.length });
    this.tooltip = file.filePath;
    this.contextValue = 'structureFile';
    this.command = {
      command: 'nevermin.openFileFunctionGraph',
      title: t('structure.openFileGraph'),
      arguments: [{ filePath: file.filePath, name: file.displayName }]
    };
  }
}

class StructureSymbolItem extends SidebarItem {
  constructor(
    public readonly symbol: SymbolTreeSymbol
  ) {
    const icon =
      symbol.kind === 'class' ? 'symbol-class' : symbol.kind === 'method' ? 'symbol-method' : 'symbol-function';
    super(symbol.name, vscode.TreeItemCollapsibleState.None, icon);
    this.description = `${symbol.kind} · L${symbol.startLine}`;
    this.tooltip = `${symbol.filePath}:${symbol.startLine}`;
    this.contextValue = 'structureSymbol';
    this.command = {
      command: 'nevermin.openFileFunctionGraph',
      title: t('structure.openSymbolGraph'),
      arguments: [{ filePath: symbol.filePath, nodeId: symbol.id, name: symbol.name }]
    };
  }
}

export class CodeExplorerProvider implements vscode.TreeDataProvider<ExplorerNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ExplorerNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ExplorerNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ExplorerNode): Promise<ExplorerNode[]> {
    if (!element) {
      return this.getRootItems();
    }

    if (element instanceof SectionItem) {
      return this.getSectionChildren(element.section);
    }

    if (element instanceof FolderItem) {
      return this.getFolderChildren(element);
    }

    if (element instanceof StructureFolderItem) {
      return element.folder.files.map((file) => new StructureFileItem(file));
    }

    if (element instanceof StructureFileItem) {
      return element.file.symbols.map((symbol) => new StructureSymbolItem(symbol));
    }

    if (element instanceof ResultsGroupItem) {
      return element.children;
    }

    return [];
  }

  private async getRootItems(): Promise<ExplorerNode[]> {
    if (!hasChosenPrivacyMode(this.context)) {
      return this.getPrivacyGateItems();
    }

    const workspaceReady = hasWorkspaceFolders();
    const codeFiles = workspaceReady ? await getWorkspaceCodeFiles(25) : [];
    const selectedCount = getSelectedAnalysisFilePaths(this.context).length;
    const analysisStatus = getRepoAnalysisStatus(this.context);
    const latestAnalysis = getLatestRepoAnalysis(this.context);
    const apiKeyState = await getApiKeyState(this.context);
    const privacyMode = getPrivacyMode(this.context);

    const statusDescription =
      privacyMode === 'private'
        ? t('privacy.mode.privateShort')
        : !workspaceReady
          ? t('sidebar.status.openFolderFirst')
          : codeFiles.length === 0
            ? t('sidebar.status.noCodeFiles')
            : apiKeyState.source === 'missing'
              ? t('sidebar.status.apiKeyMissing')
              : analysisStatus === 'loading'
                ? t('sidebar.status.analyzing')
                : selectedCount > 0
                  ? t('sidebar.selection.count', { count: selectedCount })
                  : t('sidebar.status.ready');

    const actionsDescription =
      selectedCount > 0
        ? t('sidebar.actions.analyzeN', { count: selectedCount })
        : t('sidebar.actions.analyzeOrExplain');

    const resultsDescription =
      analysisStatus === 'loading'
        ? t('sidebar.results.running')
        : analysisStatus === 'error'
          ? t('sidebar.results.failed')
          : latestAnalysis
            ? `${latestAnalysis.fileCount} file · ${latestAnalysis.symbolCount} symbol`
            : t('sidebar.results.none');

    const gitStatus = getGitHistoryStatus(this.context);
    const gitInsights = getLatestGitHistory(this.context);
    const gitDescription =
      gitStatus === 'loading'
        ? t('sidebar.git.running')
        : gitStatus === 'error'
          ? t('sidebar.git.failed')
          : gitInsights
            ? t('sidebar.git.ready', {
                commits: gitInsights.commitCountSampled,
                alive: gitInsights.aliveFiles.length
              })
            : t('sidebar.git.none');

    const structureGraph = getCachedCodeGraph(this.context);
    const structureDescription = structureGraph?.nodes.length
      ? t('structure.ready', { count: structureGraph.nodes.filter((n) => n.kind === 'function' || n.kind === 'class' || n.kind === 'method').length })
      : t('structure.none');

    const logCount = getActivityCount();
    const logsDescription =
      analysisStatus === 'loading'
        ? t('sidebar.logs.running')
        : logCount > 0
          ? t('sidebar.logs.count', { count: Math.min(logCount, 25) })
          : t('sidebar.logs.empty');

    return [
      new SectionItem(
        'status',
        t('sidebar.section.status'),
        'pulse',
        vscode.TreeItemCollapsibleState.Collapsed,
        statusDescription
      ),
      new SectionItem(
        'actions',
        t('sidebar.section.actions'),
        'play',
        vscode.TreeItemCollapsibleState.Collapsed,
        actionsDescription
      ),
      new SectionItem(
        'files',
        t('sidebar.section.files'),
        'files',
        vscode.TreeItemCollapsibleState.Collapsed,
        selectedCount > 0
          ? t('sidebar.files.checked', { count: selectedCount })
          : t('sidebar.files.checkTarget')
      ),
      new SectionItem(
        'structure',
        t('sidebar.section.structure'),
        'type-hierarchy-sub',
        vscode.TreeItemCollapsibleState.Collapsed,
        structureDescription
      ),
      new SectionItem(
        'results',
        t('sidebar.section.results'),
        'graph',
        vscode.TreeItemCollapsibleState.Collapsed,
        resultsDescription
      ),
      new SectionItem(
        'gitHistory',
        t('sidebar.section.gitHistory'),
        'git-commit',
        vscode.TreeItemCollapsibleState.Collapsed,
        gitDescription
      ),
      new SectionItem(
        'logs',
        t('sidebar.section.logs'),
        'output',
        vscode.TreeItemCollapsibleState.Collapsed,
        logsDescription
      ),
      new SectionItem(
        'settings',
        t('sidebar.section.settings'),
        'settings-gear',
        vscode.TreeItemCollapsibleState.Collapsed,
        privacyMode === 'private'
          ? t('privacy.mode.privateShort')
          : privacyMode === 'public'
            ? t('privacy.mode.publicShort')
            : getProviderLabel()
      )
    ];
  }

  private getPrivacyGateItems(): ExplorerNode[] {
    return [
      new StatusItem(
        t('privacy.gate.title'),
        'shield',
        t('privacy.gate.subtitle'),
        undefined,
        t('privacy.gate.tooltip')
      ),
      new StatusItem(
        t('privacy.private.label'),
        'lock',
        t('privacy.private.badge'),
        {
          command: 'nevermin.setPrivacyPrivate',
          title: t('privacy.private.label')
        },
        t('privacy.private.detail')
      ),
      new StatusItem(
        t('privacy.public.label'),
        'globe',
        t('privacy.public.badge'),
        {
          command: 'nevermin.setPrivacyPublic',
          title: t('privacy.public.label')
        },
        t('privacy.public.detail')
      )
    ];
  }

  private async getSectionChildren(section: SectionId): Promise<ExplorerNode[]> {
    switch (section) {
      case 'status':
        return this.getStatusChildren();
      case 'actions':
        return this.getActionChildren();
      case 'files':
        return this.getFileSectionChildren();
      case 'structure':
        return this.getStructureChildren();
      case 'results':
        return this.getResultsChildren();
      case 'gitHistory':
        return this.getGitHistoryChildren();
      case 'logs':
        return this.getLogsChildren();
      case 'settings':
        return this.getSettingsChildren();
      default:
        return [];
    }
  }

  private getLogsChildren(): ExplorerNode[] {
    const recent = getRecentActivity(20);
    const actions: ExplorerNode[] = [
      new StatusItem(
        t('sidebar.logs.open'),
        'terminal',
        t('sidebar.logs.openDetail'),
        {
          command: 'nevermin.openOutputLogs',
          title: t('sidebar.logs.open')
        },
        t('sidebar.logs.openTooltip')
      ),
      new StatusItem(
        t('sidebar.logs.clear'),
        'clear-all',
        undefined,
        {
          command: 'nevermin.clearActivityLogs',
          title: t('sidebar.logs.clear')
        }
      )
    ];

    if (recent.length === 0) {
      return [
        ...actions,
        new StatusItem(t('sidebar.logs.none'), 'info', t('sidebar.logs.noneHint'))
      ];
    }

    return [
      ...actions,
      ...recent.map((entry) => this.buildLogItem(entry))
    ];
  }

  private buildLogItem(entry: ActivityEntry): StatusItem {
    const icon =
      entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warning' : 'circle-small-filled';
    const label =
      entry.message.length > 72 ? `${entry.message.slice(0, 69)}…` : entry.message;
    return new StatusItem(
      label,
      icon,
      formatActivityTime(entry.at),
      {
        command: 'nevermin.openOutputLogs',
        title: t('sidebar.logs.open')
      },
      `[${entry.level.toUpperCase()}] ${entry.message}`
    );
  }

  private async getStatusChildren(): Promise<ExplorerNode[]> {
    const provider = getProviderLabel();
    const apiKeyState = await getApiKeyState(this.context);
    const workspaceReady = hasWorkspaceFolders();
    const codeFiles = workspaceReady ? await getWorkspaceCodeFiles(25) : [];
    const selectedCount = getSelectedAnalysisFilePaths(this.context).length;
    const analysisStatus = getRepoAnalysisStatus(this.context);

    return [
      new StatusItem(
        this.getApiKeyLabel(apiKeyState),
        apiKeyState.source === 'secretStorage' ? 'pass-filled' : 'warning',
        provider,
        apiKeyState.source === 'secretStorage'
          ? undefined
          : {
              command: 'nevermin.setApiKey',
              title: t('sidebar.action.saveApiKey')
            },
        this.getApiKeyTooltip(apiKeyState)
      ),
      new StatusItem(
        workspaceReady && codeFiles.length > 0
          ? t('sidebar.workspace.ready')
          : t('sidebar.workspace.notReady'),
        workspaceReady && codeFiles.length > 0 ? 'pass-filled' : 'warning',
        workspaceReady
          ? codeFiles.length >= 25
            ? t('sidebar.workspace.codeFilesMany')
            : t('sidebar.workspace.codeFiles', { count: codeFiles.length })
          : t('sidebar.workspace.openProject'),
        workspaceReady && codeFiles.length > 0
          ? undefined
          : {
              command: 'workbench.action.openFolder',
              title: t('sidebar.workspace.openProject')
            },
        workspaceReady && codeFiles.length > 0
          ? t('sidebar.workspace.readyHint')
          : t('sidebar.workspace.openHint')
      ),
      new StatusItem(
        selectedCount > 0
          ? t('sidebar.selection.count', { count: selectedCount })
          : t('sidebar.selection.none'),
        selectedCount > 0 ? 'checklist' : 'circle-large-outline',
        t('sidebar.selection.hint'),
        undefined,
        t('sidebar.selection.tooltip')
      ),
      new StatusItem(
        analysisStatus === 'loading'
          ? t('sidebar.analysis.running')
          : analysisStatus === 'error'
            ? t('sidebar.analysis.failed')
            : analysisStatus === 'ready'
              ? t('sidebar.analysis.hasResult')
              : t('sidebar.analysis.none'),
        analysisStatus === 'loading'
          ? 'sync~spin'
          : analysisStatus === 'error'
            ? 'error'
            : analysisStatus === 'ready'
              ? 'graph'
              : 'circle-large-outline',
        analysisStatus === 'loading' ? t('sidebar.analysis.wait') : undefined
      )
    ];
  }

  private async getActionChildren(): Promise<ExplorerNode[]> {
    const workspaceReady = hasWorkspaceFolders();
    const codeFiles = workspaceReady ? await getWorkspaceCodeFiles(25) : [];
    const selectedCount = getSelectedAnalysisFilePaths(this.context).length;

    if (!workspaceReady || codeFiles.length === 0) {
      return [
        new StatusItem(
          t('sidebar.action.openFolderRequired'),
          'folder-opened',
          undefined,
          {
            command: 'workbench.action.openFolder',
            title: t('sidebar.workspace.openProject')
          },
          t('sidebar.action.openFolderRequiredHint')
        )
      ];
    }

    return [
      new StatusItem(
        selectedCount > 0
          ? t('sidebar.action.analyzeSelectedN', { count: selectedCount })
          : t('sidebar.action.analyzeSelected'),
        'checklist',
        selectedCount > 0 ? t('sidebar.action.recommended') : t('sidebar.action.checkFirst'),
        {
          command: 'nevermin.analyzeSelectedFiles',
          title: t('sidebar.action.analyzeSelected')
        },
        selectedCount > 0
          ? t('sidebar.action.analyzeSelectedHint', { count: selectedCount })
          : t('sidebar.action.analyzeSelectedEmptyHint')
      ),
      new StatusItem(
        t('sidebar.action.analyzeRepo'),
        'repo',
        undefined,
        {
          command: 'nevermin.analyzeRepo',
          title: t('sidebar.action.analyzeRepo')
        },
        t('sidebar.action.analyzeRepoHint')
      ),
      new StatusItem(
        t('sidebar.action.analyzeGit'),
        'git-commit',
        undefined,
        {
          command: 'nevermin.analyzeGitHistory',
          title: t('sidebar.action.analyzeGit')
        },
        t('sidebar.action.analyzeGitHint')
      ),
      new StatusItem(
        t('sidebar.action.explain'),
        'comment-discussion',
        undefined,
        {
          command: 'nevermin.explainSelection',
          title: t('sidebar.action.explain')
        },
        t('sidebar.action.explainHint')
      )
    ];
  }

  private async getFileSectionChildren(): Promise<ExplorerNode[]> {
    const workspaceFiles = await getWorkspaceAnalysisFiles(200);
    if (workspaceFiles.length === 0) {
      return [
        new StatusItem(
          t('sidebar.status.noCodeFiles'),
          'warning',
          t('sidebar.workspace.openProject'),
          {
            command: 'workbench.action.openFolder',
            title: t('sidebar.workspace.openProject')
          }
        )
      ];
    }

    const selectedPaths = new Set(getSelectedAnalysisFilePaths(this.context));
    const folders = this.groupFilesByFolder(workspaceFiles);

    return [
      new StatusItem(
        t('sidebar.files.selectAll'),
        'checklist',
        t('sidebar.folder.files', { count: workspaceFiles.length }),
        {
          command: 'nevermin.selectAllAnalysisFiles',
          title: t('sidebar.files.selectAll')
        }
      ),
      new StatusItem(
        t('sidebar.files.clear'),
        'close',
        selectedPaths.size > 0
          ? t('sidebar.folder.selected', { selected: selectedPaths.size, total: workspaceFiles.length })
          : t('sidebar.logs.empty'),
        {
          command: 'nevermin.clearAnalysisSelection',
          title: t('sidebar.files.clear')
        }
      ),
      new StatusItem(
        selectedPaths.size > 0
          ? t('sidebar.files.checked', { count: selectedPaths.size })
          : t('sidebar.files.checkTarget'),
        selectedPaths.size > 0 ? 'pass-filled' : 'info',
        t('sidebar.selection.hint'),
        undefined,
        t('sidebar.selection.tooltip')
      ),
      ...folders.map(([folderKey, files]) => {
        const selectedCount = files.filter((uri) => selectedPaths.has(uri.fsPath.replace(/\\/g, '/'))).length;
        const label = folderKey === '.' ? '(root)' : folderKey;
        return new FolderItem(folderKey, label, files, selectedCount);
      })
    ];
  }

  private getStructureChildren(): ExplorerNode[] {
    const graph = getCachedCodeGraph(this.context);
    if (!graph || graph.nodes.length === 0) {
      return [
        new StatusItem(
          t('structure.needAnalyze'),
          'info',
          t('structure.needAnalyzeHint'),
          {
            command: 'nevermin.analyzeRepo',
            title: t('sidebar.action.analyzeRepo')
          }
        )
      ];
    }

    const folders = buildSymbolTree(graph);
    if (folders.length === 0) {
      return [new StatusItem(t('structure.emptySymbols'), 'info', t('structure.emptySymbolsHint'))];
    }

    return folders.map((folder) => new StructureFolderItem(folder));
  }

  private getFolderChildren(folder: FolderItem): ExplorerNode[] {
    const selectedPaths = new Set(getSelectedAnalysisFilePaths(this.context));
    return folder.files
      .slice()
      .sort((left, right) => path.basename(left.fsPath).localeCompare(path.basename(right.fsPath)))
      .map((uri) => {
        const normalized = uri.fsPath.replace(/\\/g, '/');
        return new AnalysisFileItem(
          uri.fsPath,
          path.basename(uri.fsPath),
          selectedPaths.has(normalized),
          path.extname(uri.fsPath).replace('.', '').toUpperCase() || 'FILE',
          uri.fsPath
        );
      });
  }

  private async getGitHistoryChildren(): Promise<ExplorerNode[]> {
    const status = getGitHistoryStatus(this.context);
    const insights = getLatestGitHistory(this.context);

    const runItem = new StatusItem(
      t('sidebar.git.run'),
      'git-commit',
      status === 'loading' ? t('sidebar.git.running') : undefined,
      {
        command: 'nevermin.analyzeGitHistory',
        title: t('sidebar.git.run')
      },
      t('sidebar.git.runHint')
    );

    const manageItems: ExplorerNode[] = insights
      ? [
          new StatusItem(
            t('sidebar.git.rerun'),
            'debug-rerun',
            t('sidebar.git.rerunHint'),
            {
              command: 'nevermin.rerunGitHistory',
              title: t('sidebar.git.rerun')
            },
            t('sidebar.git.rerunTooltip')
          ),
          new StatusItem(
            t('sidebar.git.clear'),
            'trash',
            t('sidebar.git.clearHint'),
            {
              command: 'nevermin.clearGitHistoryResults',
              title: t('sidebar.git.clear')
            },
            t('sidebar.git.clearTooltip')
          )
        ]
      : [];

    if (status === 'loading') {
      return [
        runItem,
        new StatusItem(t('sidebar.git.scanning'), 'sync~spin', t('sidebar.analysis.wait'))
      ];
    }

    if (status === 'error' && !insights) {
      return [
        runItem,
        new StatusItem(
          t('sidebar.git.failed'),
          'error',
          t('sidebar.git.retry'),
          {
            command: 'nevermin.analyzeGitHistory',
            title: t('sidebar.git.run')
          }
        )
      ];
    }

    if (!insights) {
      return [
        runItem,
        new StatusItem(t('sidebar.git.noneDetail'), 'info', t('sidebar.git.noneHint'))
      ];
    }

    return [...manageItems, runItem, ...this.buildGitHistoryItems(insights)];
  }

  private buildGitHistoryItems(insights: GitHistoryInsights): ExplorerNode[] {
    const items: ExplorerNode[] = [];
    const root = insights.repoRoot;

    if (insights.narrative) {
      items.push(
        new StatusItem(
          t('sidebar.git.narrative'),
          'book',
          t('sidebar.git.narrativeHint'),
          {
            command: 'nevermin.openGitHistoryNarrative',
            title: t('sidebar.git.narrative'),
            arguments: [insights.narrative]
          },
          insights.narrative.slice(0, 240)
        )
      );
    }

    items.push(
      new StatusItem(
        t('sidebar.git.stats', {
          commits: insights.commitCountSampled,
          days: insights.windowDays
        }),
        'history',
        undefined,
        undefined,
        insights.summaryBullets.join('\n')
      )
    );

    if (insights.aliveFiles.length > 0) {
      items.push(
        new ResultsGroupItem(
          'gitAlive',
          t('sidebar.git.alive'),
          'flame',
          insights.aliveFiles.map(
            (file) =>
              new StatusItem(
                this.shortPath(file.path),
                'file-code',
                t('sidebar.git.aliveMeta', {
                  commits: file.commits,
                  days: file.daysSinceChange
                }),
                {
                  command: 'nevermin.openGitHistoryFile',
                  title: file.path,
                  arguments: [root, file.path]
                },
                `${file.path}\n${file.authors.slice(0, 4).join(', ')}`
              )
          ),
          String(insights.aliveFiles.length),
          true
        )
      );
    }

    if (insights.frozenFiles.length > 0) {
      items.push(
        new ResultsGroupItem(
          'gitFrozen',
          t('sidebar.git.frozen'),
          'lock',
          insights.frozenFiles.map(
            (file) =>
              new StatusItem(
                this.shortPath(file.path),
                'file',
                t('sidebar.git.frozenMeta', { days: file.daysSinceChange }),
                {
                  command: 'nevermin.openGitHistoryFile',
                  title: file.path,
                  arguments: [root, file.path]
                },
                file.path
              )
          ),
          String(insights.frozenFiles.length),
          false
        )
      );
    }

    if (insights.recentCommits.length > 0) {
      items.push(
        new ResultsGroupItem(
          'gitWhy',
          t('sidebar.git.why'),
          'comment',
          insights.recentCommits.map((commit) => {
            const label =
              commit.subject.length > 56 ? `${commit.subject.slice(0, 53)}…` : commit.subject;
            const firstFile = commit.files[0];
            return new StatusItem(
              label,
              'git-commit',
              `${commit.hash} · ${commit.author}`,
              firstFile
                ? {
                    command: 'nevermin.openGitHistoryFile',
                    title: firstFile,
                    arguments: [root, firstFile]
                  }
                : undefined,
              `${commit.date}\n${commit.subject}\n${commit.files.slice(0, 6).join('\n')}`
            );
          }),
          String(insights.recentCommits.length),
          true
        )
      );
    }

    if (insights.owners.length > 0) {
      items.push(
        new ResultsGroupItem(
          'gitOwners',
          t('sidebar.git.owners'),
          'account',
          insights.owners.map(
            (owner) =>
              new StatusItem(
                owner.author,
                'person',
                this.shortPath(owner.path),
                {
                  command: 'nevermin.openGitHistoryFile',
                  title: owner.path,
                  arguments: [root, owner.path]
                },
                t('sidebar.git.ownerMeta', {
                  path: owner.path,
                  commits: owner.commits,
                  share: Math.round(owner.share * 100)
                })
              )
          ),
          String(insights.owners.length),
          false
        )
      );
    }

    if (insights.couplings.length > 0) {
      items.push(
        new ResultsGroupItem(
          'gitCoupling',
          t('sidebar.git.coupling'),
          'type-hierarchy',
          insights.couplings.map(
            (pair) =>
              new StatusItem(
                `${this.shortPath(pair.a)} ↔ ${this.shortPath(pair.b)}`,
                'link',
                t('sidebar.git.couplingMeta', { count: pair.together }),
                {
                  command: 'nevermin.openGitHistoryFile',
                  title: pair.a,
                  arguments: [root, pair.a]
                },
                `${pair.a}\n${pair.b}\n×${pair.together}`
              )
          ),
          String(insights.couplings.length),
          true
        )
      );
    }

    return items;
  }

  private shortPath(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length <= 2) {
      return normalized;
    }
    return parts.slice(-2).join('/');
  }

  private async getResultsChildren(): Promise<ExplorerNode[]> {
    const analysisStatus = getRepoAnalysisStatus(this.context);
    const analysis = getLatestRepoAnalysis(this.context);

    if (analysisStatus === 'loading') {
      return [
        new StatusItem(t('sidebar.analysis.running'), 'sync~spin', t('sidebar.analysis.wait'))
      ];
    }

    if (analysisStatus === 'error') {
      const retryCommand =
        getLastAnalysisMode(this.context) === 'selected'
          ? 'nevermin.analyzeSelectedFiles'
          : 'nevermin.analyzeRepo';
      return [
        new StatusItem(
          t('sidebar.analysis.failed'),
          'error',
          t('sidebar.results.failed'),
          {
            command: retryCommand,
            title: t('sidebar.action.analyzeRepo')
          }
        )
      ];
    }

    if (!analysis) {
      return [
        new StatusItem(
          t('sidebar.results.none'),
          'info',
          t('sidebar.results.runAnalyze'),
          {
            command: 'nevermin.analyzeRepo',
            title: t('sidebar.action.analyzeRepo')
          }
        )
      ];
    }

    return this.buildAnalysisItems(analysis);
  }

  private analysisActionItems(): ExplorerNode[] {
    return [
      new StatusItem(
        t('sidebar.results.rerun'),
        'debug-rerun',
        t('sidebar.results.rerunHint'),
        {
          command: 'nevermin.rerunAnalysis',
          title: t('sidebar.results.rerun')
        },
        t('sidebar.results.rerunTooltip')
      ),
      new StatusItem(
        t('sidebar.results.clear'),
        'trash',
        t('sidebar.results.clearHint'),
        {
          command: 'nevermin.clearAnalysisResults',
          title: t('sidebar.results.clear')
        },
        t('sidebar.results.clearTooltip')
      )
    ];
  }

  private async getSettingsChildren(): Promise<ExplorerNode[]> {
    const apiKeyState = await getApiKeyState(this.context);
    const activeProvider = getProviderName();
    const privacyMode = getPrivacyMode(this.context);
    const needsKey = activeProvider !== 'ollama' && privacyMode !== 'private';

    return [
      new StatusItem(
        privacyMode === 'private'
          ? t('privacy.mode.private')
          : privacyMode === 'public'
            ? t('privacy.mode.public')
            : t('privacy.mode.unset'),
        privacyMode === 'private' ? 'lock' : 'globe',
        t('privacy.change'),
        {
          command: 'nevermin.choosePrivacyMode',
          title: t('privacy.change')
        },
        t('privacy.changeHint')
      ),
      new StatusItem(
        t('lang.current', { name: getLanguageLabel() }),
        'globe',
        undefined,
        {
          command: 'nevermin.selectLanguage',
          title: t('sidebar.action.pickLanguage')
        }
      ),
      new StatusItem(
        `Provider: ${getProviderLabel()}`,
        'symbol-enum',
        privacyMode === 'private' ? t('privacy.providerLocked') : undefined,
        {
          command: 'nevermin.selectProvider',
          title: t('sidebar.action.pickProvider')
        }
      ),
      ...(needsKey
        ? [
            new StatusItem(
              apiKeyState.source === 'secretStorage'
                ? t('sidebar.apiKey.ok')
                : t('sidebar.action.saveApiKey'),
              'key',
              getProviderLabel(),
              {
                command: 'nevermin.setApiKey',
                title: t('sidebar.action.saveApiKey')
              },
              this.getApiKeyTooltip(apiKeyState)
            )
          ]
        : [
            new StatusItem(
              t('sidebar.ollama.pickModel'),
              'server-process',
              getLlmModel() || getProviderDefaultModel('ollama'),
              {
                command: 'nevermin.selectOllamaModel',
                title: t('sidebar.ollama.pickModel')
              },
              t('sidebar.ollama.pickModelHint')
            )
          ]),
      new StatusItem(
        t('sidebar.action.openSettings'),
        'gear',
        undefined,
        {
          command: 'nevermin.openSettings',
          title: t('sidebar.action.openSettings')
        }
      ),
      new StatusItem(
        t('wipe.sidebar'),
        'trash',
        privacyMode === 'private' ? t('wipe.sidebarPrivateHint') : t('wipe.sidebarHint'),
        {
          command: 'nevermin.wipeWorkspaceData',
          title: t('wipe.sidebar')
        },
        t('wipe.sidebarTooltip')
      ),
      new StatusItem(
        t('sidebar.action.refresh'),
        'refresh',
        undefined,
        {
          command: 'nevermin.refreshSidebar',
          title: t('sidebar.action.refresh')
        }
      )
    ];
  }

  private buildAnalysisItems(analysis: RepoAnalysis): ExplorerNode[] {
    const groups: ExplorerNode[] = [
      ...this.analysisActionItems(),
      new StatusItem(
        `${analysis.fileCount} file · ${analysis.symbolCount} symbol`,
        'check',
        new Date(analysis.generatedAt).toLocaleString(),
        undefined,
        t('sidebar.results.savedAt')
      )
    ];

    const insights = analysis.insights;
    if (insights) {
      const mainFlow = insights.mainFlow ?? insights.keyFlows[0] ?? null;
      const learningChildren: ExplorerNode[] = [];
      if (mainFlow) {
        learningChildren.push(...this.buildMainFlowChildren(mainFlow));
      }
      learningChildren.push(
        new StatusItem(
          t('sidebar.results.openMindMap'),
          'map',
          'Mind Map',
          {
            command: 'nevermin.openLearningMindMap',
            title: t('sidebar.results.openMindMap'),
            arguments: [insights]
          },
          t('sidebar.results.mindMapHint')
        )
      );
      groups.push(
        new ResultsGroupItem(
          'flow',
          t('sidebar.results.mainFlow'),
          'git-branch',
          learningChildren,
          mainFlow ? `${mainFlow.input} → ${mainFlow.output}` : 'Mind Map',
          true
        )
      );

      const summaryChildren: ExplorerNode[] = [];
      if (insights.narrative) {
        summaryChildren.push(
          new StatusItem(
            t('sidebar.results.openNarrative'),
            'markdown',
            undefined,
            {
              command: 'nevermin.openInsightsNarrative',
              title: t('sidebar.results.openNarrative'),
              arguments: [insights.narrative]
            }
          )
        );
      }
      for (const bullet of insights.summaryBullets.slice(0, 3)) {
        summaryChildren.push(new StatusItem(bullet, 'info', undefined, undefined, bullet));
      }
      if (summaryChildren.length > 0) {
        groups.push(
          new ResultsGroupItem(
            'summary',
            t('sidebar.results.summary'),
            'lightbulb',
            summaryChildren,
            undefined,
            true
          )
        );
      }

      if (insights.entryPoints.length > 0) {
        groups.push(
          new ResultsGroupItem(
            'entries',
            t('sidebar.results.entries'),
            'debug-start',
            insights.entryPoints.map(
              (entry) =>
                new StatusItem(
                  entry.name,
                  entry.kind === 'class' ? 'symbol-class' : 'symbol-method',
                  entry.filePath,
                  {
                    command: 'nevermin.openGraphInsight',
                    title: t('sidebar.results.entries'),
                    arguments: [entry]
                  },
                  entry.reason
                )
            ),
            String(insights.entryPoints.length),
            false
          )
        );
      }

      if (insights.hubs.length > 0) {
        groups.push(
          new ResultsGroupItem(
            'hubs',
            t('sidebar.results.hubs'),
            'type-hierarchy',
            insights.hubs.map(
              (hub) =>
                new StatusItem(
                  hub.name,
                  hub.kind === 'file' ? 'file-code' : hub.kind === 'class' ? 'symbol-class' : 'symbol-method',
                  hub.filePath,
                  {
                    command: 'nevermin.openGraphInsight',
                    title: t('sidebar.results.hubs'),
                    arguments: [hub]
                  },
                  hub.reason
                )
            ),
            String(insights.hubs.length),
            false
          )
        );
      }

      if (insights.keyFlows.length > 1) {
        groups.push(
          new ResultsGroupItem(
            'otherFlows',
            t('sidebar.results.otherFlows'),
            'git-branch',
            insights.keyFlows.slice(1).map((flow) => this.buildOtherFlowItem(flow)),
            t('sidebar.results.nFlows', { count: insights.keyFlows.length - 1 }),
            false
          )
        );
      }
    }

    groups.push(
      new ResultsGroupItem(
        'folders',
        t('sidebar.results.folders'),
        'folder-opened',
        analysis.topFolders.map(
          (folder) =>
            new StatusItem(
              folder.folderPath,
              'folder',
              t('sidebar.folder.files', { count: folder.fileCount })
            )
        ),
        String(analysis.folderCount),
        false
      ),
      new ResultsGroupItem(
        'files',
        t('sidebar.results.importantFiles'),
        'file-code',
        analysis.importantFiles.map(
          (file) =>
            new StatusItem(
              path.basename(file.filePath),
              'file',
              `${file.symbolCount} symbol`,
              {
                command: 'nevermin.openGraphInsight',
                title: t('sidebar.results.importantFiles'),
                arguments: [
                  {
                    name: path.basename(file.filePath),
                    filePath: file.filePath,
                    startLine: 1,
                    endLine: 1
                  }
                ]
              },
              file.symbols.length > 0
                ? `Symbol: ${file.symbols.slice(0, 4).join(', ')}${file.symbols.length > 4 ? '…' : ''}`
                : file.filePath
            )
        ),
        t('sidebar.results.spotlight'),
        false
      ),
      new ResultsGroupItem(
        'symbols',
        t('sidebar.results.symbols'),
        'symbol-method',
        analysis.mainSymbols.map(
          (symbol) =>
            new StatusItem(
              symbol.name,
              symbol.kind === 'class' ? 'symbol-class' : 'symbol-method',
              `${path.basename(symbol.filePath)}:${symbol.startLine}`,
              {
                command: 'nevermin.openGraphInsight',
                title: t('sidebar.results.symbols'),
                arguments: [symbol]
              },
              `${symbol.kind} di ${symbol.filePath}:${symbol.startLine}-${symbol.endLine}`
            )
        ),
        t('sidebar.results.dominant'),
        false
      )
    );

    return groups;
  }

  private buildMainFlowChildren(mainFlow: GraphInsightFlow): ExplorerNode[] {
    return [
      new StatusItem(
        `${mainFlow.input} → ${mainFlow.output}`,
        'type-hierarchy',
        'Mermaid',
        {
          command: 'nevermin.openMainFlowDiagram',
          title: t('sidebar.results.openFlow'),
          arguments: [mainFlow]
        },
        t('sidebar.results.flowHint')
      )
    ];
  }

  private buildOtherFlowItem(flow: GraphInsightFlow): StatusItem {
    const stage = flow.stages.find((item) => item.role === 'input') ?? flow.stages[0];
    return new StatusItem(
      `${flow.input} → ${flow.output}`,
      'arrow-right',
      flow.process.length > 0
        ? flow.process.join(', ')
        : t('sidebar.results.steps', { count: flow.steps.length }),
      stage
        ? this.openStageCommand(stage, flow.label, flow.steps.join(' → '))
        : undefined,
      [
        t('sidebar.results.input', { value: flow.input }),
        flow.process.length > 0
          ? t('sidebar.results.process', { value: flow.process.join(' → ') })
          : undefined,
        t('sidebar.results.output', { value: flow.output })
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  private openStageCommand(
    stage: GraphInsightFlowStage,
    name: string,
    reason: string
  ): vscode.Command {
    return {
      command: 'nevermin.openGraphInsight',
      title: 'Buka Symbol',
      arguments: [
        {
          id: stage.nodeId,
          name,
          kind: 'function',
          filePath: stage.filePath,
          startLine: stage.startLine,
          endLine: stage.endLine,
          score: 0,
          reason
        }
      ]
    };
  }

  private groupFilesByFolder(files: vscode.Uri[]): Array<[string, vscode.Uri[]]> {
    const groups = new Map<string, vscode.Uri[]>();

    for (const uri of files) {
      const folder = vscode.workspace.getWorkspaceFolder(uri);
      const relative = folder ? path.relative(folder.uri.fsPath, uri.fsPath) : path.basename(uri.fsPath);
      const folderKey = path.dirname(relative).replace(/\\/g, '/') || '.';
      const list = groups.get(folderKey) ?? [];
      list.push(uri);
      groups.set(folderKey, list);
    }

    return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }

  private getApiKeyLabel(apiKeyState: ApiKeyState): string {
    switch (apiKeyState.source) {
      case 'secretStorage':
        return t('sidebar.apiKey.ok');
      case 'settingsFallback':
        return t('sidebar.apiKey.fallback');
      default:
        return t('sidebar.apiKey.missing');
    }
  }

  private getApiKeyTooltip(apiKeyState: ApiKeyState): string {
    switch (apiKeyState.source) {
      case 'secretStorage':
        return t('sidebar.apiKey.tooltip.ok');
      case 'settingsFallback':
        return t('sidebar.apiKey.tooltip.fallback');
      default:
        return t('sidebar.apiKey.tooltip.missing');
    }
  }
}
