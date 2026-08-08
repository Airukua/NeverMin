import * as assert from 'assert';
import {
  accumulateCompletionUsage,
  addTokenUsage,
  formatTokenUsageForLog,
  normalizeAnthropicTokenUsage,
  normalizeGeminiTokenUsage,
  normalizeOpenAiTokenUsage
} from '../../src/core/llm/tokenUsage';

describe('tokenUsage helpers', () => {
  it('menormalisasi usage OpenAI-compatible', () => {
    assert.deepStrictEqual(
      normalizeOpenAiTokenUsage({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }),
      { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
    );
  });

  it('menjumlahkan total OpenAI jika total_tokens hilang', () => {
    assert.deepStrictEqual(
      normalizeOpenAiTokenUsage({ prompt_tokens: 3, completion_tokens: 2 }),
      { promptTokens: 3, completionTokens: 2, totalTokens: 5 }
    );
  });

  it('menormalisasi usage Anthropic', () => {
    assert.deepStrictEqual(normalizeAnthropicTokenUsage({ input_tokens: 8, output_tokens: 4 }), {
      promptTokens: 8,
      completionTokens: 4,
      totalTokens: 12
    });
  });

  it('menormalisasi usage Gemini', () => {
    assert.deepStrictEqual(
      normalizeGeminiTokenUsage({
        promptTokenCount: 20,
        candidatesTokenCount: 7,
        totalTokenCount: 27
      }),
      { promptTokens: 20, completionTokens: 7, totalTokens: 27 }
    );
  });

  it('mengabaikan payload usage kosong', () => {
    assert.strictEqual(normalizeOpenAiTokenUsage({}), undefined);
    assert.strictEqual(normalizeAnthropicTokenUsage(null), undefined);
    assert.strictEqual(normalizeGeminiTokenUsage(undefined), undefined);
  });

  it('menjumlahkan usage antar call', () => {
    assert.deepStrictEqual(
      addTokenUsage(
        { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
        { promptTokens: 5, completionTokens: 3, totalTokens: 8 }
      ),
      { promptTokens: 15, completionTokens: 5, totalTokens: 20 }
    );
  });

  it('tidak menghitung ulang usage dari cache hit', () => {
    const first = accumulateCompletionUsage(undefined, {
      text: 'a',
      usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 }
    });
    const second = accumulateCompletionUsage(first, {
      text: 'a',
      usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 },
      fromCache: true
    });
    assert.deepStrictEqual(second, {
      promptTokens: 10,
      completionTokens: 1,
      totalTokens: 11
    });
  });

  it('memformat usage untuk log', () => {
    assert.strictEqual(
      formatTokenUsageForLog({ promptTokens: 10, completionTokens: 5, totalTokens: 15 }),
      '10+5=15 tok'
    );
    assert.strictEqual(formatTokenUsageForLog(undefined), '');
  });
});
