import * as assert from 'assert';
import { buildRepoGraph, traceFrom } from '../../src/core/graph/graphBuilder';

describe('buildRepoGraph', () => {
  it('membangun edge defines, imports, calls, uses, dan extends', async () => {
    const graph = await buildRepoGraph([
      {
        path: 'src/math.ts',
        content: [
          'export function add(left: number, right: number) {',
          '  return left + right;',
          '}',
          '',
          'export class BaseService {',
          '  format(value: string) {',
          '    return value.trim();',
          '  }',
          '}'
        ].join('\n')
      },
      {
        path: 'src/service.ts',
        content: [
          "import { add, BaseService } from './math';",
          '',
          'export class DerivedService extends BaseService {',
          '  render() {',
          '    const alias = add;',
          '    const total = add(1, 2);',
          '    return this.format(String(total));',
          '  }',
          '',
          '  format(value: string) {',
          '    return value.toUpperCase();',
          '  }',
          '}'
        ].join('\n')
      }
    ]);

    const mathFile = graph.nodes.find((node) => node.kind === 'file' && node.filePath === 'src/math.ts');
    const serviceFile = graph.nodes.find((node) => node.kind === 'file' && node.filePath === 'src/service.ts');
    const addNode = graph.nodes.find((node) => node.name === 'add' && node.filePath === 'src/math.ts');
    const baseServiceNode = graph.nodes.find((node) => node.name === 'BaseService' && node.filePath === 'src/math.ts');
    const derivedNode = graph.nodes.find((node) => node.name === 'DerivedService' && node.filePath === 'src/service.ts');
    const renderNode = graph.nodes.find((node) => node.name === 'DerivedService.render');
    const formatNode = graph.nodes.find((node) => node.name === 'DerivedService.format');

    assert.ok(mathFile);
    assert.ok(serviceFile);
    assert.ok(addNode);
    assert.ok(baseServiceNode);
    assert.ok(derivedNode);
    assert.ok(renderNode);
    assert.ok(formatNode);

    assert.ok(graph.edges.some((edge) => edge.kind === 'defines' && edge.from === mathFile!.id && edge.to === addNode!.id));
    assert.ok(graph.edges.some((edge) => edge.kind === 'imports' && edge.from === serviceFile!.id && edge.to === addNode!.id));
    assert.ok(graph.edges.some((edge) => edge.kind === 'imports' && edge.from === serviceFile!.id && edge.to === baseServiceNode!.id));
    assert.ok(graph.edges.some((edge) => edge.kind === 'calls' && edge.from === renderNode!.id && edge.to === addNode!.id));
    assert.ok(graph.edges.some((edge) => edge.kind === 'uses' && edge.from === renderNode!.id && edge.to === addNode!.id));
    assert.ok(graph.edges.some((edge) => edge.kind === 'extends' && edge.from === derivedNode!.id && edge.to === baseServiceNode!.id));
    assert.ok(graph.edges.some((edge) => edge.kind === 'defines' && edge.from === derivedNode!.id && edge.to === renderNode!.id));
    assert.ok(graph.edges.some((edge) => edge.kind === 'defines' && edge.from === derivedNode!.id && edge.to === formatNode!.id));

    const paths = traceFrom(graph, renderNode!.id, 3);
    assert.ok(paths.some((path) => path.some((node) => node.id === addNode!.id)));
    assert.ok(paths.some((path) => path.some((node) => node.id === formatNode!.id)));
  });

  it('tetap aman saat graph punya siklus referensi', async () => {
    const graph = await buildRepoGraph([
      {
        path: 'src/a.ts',
        content: [
          "import { ping } from './b';",
          '',
          'export function alpha() {',
          '  return ping();',
          '}'
        ].join('\n')
      },
      {
        path: 'src/b.ts',
        content: [
          "import { alpha } from './a';",
          '',
          'export function ping() {',
          '  return alpha();',
          '}'
        ].join('\n')
      }
    ]);

    const alphaNode = graph.nodes.find((node) => node.name === 'alpha');
    const pingNode = graph.nodes.find((node) => node.name === 'ping');

    assert.ok(alphaNode);
    assert.ok(pingNode);
    assert.ok(graph.edges.some((edge) => edge.from === alphaNode!.id && edge.to === pingNode!.id));
    assert.ok(graph.edges.some((edge) => edge.from === pingNode!.id && edge.to === alphaNode!.id));

    const paths = traceFrom(graph, alphaNode!.id, 4);
    assert.ok(paths.length > 0);
    assert.ok(paths.every((path) => path.length <= 5));
  });

  it('menghubungkan komponen React, utils const, alias, dan default import', async () => {
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
          "  return { open: true };",
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

    const formatNode = graph.nodes.find((node) => node.name === 'formatLabel');
    const contextNode = graph.nodes.find((node) => node.name === 'SidebarContext');
    const sidebarNode = graph.nodes.find((node) => node.name === 'Sidebar');
    const sidebarFile = graph.nodes.find((node) => node.kind === 'file' && node.name === 'Sidebar.tsx');

    assert.ok(formatNode, 'formatLabel const harus jadi node');
    assert.ok(contextNode, 'SidebarContext const harus jadi node');
    assert.ok(sidebarNode, 'Sidebar const harus jadi node');
    assert.ok(sidebarFile);

    assert.ok(
      graph.edges.some((edge) => edge.kind === 'imports' && edge.from === sidebarFile!.id && edge.to === formatNode!.id),
      'import alias @/utils/format harus terhubung'
    );
    assert.ok(
      graph.edges.some((edge) => edge.kind === 'imports' && edge.from === sidebarFile!.id && edge.to === contextNode!.id),
      'default import SidebarContext harus terhubung ke symbol'
    );
    assert.ok(
      graph.edges.some((edge) => edge.kind === 'calls' && edge.from === sidebarNode!.id && edge.to === formatNode!.id),
      'pemanggilan formatLabel harus jadi edge calls'
    );
    assert.ok(
      graph.edges.some((edge) => edge.kind === 'uses' && edge.from === sidebarNode!.id && edge.to === contextNode!.id),
      'pemakaian JSX <SidebarContext /> harus jadi edge uses'
    );
  });
});
