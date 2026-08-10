import * as assert from 'assert';
import { parseGapExplainResponse } from '../../src/core/llm/gapExplainPrompt';

describe('gapExplainPrompt', () => {
  it('parseGapExplainResponse membutuhkan 4 field + ≥2 opsi', () => {
    const detail = parseGapExplainResponse(`{
      "whyItMatters": "Shared model changes silently break the worker path.",
      "concreteExample": "a1b2c3d4 · Fix executor payload · touched models.py and executor.py",
      "contributionOptions": [
        {"title": "Document the contract", "detail": "Add a short ADR.", "effort": "low"},
        {"title": "Extract shared schema", "detail": "Move fields to a typed module.", "effort": "high"}
      ],
      "confidenceJustification": "together=5 is moderate; medium confidence fits."
    }`);
    assert.ok(detail);
    assert.strictEqual(detail!.contributionOptions[0].effort, 'low');
    assert.strictEqual(detail!.contributionOptions[1].effort, 'high');
    assert.ok(detail!.whyItMatters.includes('worker'));
  });

  it('reject jika opsi kurang dari 2', () => {
    const detail = parseGapExplainResponse(`{
      "whyItMatters": "x",
      "concreteExample": "y",
      "contributionOptions": [
        {"title": "Only one", "detail": "nope", "effort": "low"}
      ],
      "confidenceJustification": "z"
    }`);
    assert.strictEqual(detail, null);
  });
});
