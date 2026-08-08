import * as assert from 'assert';
import {
  buildNodeSummariesPrompt,
  parseNodeSummariesResponse
} from '../../src/core/llm/promptBuilder';

describe('node summaries prompt', () => {
  const targets = [
    {
      id: 'a.ts#Foo:1',
      name: 'Foo',
      kind: 'function',
      filePath: 'a.ts',
      role: 'entry'
    },
    {
      id: 'b.ts#Bar:1',
      name: 'Bar',
      kind: 'class',
      filePath: 'b.ts',
      role: 'hub'
    }
  ];

  it('membangun prompt berisi daftar komponen + icon set', () => {
    const prompt = buildNodeSummariesPrompt(targets);
    assert.ok(prompt.includes('Foo'));
    assert.ok(prompt.includes('a.ts#Foo:1'));
    assert.ok(prompt.includes('JSON'));
    assert.ok(prompt.includes('Bahasa Indonesia'));
    assert.ok(prompt.includes('icon'));
    assert.ok(prompt.includes('map'));
  });

  it('membangun prompt English bila lang=en', () => {
    const prompt = buildNodeSummariesPrompt(targets, 'en');
    assert.ok(prompt.includes('Acts as'));
    assert.ok(prompt.includes('English'));
    assert.ok(prompt.includes('icon'));
  });

  it('parse JSON object summary+icon', () => {
    const parsed = parseNodeSummariesResponse(
      '```json\n{"a.ts#Foo:1":{"summary":"Berfungsi sebagai entry UI.","icon":"form"},"Bar":{"summary":"Berfungsi sebagai hub data.","icon":"data"}}\n```',
      targets
    );
    assert.strictEqual(parsed.summaries['a.ts#Foo:1'], 'Berfungsi sebagai entry UI.');
    assert.strictEqual(parsed.summaries.Foo, 'Berfungsi sebagai entry UI.');
    assert.strictEqual(parsed.icons['a.ts#Foo:1'], 'form');
    assert.strictEqual(parsed.icons.Bar, 'data');
    assert.strictEqual(parsed.summaries['b.ts#Bar:1'], 'Berfungsi sebagai hub data.');
  });

  it('parse format string lama (hanya summary)', () => {
    const parsed = parseNodeSummariesResponse(
      '{"a.ts#Foo:1":"Berfungsi sebagai entry UI.","Bar":"Berfungsi sebagai hub data."}',
      targets
    );
    assert.strictEqual(parsed.summaries.Foo, 'Berfungsi sebagai entry UI.');
    assert.strictEqual(parsed.summaries.Bar, 'Berfungsi sebagai hub data.');
    assert.deepStrictEqual(parsed.icons, {});
  });
});
