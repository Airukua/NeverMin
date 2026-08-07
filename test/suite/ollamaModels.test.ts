import * as assert from 'assert';
import { describeOllamaModel, ollamaNativeBaseUrl } from '../../src/utils/ollamaModels';

describe('ollamaModels helpers', () => {
  it('ollamaNativeBaseUrl memotong /v1', () => {
    assert.strictEqual(ollamaNativeBaseUrl('http://127.0.0.1:11434/v1'), 'http://127.0.0.1:11434');
    assert.strictEqual(ollamaNativeBaseUrl('http://127.0.0.1:11434/v1/'), 'http://127.0.0.1:11434');
    assert.strictEqual(ollamaNativeBaseUrl('http://10.0.0.5:11434'), 'http://10.0.0.5:11434');
  });

  it('describeOllamaModel menandai running + meta', () => {
    const text = describeOllamaModel({
      name: 'llama3.2:latest',
      running: true,
      parameterSize: '3.2B',
      family: 'llama',
      size: 2 * 1024 * 1024 * 1024
    });
    assert.ok(text.includes('running'));
    assert.ok(text.includes('3.2B'));
    assert.ok(text.includes('GB'));
  });
});
