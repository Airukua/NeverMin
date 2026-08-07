import * as assert from 'assert';
import { buildMainFlowMermaid } from '../../src/core/graph/flowMermaid';
import { GraphInsightFlow } from '../../src/core/graph/graphInsights';

describe('buildMainFlowMermaid', () => {
  it('membuat flowchart LR dari stages input/process/output', () => {
    const flow: GraphInsightFlow = {
      id: 'flow:1',
      label: 'Input: Client → Output: S3',
      nodeIds: ['a', 'b', 'c'],
      steps: ['Client', 'API', 'S3'],
      input: 'Client',
      process: ['API'],
      output: 'S3',
      stages: [
        { role: 'input', name: 'Client', nodeId: 'a', filePath: 'a.ts', startLine: 1, endLine: 2 },
        { role: 'process', name: 'API', nodeId: 'b', filePath: 'b.ts', startLine: 1, endLine: 2 },
        { role: 'output', name: 'S3', nodeId: 'c', filePath: 'c.ts', startLine: 1, endLine: 2 }
      ],
      ioScore: 10,
      mermaid: ''
    };

    const mermaid = buildMainFlowMermaid(flow);
    assert.ok(mermaid.startsWith('flowchart LR'));
    assert.ok(mermaid.includes('Client'));
    assert.ok(mermaid.includes('API'));
    assert.ok(mermaid.includes('S3'));
    assert.ok(mermaid.includes('-->'));
  });
});
