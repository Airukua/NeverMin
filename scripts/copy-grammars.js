#!/usr/bin/env node
/**
 * Copy tree-sitter language WASM files into media/grammars for the extension.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'node_modules', 'tree-sitter-wasms', 'out');
const targetDir = path.join(root, 'media', 'grammars');

const files = [
  'tree-sitter-typescript.wasm',
  'tree-sitter-tsx.wasm',
  'tree-sitter-python.wasm',
  'tree-sitter-javascript.wasm'
];

if (!fs.existsSync(sourceDir)) {
  console.warn(`[copy-grammars] Skip: ${sourceDir} not found`);
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const from = path.join(sourceDir, file);
  const to = path.join(targetDir, file);
  if (!fs.existsSync(from)) {
    console.warn(`[copy-grammars] Missing source: ${file}`);
    continue;
  }
  fs.copyFileSync(from, to);
  console.log(`[copy-grammars] ${file}`);
}
