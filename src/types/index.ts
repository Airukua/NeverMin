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

export type ProviderName = 'gemini' | 'deepseek';

export interface LlmProvider {
  readonly name: ProviderName;
  complete(prompt: string): Promise<string>;
}
