import * as vscode from 'vscode';
import { ProviderName } from '../types';
import {
  getApiKey,
  getEffectiveLlmModel,
  getOllamaBaseUrl,
  getProviderLabel,
  getProviderName,
  hasApiKey,
  setLlmModel
} from './config';
import { Logger } from './logger';
import { LlmIssue } from './llmUserNotice';
import { detectOllamaModels, OllamaDetectError, ollamaNativeBaseUrl } from './ollamaModels';

export interface LlmSession {
  provider: ProviderName;
  providerLabel: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

function bareModelName(name: string): string {
  return name.trim().replace(/:latest$/i, '').toLowerCase();
}

/**
 * Cocokkan preferred model ke daftar terpasang (llama3.2 ↔ llama3.2:latest).
 * Jika tidak ada, pakai model yang sedang running, lalu model pertama.
 */
export async function resolveOllamaChatModel(
  preferred: string,
  openAiCompatibleBaseUrl: string = getOllamaBaseUrl()
): Promise<{ model: string; remappedFrom?: string; available: string[] }> {
  const models = await detectOllamaModels(openAiCompatibleBaseUrl);
  const available = models.map((m) => m.name);
  if (available.length === 0) {
    throw new OllamaDetectError(
      `Ollama jalan di ${ollamaNativeBaseUrl(openAiCompatibleBaseUrl)} tapi belum ada model. Jalankan: ollama pull llama3.2`
    );
  }

  const prefer = preferred.trim();
  if (prefer) {
    const preferBare = bareModelName(prefer);
    const exact =
      models.find((m) => m.name === prefer) ||
      models.find((m) => bareModelName(m.name) === preferBare);
    if (exact) {
      return {
        model: exact.name,
        remappedFrom: exact.name !== prefer ? prefer : undefined,
        available
      };
    }
  }

  const running = models.find((m) => m.running);
  const pick = running ?? models[0];
  return {
    model: pick.name,
    remappedFrom: prefer || undefined,
    available
  };
}

/**
 * Siapkan provider+model untuk panggilan LLM.
 * Untuk Ollama: pastikan daemon reachable dan model ada (auto-remap jika perlu).
 */
export async function prepareLlmSession(
  context: vscode.ExtensionContext
): Promise<{ ok: true; session: LlmSession } | { ok: false; issue: LlmIssue }> {
  const provider = getProviderName();
  const providerLabel = getProviderLabel(provider);

  if (!(await hasApiKey(context))) {
    return { ok: false, issue: { kind: 'no_key', providerLabel } };
  }

  let model = getEffectiveLlmModel(provider);
  const baseUrl = provider === 'ollama' ? getOllamaBaseUrl() : undefined;

  if (provider === 'ollama') {
    try {
      const resolved = await resolveOllamaChatModel(model, baseUrl);
      if (resolved.remappedFrom) {
        Logger.warn(
          `Ollama model '${resolved.remappedFrom}' tidak cocok/terpasang → pakai '${resolved.model}' (tersedia: ${resolved.available.join(', ')})`
        );
        await setLlmModel(resolved.model);
      } else if (resolved.model !== model) {
        Logger.info(`Ollama model efektif · ${resolved.model}`);
      }
      model = resolved.model;
    } catch (error) {
      const detail =
        error instanceof OllamaDetectError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      Logger.error(`Ollama preflight gagal · ${detail}`);
      return {
        ok: false,
        issue: {
          kind: 'failed',
          providerLabel,
          detail
        }
      };
    }
  }

  return {
    ok: true,
    session: {
      provider,
      providerLabel,
      model,
      apiKey: await getApiKey(context, provider),
      baseUrl
    }
  };
}
