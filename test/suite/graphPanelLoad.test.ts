import * as assert from 'assert';
import fs from 'fs';
import path from 'path';

describe('graphPanel Mermaid migration', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../../src/ui/webview/graphPanel.ts'),
    'utf8'
  );

  it('panel memakai Mermaid, bukan Cytoscape', () => {
    assert.ok(source.includes('mermaid/dist/mermaid.min.js'));
    assert.ok(!source.includes('cytoscape/dist/cytoscape.min.js'));
    assert.ok(source.includes('buildRepoMermaidBundle'));
    assert.ok(source.includes('data-view="modules"'));
    assert.ok(source.includes('zoomIn'));
    assert.ok(source.includes('neverminOpen'));
    assert.ok(source.includes('fitDiagram'));
    assert.ok(!source.includes('class="title">NeverMIN'));
    assert.ok(!source.includes('>Arsitektur</button>'));
  });

  it('webview mengirim ready handshake setelah shell siap (sebelum Mermaid)', () => {
    assert.ok(source.includes("vscode.postMessage({ type: 'ready', generation: bootGeneration })"));
    assert.ok(source.includes("msg.type === 'ready'"));
    assert.ok(source.includes('toWebviewInsights'));
    assert.ok(source.includes('renderStatus'));
    assert.ok(source.includes('loadMermaidLibrary'));
    assert.ok(source.includes('mermaidUri'));
    assert.ok(source.includes('setGraph-queued') || source.includes('setGraph-sent'));
    assert.ok(source.includes('ready-accepted'));
    assert.ok(source.includes('webviewLife'));
    assert.ok(source.includes('life(\'shell-ready\')') || source.includes('life("shell-ready")') || source.includes("life('shell-ready')"));
    // Mermaid tidak blocking di <head>
    assert.ok(!/<script[^>]+src="\$\{mermaidUri\}"/.test(source));
  });

  it('regex webview memakai escape ganda di template literal host', () => {
    // Tanpa \\n / \\s ganda, host men-eval template jadi newline di dalam /regex/ → script webview gagal parse.
    assert.ok(source.includes('(?=\\\\n##\\\\s|$)'));
    assert.ok(source.includes('split(/\\\\n##\\\\s+/)'));
    assert.ok(source.includes(".join('\\\\n## ')"));
    assert.ok(source.includes('.replace(/^\\\\s+/, \'\')') || source.includes(".replace(/^\\\\s+/, '')"));
    assert.ok(!source.includes('(?=\\n##\\s|$)'));
  });
});
