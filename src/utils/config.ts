import * as vscode from 'vscode';
import { ProviderName } from '../types';
import { getProviderCatalogEntry, isProviderName, PROVIDER_CATALOG, PROVIDER_IDS } from '../core/llm/providerCatalog';
import { NeverminLanguage, isNeverminLanguage, languageDisplayName } from '../i18n/types';
import { Logger } from './logger';

const NEVERMIN_SECTION = 'nevermin';
const API_KEY_SETTING = 'apiKey';
const API_KEY_SECRET = 'nevermin.apiKey';

export type ApiKeySource = 'secretStorage' | 'settingsFallback' | 'missing';

export interface ApiKeyState {
  readonly value: string;
  readonly source: ApiKeySource;
  readonly provider: ProviderName;
}

export type { NeverminLanguage };

function providerSecretKey(provider: ProviderName): string {
  return `${API_KEY_SECRET}.${provider}`;
}

export function getLanguage(): NeverminLanguage {
  const raw = vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<string>('language', 'id');
  return isNeverminLanguage(raw) ? raw : 'id';
}

export async function setLanguage(language: NeverminLanguage): Promise<void> {
  await vscode.workspace
    .getConfiguration(NEVERMIN_SECTION)
    .update('language', language, vscode.ConfigurationTarget.Global);
}

export function getLanguageLabel(language: NeverminLanguage = getLanguage()): string {
  return languageDisplayName(language);
}

export function getProviderName(): ProviderName {
  const raw = vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<string>('provider', 'ollama');
  return isProviderName(raw) ? raw : 'ollama';
}

/** True saat setProviderName sedang / baru saja menulis — watcher harus diam. */
let providerWriteDepth = 0;

export function isWritingProviderSetting(): boolean {
  return providerWriteDepth > 0;
}

/**
 * Tulis provider ke Global + Workspace (nilai sama).
 * Jangan tulis WorkspaceFolder — `nevermin.provider` tidak support folder scope.
 * Ganti provider → reset model ke default katalog (hindari sisa Ollama di Gemini, dll).
 */
