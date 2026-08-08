import * as assert from 'assert';
import * as configApi from '../../src/utils/config';
import vscodeMock = require('../mocks/vscode');

const { clearApiKey, getApiKeyState, getEffectiveLlmModel, getProviderName, migrateLegacyApiKey, setApiKey, setLlmModel, setProviderName } =
  configApi;
const { __resetVscodeMock, __seedSettingsApiKey, createMockExtensionContext } = vscodeMock;

describe('config api key migrate', () => {
  beforeEach(async () => {
    __resetVscodeMock();
    // Default package.json = ollama; tes cloud key butuh provider cloud.
    await setProviderName('gemini');
  });

  it('migrateLegacyApiKey memindahkan settings ke SecretStorage per-provider lalu menghapus plaintext', async () => {
    const context = createMockExtensionContext();
    __seedSettingsApiKey('legacy-key-from-settings');

    const migrated = await migrateLegacyApiKey(context as never);
    assert.strictEqual(migrated, true);

    const provider = getProviderName();
    assert.strictEqual(provider, 'gemini');
    const state = await getApiKeyState(context as never, provider);
    assert.strictEqual(state.source, 'secretStorage');
    assert.strictEqual(state.value, 'legacy-key-from-settings');
    assert.strictEqual(state.provider, provider);

    await context.secrets.delete(`nevermin.apiKey.${provider}`);
    await context.secrets.delete('nevermin.apiKey');
    const afterDeleteSecret = await getApiKeyState(context as never, provider);
    assert.strictEqual(afterDeleteSecret.source, 'missing');
    assert.strictEqual(afterDeleteSecret.value, '');
  });

  it('setApiKey menyimpan secret per-provider dan membersihkan settings', async () => {
    const context = createMockExtensionContext();
    __seedSettingsApiKey('should-be-cleared');

    await setApiKey(context as never, 'fresh-secret');

    const provider = getProviderName();
    const state = await getApiKeyState(context as never, provider);
    assert.strictEqual(state.source, 'secretStorage');
    assert.strictEqual(state.value, 'fresh-secret');

    await context.secrets.delete(`nevermin.apiKey.${provider}`);
    await context.secrets.delete('nevermin.apiKey');
    const withoutSecret = await getApiKeyState(context as never, provider);
    assert.strictEqual(withoutSecret.source, 'missing');
  });

  it('clearApiKey menghapus secret dan settings', async () => {
    const context = createMockExtensionContext();
    await setApiKey(context as never, 'temp');
    __seedSettingsApiKey('leftover');

    await clearApiKey(context as never);

    const state = await getApiKeyState(context as never);
    assert.strictEqual(state.source, 'missing');
    assert.strictEqual(state.value, '');
  });

  it('setProviderName + API key terpisah per provider', async () => {
    const context = createMockExtensionContext();
    await setProviderName('openai');
    await setApiKey(context as never, 'openai-key', 'openai');
    await setProviderName('anthropic');
    await setApiKey(context as never, 'anthropic-key', 'anthropic');

    assert.strictEqual((await getApiKeyState(context as never, 'openai')).value, 'openai-key');
    assert.strictEqual((await getApiKeyState(context as never, 'anthropic')).value, 'anthropic-key');
  });

  it('ollama tidak membutuhkan API key', async () => {
    await setProviderName('ollama');
    const context = createMockExtensionContext();
    const state = await getApiKeyState(context as never, 'ollama');
    assert.strictEqual(state.source, 'secretStorage');
    assert.ok(state.value.length > 0);
  });

  it('default provider dari settings adalah ollama', () => {
    __resetVscodeMock();
    assert.strictEqual(getProviderName(), 'ollama');
  });

  it('getEffectiveLlmModel buang sisa model provider lain dan Gemini stale', async () => {
    await setProviderName('gemini');
    await setLlmModel('llama3.2:3b');
    assert.strictEqual(getEffectiveLlmModel('gemini'), 'gemini-flash-latest');

    await setLlmModel('gpt-4o-mini');
    assert.strictEqual(getEffectiveLlmModel('gemini'), 'gemini-flash-latest');

    await setLlmModel('gemini-2.5-flash');
    assert.strictEqual(getEffectiveLlmModel('gemini'), 'gemini-flash-latest');

    await setLlmModel('models/gemini-3.5-flash');
    assert.strictEqual(getEffectiveLlmModel('gemini'), 'gemini-3.5-flash');

    await setLlmModel('gemini-flash-latest');
    assert.strictEqual(getEffectiveLlmModel('gemini'), 'gemini-flash-latest');
  });
});
