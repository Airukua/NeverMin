import { getOllamaBaseUrl } from './config';

export interface OllamaModelInfo {
  name: string;
  size?: number;
  parameterSize?: string;
  family?: string;
  /** Sedang loaded di memori (`ollama ps`). */
  running: boolean;
  modifiedAt?: string;
}

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    size?: number;
    modified_at?: string;
    details?: {
      parameter_size?: string;
      family?: string;
    };
  }>;
}

interface OllamaPsResponse {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
}

interface OpenAiModelsResponse {
  data?: Array<{ id?: string }>;
}

export class OllamaDetectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaDetectError';
  }
}

/** Dari `http://host:11434/v1` → `http://host:11434`. */
export function ollamaNativeBaseUrl(openAiCompatibleBaseUrl: string = getOllamaBaseUrl()): string {
  const trimmed = openAiCompatibleBaseUrl.trim().replace(/\/$/, '');
  return trimmed.replace(/\/v1$/i, '') || 'http://127.0.0.1:11434';
}

async function fetchJson<T>(url: string, timeoutMs = 8_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new OllamaDetectError(`HTTP ${response.status} dari ${url}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof OllamaDetectError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OllamaDetectError(`Timeout menghubungi Ollama (${url})`);
    }
    throw new OllamaDetectError(
      error instanceof Error ? error.message : `Gagal fetch Ollama: ${String(error)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

function formatSize(bytes?: number): string | undefined {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) {
    return undefined;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/**
 * Deteksi model terpasang (`/api/tags`) + yang sedang run (`/api/ps`).
 * Fallback ke `/v1/models` jika native API gagal.
 */
export async function detectOllamaModels(
  openAiCompatibleBaseUrl: string = getOllamaBaseUrl()
): Promise<OllamaModelInfo[]> {
  const native = ollamaNativeBaseUrl(openAiCompatibleBaseUrl);
  const running = new Set<string>();

  try {
    const ps = await fetchJson<OllamaPsResponse>(`${native}/api/ps`);
    for (const item of ps.models ?? []) {
      const name = (item.name || item.model || '').trim();
      if (name) {
        running.add(name);
        // juga tanpa tag :latest
        running.add(name.replace(/:latest$/i, ''));
      }
    }
  } catch {
    // ps opsional — lanjut list tags
  }

  try {
    const tags = await fetchJson<OllamaTagsResponse>(`${native}/api/tags`);
    const models: OllamaModelInfo[] = [];
    for (const item of tags.models ?? []) {
      const name = (item.name || '').trim();
      if (!name) {
        continue;
      }
      const bare = name.replace(/:latest$/i, '');
      models.push({
        name,
        size: item.size,
        parameterSize: item.details?.parameter_size,
        family: item.details?.family,
        modifiedAt: item.modified_at,
        running: running.has(name) || running.has(bare)
      });
    }

    return models.sort((a, b) => Number(b.running) - Number(a.running) || a.name.localeCompare(b.name));
  } catch (tagsError) {
    // Fallback OpenAI-compatible
    try {
      const base = openAiCompatibleBaseUrl.replace(/\/$/, '');
      const listed = await fetchJson<OpenAiModelsResponse>(`${base}/models`);
      const models: OllamaModelInfo[] = [];
      for (const item of listed.data ?? []) {
        const name = (item.id || '').trim();
        if (!name) {
          continue;
        }
        const bare = name.replace(/:latest$/i, '');
        models.push({
          name,
          running: running.has(name) || running.has(bare)
        });
      }
      return models.sort((a, b) => Number(b.running) - Number(a.running) || a.name.localeCompare(b.name));
    } catch {
      throw tagsError instanceof OllamaDetectError
        ? tagsError
        : new OllamaDetectError(
            tagsError instanceof Error ? tagsError.message : String(tagsError)
          );
    }
  }
}

export function describeOllamaModel(model: OllamaModelInfo): string {
  const parts: string[] = [];
  if (model.running) {
    parts.push('running');
  }
  if (model.parameterSize) {
    parts.push(model.parameterSize);
  }
  if (model.family) {
    parts.push(model.family);
  }
  const size = formatSize(model.size);
  if (size) {
    parts.push(size);
  }
  return parts.join(' · ');
}
