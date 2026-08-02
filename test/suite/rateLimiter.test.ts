import * as assert from 'assert';
import { RateLimiter } from '../../src/core/llm/rateLimiter';
import {
  HttpStatusError,
  retryWithBackoff
} from '../../src/core/llm/retryWithBackoff';
import {
  clearPromptCache,
  getCachedPromptResponse,
  setCachedPromptResponse
} from '../../src/core/llm/promptCache';

describe('LLM utilities', () => {
  beforeEach(() => {
    clearPromptCache();
  });

  it('request ke-11 dalam 1 menit harus menunggu', async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter({
      requestsPerMinute: 10,
      clock: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      }
    });

    for (let index = 0; index < 10; index += 1) {
      await limiter.acquire();
    }

    await limiter.acquire();

    assert.strictEqual(waits.length, 1);
    assert.strictEqual(waits[0], 60_000);
    assert.strictEqual(now, 60_000);
  });

  it('retryWithBackoff berhasil di percobaan ke-2 setelah gagal 1x', async () => {
    let attempts = 0;
    const waits: number[] = [];

    const result = await retryWithBackoff(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new HttpStatusError('Gemini API error: 429', 429);
        }
        return 'ok';
      },
      {
        maxRetries: 3,
        baseDelayMs: 0,
        sleep: async (ms) => {
          waits.push(ms);
        },
        random: () => 0
      }
    );

    assert.strictEqual(result, 'ok');
    assert.strictEqual(attempts, 2);
    assert.deepStrictEqual(waits, [0]);
  });

  it('retryWithBackoff langsung throw kalau error tidak retryable', async () => {
    let attempts = 0;

    await assert.rejects(
      () =>
        retryWithBackoff(
          async () => {
            attempts += 1;
            throw new HttpStatusError('Unauthorized', 401);
          },
          {
            sleep: async () => undefined,
            random: () => 0
          }
        ),
      /Unauthorized/
    );

    assert.strictEqual(attempts, 1);
  });

  it('promptCache return cached value untuk prompt identik dan miss untuk prompt beda', () => {
    setCachedPromptResponse('prompt-a', 'response-a', { clock: () => 1000 });

    assert.strictEqual(getCachedPromptResponse('prompt-a', { clock: () => 1000 }), 'response-a');
    assert.strictEqual(getCachedPromptResponse('prompt-b', { clock: () => 1000 }), undefined);
  });
});
