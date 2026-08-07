/**
 * Smoke: pastikan HTML graph panel menghasilkan <script> yang bisa di-parse.
 * Mereproduksi bug: \\n di template literal host jadi newline di dalam /regex/.
 */
const assert = require('assert');
const Module = require('module');
const path = require('path');

const vscodeMock = {
  window: {
    activeColorTheme: { kind: 2 },
    ColorThemeKind: { Dark: 2, Light: 1, HighContrast: 3, HighContrastLight: 4 },
    createWebviewPanel: () => {
      throw new Error('not used');
    },
    onDidChangeActiveColorTheme: () => ({ dispose() {} }),
    showInformationMessage: () => {},
    showWarningMessage: () => {},
    showErrorMessage: () => {}
  },
  Uri: {
    file: (p) => ({ fsPath: p, scheme: 'file', path: p, toString: () => `file://${p}` }),
    joinPath: (base, ...parts) => ({
      fsPath: path.join(base.fsPath || String(base), ...parts),
      scheme: 'file'
    }),
    parse: (v) => ({ fsPath: v, scheme: 'file' })
  },
  ViewColumn: { Beside: 2 },
  workspace: {
    openTextDocument: async () => ({}),
  },
  env: { clipboard: { writeText: async () => {} } }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') {
    return vscodeMock;
  }
  return originalLoad(request, parent, isMain);
};

const { createGraphPanel } = require('../dist/ui/webview/graphPanel');

// createGraphPanel needs more mocking — instead call render via update path.
// Patch: read compiled source and eval the escape simulation + require internal by re-export.

function extractScript(html) {
  const start = html.indexOf('<script');
  const close = html.indexOf('>', start);
  const end = html.lastIndexOf('</script>');
  assert.ok(start >= 0 && end > close, 'script tag missing');
  return html.slice(close + 1, end);
}

// Build HTML the same way renderHtml does by invoking createGraphPanel with heavy mocks
let assignedHtml = '';
const fakeWebview = {
  cspSource: 'https://csp.example',
  html: '',
  asWebviewUri: (uri) => ({ toString: () => `https://webview/mermaid.min.js` }),
  postMessage: async () => true,
  onDidReceiveMessage: () => ({ dispose() {} })
};
Object.defineProperty(fakeWebview, 'html', {
  get() {
    return assignedHtml;
  },
  set(v) {
    assignedHtml = v;
  }
});

const fakePanel = {
  webview: fakeWebview,
  iconPath: undefined,
  reveal: () => {},
  onDidDispose: () => ({ dispose() {} })
};

vscodeMock.window.createWebviewPanel = () => fakePanel;

createGraphPanel(
  { fsPath: '/tmp/ext', scheme: 'file' },
  { nodes: [], edges: [] },
  undefined,
  { state: 'loading', message: 'test' }
);

assert.ok(assignedHtml.length > 1000, 'html not assigned');
const script = extractScript(assignedHtml);

// Must not contain a regex literal broken across lines
assert.ok(
  !/\/(?:\\.|[^\/\n])*[\r\n](?:\\.|[^\/\n])*\//.test(script),
  'script still contains multi-line regex literal'
);

// Parse check (syntax only)
try {
  // acquireVsCodeApi is free identifier — wrap so parse doesn't need it defined
  new Function('acquireVsCodeApi', 'window', 'document', script);
} catch (err) {
  console.error('SCRIPT PARSE FAILED:', err.message);
  const lines = script.split('\n');
  const m = String(err.message).match(/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    console.error(lines.slice(Math.max(0, n - 3), n + 3).join('\n'));
  }
  process.exit(1);
}

console.log('OK: webview script parses ·', script.length, 'chars');
