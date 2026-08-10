import * as assert from 'assert';
import {
  isThinkingModelName,
  resolveOllamaThinkOption
} from '../../src/core/llm/thinkingModel';

describe('thinkingModel', () => {
  it('detects known thinking models', () => {
    assert.strictEqual(isThinkingModelName('qwen3:8b'), true);
    assert.strictEqual(isThinkingModelName('deepseek-r1:14b'), true);
    assert.strictEqual(isThinkingModelName('qwq:32b'), true);
    assert.strictEqual(isThinkingModelName('llama3.2:latest'), false);
    assert.strictEqual(isThinkingModelName('deepseek-coder-v2'), false);
    assert.strictEqual(isThinkingModelName(''), false);
  });

  it('only sets think for ollama thinking models', () => {
    assert.strictEqual(resolveOllamaThinkOption('ollama', 'qwen3:8b', 'prefer-on'), true);
    assert.strictEqual(resolveOllamaThinkOption('ollama', 'qwen3:8b', 'prefer-off'), false);
    assert.strictEqual(
      resolveOllamaThinkOption('ollama', 'llama3.2', 'prefer-on'),
      undefined
    );
    assert.strictEqual(
      resolveOllamaThinkOption('ollama', 'llama3.2', 'prefer-off'),
      undefined
    );
    assert.strictEqual(resolveOllamaThinkOption('openai', 'qwen3:8b', 'prefer-on'), undefined);
  });
});
