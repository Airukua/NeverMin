import * as assert from 'assert';
import { HttpStatusError } from '../../src/core/llm/retryWithBackoff';
import { classifyLlmError, pickPrimaryLlmIssue } from '../../src/utils/llmUserNotice';

describe('llm user notice', () => {
  it('mengklasifikasi 429/quota sebagai quota', () => {
    assert.strictEqual(classifyLlmError(new HttpStatusError('rate limit', 429, 'quota exceeded')), 'quota');
    assert.strictEqual(
      classifyLlmError(new HttpStatusError('paywall', 402, 'insufficient_quota')),
      'quota'
    );
    assert.strictEqual(classifyLlmError(new Error('RESOURCE_EXHAUSTED: quota')), 'quota');
  });

  it('mengklasifikasi 401/403 sebagai auth', () => {
    assert.strictEqual(classifyLlmError(new HttpStatusError('nope', 401)), 'auth');
    assert.strictEqual(classifyLlmError(new Error('invalid_api_key')), 'auth');
  });

  it('pickPrimaryLlmIssue mengutamakan quota', () => {
    const primary = pickPrimaryLlmIssue([
      { kind: 'empty', providerLabel: 'Gemini' },
      { kind: 'quota', providerLabel: 'Gemini', detail: '429' },
      { kind: 'partial', providerLabel: 'Gemini' }
    ]);
    assert.strictEqual(primary?.kind, 'quota');
  });
});
