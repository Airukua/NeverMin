import * as assert from 'assert';
import { resolveExplainScope } from '../../src/core/llm/explainNodeContext';

describe('resolveExplainScope', () => {
  it('Architecture + function node → scope function (bukan file utuh)', () => {
    assert.strictEqual(
      resolveExplainScope({
        view: 'architecture',
        kind: 'function',
        name: 'runDocumentPipelineTick',
        startLine: 212,
        endLine: 280
      }),
      'function'
    );
  });

  it('Architecture + file node → scope file', () => {
    assert.strictEqual(
      resolveExplainScope({
        view: 'architecture',
        kind: 'file',
        name: 'runner.ts'
      }),
      'file'
    );
  });

  it('Functions overview file card → scope file', () => {
    assert.strictEqual(
      resolveExplainScope({
        view: 'functions',
        kind: 'file',
        name: 'runner.ts'
      }),
      'file'
    );
  });
});
