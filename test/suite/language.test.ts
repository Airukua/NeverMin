import * as assert from 'assert';
import {
  buildExplainPrompt,
  buildGraphInsightsPrompt,
  buildNodeSummariesPrompt,
  narrativePurposeHeading
} from '../../src/core/llm/promptBuilder';
import { buildGraphInsights } from '../../src/core/graph/graphInsights';
import { CodeGraph } from '../../src/core/graph/types';
import { t } from '../../src/i18n';
import * as configApi from '../../src/utils/config';
import vscodeMock = require('../mocks/vscode');

const { getLanguage, setLanguage } = configApi;
const { __resetVscodeMock } = vscodeMock;

describe('language support', () => {
  beforeEach(() => {
    __resetVscodeMock();
  });

  it('getLanguage default id dan setLanguage en', async () => {
    assert.strictEqual(getLanguage(), 'id');
    await setLanguage('en');
    assert.strictEqual(getLanguage(), 'en');
  });

  it('t() mengembalikan string EN/ID', async () => {
    assert.strictEqual(t('webview.mindMap', undefined, 'id'), 'Mind Map');
    assert.strictEqual(t('webview.mindMap', undefined, 'en'), 'Mind Map');
    assert.strictEqual(t('webview.openSource', undefined, 'id'), 'Buka sumber');
    assert.strictEqual(t('webview.openSource', undefined, 'en'), 'Open source');
    assert.strictEqual(t('lang.changed', { name: 'English' }, 'en'), 'NeverMIN language: English');
  });

  it('prompt explain mengikuti bahasa', () => {
    const chunks = [
      {
        filePath: 'a.ts',
        startLine: 1,
        endLine: 2,
        content: 'const x = 1;'
      }
    ];
    const idPrompt = buildExplainPrompt('Jelaskan', chunks, 'id');
    const enPrompt = buildExplainPrompt('Explain', chunks, 'en');
    assert.ok(idPrompt.includes('Bahasa Indonesia'));
    assert.ok(enPrompt.includes('Answer in clear, concise English'));
    assert.ok(enPrompt.includes('lines 1-2'));
    assert.ok(idPrompt.includes('baris 1-2'));
  });

  it('prompt insights + node summaries bilingual', () => {
    const insights = buildGraphInsights(
      {
        nodes: [{ id: 'f', kind: 'file', name: 'a.ts', filePath: '/a.ts', startLine: 1, endLine: 1 }],
        edges: []
      } as CodeGraph,
      'en'
    );
    const prompt = buildGraphInsightsPrompt(insights, 'en');
    assert.ok(prompt.includes(narrativePurposeHeading('en')));
    assert.ok(prompt.includes('This application is for'));
    assert.ok(prompt.includes('Return ONE JSON object'));
    assert.ok(prompt.includes('flowSteps'));
    assert.ok(prompt.includes('readingGuide'));
    assert.ok(!prompt.includes('Bahasa Indonesia'));

    const nodePrompt = buildNodeSummariesPrompt(
      [{ id: '1', name: 'Foo', kind: 'function', filePath: 'a.ts', role: 'entry' }],
      'en'
    );
    assert.ok(nodePrompt.includes('Acts as'));
    assert.ok(nodePrompt.includes('English'));
  });

  it('buildGraphInsights bullets EN', () => {
    const insights = buildGraphInsights({ nodes: [], edges: [] }, 'en');
    assert.ok(insights.summaryBullets[0]?.includes('Graph has'));
  });
});
