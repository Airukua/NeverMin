import * as assert from 'assert';
import {
  semanticRetryPlanFor,
  semanticRetryPromptSuffix,
  semanticRetryTemperature,
  shouldAbortSemanticRetry
} from '../../src/core/llm/semanticRetry';

describe('semanticRetry', () => {
  it('ollama retry lebih agresif dari cloud', () => {
    assert.strictEqual(semanticRetryPlanFor('ollama').maxAttempts, 5);
    assert.ok(semanticRetryPlanFor('openai').maxAttempts < semanticRetryPlanFor('ollama').maxAttempts);
  });

  it('menaikkan temperature per attempt dengan cap', () => {
    assert.ok(semanticRetryTemperature(0.2, 1) > semanticRetryTemperature(0.2, 0));
    assert.strictEqual(semanticRetryTemperature(0.8, 5), 0.85);
  });

  it('suffix retry kosong di attempt pertama', () => {
    assert.strictEqual(semanticRetryPromptSuffix(0, 'id'), '');
    assert.ok(semanticRetryPromptSuffix(1, 'id').includes('retry'));
    assert.ok(semanticRetryPromptSuffix(1, 'en').toLowerCase().includes('retry'));
  });

  it('abort pada auth/quota/no_key', () => {
    assert.strictEqual(shouldAbortSemanticRetry('auth'), true);
    assert.strictEqual(shouldAbortSemanticRetry('quota'), true);
    assert.strictEqual(shouldAbortSemanticRetry('empty'), false);
    assert.strictEqual(shouldAbortSemanticRetry('failed'), false);
  });
});
