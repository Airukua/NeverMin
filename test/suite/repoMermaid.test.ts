import * as assert from 'assert';
import { buildRepoMermaidBundle, inferNodeIcon } from '../../src/core/graph/repoMermaid';
import { CodeGraph } from '../../src/core/graph/types';
import { GraphInsights } from '../../src/core/graph/graphInsights';

function sampleGraph(): CodeGraph {
  return {
    nodes: [
      {
        id: '/app/kilat/configs/main_config.py',
        kind: 'file',
        name: 'main_config.py',
        filePath: '/app/kilat/configs/main_config.py',
        startLine: 1,
        endLine: 20
      },
      {
        id: '/app/kilat/training/trainer.py',
        kind: 'file',
        name: 'trainer.py',
        filePath: '/app/kilat/training/trainer.py',
        startLine: 1,
        endLine: 40
      },
      {
        id: '/app/kilat/training/callbacks.py',
        kind: 'file',
        name: 'callbacks.py',
        filePath: '/app/kilat/training/callbacks.py',
        startLine: 1,
        endLine: 30
      },
      {
        id: '/app/kilat/training/scheduler.py',
        kind: 'file',
        name: 'scheduler.py',
        filePath: '/app/kilat/training/scheduler.py',
        startLine: 1,
        endLine: 20
      },
      {
        id: '/app/kilat/configs/main_config.py#MainConfig:1',
        kind: 'class',
        name: 'MainConfig',
        filePath: '/app/kilat/configs/main_config.py',
        startLine: 1,
        endLine: 10
      }
    ],
    edges: [
      {
        from: '/app/kilat/configs/main_config.py',
        to: '/app/kilat/training/trainer.py',
        kind: 'imports'
      },
      {
        from: '/app/kilat/training/trainer.py',
        to: '/app/kilat/training/callbacks.py',
        kind: 'imports'
      },
      {
        from: '/app/kilat/training/trainer.py',
        to: '/app/kilat/training/scheduler.py',
        kind: 'imports'
      }
    ]
  };
}

function sampleInsights(): GraphInsights {
  return {
    generatedAt: new Date().toISOString(),
    entryPoints: [
      {
        id: '/app/kilat/configs/main_config.py#MainConfig:1',
        name: 'MainConfig',
        kind: 'class',
        filePath: '/app/kilat/configs/main_config.py',
        startLine: 1,
        endLine: 10,
        score: 10,
        reason: 'entry'
      }
    ],
    hubs: [
      {
        id: '/app/kilat/training/trainer.py',
        name: 'KilatTrainer',
        kind: 'class',
        filePath: '/app/kilat/training/trainer.py',
        startLine: 1,
        endLine: 20,
        score: 9,
        reason: 'hub'
      },
      {
        id: '/app/kilat/training/callbacks.py',
        name: 'TrainerState',
        kind: 'class',
        filePath: '/app/kilat/training/callbacks.py',
        startLine: 1,
        endLine: 15,
        score: 8,
        reason: 'hub'
      }
    ],
    mainFlow: {
      id: 'flow-1',
      label: 'MainConfig → Trainer',
      nodeIds: [],
      steps: ['MainConfig', 'KilatTrainer', 'TrainerState'],
      input: 'MainConfig',
      process: ['KilatTrainer'],
      output: 'TrainerState',
      stages: [
        {
          role: 'input',
          name: 'MainConfig',
          nodeId: '/app/kilat/configs/main_config.py#MainConfig:1',
          filePath: '/app/kilat/configs/main_config.py',
          startLine: 1,
          endLine: 10
        },
        {
          role: 'process',
          name: 'KilatTrainer',
          nodeId: '/app/kilat/training/trainer.py',
          filePath: '/app/kilat/training/trainer.py',
          startLine: 1,
          endLine: 20
        },
        {
          role: 'output',
          name: 'TrainerState',
          nodeId: '/app/kilat/training/callbacks.py',
          filePath: '/app/kilat/training/callbacks.py',
          startLine: 1,
          endLine: 15
        }
      ],
      ioScore: 1,
      mermaid: ''
    },
    keyFlows: [],
    orphanFiles: [],
    stats: {
      nodeCount: 5,
      edgeCount: 3,
      nodesByKind: {},
      edgesByKind: {}
    },
    summaryBullets: []
  };
}

describe('inferNodeIcon', () => {
  it('menebak ikon dari token nama variabel', () => {
    assert.strictEqual(inferNodeIcon('MapResponden'), 'map');
    assert.strictEqual(inferNodeIcon('Navbar'), 'nav');
    assert.strictEqual(inferNodeIcon('Sidebar'), 'sidebar');
    assert.strictEqual(inferNodeIcon('Dropdown'), 'menu');
    assert.strictEqual(inferNodeIcon('goToPrevMonth', { filePath: 'ui/form/date-picker.tsx' }), 'calendar');
    assert.strictEqual(inferNodeIcon('UserAvatar'), 'user');
    assert.strictEqual(inferNodeIcon('AnalyticsChart'), 'chart');
    assert.strictEqual(inferNodeIcon('AuthProvider'), 'auth');
    assert.strictEqual(inferNodeIcon('fetchUsers', { kind: 'function' }), 'api');
    assert.strictEqual(inferNodeIcon('WeirdThing', { kind: 'class' }), 'class');
  });
});

