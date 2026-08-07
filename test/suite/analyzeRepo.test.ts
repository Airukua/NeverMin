import * as assert from 'assert';
import {
  gateAnalysisProgress,
  limitAnalysisFiles,
  MAX_ANALYSIS_FILES
} from '../../src/commands/analyzeRepo';

describe('analyzeRepo scale + cancel gate', () => {
  it('limitAnalysisFiles memotong ke MAX_ANALYSIS_FILES', () => {
    const files = Array.from({ length: MAX_ANALYSIS_FILES + 25 }, (_, index) => `f${index}.ts`);
    const { capped, truncated } = limitAnalysisFiles(files);

    assert.strictEqual(truncated, true);
    assert.strictEqual(capped.length, MAX_ANALYSIS_FILES);
    assert.strictEqual(capped[0], 'f0.ts');
    assert.strictEqual(capped[capped.length - 1], `f${MAX_ANALYSIS_FILES - 1}.ts`);
  });

  it('limitAnalysisFiles tidak memotong bila di bawah batas', () => {
    const files = ['a.ts', 'b.ts'];
    const { capped, truncated } = limitAnalysisFiles(files);
    assert.strictEqual(truncated, false);
    assert.deepStrictEqual(capped, files);
  });

  it('gateAnalysisProgress memprioritaskan cancel lalu empty', () => {
    assert.strictEqual(gateAnalysisProgress(true, 10), 'cancelled');
    assert.strictEqual(gateAnalysisProgress(false, 0), 'empty');
    assert.strictEqual(gateAnalysisProgress(false, 3), 'ready');
  });
});
