export type SupportedLanguage = 'typescript' | 'tsx' | 'javascript' | 'python';

export interface LanguageConfig {
  wasmPath: string;
  // query tree-sitter beda tiap bahasa karena nama node AST-nya beda
  functionQuery: string;
  classQuery: string;
  interfaceQuery?: string;
}

const TS_LIKE_FUNCTION_QUERY = [
  '(function_declaration name: (identifier) @name) @func',
  '(variable_declarator name: (identifier) @name value: [(arrow_function) (function_expression)]) @func'
].join('\n');

const TS_LIKE_CLASS_QUERY = '(class_declaration name: (type_identifier) @name) @class';
const JS_CLASS_QUERY = '(class_declaration name: (identifier) @name) @class';
const TS_INTERFACE_QUERY = '(interface_declaration name: (type_identifier) @name) @iface';

const registry: Record<SupportedLanguage, LanguageConfig> = {
  typescript: {
    wasmPath: 'media/grammars/tree-sitter-typescript.wasm',
    functionQuery: TS_LIKE_FUNCTION_QUERY,
    classQuery: TS_LIKE_CLASS_QUERY,
    interfaceQuery: TS_INTERFACE_QUERY
  },
  tsx: {
    wasmPath: 'media/grammars/tree-sitter-tsx.wasm',
    functionQuery: TS_LIKE_FUNCTION_QUERY,
    classQuery: TS_LIKE_CLASS_QUERY,
    interfaceQuery: TS_INTERFACE_QUERY
  },
  javascript: {
    wasmPath: 'media/grammars/tree-sitter-javascript.wasm',
    functionQuery: TS_LIKE_FUNCTION_QUERY,
    classQuery: JS_CLASS_QUERY
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
  if (/\.(jsx|mjs|cjs|js)$/i.test(filePath)) return 'javascript';
  if (filePath.endsWith('.py')) return 'python';
  return null;
}

export function getLanguageConfig(lang: SupportedLanguage): LanguageConfig {
  return registry[lang];
}
