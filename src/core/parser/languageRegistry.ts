export type SupportedLanguage = 'typescript' | 'tsx' | 'python';

export interface LanguageConfig {
  wasmPath: string;
  // query tree-sitter beda tiap bahasa karena nama node AST-nya beda
  functionQuery: string;
  classQuery: string;
}

const TS_FUNCTION_QUERY = '(function_declaration name: (identifier) @name) @func';
const TS_CLASS_QUERY = '(class_declaration name: (type_identifier) @name) @class';

const registry: Record<SupportedLanguage, LanguageConfig> = {
  typescript: {
    wasmPath: 'media/grammars/tree-sitter-typescript.wasm',
    functionQuery: TS_FUNCTION_QUERY,
    classQuery: TS_CLASS_QUERY
  },
  tsx: {
    // .tsx butuh grammar TSX; typescript.wasm sering gagal parse JSX
    wasmPath: 'media/grammars/tree-sitter-tsx.wasm',
    functionQuery: TS_FUNCTION_QUERY,
    classQuery: TS_CLASS_QUERY
  },
  python: {
    wasmPath: 'media/grammars/tree-sitter-python.wasm',
    functionQuery: '(function_definition name: (identifier) @name) @func',
    classQuery: '(class_definition name: (identifier) @name) @class'
  }
};

export function detectLanguage(filePath: string): SupportedLanguage | null {
  if (filePath.endsWith('.tsx')) return 'tsx';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.py')) return 'python';
  return null; // bahasa belum didukung -> astParser skip file ini
}

export function getLanguageConfig(lang: SupportedLanguage): LanguageConfig {
  return registry[lang];
}
