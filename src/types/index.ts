export interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  symbolName?: string;
  contextHeader?: string;
  estimatedTokens?: number;
  chunkKind?: 'module' | 'symbol' | 'symbol-part';
  signature?: string;
  parentClass?: string;
  symbolKind?: 'function' | 'method' | 'class' | 'interface' | 'type' | 'variable';
  partLabel?: string;
}

export interface ExplainRequest {
  chunks: CodeChunk[];
  question: string;
}

export interface ExplainResponse {
  answer: string;
  citedChunks: CodeChunk[];
}

export type ProviderName =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'together'
  | 'xai'
  | 'ollama';

/** Token usage dari respons provider (opsional — tidak semua API/cache mengisi). */
export interface LlmTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LlmCompletionResult {
  text: string;
  /** Reasoning trace (Qwen3/DeepSeek/Ollama thinking) — terpisah dari jawaban akhir. */
  thinking?: string;
  usage?: LlmTokenUsage;
  /** true jika diambil dari prompt cache (bukan billable call baru). */
  fromCache?: boolean;
}

export interface LlmCompleteOptions {
  /** Lewati baca cache (tetap boleh menulis bila cacheResponse true). */
  skipCache?: boolean;
  /** Default true. Set false untuk call yang belum divalidasi (retry semantik). */
  cacheResponse?: boolean;
  /**
   * Ollama thinking models (qwen3, deepseek-r1, …).
   * true/level → minta trace; false → matikan (penting untuk JSON terstruktur).
   * Diabaikan provider non-Ollama.
   */
  think?: boolean | 'low' | 'medium' | 'high' | 'max';
}

export interface LlmProvider {
  readonly name: ProviderName;
  complete(prompt: string, options?: LlmCompleteOptions): Promise<LlmCompletionResult>;
}
