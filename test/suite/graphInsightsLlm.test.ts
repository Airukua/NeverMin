import * as assert from 'assert';
import {
  applyGraphInsightsLlmPayload,
  parseGraphInsightsLlmResponse
} from '../../src/core/llm/promptBuilder';
import type { GraphInsights } from '../../src/core/graph/graphInsights';

function stubInsights(): GraphInsights {
  return {
    generatedAt: new Date().toISOString(),
    entryPoints: [
      {
        id: 'e1',
        name: 'MainConfig',
        kind: 'class',
        filePath: 'a.py',
        startLine: 1,
        endLine: 2,
        score: 1,
        reason: 'revPR 100%, betw 61%'
      }
    ],
    hubs: [
      {
        id: 'h1',
        name: 'TrainerState',
        kind: 'class',
        filePath: 'b.py',
        startLine: 1,
        endLine: 2,
        score: 1,
        reason: 'PR 83%'
      }
    ],
    mainFlow: {
      id: 'f1',
      label: 'heuristic label',
      nodeIds: [],
      steps: [],
      input: 'MainConfig',
      process: ['init'],
      output: 'load_yaml_file',
      stages: [],
      ioScore: 1,
      mermaid: ''
    },
    keyFlows: [],
    orphanFiles: [],
    stats: { nodeCount: 10, edgeCount: 20, nodesByKind: {}, edgesByKind: {} },
    summaryBullets: ['Graph has 10 nodes']
  };
}

describe('parseGraphInsightsLlmResponse', () => {
  it('parse JSON fence dan menimpa heuristik', () => {
    const raw = `\`\`\`json
{
  "purpose": "This application is for training.",
  "overview": "Structured around 10 components.",
  "flowSteps": ["Enter via MainConfig", "Leave via load_yaml_file"],
  "readingGuide": {
    "startHere": "Begin at MainConfig",
    "followModules": "Explore DataLoaderConfig",
    "trackExecution": "Watch TrainerState"
  },
  "entries": [{"name": "MainConfig", "reason": "Config entry for the training stack"}],
  "hubs": [{"name": "TrainerState", "reason": "Holds training loop state"}],
  "mainFlowLabel": "MainConfig → load_yaml_file"
}
\`\`\``;
    const payload = parseGraphInsightsLlmResponse(raw);
    assert.ok(payload);
    assert.ok(payload!.purpose?.includes('training'));
    assert.ok(payload!.narrative.includes('What this codebase is for'));

    const next = applyGraphInsightsLlmPayload(stubInsights(), payload!);
    assert.deepStrictEqual(next.summaryBullets, []);
    assert.strictEqual(next.panel?.purpose, 'This application is for training.');
    assert.strictEqual(next.entryPoints[0].reason, 'Config entry for the training stack');
    assert.strictEqual(next.hubs[0].reason, 'Holds training loop state');
    assert.strictEqual(next.mainFlow?.label, 'MainConfig → load_yaml_file');
    assert.ok(!next.entryPoints[0].reason.includes('revPR'));
  });

  it('fallback markdown-only membersihkan bullet + reason metrik', () => {
    const payload = parseGraphInsightsLlmResponse(
      '## Overview\n\nPlain narrative without JSON.'
    );
    assert.ok(payload);
    const next = applyGraphInsightsLlmPayload(stubInsights(), payload!);
    assert.deepStrictEqual(next.summaryBullets, []);
    assert.strictEqual(next.entryPoints[0].reason, '');
    assert.strictEqual(next.hubs[0].reason, '');
    assert.ok(next.narrative?.includes('Overview'));
  });
});
