import * as vscode from 'vscode';
import { t } from '../i18n';
import { hasChosenPrivacyMode, isPrivateCodebase } from './privacyMode';

/**
 * Pastikan user sudah pilih Private/Public. Return false jika batal.
 */
export async function ensurePrivacyModeChosen(
  context: vscode.ExtensionContext
): Promise<boolean> {
  if (hasChosenPrivacyMode(context)) {
    return true;
  }
  const { choosePrivacyMode } = await import('../commands/privacyMode');
  const mode = await choosePrivacyMode(context, { forcePick: true });
  await vscode.commands.executeCommand('nevermin.refreshSidebar');
  return Boolean(mode);
}

/** Block cloud provider / API key actions while Private mode is on. */
export function assertCloudLlmAllowed(context: vscode.ExtensionContext): boolean {
  if (!isPrivateCodebase(context)) {
    return true;
  }
  vscode.window.showWarningMessage(t('privacy.cloudBlocked'));
  return false;
}
