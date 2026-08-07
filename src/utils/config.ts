import * as vscode from 'vscode';
import { ProviderName } from '../types';
import { getProviderCatalogEntry, isProviderName, PROVIDER_CATALOG, PROVIDER_IDS } from '../core/llm/providerCatalog';
import { NeverminLanguage, isNeverminLanguage, languageDisplayName } from '../i18n/types';

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
  const raw = vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<string>('provider', 'gemini');
  return isProviderName(raw) ? raw : 'gemini';
}

export async function setProviderName(provider: ProviderName): Promise<void> {
  await vscode.workspace.getConfiguration(NEVERMIN_SECTION).update('provider', provider, vscode.ConfigurationTarget.Global);
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
  if (inspection?.workspaceFolderValue) {
    await config.update(API_KEY_SETTING, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
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
  if (provider === 'ollama' || getProviderName() === 'ollama') {
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
  // Ollama lokal: jangan migrasi/simpan key — bersihkan saja jika masih ada.
  if (getProviderName() === 'ollama') {
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

export async function setLlmModel(model: string): Promise<void> {
  await vscode.workspace
    .getConfiguration(NEVERMIN_SECTION)
    .update('model', model.trim(), vscode.ConfigurationTarget.Global);
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
