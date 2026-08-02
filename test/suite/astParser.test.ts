import * as assert from 'assert';
import { extractSymbols } from '../../src/core/parser/astParser';

describe('extractSymbols', () => {
  it('mendeteksi symbol TypeScript', async () => {
    const content = [
      'function greet(name: string) {',
      '  return `Hello ${name}`;',
      '}',
      '',
      'class User {',
      '  constructor(public id: number) {}',
      '}'
    ].join('\n');

    const symbols = await extractSymbols('sample.ts', content);

    assert.strictEqual(symbols.length, 2);
    assert.deepStrictEqual(
      symbols.map((symbol) => symbol.name),
      ['greet', 'User']
    );
    assert.deepStrictEqual(
      symbols.map((symbol) => symbol.kind),
      ['function', 'class']
    );
    assert.deepStrictEqual(
      symbols.map((symbol) => [symbol.startLine, symbol.endLine]),
      [
        [1, 3],
        [5, 7]
      ]
    );
  });

  it('mendeteksi symbol Python', async () => {
    const content = [
      'def greet(name):',
      '    return f"Hello {name}"',
      '',
      'class User:',
      '    def __init__(self, user_id):',
      '        self.user_id = user_id'
    ].join('\n');

    const symbols = await extractSymbols('sample.py', content);

    assert.strictEqual(symbols.length, 2);
    assert.deepStrictEqual(
      symbols.map((symbol) => symbol.name),
      ['greet', 'User']
    );
    assert.deepStrictEqual(
      symbols.map((symbol) => symbol.kind),
      ['function', 'class']
    );
  });

  it('mengembalikan array kosong untuk ekstensi tidak dikenal', async () => {
    const symbols = await extractSymbols('sample.txt', 'hello world');
    assert.deepStrictEqual(symbols, []);
  });

  it('mendeteksi const arrow component dan helper', async () => {
    const content = [
      'export const formatLabel = (value: string) => {',
      '  return value.trim();',
      '};',
      '',
      'export const Sidebar = () => {',
      '  return formatLabel("ok");',
      '};'
    ].join('\n');

    const symbols = await extractSymbols('Sidebar.tsx', content);
    const names = symbols.map((symbol) => symbol.name);

    assert.ok(names.includes('formatLabel'));
    assert.ok(names.includes('Sidebar'));
  });
});
