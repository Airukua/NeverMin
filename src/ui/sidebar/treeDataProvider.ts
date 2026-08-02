import path from 'path';
import * as vscode from 'vscode';
import { ApiKeyState, getApiKeyState, getProviderLabel } from '../../utils/config';
import { getWorkspaceAnalysisFiles, getWorkspaceCodeFiles, hasWorkspaceFolders } from '../../utils/workspace';
import { getLatestRepoAnalysis, getRepoAnalysisStatus } from '../../utils/repoAnalysis';
import { getSelectedAnalysisFilePaths } from '../../utils/repoAnalysisSelection';
import { RepoAnalysis } from '../../core/analysis/repoAnalyzer';

type SectionId = 'status' | 'actions' | 'files' | 'results' | 'settings';
type ExplorerNode = SectionItem | FolderItem | StatusItem | AnalysisFileItem;

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
    this.description = selectedCount > 0 ? `${selectedCount}/${files.length} dipilih` : `${files.length} file`;
    this.tooltip = folderKey;
    this.contextValue = 'analysisFolder';
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

    return [];
  }

  private async getRootItems(): Promise<ExplorerNode[]> {
    const workspaceReady = hasWorkspaceFolders();
    const codeFiles = workspaceReady ? await getWorkspaceCodeFiles(25) : [];
    const selectedCount = getSelectedAnalysisFilePaths(this.context).length;
    const analysisStatus = getRepoAnalysisStatus(this.context);
    const latestAnalysis = getLatestRepoAnalysis(this.context);
    const apiKeyState = await getApiKeyState(this.context);

    const statusDescription = !workspaceReady
      ? 'Buka folder dulu'
      : codeFiles.length === 0
        ? 'Belum ada file kode'
        : apiKeyState.source === 'missing'
          ? 'API key belum diset'
          : analysisStatus === 'loading'
            ? 'Sedang menganalisis'
            : selectedCount > 0
              ? `${selectedCount} file siap dianalisis`
              : 'Siap dipakai';

    const actionsDescription =
      selectedCount > 0 ? `Analisis ${selectedCount} file` : 'Analisis repo / jelaskan kode';

    const resultsDescription =
      analysisStatus === 'loading'
        ? 'Berjalan...'
        : analysisStatus === 'error'
          ? 'Gagal'
          : latestAnalysis
            ? `${latestAnalysis.fileCount} file · ${latestAnalysis.symbolCount} symbol`
            : 'Belum ada hasil';

    return [
      new SectionItem('status', '1. Status', 'pulse', vscode.TreeItemCollapsibleState.Expanded, statusDescription),
      new SectionItem('actions', '2. Jalankan', 'play', vscode.TreeItemCollapsibleState.Expanded, actionsDescription),
      new SectionItem(
        'files',
        '3. Pilih File',
        'files',
        vscode.TreeItemCollapsibleState.Expanded,
        selectedCount > 0 ? `${selectedCount} dicentang` : 'Centang file target'
      ),
      new SectionItem('results', '4. Hasil Analisis', 'graph', vscode.TreeItemCollapsibleState.Collapsed, resultsDescription),
      new SectionItem('settings', 'Pengaturan', 'settings-gear', vscode.TreeItemCollapsibleState.Collapsed, getProviderLabel())
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
      case 'results':
        return this.getResultsChildren();
      case 'settings':
        return this.getSettingsChildren();
      default:
        return [];
    }
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
              title: 'Simpan API Key'
            },
        this.getApiKeyTooltip(apiKeyState)
      ),
      new StatusItem(
        workspaceReady && codeFiles.length > 0 ? 'Workspace siap' : 'Workspace belum siap',
        workspaceReady && codeFiles.length > 0 ? 'pass-filled' : 'warning',
        workspaceReady ? `${codeFiles.length}+ file kode` : 'Buka folder project',
        workspaceReady && codeFiles.length > 0
          ? undefined
          : {
              command: 'workbench.action.openFolder',
              title: 'Buka Folder'
            },
        workspaceReady && codeFiles.length > 0
          ? 'NeverMIN menemukan file kode di workspace ini.'
          : 'Buka folder project yang berisi source code.'
      ),
      new StatusItem(
        selectedCount > 0 ? `${selectedCount} file dipilih` : 'Belum memilih file',
        selectedCount > 0 ? 'checklist' : 'circle-large-outline',
        'Untuk analisis terfokus',
        undefined,
        'Centang file di bagian "Pilih File" jika ingin analisis sebagian repo saja.'
      ),
      new StatusItem(
        analysisStatus === 'loading'
          ? 'Analisis berjalan'
          : analysisStatus === 'error'
            ? 'Analisis gagal'
            : analysisStatus === 'ready'
              ? 'Ada hasil analisis'
              : 'Belum ada analisis',
        analysisStatus === 'loading' ? 'sync~spin' : analysisStatus === 'error' ? 'error' : analysisStatus === 'ready' ? 'graph' : 'circle-large-outline',
        analysisStatus === 'loading' ? 'Tunggu sebentar' : undefined
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
          'Buka folder project dulu',
          'folder-opened',
          'Wajib',
          {
            command: 'workbench.action.openFolder',
            title: 'Buka Folder'
          },
          'Sidebar akan aktif setelah ada workspace berisi file kode.'
        )
      ];
    }

    return [
      new StatusItem(
        selectedCount > 0 ? `Analisis ${selectedCount} file terpilih` : 'Analisis file terpilih',
        'checklist',
        selectedCount > 0 ? 'Direkomendasikan' : 'Centang file dulu',
        {
          command: 'nevermin.analyzeSelectedFiles',
          title: 'Analisis File Dicentang'
        },
        selectedCount > 0
          ? `Membangun graph dan ringkasan dari ${selectedCount} file yang dicentang.`
          : 'Centang file di bagian Pilih File, lalu klik lagi di sini.'
      ),
      new StatusItem(
        'Analisis seluruh repo',
        'repo',
        'Semua file',
        {
          command: 'nevermin.analyzeRepo',
          title: 'Jalankan Analisis Repo'
        },
        'Memindai workspace lalu membuka code graph.'
      ),
      new StatusItem(
        'Jelaskan kode yang dipilih',
        'comment-discussion',
        'Selection / file aktif',
        {
          command: 'nevermin.explainSelection',
          title: 'Jelaskan Kode Aktif'
        },
        'Jelaskan selection di editor, atau seluruh file jika tidak ada selection.'
      )
    ];
  }

  private async getFileSectionChildren(): Promise<ExplorerNode[]> {
    const workspaceFiles = await getWorkspaceAnalysisFiles(200);
    if (workspaceFiles.length === 0) {
      return [
        new StatusItem(
          'Belum ada file untuk dipilih',
          'warning',
          'Buka folder project',
          {
            command: 'workbench.action.openFolder',
            title: 'Buka Folder'
          }
        )
      ];
    }

    const selectedPaths = new Set(getSelectedAnalysisFilePaths(this.context));
    const folders = this.groupFilesByFolder(workspaceFiles);

    return [
      new StatusItem(
        'Centang semua file',
        'checklist',
        `${workspaceFiles.length} file`,
        {
          command: 'nevermin.selectAllAnalysisFiles',
          title: 'Centang Semua File'
        },
        'Pilih semua file yang bisa dianalisis.'
      ),
      new StatusItem(
        selectedPaths.size > 0 ? `${selectedPaths.size} file dicentang` : 'Belum ada yang dicentang',
        selectedPaths.size > 0 ? 'pass-filled' : 'info',
        'Klik checkbox di file',
        undefined,
        'Centang file, lalu pakai "Analisis file terpilih" di bagian Jalankan.'
      ),
      ...folders.map(([folderKey, files]) => {
        const selectedCount = files.filter((uri) => selectedPaths.has(uri.fsPath.replace(/\\/g, '/'))).length;
        const label = folderKey === '.' ? '(root)' : folderKey;
        return new FolderItem(folderKey, label, files, selectedCount);
      })
    ];
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

  private async getResultsChildren(): Promise<ExplorerNode[]> {
    const analysisStatus = getRepoAnalysisStatus(this.context);
    const analysis = getLatestRepoAnalysis(this.context);

    if (analysisStatus === 'loading') {
      return [
        new StatusItem('Sedang menyusun ringkasan & graph', 'sync~spin', 'Mohon tunggu')
      ];
    }

    if (analysisStatus === 'error') {
      return [
        new StatusItem(
          'Analisis gagal — coba lagi',
          'error',
          'Klik untuk ulang',
          {
            command: 'nevermin.analyzeRepo',
            title: 'Jalankan Analisis Repo'
          }
        )
      ];
    }

    if (!analysis) {
      return [
        new StatusItem(
          'Belum ada hasil',
          'info',
          'Jalankan analisis dulu',
          {
            command: 'nevermin.analyzeRepo',
            title: 'Jalankan Analisis Repo'
          },
          'Hasil folder, file penting, dan symbol utama akan muncul di sini.'
        )
      ];
    }

    return this.buildAnalysisItems(analysis);
  }

  private async getSettingsChildren(): Promise<ExplorerNode[]> {
    const apiKeyState = await getApiKeyState(this.context);

    return [
      new StatusItem(
        `Provider: ${getProviderLabel()}`,
        'symbol-enum',
        'Aktif',
        {
          command: 'nevermin.openSettings',
          title: 'Buka Settings'
        }
      ),
      new StatusItem(
        'Pakai Gemini',
        'sparkle',
        undefined,
        {
          command: 'nevermin.useGemini',
          title: 'Pakai Gemini'
        }
      ),
      new StatusItem(
        'Pakai DeepSeek',
        'sparkle',
        undefined,
        {
          command: 'nevermin.useDeepSeek',
          title: 'Pakai DeepSeek'
        }
      ),
      new StatusItem(
        apiKeyState.source === 'secretStorage' ? 'Ganti API key' : 'Simpan API key',
        'key',
        apiKeyState.source === 'secretStorage' ? 'Tersimpan aman' : 'Belum aman',
        {
          command: 'nevermin.setApiKey',
          title: 'Simpan API Key'
        },
        this.getApiKeyTooltip(apiKeyState)
      ),
      new StatusItem(
        'Buka Settings',
        'gear',
        undefined,
        {
          command: 'nevermin.openSettings',
          title: 'Buka Settings NeverMIN'
        }
      ),
      new StatusItem(
        'Refresh sidebar',
        'refresh',
        undefined,
        {
          command: 'nevermin.refreshSidebar',
          title: 'Refresh Sidebar'
        }
      )
    ];
  }

  private buildAnalysisItems(analysis: RepoAnalysis): ExplorerNode[] {
    const items: ExplorerNode[] = [
      new StatusItem(
        `${analysis.fileCount} file · ${analysis.symbolCount} symbol`,
        'check',
        new Date(analysis.generatedAt).toLocaleString(),
        {
          command: 'nevermin.analyzeRepo',
          title: 'Analisis Ulang'
        },
        'Klik untuk menjalankan analisis ulang.'
      )
    ];

    const insights = analysis.insights;
    if (insights) {
      items.push(new StatusItem('Insights Graph', 'lightbulb', 'Flow & ringkasan'));

      const mainFlow = insights.mainFlow ?? insights.keyFlows[0] ?? null;
      if (mainFlow) {
        items.push(
          new StatusItem(
            'Flow Utama (Data)',
            'git-branch',
            'Input → Output',
            {
              command: 'nevermin.openGraphInsight',
              title: 'Buka Flow Utama',
              arguments: [
                {
                  id: mainFlow.nodeIds[0],
                  name: mainFlow.label,
                  kind: 'function',
                  filePath: mainFlow.stages[0]?.filePath ?? '',
                  startLine: 1,
                  endLine: 1,
                  score: mainFlow.ioScore,
                  reason: mainFlow.steps.join(' → '),
                  nodeIds: mainFlow.nodeIds
                }
              ]
            },
            [
              `Input: ${mainFlow.input}`,
              mainFlow.process.length > 0 ? `Proses: ${mainFlow.process.join(' → ')}` : undefined,
              `Output: ${mainFlow.output}`,
              '',
              mainFlow.steps.join(' → ')
            ]
              .filter(Boolean)
              .join('\n')
          )
        );
        items.push(
          new StatusItem(
            `Input: ${mainFlow.input}`,
            'arrow-right',
            'masuk data',
            {
              command: 'nevermin.openGraphInsight',
              title: 'Buka Input',
              arguments: [
                {
                  id: mainFlow.stages.find((s) => s.role === 'input')?.nodeId ?? mainFlow.nodeIds[0],
                  name: mainFlow.input,
                  kind: 'function',
                  filePath: mainFlow.stages.find((s) => s.role === 'input')?.filePath ?? '',
                  startLine: 1,
                  endLine: 1,
                  score: 0,
                  reason: 'Titik masuk data aplikasi'
                }
              ]
            },
            'Dari mana data masuk ke aplikasi'
          )
        );
        if (mainFlow.process.length > 0) {
          items.push(
            new StatusItem(
              `Proses: ${mainFlow.process.join(' → ')}`,
              'gear',
              `${mainFlow.process.length} langkah`,
              undefined,
              'Transformasi / service di tengah alur'
            )
          );
        }
        items.push(
          new StatusItem(
            `Output: ${mainFlow.output}`,
            'export',
            'hasil data',
            {
              command: 'nevermin.openGraphInsight',
              title: 'Buka Output',
              arguments: [
                {
                  id:
                    mainFlow.stages.find((s) => s.role === 'output')?.nodeId ??
                    mainFlow.nodeIds[mainFlow.nodeIds.length - 1],
                  name: mainFlow.output,
                  kind: 'function',
                  filePath: mainFlow.stages.find((s) => s.role === 'output')?.filePath ?? '',
                  startLine: 1,
                  endLine: 1,
                  score: 0,
                  reason: 'Titik keluar / tampilan hasil data'
                }
              ]
            },
            'Ke mana data ditampilkan atau dikirim keluar'
          )
        );
      }

      if (insights.narrative) {
        items.push(
          new StatusItem(
            'Ringkasan onboarding (Markdown)',
            'markdown',
            'Klik untuk preview',
            {
              command: 'nevermin.openInsightsNarrative',
              title: 'Buka Ringkasan Markdown',
              arguments: [insights.narrative]
            },
            'Membuka preview Markdown dari ringkasan LLM.'
          )
        );
      }

      for (const bullet of insights.summaryBullets.slice(0, 3)) {
        items.push(new StatusItem(bullet, 'info', 'Insight', undefined, bullet));
      }

      if (insights.entryPoints.length > 0) {
        items.push(new StatusItem('Entry points', 'debug-start', `${insights.entryPoints.length} titik`));
        for (const entry of insights.entryPoints) {
          items.push(
            new StatusItem(
              entry.name,
              entry.kind === 'class' ? 'symbol-class' : 'symbol-method',
              entry.filePath,
              {
                command: 'nevermin.openGraphInsight',
                title: 'Buka Entry Point',
                arguments: [entry]
              },
              entry.reason
            )
          );
        }
      }

      if (insights.hubs.length > 0) {
        items.push(new StatusItem('Hubs', 'type-hierarchy', `${insights.hubs.length} hub`));
        for (const hub of insights.hubs) {
          items.push(
            new StatusItem(
              hub.name,
              hub.kind === 'file' ? 'file-code' : hub.kind === 'class' ? 'symbol-class' : 'symbol-method',
              hub.filePath,
              {
                command: 'nevermin.openGraphInsight',
                title: 'Buka Hub',
                arguments: [hub]
              },
              hub.reason
            )
          );
        }
      }

      if (insights.keyFlows.length > 1) {
        items.push(new StatusItem('Alur lain', 'git-branch', `${insights.keyFlows.length - 1} alur`));
        for (const flow of insights.keyFlows.slice(1)) {
          items.push(
            new StatusItem(
              `${flow.input} → ${flow.output}`,
              'arrow-right',
              flow.process.length > 0 ? flow.process.join(', ') : `${flow.steps.length} langkah`,
              undefined,
              [
                `Input: ${flow.input}`,
                flow.process.length > 0 ? `Proses: ${flow.process.join(' → ')}` : undefined,
                `Output: ${flow.output}`
              ]
                .filter(Boolean)
                .join('\n')
            )
          );
        }
      }
    }

    items.push(
      new StatusItem('Folder teratas', 'folder-opened', `${analysis.folderCount} folder`),
      ...analysis.topFolders.map(
        (folder) =>
          new StatusItem(folder.folderPath, 'folder', `${folder.fileCount} file`)
      ),
      new StatusItem('File penting', 'file-code', 'Sorotan'),
      ...analysis.importantFiles.map(
        (file) =>
          new StatusItem(
            file.filePath,
            'file',
            `${file.symbolCount} symbol`,
            undefined,
            file.symbols.length > 0
              ? `Symbol: ${file.symbols.slice(0, 4).join(', ')}${file.symbols.length > 4 ? '…' : ''}`
              : 'Tidak ada symbol terdeteksi.'
          )
      ),
      new StatusItem('Symbol utama', 'symbol-method', 'Paling dominan'),
      ...analysis.mainSymbols.map(
        (symbol) =>
          new StatusItem(
            symbol.name,
            symbol.kind === 'class' ? 'symbol-class' : 'symbol-method',
            `${symbol.filePath}:${symbol.startLine}`,
            undefined,
            `${symbol.kind} di ${symbol.filePath}:${symbol.startLine}-${symbol.endLine}`
          )
      )
    );

    return items;
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
        return 'API key siap';
      case 'settingsFallback':
        return 'API key masih di settings';
      default:
        return 'API key belum diset';
    }
  }

  private getApiKeyTooltip(apiKeyState: ApiKeyState): string {
    switch (apiKeyState.source) {
      case 'secretStorage':
        return 'API key tersimpan di SecretStorage VS Code.';
      case 'settingsFallback':
        return 'API key masih dibaca dari settings.json. Simpan ulang agar pindah ke SecretStorage.';
      default:
        return 'Simpan API key agar NeverMIN bisa menjelaskan kode.';
    }
  }
}
