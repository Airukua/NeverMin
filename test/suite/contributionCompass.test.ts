import * as assert from 'assert';
import {
  applyContributionCompassLlmPayload,
  buildContributionCompass
} from '../../src/core/graph/contributionCompass';
import { detectContributionGaps, extractDocClaims } from '../../src/core/graph/contributionGaps';
import type { GraphInsights } from '../../src/core/graph/graphInsights';
import type { CodeGraph } from '../../src/core/graph/types';

function sampleInsights(): GraphInsights {
  return {
    generatedAt: new Date().toISOString(),
    entryPoints: [
      {
        id: 'e1',
        name: 'main',
        kind: 'function',
        filePath: 'src/main.ts',
        startLine: 1,
        endLine: 20,
        score: 1,
        reason: 'entry'
      }
    ],
    hubs: [
      {
        id: 'h1',
        name: 'AuthService',
        kind: 'class',
        filePath: 'src/auth/AuthService.ts',
        startLine: 1,
        endLine: 80,
        score: 1,
        reason: 'hub'
      }
    ],
    mainFlow: null,
    keyFlows: [],
    orphanFiles: [
      {
        id: 'o1',
        name: 'helpers.test.ts',
        kind: 'file',
        filePath: 'src/utils/helpers.test.ts',
        startLine: 1,
        endLine: 40,
        score: 0,
        reason: 'orphan'
      }
    ],
    stats: {
      nodeCount: 3,
      edgeCount: 0,
      nodesByKind: {},
      edgesByKind: {}
    },
    summaryBullets: [],
    nodeSensitivity: {
      h1: {
        level: 'critical',
        score: 10,
        signals: ['hub', 'auth'],
        reason: 'hub · auth'
      },
      AuthService: {
        level: 'critical',
        score: 10,
        signals: ['hub', 'auth'],
        reason: 'hub · auth'
      }
    }
  };
}

describe('contributionGaps', () => {
  it('extractDocClaims mengambil heading dan bullet fitur', () => {
    const claims = extractDocClaims(
      '# My App\n\n## Rate limiting\n\n- Support OAuth login\n- Enable webhook delivery\n'
    );
    assert.ok(claims.some((c) => /rate/i.test(c)));
    assert.ok(claims.some((c) => /oauth/i.test(c)));
  });

  it('mendeteksi orphan-promise, silent catch, dan test-gap hub', () => {
    const gaps = detectContributionGaps({
      insights: sampleInsights(),
      docsText: '## Payment webhooks\n\n- Support realtime dashboard\n',
      fileContents: [
        {
          path: 'src/auth/AuthService.ts',
          content: 'export class AuthService {\n  login() {\n    try {\n      doLogin();\n    } catch {\n    }\n  }\n}\n'
        },
        {
          path: 'src/utils/helpers.test.ts',
          content: "it('noop', () => { expect(true).toBe(true); });\n"
        }
      ],
      lang: 'en'
    });
    assert.ok(gaps.some((g) => g.type === 'orphan-promise'));
    assert.ok(gaps.some((g) => g.type === 'bug-pattern'));
    assert.ok(
      gaps.some(
        (g) =>
          g.type === 'test-gap' &&
          (g.name === 'AuthService' || (g.filePath || '').includes('AuthService'))
      )
    );
    assert.ok(gaps.every((g) => g.priorityScore > 0));
  });
});

describe('contributionCompass', () => {
  it('membangun model gaps dengan risk badge sekunder', () => {
    const model = buildContributionCompass({
      insights: sampleInsights(),
      docsText: '## Payment webhooks\n',
      fileContents: [
        {
          path: 'src/auth/AuthService.ts',
          content: 'try { x(); } catch {}'
        }
      ],
      lang: 'id',
      llmStatus: 'idle'
    });
    assert.ok(model.gaps.length >= 1);
    assert.strictEqual(model.summary.gaps, model.gaps.length);
    assert.strictEqual(model.hasGit, false);
    assert.ok(model.readFirst.length >= 1);
    assert.ok(model.firstSteps.length >= 1);
    assert.strictEqual(model.safeToTouch.length, 0);
    assert.ok(
      model.gaps.some((g) => g.riskBadge === 'critical-zone' || g.riskBadge === 'needs-review')
    );
  });

  it('tanpa insights menghasilkan model kosong yang valid', () => {
    const model = buildContributionCompass(null, null, 'en', 'skipped');
    assert.strictEqual(model.summary.gaps, 0);
    assert.strictEqual(model.llmStatus, 'skipped');
  });

  it('apply LLM menjelaskan gap dan bisa dismiss false positive', () => {
    const base = buildContributionCompass({
      insights: sampleInsights(),
      docsText: '## Payment webhooks\n',
      fileContents: [
        { path: 'src/auth/AuthService.ts', content: 'try { x(); } catch {}' }
      ],
      lang: 'en',
      llmStatus: 'pending'
    });
    assert.ok(base.gaps.length >= 1);
    const keepId = base.gaps[0].id;
    const dropId = base.gaps[1]?.id;
    const merged = applyContributionCompassLlmPayload(
      base,
      {
        advice: 'Close the silent-catch gap first, then add hub tests.',
        gaps: [
          {
            id: keepId,
            keep: true,
            explanation: 'Real gap — empty catch hides auth failures.',
            opportunity: 'Log and rethrow or return a typed error.'
          },
          ...(dropId
            ? [{ id: dropId, keep: false, explanation: 'Intentional — documented stub.' }]
            : [])
        ],
        firstSteps: [
          {
            title: 'Fix silent catch',
            detail: 'Add error handling.',
            target: keepId
          }
        ]
      },
      'en'
    );
    assert.strictEqual(merged.llmStatus, 'ready');
    assert.ok(merged.agentAdvice?.includes('silent-catch') || merged.agentAdvice?.includes('hub'));
    const kept = merged.gaps.find((g) => g.id === keepId);
    assert.ok(kept?.llmExplanation?.includes('empty catch'));
    assert.ok(kept?.opportunity?.includes('typed error'));
    if (dropId) {
      assert.ok(!merged.gaps.some((g) => g.id === dropId));
    }
    assert.ok(merged.firstSteps[0]?.title.includes('silent'));
  });

  it('YAGNI-lite: single extends implementor', () => {
    const graph: CodeGraph = {
      nodes: [
        {
          id: 'iface',
          name: 'IPaymentGateway',
          kind: 'class',
          filePath: 'src/pay/IPaymentGateway.ts',
          startLine: 1,
          endLine: 10
        },
        {
          id: 'impl',
          name: 'StripeGateway',
          kind: 'class',
          filePath: 'src/pay/StripeGateway.ts',
          startLine: 1,
          endLine: 40
        }
      ],
      edges: [{ from: 'impl', to: 'iface', kind: 'extends' }]
    };
    const gaps = detectContributionGaps({
      insights: sampleInsights(),
      graph,
      lang: 'en'
    });
    assert.ok(gaps.some((g) => g.type === 'yagni'));
  });
});
