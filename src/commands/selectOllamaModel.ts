import * as vscode from 'vscode';
import { t } from '../i18n';
import {
  enforceOllamaNoApiKeys,
  getLanguage,
  getLlmModel,
  getOllamaBaseUrl,
  getProviderDefaultModel,
  getProviderName,
  setLlmModel,
  setProviderName
} from '../utils/config';
import { Logger } from '../utils/logger';
import { isPrivateCodebase } from '../utils/privacyMode';
import {
  describeOllamaModel,
  detectOllamaModels,
  OllamaDetectError
} from '../utils/ollamaModels';

export async function pickAndSetOllamaModel(
  context: vscode.ExtensionContext,
  options: { switchProvider?: boolean } = {}
): Promise<string | undefined> {
  const alreadyOllama = getProviderName() === 'ollama';
  const shouldSwitch = options.switchProvider === true || (!alreadyOllama && isPrivateCodebase(context));

  if (shouldSwitch && !alreadyOllama) {
    // Public + lagi pakai cloud: jangan silent force Ollama — konfirmasi dulu.
    if (!isPrivateCodebase(context)) {
      const switchLabel = t('privacy.switchToOllama');
      const cancelLabel = t('privacy.keepCloudProvider');
      const choice = await vscode.window.showWarningMessage(
        t('privacy.switchToOllamaAsk'),
        { modal: true },
        switchLabel,
        cancelLabel
      );
      if (choice !== switchLabel) {
        return undefined;
      }
    }
    await setProviderName('ollama');
    if (isPrivateCodebase(context)) {
      const removed = await enforceOllamaNoApiKeys(context);
      if (removed > 0) {
        Logger.info(`Ollama · hapus ${removed} API key cloud`);
        vscode.window.showInformationMessage(t('ollama.keysCleared', { label: 'Ollama', count: removed }));
      }
    }
  } else if (alreadyOllama && isPrivateCodebase(context)) {
    await enforceOllamaNoApiKeys(context);
  }

  const baseUrl = getOllamaBaseUrl();
  const current = getLlmModel() || getProviderDefaultModel('ollama');

  let models;
  try {
    models = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('ollama.detecting'),
        cancellable: false
      },
      async () => detectOllamaModels(baseUrl)
    );
  } catch (error) {
    const detail =
      error instanceof OllamaDetectError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    Logger.warn(`Deteksi Ollama gagal · ${baseUrl} · ${detail}`);
    vscode.window.showErrorMessage(t('ollama.detectFail', { error: detail, url: baseUrl }));
    return undefined;
  }

  if (models.length === 0) {
    vscode.window.showWarningMessage(t('ollama.noModels', { url: baseUrl }));
    return undefined;
  }

  const runningCount = models.filter((m) => m.running).length;
  const picked = await vscode.window.showQuickPick(
    models.map((model) => ({
      label: `${model.running ? '$(play)' : '$(circle-outline)'} ${model.name}`,
      description:
        model.name === current ||
        model.name.replace(/:latest$/i, '') === current.replace(/:latest$/i, '')
          ? getLanguage() === 'en'
            ? 'Active'
            : 'Aktif'
          : model.running
            ? 'RAM'
            : undefined,
      detail: describeOllamaModel(model) || undefined,
      model: model.name
    })),
    {
      title: t('ollama.pickTitle'),
      placeHolder:
        runningCount > 0
          ? t('ollama.pickPlaceholderRunning', { count: runningCount })
          : t('ollama.pickPlaceholder'),
      ignoreFocusOut: true,
      matchOnDetail: true
    }
  );

  if (!picked) {
    return undefined;
  }

  await setLlmModel(picked.model);
  Logger.info(`Ollama model dipilih · ${picked.model} · ${baseUrl}`);
  vscode.window.showInformationMessage(t('ollama.modelSet', { model: picked.model }));
  return picked.model;
}

export function registerSelectOllamaModelCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand('nevermin.selectOllamaModel', async () => {
    // Private: langsung Ollama. Public: konfirmasi dulu (lihat pickAndSetOllamaModel).
    await pickAndSetOllamaModel(context, { switchProvider: true });
  });
}
