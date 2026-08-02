import * as vscode from 'vscode';
import { ProviderName } from '../types';

const NEVERMIN_SECTION = 'nevermin';
const API_KEY_SETTING = 'apiKey';
const API_KEY_SECRET = 'nevermin.apiKey';

export type ApiKeySource = 'secretStorage' | 'settingsFallback' | 'missing';

export interface ApiKeyState {
  readonly value: string;
  readonly source: ApiKeySource;
}

export function getProviderName(): ProviderName {
  return vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<ProviderName>('provider', 'gemini');
}

export async function setProviderName(provider: ProviderName): Promise<void> {
  await vscode.workspace.getConfiguration(NEVERMIN_SECTION).update('provider', provider, vscode.ConfigurationTarget.Global);
}

function getFallbackApiKey(): string {
  return vscode.workspace.getConfiguration(NEVERMIN_SECTION).get<string>(API_KEY_SETTING, '').trim();
}

async function getSecretApiKey(context: vscode.ExtensionContext): Promise<string> {
  return (await context.secrets.get(API_KEY_SECRET))?.trim() ?? '';
}

export async function getApiKeyState(context: vscode.ExtensionContext): Promise<ApiKeyState> {
  const secretKey = await getSecretApiKey(context);
  if (secretKey) {
    return { value: secretKey, source: 'secretStorage' };
  }

  const fallbackKey = getFallbackApiKey();
  if (fallbackKey) {
    return { value: fallbackKey, source: 'settingsFallback' };
  }

  return { value: '', source: 'missing' };
}

export async function getApiKey(context: vscode.ExtensionContext): Promise<string> {
  const state = await getApiKeyState(context);
  if (!state.value) {
    throw new Error('API key belum diset. Simpan lewat command NeverMIN: Atur API Key.');
  }
  return state.value;
}

export async function hasApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  return (await getApiKeyState(context)).value.length > 0;
}

export async function setApiKey(context: vscode.ExtensionContext, apiKey: string): Promise<void> {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) {
    await context.secrets.delete(API_KEY_SECRET);
    return;
  }

  await context.secrets.store(API_KEY_SECRET, normalizedKey);
}

export async function clearApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(API_KEY_SECRET);
}

export async function migrateLegacyApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  const existingSecret = await getSecretApiKey(context);
  if (existingSecret) {
    return false;
  }

  const fallbackKey = getFallbackApiKey();
  if (!fallbackKey) {
    return false;
  }

  await context.secrets.store(API_KEY_SECRET, fallbackKey);
  return true;
}

export function getProviderLabel(): string {
  return getProviderName() === 'gemini' ? 'Gemini' : 'DeepSeek';
}
