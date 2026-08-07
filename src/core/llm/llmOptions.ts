export interface LlmProviderOptions {
  model?: string;
  temperature?: number;
  /** Override base URL (mis. Ollama custom host). */
  baseUrl?: string;
}
