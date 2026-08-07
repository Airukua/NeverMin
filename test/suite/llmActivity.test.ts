import * as assert from 'assert';
import {
  summarizeExplainResult,
  summarizeNarrativeResult,
  summarizeNodeSummariesResult
} from '../../src/utils/llmActivity';

describe('llmActivity summaries', () => {
  it('meringkas narasi dengan cuplikan tujuan', () => {
    const text = [
      '## Kodingan ini untuk apa',
      'Aplikasi ini adalah aplikasi untuk onboarding developer.',
      '',
      '## Alur utama',
      'Input ke output.'
    ].join('\n');
    const summary = summarizeNarrativeResult(text);
    assert.ok(summary.includes('karakter'));
    assert.ok(summary.toLowerCase().includes('onboarding'));
  });

  it('meringkas node summaries', () => {
    const summary = summarizeNodeSummariesResult(
      {
        a: 'Entry app bootstrap',
        b: 'Hub graph builder'
      },
      5
    );
    assert.ok(summary.startsWith('2/5'));
    assert.ok(summary.includes('Entry'));
  });

  it('menandai hasil explain kosong', () => {
    assert.strictEqual(summarizeExplainResult('   '), 'hasil kosong');
  });
});