export async function setProviderName(provider: ProviderName): Promise<void> {
  const previous = getProviderName();
  providerWriteDepth += 1;
  try {
    const config = vscode.workspace.getConfiguration(NEVERMIN_SECTION);
    await config.update('provider', provider, vscode.ConfigurationTarget.Global);

    if (vscode.workspace.workspaceFolders?.length) {
      try {
        await config.update('provider', provider, vscode.ConfigurationTarget.Workspace);
      } catch (error) {
        // Workspace tanpa .code-workspace / read-only: Global saja cukup.
        Logger.warn(
          `Gagal tulis nevermin.provider ke Workspace: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (previous !== provider) {
      await writeLlmModel(getProviderDefaultModel(provider));
    }
  } finally {
    // Event config VS Code sering datang SETELAH await selesai — tahan flag sebentar.
    setTimeout(() => {
      providerWriteDepth = Math.max(0, providerWriteDepth - 1);
    }, 750);
  }
}

function getFallbackApiKey(): string {
  return vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<string>(API_KEY_SETTING, '').trim();
}

async function getSecretApiKeyForProvider(
  context: vscode.ExtensionContext,
  provider: ProviderName
): Promise<string> {
  const perProvider = (await context.secrets.get(providerSecretKey(provider)))?.trim() ?? '';
  if (perProvider) {
    return perProvider;
  }
  // Legacy shared key (sebelum per-provider)
  return (await context.secrets.get(API_KEY_SECRET))?.trim() ?? '';
}

async function clearSettingsApiKey(): Promise<void> {
  const config = vscode.workspace.getConfiguration(NEVERMIN_SECTION);
  const inspection = config.inspect<string>(API_KEY_SETTING);
  // Folder scope mungkin tidak didukung — skip aman.
  if (inspection?.workspaceFolderValue) {
    try {
      await config.update(API_KEY_SETTING, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
    } catch {
      /* ignore */
    }
  }
  if (inspection?.workspaceValue) {
    await config.update(API_KEY_SETTING, undefined, vscode.ConfigurationTarget.Workspace);
  }
  if (inspection?.globalValue) {
    await config.update(API_KEY_SETTING, undefined, vscode.ConfigurationTarget.Global);
  }
}

export async function getApiKeyState(
  context: vscode.ExtensionContext,
  provider: ProviderName = getProviderName()
): Promise<ApiKeyState> {
  const entry = getProviderCatalogEntry(provider);
  const secretKey = await getSecretApiKeyForProvider(context, provider);
  if (secretKey) {
    return { value: secretKey, source: 'secretStorage', provider };
  }

  // Ollama boleh tanpa key
  if (!entry.requiresApiKey) {
    return { value: 'ollama-local', source: 'secretStorage', provider };
  }

  const fallbackKey = getFallbackApiKey();
  if (fallbackKey) {
    return { value: fallbackKey, source: 'settingsFallback', provider };
  }

  return { value: '', source: 'missing', provider };
}

export async function getApiKey(
  context: vscode.ExtensionContext,
  provider: ProviderName = getProviderName()
): Promise<string> {
  const entry = getProviderCatalogEntry(provider);
  const state = await getApiKeyState(context, provider);
  if (!state.value) {
    const lang = getLanguage();
    throw new Error(
      lang === 'en'
        ? `API key for ${entry.label} is not set. Save it via NeverMIN: Save API Key (for the active provider).`
        : `API key ${entry.label} belum diset. Simpan lewat NeverMIN: Simpan API Key (untuk provider aktif).`
    );
  }
  // Marker internal ollama — kirim string kosong ke HTTP layer
  if (provider === 'ollama' && state.value === 'ollama-local') {
    return '';
  }
  return state.value;
}

export async function hasApiKey(
  context: vscode.ExtensionContext,
  provider: ProviderName = getProviderName()
): Promise<boolean> {
  const entry = getProviderCatalogEntry(provider);
  if (!entry.requiresApiKey) {
    return true;
  }
  return (await getApiKeyState(context, provider)).value.length > 0;
}

export async function setApiKey(
  context: vscode.ExtensionContext,
  apiKey: string,
  provider: ProviderName = getProviderName()
): Promise<void> {
  // Hanya blokir bila target provider adalah Ollama.
  // Kalau user Public masih di Ollama lalu pilih Gemini dulu, set key untuk Gemini harus lolos.
  if (provider === 'ollama') {
    await clearAllLlmApiKeys(context);
    throw new Error(
      getLanguage() === 'en'
        ? 'Ollama runs locally — cloud API keys are cleared and not stored.'
        : 'Ollama berjalan lokal — API key cloud dihapus dan tidak disimpan.'
    );
  }

  const normalizedKey = apiKey.trim();
  if (!normalizedKey) {
    await clearApiKey(context, provider);
    return;
  }

  await context.secrets.store(providerSecretKey(provider), normalizedKey);
  // Jangan biarkan plaintext di settings setelah secret tersimpan
  await clearSettingsApiKey();
}

export async function clearApiKey(
  context: vscode.ExtensionContext,
  provider: ProviderName = getProviderName()
): Promise<void> {
  await context.secrets.delete(providerSecretKey(provider));
  // Juga hapus legacy shared bila provider aktif
  if (provider === getProviderName()) {
    await context.secrets.delete(API_KEY_SECRET);
  }
  await clearSettingsApiKey();
}

/**
 * Hapus semua API key LLM NeverMIN (per-provider + legacy + settings fallback).
 * Dipakai saat beralih ke Ollama agar key cloud tidak tertinggal di mesin.
 */
export async function clearAllLlmApiKeys(context: vscode.ExtensionContext): Promise<number> {
  let cleared = 0;
  for (const provider of PROVIDER_IDS) {
    if (provider === 'ollama') {
      continue;
    }
    const key = providerSecretKey(provider);
    const existing = (await context.secrets.get(key))?.trim() ?? '';
    if (existing) {
      cleared += 1;
    }
    await context.secrets.delete(key);
  }
  const legacy = (await context.secrets.get(API_KEY_SECRET))?.trim() ?? '';
  if (legacy) {
    cleared += 1;
  }
  await context.secrets.delete(API_KEY_SECRET);
  if (getFallbackApiKey()) {
    cleared += 1;
  }
  await clearSettingsApiKey();
  return cleared;
}

/**
 * Saat provider Ollama aktif: buang semua key cloud dan pastikan settings bersih.
 */
export async function enforceOllamaNoApiKeys(context: vscode.ExtensionContext): Promise<number> {
  return clearAllLlmApiKeys(context);
}

export async function migrateLegacyApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  // Ollama + Private: hapus key cloud. Public + Ollama: jangan hapus
  // (user bisa ganti ke Gemini/OpenAI sebentar lagi — key harus tetap).
  if (getProviderName() === 'ollama') {
    const { isPrivateCodebase } = await import('./privacyMode');
    if (!isPrivateCodebase(context)) {
      return false;
    }
    const removed = await clearAllLlmApiKeys(context);
    return removed > 0;
  }

  const provider = getProviderName();
  const existingPerProvider = (await context.secrets.get(providerSecretKey(provider)))?.trim() ?? '';
  const existingShared = (await context.secrets.get(API_KEY_SECRET))?.trim() ?? '';

  if (existingPerProvider) {
    if (getFallbackApiKey()) {
      await clearSettingsApiKey();
      return true;
    }
    return false;
  }

  if (existingShared) {
    await context.secrets.store(providerSecretKey(provider), existingShared);
    if (getFallbackApiKey()) {
      await clearSettingsApiKey();
    }
    return true;
  }

  const fallbackKey = getFallbackApiKey();
  if (!fallbackKey) {
    return false;
  }

  await context.secrets.store(providerSecretKey(provider), fallbackKey);
  await clearSettingsApiKey();
  return true;
}

export function getProviderLabel(provider: ProviderName = getProviderName()): string {
  return getProviderCatalogEntry(provider).label;
}

export function getProviderDefaultModel(provider: ProviderName = getProviderName()): string {
  return getProviderCatalogEntry(provider).defaultModel;
}

export function listProviders() {
  return PROVIDER_CATALOG;
}

export function getMaxAnalysisFiles(): number {
  const configured = vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<number>('maxAnalysisFiles', 500);
  if (!Number.isFinite(configured)) {
    return 500;
  }
  return Math.min(2000, Math.max(10, Math.floor(configured)));
}

export function getLlmModel(): string {
  return vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<string>('model', '').trim();
}

/** Model id Gemini yang sering 404 / retired untuk key baru — pakai default katalog. */
const STALE_GEMINI_MODELS = new Set([
  'gemini-pro',
  'gemini-1.0-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest',
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro'
]);

function normalizeModelId(raw: string): string {
  return raw.trim().replace(/^models\//i, '');
}

function isCompatibleModel(model: string, provider: ProviderName): boolean {
  const m = model.toLowerCase();
  switch (provider) {
    case 'gemini':
      return m.startsWith('gemini') || m.startsWith('gemma');
    case 'openai':
      return /^(gpt-|o[1-9]|chatgpt-|text-embedding)/.test(m);
    case 'anthropic':
      return m.startsWith('claude');
    case 'deepseek':
      return m.startsWith('deepseek');
    case 'xai':
      return m.startsWith('grok');
    case 'mistral':
      return /^(mistral|mixtral|codestral|pixtral|ministral)/.test(m);
    case 'openrouter':
      return m.includes('/') || m.startsWith('openrouter');
    case 'together':
      return m.includes('/') || /^(meta-llama|qwen|mistralai|nousresearch)/.test(m);
    case 'groq':
      return (
        !m.startsWith('gemini') &&
        !m.startsWith('gpt-') &&
        !m.startsWith('claude') &&
        !m.startsWith('deepseek') &&
        !m.startsWith('grok') &&
        !m.includes('/')
      );
    case 'ollama':
      if (m.startsWith('gemini') || m.startsWith('gpt-') || m.startsWith('claude') || m.startsWith('grok')) {
        return false;
      }
      if (m.includes('/') && !m.includes(':')) {
        return false;
      }
      return true;
    default:
      return true;
  }
}

/**
 * Model efektif untuk provider aktif.
 * Buang sisa model provider lain / id Gemini yang sering 404, dan normalisasi `models/…`.
 */
export function getEffectiveLlmModel(provider: ProviderName = getProviderName()): string {
  const configured = normalizeModelId(getLlmModel());
  const fallback = getProviderDefaultModel(provider);
  if (!configured) {
    return fallback;
  }
  if (!isCompatibleModel(configured, provider)) {
    return fallback;
  }
  if (provider === 'gemini' && STALE_GEMINI_MODELS.has(configured.toLowerCase())) {
    return fallback;
  }
  return configured;
}

async function writeLlmModel(model: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(NEVERMIN_SECTION);
  const value = model.trim();
  await config.update('model', value, vscode.ConfigurationTarget.Global);
  if (vscode.workspace.workspaceFolders?.length) {
    try {
      // Samakan / timpa override workspace supaya sisa Ollama tidak menang vs Global.
      await config.update('model', value, vscode.ConfigurationTarget.Workspace);
    } catch (error) {
      Logger.warn(
        `Gagal tulis nevermin.model ke Workspace: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export async function setLlmModel(model: string): Promise<void> {
  await writeLlmModel(model);
}

export function getLlmTemperature(): number {
  const configured = vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<number>('temperature', 0.2);
  if (!Number.isFinite(configured)) {
    return 0.2;
  }
  return Math.min(2, Math.max(0, configured));
}

export function getOllamaBaseUrl(): string {
  const configured = vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<string>('ollamaBaseUrl', '').trim();
  return configured || 'http://127.0.0.1:11434/v1';
}
