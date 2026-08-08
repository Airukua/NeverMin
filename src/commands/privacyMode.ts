import * as vscode from 'vscode';
import { t } from '../i18n';
import { pickAndSetOllamaModel } from './selectOllamaModel';
import { getProviderName } from '../utils/config';
import { ensureCloudProviderForPublic } from '../utils/pickCloudProvider';
import {
  getPrivacyMode,
  PrivacyMode,
  setPrivacyMode
} from '../utils/privacyMode';

export async function choosePrivacyMode(
  context: vscode.ExtensionContext,
  options: { forcePick?: boolean } = {}
): Promise<PrivacyMode | undefined> {
  const current = getPrivacyMode(context);
  if (!options.forcePick && (current === 'private' || current === 'public')) {
    return current;
  }

  const picked = await vscode.window.showQuickPick(
    [
      {
        label: `$(lock) ${t('privacy.private.label')}`,
        description: t('privacy.private.badge'),
        detail: t('privacy.private.detail'),
        mode: 'private' as const
      },
      {
        label: `$(globe) ${t('privacy.public.label')}`,
        description: t('privacy.public.badge'),
        detail: t('privacy.public.detail'),
        mode: 'public' as const
      }
    ],
    {
      title: t('privacy.pickTitle'),
      placeHolder: t('privacy.pickPlaceholder'),
      ignoreFocusOut: true
    }
  );

  if (!picked) {
    return undefined;
  }

  await setPrivacyMode(context, picked.mode);
  vscode.window.showInformationMessage(
    picked.mode === 'private' ? t('privacy.private.applied') : t('privacy.public.applied')
  );

  if (picked.mode === 'private') {
    await pickAndSetOllamaModel(context, { switchProvider: true });
  } else if (getProviderName() === 'ollama') {
    await ensureCloudProviderForPublic(context, { forcePick: true });
  }

  return picked.mode;
}

export function registerPrivacyModeCommands(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand('nevermin.choosePrivacyMode', async () => {
      await choosePrivacyMode(context, { forcePick: true });
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
    }),
    vscode.commands.registerCommand('nevermin.setPrivacyPrivate', async () => {
      await setPrivacyMode(context, 'private');
      vscode.window.showInformationMessage(t('privacy.private.applied'));
      await pickAndSetOllamaModel(context, { switchProvider: true });
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
    }),
    vscode.commands.registerCommand('nevermin.setPrivacyPublic', async () => {
      await setPrivacyMode(context, 'public');
      vscode.window.showInformationMessage(t('privacy.public.applied'));
      if (getProviderName() === 'ollama') {
        await ensureCloudProviderForPublic(context, { forcePick: true });
      }
      await vscode.commands.executeCommand('nevermin.refreshSidebar');
    })
  );
}
