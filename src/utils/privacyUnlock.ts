import * as vscode from 'vscode';
import { t } from '../i18n';
import { isPrivateCodebase, setPrivacyMode } from './privacyMode';

/**
 * Jika masih Private dan user mau cloud provider/API key,
 * tawarkan ganti ke Public. Return true jika cloud diizinkan.
 */
export async function ensureCloudAllowedOrOfferPublic(
  context: vscode.ExtensionContext
): Promise<boolean> {
  if (!isPrivateCodebase(context)) {
    return true;
  }

  const switchPublic = t('privacy.switchToPublic');
  const keepPrivate = t('privacy.keepPrivateOllama');
  const choice = await vscode.window.showWarningMessage(
    t('privacy.cloudBlockedAsk'),
    { modal: true },
    switchPublic,
    keepPrivate
  );

  if (choice !== switchPublic) {
    return false;
  }

  await setPrivacyMode(context, 'public');
  vscode.window.showInformationMessage(t('privacy.public.applied'));
  return true;
}
