# NeverMIN — TODO

Prioritized from actual code review (not README). Check items off as they land.

---

## P0 — Fix first (bugs / risk)

- [x] **Serialize Tree-sitter parsing** (`src/core/parser/astParser.ts`)
- [x] **Stop global tree-sitter kill-switch** (`astParser.ts`)
- [x] **Fix fake class methods** (`src/core/graph/graphBuilder.ts`)
- [x] **Workspace-relative absolute paths** (`graphBuilder.ts` `toAbsolutePath`)
- [x] **Flow Utama open → real line ranges** (`treeDataProvider.ts` + `extension.ts`)
- [x] **Clear plaintext API key after SecretStorage migrate** (`src/utils/config.ts`)
- [x] **Escape graph panel script payload** (`src/ui/webview/graphPanel.ts`)
- [x] **Analyze repo scale + panel lifecycle** (`src/commands/analyzeRepo.ts`, `graphPanel.ts`)
- [x] **Standalone graph HTTP auth / scope** (`standaloneGraphHtml.ts`)

---

## P1 — Graph & insights quality

- [x] Import edges: `require()`, dynamic `import()`, `export … from`
- [x] Resolve `import * as ns` → `ns.foo` calls
- [x] Fix default-import heuristic (not “first exportable in file”)
- [x] Reduce noisy `calls` / `uses` (keywords, member receivers, false identifiers)
- [x] AST queries: arrows, methods, interfaces, type aliases (`languageRegistry.ts`)
- [x] Wire JS/JSX grammar (or document regex-only clearly)
- [x] Insights Input/Process/Output: less name-regex theater, more topology + folder roles
- [x] Cap / debounce `traceFrom` on dense graphs
- [x] Share symbol parse cache between `analyzeRepoFiles` and `buildRepoGraph`

---

## P2 — Explain / LLM / context

- [x] Symbol-aware chunking: `chunkFile` must not always pass `symbols: []`
- [x] Better BM25 tokenize (camelCase / snake_case split)
- [x] Gemini request timeout (`AbortController`) like DeepSeek
- [x] Do not cache empty LLM responses; bound prompt cache (LRU / max entries)
- [x] Don’t auto-`explainSelection` on every graph node click without confirm / setting
- [x] Progress + cancel for explain; empty-doc guard; clearer API-key errors
- [x] Prompt size cap + light secret redaction before send

---

## P3 — Sidebar / UX

- [x] Nest Results (Flow Utama, Entry, Hubs, Files) instead of one flat dump
- [x] Make “Alur lain”, important files, main symbols openable
- [x] Clear selection command; prune deleted paths from workspaceState
- [x] Error retry should re-run selected-files when that was the last mode
- [x] Show active LLM provider clearly in sidebar
- [x] Expand Results after successful analysis
- [x] Polish Flow Utama visual hierarchy (highest contrib priority for UI)

---

## P4 — Packaging / product

- [x] Add `.vscodeignore`; ensure WASM + cytoscape ship in `.vsix`
- [x] Add `@vscode/vsce` (or `npx`) consistently; verify `npm run package`
- [x] Marketplace fields: `icon`, `repository`, `bugs`, `homepage`, `license` in `package.json`
- [x] `contributes.menus` / `keybindings` / `viewsWelcome`
- [x] Drop or narrow heavy `activationEvents` where redundant
- [x] Prefer SecretStorage-only for API keys (settings as deprecated fallback)
- [x] Fix e2e extension id: `abdul-wahid-rukua.nevermin` (`test/e2e/…`)

---

## P5 — Tests

- [x] Unit: `config` migrate clears settings key
- [x] Unit: method extraction ignores control-flow keywords
- [x] Unit: graph paths with absolute `fsPath` + workspace root
- [x] Unit: insights stages carry real line ranges used by open command
- [x] Integration: analyzeRepo cancel + maxResults (`limitAnalysisFiles` + `gateAnalysisProgress`)
- [x] Smoke: webview HTML escapes `</script>` in payload (`escapeJsonForScript`)
- [x] Cover `extension` / commands / sidebar at least with shallow tests
- [x] Fix e2e activate assertion + assert status / insights shape

---

## Nice to have

- [x] Remove dead `nodePath.ts` or consolidate with `resolveGraphNodeUri`
- [ ] Deduplicate graphPanel ↔ standaloneGraphHtml shared JS (large; deferred)
- [x] VS Code theme sync for graph (respect `activeColorTheme`)
- [x] Settings: max files, model name, temperature
- [x] Ignore-list tweak: don’t exclude real `lib/` / `libs/` source folders blindly (`workspace.ts`)
- [x] Add Marketplace `media/icon.png` (128×128) via `scripts/ensure-marketplace-icon.js` on package

---

## Suggested order for the next sprint

1. ~~P0–P5 + most nice-to-haves~~ ✅  
2. Optional: extract shared Cytoscape UI between graphPanel and standaloneGraphHtml  

---

*Last updated from codebase review. Author: Abdul Wahid Rukua.*
