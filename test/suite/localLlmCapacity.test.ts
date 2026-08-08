import * as assert from 'assert';
import {
  planLocalLlmRun,
  probeLocalLlmCapacity
} from '../../src/utils/localLlmCapacity';

describe('localLlmCapacity', () => {
  it('probe mengembalikan tier dan concurrent plan', async () => {
    const capacity = await probeLocalLlmCapacity();
    assert.ok(['weak', 'moderate', 'strong'].includes(capacity.tier));
    assert.ok(capacity.cpuCores >= 1);
    assert.ok(capacity.maxConcurrentCalls === 1 || capacity.maxConcurrentCalls === 2);
    assert.ok(capacity.nodeSummaryBatchSize >= 1);
    assert.ok(capacity.reason.includes('tier='));
  });

  it('ollama biasanya sequential kecuali host kuat+GPU', async () => {
    const plan = await planLocalLlmRun('ollama');
    if (plan.capacity.maxConcurrentCalls < 2) {
      assert.strictEqual(plan.sequential, true);
    }
    assert.ok(plan.nodeSummaryBatchSize <= 12);
  });

  it('cloud tetap parallel', async () => {
    const plan = await planLocalLlmRun('openai');
    assert.strictEqual(plan.sequential, false);
    assert.ok(plan.nodeSummaryBatchSize >= 12);
  });
});
