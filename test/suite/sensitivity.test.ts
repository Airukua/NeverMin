import * as assert from 'assert';
import { scoreNodeSensitivity, buildNodeSensitivityMap } from '../../src/core/graph/sensitivity';
import type { GraphInsights } from '../../src/core/graph/graphInsights';
import type { CodeGraph } from '../../src/core/graph/types';

describe('sensitivity scoring', () => {
  it('menandai hub+auth sebagai critical/high', () => {
    const scored = scoreNodeSensitivity({
      name: 'AuthService',
      filePath: 'src/auth/AuthService.ts',
      role: 'hub',
      iconKey: 'auth',
      lang: 'id'
    });
    assert.ok(scored.score >= 5, `score=${scored.score}`);
    assert.ok(scored.level === 'critical' || scored.level === 'high');
    assert.ok(scored.signals.includes('hub'));
    assert.ok(scored.signals.includes('auth'));
  });

  it('menandai .env sebagai secrets critical', () => {
    const scored = scoreNodeSensitivity({
      name: '.env',
      filePath: 'apps/web/.env.production',
      role: 'support',
      lang: 'en'
    });
    assert.ok(scored.signals.includes('secrets'));
    assert.ok(scored.level === 'critical' || scored.level === 'high');
  });

  it('buildNodeSensitivityMap mengisi hub', () => {
    const graph: CodeGraph = {
      nodes: [
        {
          id: 'f1',
          kind: 'file',
          name: 'login.ts',
          filePath: 'src/auth/login.ts',
          startLine: 1,
          endLine: 10
        }
      ],
      edges: []
    };
    const insights: GraphInsights = {
      generatedAt: new Date().toISOString(),
      entryPoints: [],
      hubs: [
        {
          id: 'h1',
          name: 'SessionStore',
          kind: 'class',
          filePath: 'src/auth/session.ts',
          startLine: 1,
          endLine: 40,
          score: 1,
          reason: 'hub'
        }
      ],
      mainFlow: null,
      keyFlows: [],
      orphanFiles: [],
      stats: {
        nodeCount: 1,
        edgeCount: 0,
        nodesByKind: {},
        edgesByKind: {}
      },
      summaryBullets: []
    };
    const map = buildNodeSensitivityMap(graph, insights, null, 'id');
    const row = map.h1 || map.SessionStore;
    assert.ok(row);
    assert.ok(row!.signals.includes('hub'));
  });
});
