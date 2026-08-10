import * as assert from 'assert';
import { detectContributionGaps } from '../../src/core/graph/contributionGaps';
import type { GraphInsights } from '../../src/core/graph/graphInsights';
import type { CodeGraph } from '../../src/core/graph/types';

function baseInsights(): GraphInsights {
  return {
    generatedAt: new Date().toISOString(),
    entryPoints: [],
    hubs: [
      {
        id: 'h1',
        name: 'AuthService',
        kind: 'class',
        filePath: 'src/auth/AuthService.ts',
        startLine: 1,
        endLine: 40,
        score: 1,
        reason: 'hub'
      }
    ],
    mainFlow: null,
    keyFlows: [],
    orphanFiles: [],
    stats: { nodeCount: 2, edgeCount: 1, nodesByKind: {}, edgesByKind: {} },
    summaryBullets: [],
    nodeSensitivity: {}
  };
}

describe('extra contribution gap detectors', () => {
  it('silent-fallback dari .get default unknown', () => {
    const gaps = detectContributionGaps({
      insights: baseInsights(),
      fileContents: [
        {
          path: 'src/auth/AuthService.ts',
          content: 'const role = data.get("role", "unknown")\nreturn role\n'
        }
      ],
      lang: 'en'
    });
    assert.ok(gaps.some((g) => g.type === 'silent-fallback'));
  });

  it('circular-dependency dari graph imports A↔B', () => {
    const graph: CodeGraph = {
      nodes: [
        {
          id: 'a',
          name: 'models',
          kind: 'file',
          filePath: 'src/core/models.py',
          startLine: 1,
          endLine: 10
        },
        {
          id: 'b',
          name: 'executor',
          kind: 'file',
          filePath: 'src/worker/executor.py',
          startLine: 1,
          endLine: 10
        }
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'imports' },
        { from: 'b', to: 'a', kind: 'imports' }
      ]
    };
    const gaps = detectContributionGaps({
      insights: baseInsights(),
      graph,
      lang: 'en'
    });
    assert.ok(gaps.some((g) => g.type === 'circular-dependency'));
  });

  it('dependency-risk untuk package.json unpinned', () => {
    const gaps = detectContributionGaps({
      insights: baseInsights(),
      fileContents: [
        {
          path: 'package.json',
          content: JSON.stringify({
            dependencies: { lodash: 'latest', react: '^18.0.0' }
          })
        }
      ],
      lang: 'en'
    });
    assert.ok(gaps.some((g) => g.type === 'dependency-risk' && g.name === 'lodash'));
  });

  it('ownership-gap saat CODEOWNERS hilang tapi hub ada', () => {
    const gaps = detectContributionGaps({
      insights: baseInsights(),
      fileContents: [
        {
          path: 'src/auth/AuthService.ts',
          content: 'export class AuthService {}'
        }
      ],
      lang: 'en'
    });
    assert.ok(gaps.some((g) => g.type === 'ownership-gap'));
  });

  it('setiap gap baru punya evidence konkret', () => {
    const gaps = detectContributionGaps({
      insights: baseInsights(),
      graph: {
        nodes: [
          {
            id: 'a',
            name: 'a',
            kind: 'file',
            filePath: 'src/a.ts',
            startLine: 1,
            endLine: 5
          },
          {
            id: 'b',
            name: 'b',
            kind: 'file',
            filePath: 'src/b.ts',
            startLine: 1,
            endLine: 5
          }
        ],
        edges: [
          { from: 'a', to: 'b', kind: 'imports' },
          { from: 'b', to: 'a', kind: 'imports' }
        ]
      },
      fileContents: [
        {
          path: 'src/auth/AuthService.ts',
          content:
            'const x = data.get("k", "unknown")\nFEATURE_OLD = true\nasync function on_message() { await write() }\n'
        },
        {
          path: 'package.json',
          content: '{"dependencies":{"leftpad":"*"}}'
        },
        {
          path: 'src/a.ts',
          content: 'export const TIMEOUT_MS = 86400\n'
        },
        {
          path: 'src/b.ts',
          content: 'export const WAIT = 86400\n'
        },
        {
          path: 'src/c.ts',
          content: 'export const DELAY = 86400\n'
        }
      ],
      lang: 'en'
    });
    assert.ok(gaps.length >= 1);
    for (const g of gaps) {
      assert.ok(g.evidence.length >= 1, g.type);
      assert.ok(g.priorityScore > 0, g.type);
    }
  });
});
