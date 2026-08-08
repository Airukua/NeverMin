import * as assert from 'assert';
import { extractOpenAiMessageParts } from '../../src/core/llm/providers/openAiCompatibleProvider';

describe('extractOpenAiMessageParts', () => {
  it('membaca field reasoning / thinking Ollama', () => {
    const parts = extractOpenAiMessageParts({
      content: '{"ok":true}',
      reasoning: 'Saya merencanakan jawaban JSON.'
    });
    assert.strictEqual(parts.text, '{"ok":true}');
    assert.strictEqual(parts.thinking, 'Saya merencanakan jawaban JSON.');
  });

  it('memisahkan tag <think> dari content', () => {
    const parts = extractOpenAiMessageParts({
      content: '<think>langkah 1</think>\nJawaban akhir.'
    });
    assert.strictEqual(parts.text, 'Jawaban akhir.');
    assert.strictEqual(parts.thinking, 'langkah 1');
  });

  it('mengutamakan field thinking dibanding tag', () => {
    const parts = extractOpenAiMessageParts({
      content: '<think>tag</think>\nfinal',
      thinking: 'dari field'
    });
    assert.strictEqual(parts.text, 'final');
    assert.strictEqual(parts.thinking, 'dari field');
  });
});
