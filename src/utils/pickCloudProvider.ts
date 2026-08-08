import * as vscode from 'vscode';
import { ProviderName } from '../types';
import { t } from '../i18n';
import { getLanguage, getProviderName, listProviders, setProviderName } from './config';
import { isPrivateCodebase } from './privacyMode';

/**
 * Di mode Public, jika provider masih Ollama (sisa Private),
 * minta user pilih provider cloud supaya bisa simpan API key.
 * Return provider aktif setelah dialog, atau undefined jika batal.
 */
export async function ensureCloudProviderForPublic(
  context: vscode.ExtensionContext,
  options: { forcePick?: boolean } = {}
): Promise<ProviderName | undefined> {
  if (isPrivateCodebase(context)) {
    return undefined;
  }

  const current = getProviderName();
  if (!options.forcePick && current !== 'ollama') {
    return current;
  }

  const cloudProviders = listProviders().filter((entry) => entry.id !== 'ollama');
  const picked = await vscode.window.showQuickPick(
    cloudProviders.map((entry) => ({
      label: entry.label,
      description: entry.id === current ? (getLanguage() === 'en' ? 'Active' : 'Aktif') : entry.id,
      detail: entry.description,
      provider: entry.id as ProviderName
    })),
    {
      title: t('privacy.public.pickCloudTitle'),
      placeHolder: t('privacy.public.pickCloudPlaceholder'),
      ignoreFocusOut: true
    }
  );

  if (!picked) {
    return undefined;
  }

  await setProviderName(picked.provider);
  vscode.window.showInformationMessage(t('msg.providerSet', { label: picked.label }));
  return picked.provider;
}
