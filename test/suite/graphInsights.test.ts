import * as assert from 'assert';
import { buildRepoGraph } from '../../src/core/graph/graphBuilder';
import { buildGraphInsights } from '../../src/core/graph/graphInsights';

describe('buildGraphInsights', () => {
  it('menyusun entry points, hubs, dan key flows dari graph React/utils', async () => {
    const graph = await buildRepoGraph([
      {
        path: 'src/utils/format.ts',
        content: [
          'export const formatLabel = (value: string) => {',
          '  return value.trim();',
          '};'
        ].join('\n')
      },
      {
        path: 'src/components/SidebarContext.tsx',
        content: [
          'export const SidebarContext = () => {',
          '  return { open: true };',
          '};'
        ].join('\n')
      },
      {
        path: 'src/components/Sidebar.tsx',
        content: [
          "import { formatLabel } from '@/utils/format';",
          "import SidebarContext from './SidebarContext';",
          '',
          'export const Sidebar = () => {',
          '  const label = formatLabel("menu");',
          '  return <SidebarContext />;',
          '};'
        ].join('\n')
      }
    ]);

    const insights = buildGraphInsights(graph);

    assert.ok(insights.stats.nodeCount > 0);
    assert.ok(insights.stats.edgeCount > 0);
    assert.ok(insights.summaryBullets.length > 0);
    assert.ok(
      insights.entryPoints.some((item) => item.name === 'Sidebar') ||
        insights.hubs.some((item) => item.name === 'formatLabel' || item.name === 'SidebarContext'),
      'harus mendeteksi Sidebar sebagai entry atau formatLabel/SidebarContext sebagai hub'
    );
    assert.ok(
      insights.keyFlows.length > 0 || insights.entryPoints.length > 0 || insights.hubs.length > 0,
      'insights tidak boleh kosong untuk graph yang saling terhubung'
    );
  });

  it('menandai flow utama sebagai Input → Proses → Output', async () => {
    const graph = await buildRepoGraph([
      {
        path: 'src/components/ui/forms/date-picker.tsx',
        content: [
          'export const DatePicker = () => {',
          '  return null;',
          '};'
        ].join('\n')
      },
      {
        path: 'src/utils/formatDate.ts',
        content: [
          'export const formatDate = (value: string) => {',
          '  return value;',
          '};'
        ].join('\n')
      },
      {
        path: 'src/components/ui/data-display/responden-table.tsx',
        content: [
          "import { DatePicker } from '@/components/ui/forms/date-picker';",
          "import { formatDate } from '@/utils/formatDate';",
          '',
          'export const RespondenTable = () => {',
          '  const label = formatDate("2026-01-01");',
          '  return <DatePicker />;',
          '};'
        ].join('\n')
      }
    ]);

    const insights = buildGraphInsights(graph);
    assert.ok(insights.mainFlow, 'mainFlow harus terisi');
    assert.ok(insights.mainFlow?.input, 'input harus ada');
    assert.ok(insights.mainFlow?.output, 'output harus ada');
    assert.ok(
      insights.mainFlow?.stages.every((stage) => stage.startLine >= 1 && stage.endLine >= stage.startLine),
      'stage flow harus punya line range valid'
    );
    assert.ok(
      /DatePicker|RespondenTable|formatDate/.test(insights.mainFlow?.input ?? ''),
      `input tidak terduga: ${insights.mainFlow?.input}`
    );
    assert.ok(
      /DatePicker|RespondenTable|formatDate/.test(insights.mainFlow?.output ?? ''),
      `output tidak terduga: ${insights.mainFlow?.output}`
    );
    assert.ok(
      insights.summaryBullets.some((bullet) => /Flow utama data|Input|Output/i.test(bullet)),
      'summary harus menyebut flow data'
    );
  });
});
