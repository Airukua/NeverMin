import * as vscode from 'vscode';
import { enforceOllamaNoApiKeys, setProviderName } from './config';
import { Logger } from './logger';

const PRIVACY_MODE_KEY = 'nevermin.privacyMode';

export type PrivacyMode = 'private' | 'public';
export type PrivacyModeState = PrivacyMode | 'unset';

export function getPrivacyMode(context: vscode.ExtensionContext): PrivacyModeState {
  const value = context.workspaceState.get<string>(PRIVACY_MODE_KEY, 'unset');
  if (value === 'private' || value === 'public') {
    return value;
  }
  return 'unset';
}

export function hasChosenPrivacyMode(context: vscode.ExtensionContext): boolean {
  return getPrivacyMode(context) !== 'unset';
}

export function isPrivateCodebase(context: vscode.ExtensionContext): boolean {
  return getPrivacyMode(context) === 'private';
}

/**
 * Simpan pilihan awal Private / Public dan terapkan kebijakan keamanan.
 * - private → paksa Ollama + hapus semua cloud API key
 * - public → izinkan provider cloud (tidak mengubah key yang ada)
 */
export async function setPrivacyMode(
  context: vscode.ExtensionContext,
  mode: PrivacyMode
): Promise<void> {
  await context.workspaceState.update(PRIVACY_MODE_KEY, mode);

  if (mode === 'private') {
    await setProviderName('ollama');
    const removed = await enforceOllamaNoApiKeys(context);
    Logger.info(`Privacy mode · private · Ollama · cleared ${removed} cloud key(s)`);
  } else {
    Logger.info('Privacy mode · public · cloud LLM providers allowed');
  }
}

export async function clearPrivacyMode(context: vscode.ExtensionContext): Promise<void> {
  await context.workspaceState.update(PRIVACY_MODE_KEY, undefined);
}
