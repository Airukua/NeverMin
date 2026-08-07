/**
 * Minimal vscode stub for Node-based unit tests.
 * Required both as `vscode` (via register preload) and as `../mocks/vscode`.
 */

type ConfigTarget = 1 | 2 | 3;

const ConfigurationTarget = {
  Global: 1 as ConfigTarget,
  Workspace: 2 as ConfigTarget,
  WorkspaceFolder: 3 as ConfigTarget
};

interface StoredConfig {
  globalValue?: string;
  workspaceValue?: string;
  workspaceFolderValue?: string;
}

const configStore = new Map<string, StoredConfig>();

function configKey(section: string, key: string): string {
  return `${section}.${key}`;
}

class Uri {
  readonly scheme: string;
  readonly fsPath: string;
  readonly path: string;

  private constructor(scheme: string, fsPath: string) {
    this.scheme = scheme;
    this.fsPath = fsPath;
    this.path = fsPath;
  }

  static file(fsPath: string): Uri {
    return new Uri('file', fsPath);
  }

  static parse(value: string): Uri {
    const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):(?:\/\/)?(.*)$/.exec(value);
    if (!match) {
      return Uri.file(value);
    }
    const scheme = match[1];
    const rest = match[2] || value;
    if (scheme === 'file') {
      const fsPath = rest.startsWith('/') ? rest : `/${rest}`;
      return new Uri('file', fsPath.replace(/^\/([A-Za-z]:)/, '$1'));
    }
    return new Uri(scheme, value);
  }

  static joinPath(base: Uri, ...paths: string[]): Uri {
    const joined = [base.fsPath, ...paths].join('/').replace(/\/+/g, '/');
    return Uri.file(joined);
  }

  toString(skipEncoding?: boolean): string {
    void skipEncoding;
    if (this.scheme === 'file') {
      return `file://${this.fsPath}`;
    }
    return this.fsPath.includes('://') ? this.fsPath : `${this.scheme}://${this.fsPath}`;
  }
}

class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position
  ) {}
}

class Selection extends Range {}

class TreeItem {
  public checkboxState?: number;
  public description?: string;
  public tooltip?: string;
  public command?: unknown;
  public contextValue?: string;
  public iconPath?: unknown;

  constructor(
    public label: string,
    public collapsibleState?: number
  ) {}
}

class ThemeIcon {
  constructor(public readonly id: string) {}
}

class EventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];

  event = (listener: (value: T) => void): { dispose(): void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        this.listeners = this.listeners.filter((item) => item !== listener);
      }
    };
  };

  fire(value: T): void {
    for (const listener of [...this.listeners]) {
      listener(value);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

function getConfiguration(section: string) {
  return {
    get<T>(key: string, defaultValue?: T): T {
      const stored = configStore.get(configKey(section, key));
      const value = stored?.workspaceFolderValue ?? stored?.workspaceValue ?? stored?.globalValue;
      return (value !== undefined ? value : defaultValue) as T;
    },
    inspect<T>(key: string): {
      key: string;
      globalValue?: T;
      workspaceValue?: T;
      workspaceFolderValue?: T;
    } {
      const stored = configStore.get(configKey(section, key)) ?? {};
      return {
        key: configKey(section, key),
        globalValue: stored.globalValue as T | undefined,
        workspaceValue: stored.workspaceValue as T | undefined,
        workspaceFolderValue: stored.workspaceFolderValue as T | undefined
      };
    },
    async update(key: string, value: string | undefined, target: ConfigTarget): Promise<void> {
      const id = configKey(section, key);
      const current = { ...(configStore.get(id) ?? {}) };
      if (target === ConfigurationTarget.Global) {
        if (value === undefined) {
          delete current.globalValue;
        } else {
          current.globalValue = value;
        }
      } else if (target === ConfigurationTarget.Workspace) {
        if (value === undefined) {
          delete current.workspaceValue;
        } else {
          current.workspaceValue = value;
        }
      } else if (value === undefined) {
        delete current.workspaceFolderValue;
      } else {
        current.workspaceFolderValue = value;
      }
      configStore.set(id, current);
    }
  };
}

function __resetVscodeMock(): void {
  configStore.clear();
}

function __seedSettingsApiKey(value: string, target: ConfigTarget = ConfigurationTarget.Global): void {
  const id = configKey('nevermin', 'apiKey');
  const current = { ...(configStore.get(id) ?? {}) };
  if (target === ConfigurationTarget.Global) {
    current.globalValue = value;
  } else if (target === ConfigurationTarget.Workspace) {
    current.workspaceValue = value;
  } else {
    current.workspaceFolderValue = value;
  }
  configStore.set(id, current);
}

function createMockExtensionContext(): {
  extensionPath: string;
  extensionUri: Uri;
  secrets: {
    get(key: string): Promise<string | undefined>;
    store(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  globalState: {
    get<T>(key: string, defaultValue?: T): T | undefined;
    update(key: string, value: unknown): Thenable<void>;
  };
  workspaceState: {
    get<T>(key: string, defaultValue?: T): T | undefined;
    update(key: string, value: unknown): Thenable<void>;
  };
  subscriptions: Array<{ dispose(): void }>;
} {
  const secrets = new Map<string, string>();
  const globalState = new Map<string, unknown>();
  const workspaceState = new Map<string, unknown>();

  return {
    extensionPath: '/mock/nevermin',
    extensionUri: Uri.file('/mock/nevermin'),
    secrets: {
      async get(key: string) {
        return secrets.get(key);
      },
      async store(key: string, value: string) {
        secrets.set(key, value);
      },
      async delete(key: string) {
        secrets.delete(key);
      }
    },
    globalState: {
      get<T>(key: string, defaultValue?: T) {
        return (globalState.has(key) ? globalState.get(key) : defaultValue) as T | undefined;
      },
      async update(key: string, value: unknown) {
        if (value === undefined) {
          globalState.delete(key);
        } else {
          globalState.set(key, value);
        }
      }
    },
    workspaceState: {
      get<T>(key: string, defaultValue?: T) {
        return (workspaceState.has(key) ? workspaceState.get(key) : defaultValue) as T | undefined;
      },
      async update(key: string, value: unknown) {
        if (value === undefined) {
          workspaceState.delete(key);
        } else {
          workspaceState.set(key, value);
        }
      }
    },
    subscriptions: []
  };
}

const vscodeMock = {
  Uri,
  Position,
  Range,
  Selection,
  TreeItem,
  ThemeIcon,
  EventEmitter,
  ConfigurationTarget,
  TreeItemCheckboxState: { Unchecked: 0, Checked: 1 },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ViewColumn: { Beside: -2 },
  ProgressLocation: { Notification: 15 },
  TextEditorRevealType: { InCenter: 2 },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
  window: {
    activeColorTheme: { kind: 1 },
    createOutputChannel: () => ({
      appendLine: () => undefined,
      dispose: () => undefined,
      show: () => undefined
    }),
    createTreeView: () => ({
      message: '',
      dispose: () => undefined,
      onDidChangeCheckboxState: () => ({ dispose: () => undefined })
    }),
    createWebviewPanel: () => ({
      webview: {
        html: '',
        cspSource: 'vscode-webview:',
        asWebviewUri: (uri: Uri) => uri,
        onDidReceiveMessage: () => ({ dispose: () => undefined }),
        postMessage: async () => true
      },
      reveal: () => undefined,
      dispose: () => undefined,
      onDidDispose: () => ({ dispose: () => undefined })
    }),
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showInputBox: async () => undefined,
    withProgress: async (
      _options: unknown,
      task: (progress: { report(value: unknown): void }, token: { isCancellationRequested: boolean }) => Promise<unknown>
    ) => task({ report: () => undefined }, { isCancellationRequested: false }),
    showTextDocument: async () => ({
      selection: undefined,
      revealRange: () => undefined
    }),
    onDidChangeActiveColorTheme: () => ({ dispose: () => undefined })
  },
  workspace: {
    workspaceFolders: undefined as Array<{ uri: Uri; name: string }> | undefined,
    getConfiguration,
    getWorkspaceFolder: () => undefined,
    findFiles: async () => [],
    fs: {
      readFile: async () => new Uint8Array()
    },
    openTextDocument: async () => ({
      getText: () => '',
      lineAt: () => ({ text: '' })
    }),
    updateWorkspaceFolders: () => false
  },
  commands: {
    registerCommand: () => ({ dispose: () => undefined }),
    executeCommand: async () => undefined,
    getCommands: async () => []
  },
  extensions: {
    getExtension: () => undefined
  },
  __resetVscodeMock,
  __seedSettingsApiKey,
  createMockExtensionContext
};

export = vscodeMock;
