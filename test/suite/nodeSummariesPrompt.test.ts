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

  it('membangun prompt berisi daftar komponen', () => {
    const prompt = buildNodeSummariesPrompt(targets);
    assert.ok(prompt.includes('Foo'));
    assert.ok(prompt.includes('a.ts#Foo:1'));
    assert.ok(prompt.includes('JSON'));
    assert.ok(prompt.includes('Bahasa Indonesia'));
  });

  it('membangun prompt English bila lang=en', () => {
    const prompt = buildNodeSummariesPrompt(targets, 'en');
    assert.ok(prompt.includes('Acts as'));
    assert.ok(prompt.includes('English'));
  });

  it('parse JSON summaries dan map by id/name', () => {
    const parsed = parseNodeSummariesResponse(
      '```json\n{"a.ts#Foo:1":"Berfungsi sebagai entry UI.","Bar":"Berfungsi sebagai hub data."}\n```',
      targets
    );
    assert.strictEqual(parsed['a.ts#Foo:1'], 'Berfungsi sebagai entry UI.');
    assert.strictEqual(parsed.Foo, 'Berfungsi sebagai entry UI.');
    assert.strictEqual(parsed['b.ts#Bar:1'], 'Berfungsi sebagai hub data.');
    assert.strictEqual(parsed.Bar, 'Berfungsi sebagai hub data.');
  });
});