describe('buildRepoMermaidBundle', () => {
  it('membuat arsitektur berlapis Entry / Core / Pipeline / Support', () => {
    const bundle = buildRepoMermaidBundle(sampleGraph(), sampleInsights());
    assert.ok(bundle.architecture.includes('flowchart TB'));
    assert.ok(bundle.architecture.includes('Entry Points'));
    assert.ok(bundle.architecture.includes('Core Hubs'));
    assert.ok(bundle.architecture.includes('Main Pipeline'));
    assert.ok(bundle.architecture.includes('Supporting Modules'));
    assert.ok(bundle.architecture.includes('MainConfig'));
    assert.ok(bundle.architecture.includes('KilatTrainer'));
    assert.ok(Object.keys(bundle.nodeIndex).length >= 3);
  });

  it('membuat view modul antar folder', () => {
    const bundle = buildRepoMermaidBundle(sampleGraph());
    assert.ok(bundle.modules.includes('Module Map'));
    assert.ok(bundle.views.modules.nodes.length > 0);
  });

  it('memakai flow insights bila tersedia', () => {
    const bundle = buildRepoMermaidBundle(sampleGraph(), sampleInsights());
    assert.ok(bundle.flow.includes('flowchart LR'));
    assert.ok(bundle.flow.includes('MainConfig'));
    assert.ok(bundle.views.flow.nodes.length > 0);
    assert.ok(bundle.views.architecture.nodes.length > 0);
  });

  it('menyisipkan penjelasan singkat LLM ke dalam kotak node', () => {
    const insights = sampleInsights();
    insights.nodeSummaries = {
      '/app/kilat/configs/main_config.py#MainConfig:1':
        'Berfungsi sebagai entry point konfigurasi sistem.',
      MainConfig: 'Berfungsi sebagai entry point konfigurasi sistem.',
      KilatTrainer: 'Berfungsi sebagai orkestrator alur training.'
    };
    insights.nodeIcons = {
      MainConfig: 'config',
      KilatTrainer: 'api'
    };
    const bundle = buildRepoMermaidBundle(sampleGraph(), insights);
    assert.ok(bundle.architecture.includes('nm-card'));
    assert.ok(bundle.architecture.includes('nm-card-row'));
    assert.ok(bundle.architecture.includes('data-icon='));
    assert.ok(bundle.architecture.includes('nm-ico-wrap'));
    assert.ok(bundle.architecture.includes('entry point konfigurasi'));
    assert.ok(bundle.architecture.includes('orkestrator alur training'));
  });

  it('tanpa LLM summary: kartu tetap layout lengkap (bukan chip Ent)', () => {
    const bundle = buildRepoMermaidBundle(sampleGraph(), sampleInsights());
    assert.ok(bundle.architecture.includes('nm-card'));
    assert.ok(bundle.architecture.includes('nm-card-head'));
    assert.ok(bundle.architecture.includes('data-icon='));
    assert.ok(bundle.architecture.includes('nm-card-body-pending'));
    assert.ok(
      /Titik masuk|Komponen |Architecture entry|Component /.test(bundle.architecture)
    );
    assert.ok(!bundle.architecture.includes('nm-card-chip'));
    assert.ok(!bundle.architecture.includes('Simpul kode dalam graph'));
  });

  it('membangun graph fungsi per file bila functionFilePath diberi (Mermaid copy)', () => {
    const bundle = buildRepoMermaidBundle(sampleGraph(), sampleInsights(), {
      functionFilePath: '/app/kilat/configs/main_config.py',
      focusNodeId: '/app/kilat/configs/main_config.py#MainConfig:1'
    });
    assert.ok(bundle.functions.includes('flowchart TB'));
    assert.ok(bundle.functions.includes('MainConfig'));
  });

  it('tab Functions: overview semua file tertutup + detail di functionGroups', () => {
    const bundle = buildRepoMermaidBundle(sampleGraph(), sampleInsights());
    assert.ok(bundle.views.functions.nodes.length >= 1);
    assert.ok(bundle.views.functions.nodes.every((n) => n.expandKey && n.kind === 'file-group'));
    const keys = Object.keys(bundle.functionGroups);
    assert.ok(keys.length >= 1);
    const first = bundle.views.functions.nodes[0];
    assert.ok(first.expandKey);
    assert.ok(bundle.functionGroups[first.expandKey!].nodes.length >= 1);
  });
});
