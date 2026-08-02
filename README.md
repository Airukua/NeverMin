<div align="center">

# 🧭 NeverMIN

**Never Mind the confusion — an onboarding buddy for unfamiliar codebases.**

*Parses your project, builds a code graph, and shows you the main Input → Process → Output flow.*

[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.90.0-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/api)
[![Node.js 20+](https://img.shields.io/badge/node-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tree-sitter](https://img.shields.io/badge/parser-Tree--sitter-4B8BBE?style=flat-square)](https://github.com/tree-sitter/tree-sitter)
[![Providers](https://img.shields.io/badge/LLM-Gemini%20%7C%20DeepSeek-8A2BE2?style=flat-square)](#4-explain-code)
[![License](https://img.shields.io/badge/license-TBD-lightgrey?style=flat-square)](#license)

</div>

---

NeverMIN is a VS Code extension that acts like an onboarding buddy for unfamiliar codebases. It parses your project, builds a code relationship graph, infers the main **Input → Process → Output** data flow, and helps you explain code with an LLM (Gemini or DeepSeek).

Joining a new repo often feels like noise: too many files, unclear entry points, and no obvious "where does data come in / go out?" NeverMIN focuses on closing that gap.

| Goal | What you get |
|------|----------------|
| Speed up understanding | Repo analysis + graph + insights in one sidebar |
| Reduce confusion | Main data flow shown as **Input → Process → Output** |
| Stay in the editor | Explain selection, open symbols from the graph, open graph in the browser |
| Optional AI narrative | LLM summary when an API key is configured |

> 📖 **Marketplace release coming soon.**

---

## Install

```bash
git clone <your-repo-url> NeverMIN
cd NeverMIN
npm install
npm run compile
```

`npm install` runs `postinstall` to copy Tree-sitter WASM grammars into `media/grammars/`.

Then in VS Code:

1. Open this folder
2. Press **F5** (`Run Extension`) to launch the Extension Development Host
3. Open a workspace you want to explore
4. Open the **NeverMIN** activity bar view

| Script | Purpose |
|--------|---------|
| `npm run compile` | Build `src/` → `dist/` |
| `npm run watch` | Rebuild on change |
| `npm test` | Unit tests |
| `npm run copy-grammars` | Refresh Tree-sitter WASM files |
| `npm run package` | Package the `.vsix` |

---

## Quick Start

### 1. Configure a provider (optional but recommended)

In the NeverMIN sidebar → **Settings**, or Command Palette:

- `NeverMIN: Simpan API Key`
- `NeverMIN: Pakai Gemini` / `NeverMIN: Pakai DeepSeek`

Settings keys:

```yaml
nevermin.provider: gemini   # gemini | deepseek
nevermin.apiKey: ""         # fallback only; prefer SecretStorage via the command above
```

### 2. Analyze the repo

1. Open **Status** to confirm workspace + API key state
2. Optionally check files under **Pilih File**
3. Under **Jalankan**, run full-repo or selected-file analysis
4. Open **Hasil Analisis** for stats, **Flow Utama (Data)**, entry points, hubs, and more

### 3. Explore the graph

- Open the graph panel from analysis results
- Default view is **overview** (files + cross-file relations)
- Switch to **detail** for functions/classes
- Click **Flow Utama** / insight items in the sidebar to jump to related code
- Use **Buka di Browser** for a larger canvas

### 4. Explain code

Select code (or rely on the active file) and run:

```text
NeverMIN: Jelaskan Kode Ini
```

---

## Main Data Flow

After analysis, NeverMIN tries to present the application's primary path as:

```text
Input   →  where data enters (forms, pickers, handlers, …)
Process →  transforms / services / utils in the middle
Output  →  where results appear (tables, views, dashboards, …)
```

This is heuristic (names, paths, and graph edges) — an onboarding map, not a formal data-flow proof.

---

## Architecture

```text
workspace
  → parse (Tree-sitter + regex fallback)
  → graph (symbols & relations)
  → insights (entry / hub / Input→Output flow)
  → UI (sidebar + Cytoscape webview)
  → optional LLM (explain + narrative)
```

### Folder layout

| Path | Role |
|------|------|
| `src/extension.ts` | Activation, commands wiring |
| `src/commands/` | Explain / analyze commands |
| `src/core/parser/` | Language registry + AST / symbol extraction |
| `src/core/graph/` | Graph build, traversal, insights |
| `src/core/analysis/` | Repo analysis aggregation |
| `src/core/context/` | Chunking for LLM context |
| `src/core/llm/` | Providers, prompts, retry / rate limit |
| `src/ui/sidebar/` | Onboarding tree view |
| `src/ui/webview/` | Graph panel, themes, standalone browser HTML |
| `src/utils/` | Config, workspace, logger |
| `media/` | Icon + Tree-sitter grammars |
| `scripts/copy-grammars.js` | Copies WASM grammars after install |
| `test/` | Unit and e2e tests |

Core business logic under `src/core/` avoids importing `vscode` so it stays unit-testable.

### Supported languages (parser)

| Extension | Grammar |
|-----------|---------|
| `.ts` | TypeScript |
| `.tsx` | TSX |
| `.py` | Python |
| `.js` / `.jsx` | Regex fallback (no dedicated grammar wired yet) |

If WASM loading fails in a given environment, NeverMIN falls back to a simple regex symbol extractor so analysis still runs.

---

## Contributing

Contributions are welcome — especially if you care about developer experience.

**Highest priority: UI**

- Sidebar clarity and visual hierarchy (especially **Flow Utama**)
- Graph readability (layout, density, light mode polish)
- Empty / loading / error states that feel intentional
- Browser graph experience
- Accessibility and responsive layout inside the webview

If you want to contribute and are unsure where to start: **pick UI**.

**Other welcome areas**

- Stronger Input → Output flow heuristics
- Better import / call / JSX edge detection
- Retrieval / ranking for explain-context chunks
- Tests around graph insights and parser edge cases
- Docs and examples for common stacks (Next.js, Nest, Django, …)

**Suggested workflow**

1. Fork and create a branch
2. `npm install && npm run compile && npm test`
3. Keep `src/core` free of `vscode` imports when possible
4. Describe the UX problem you solved in the PR

---

## Roadmap

- [ ] Richer UI for main flow and graph overview
- [ ] More language grammars (JavaScript / JSX first)
- [ ] Symbol-aware retrieval for explanations
- [ ] Stable Tree-sitter loading across Windows / WSL / remote hosts
- [ ] Publish a polished Marketplace release

---

## Citation

```bibtex
@software{nevermin2026,
  author = {Abdul Wahid Rukua},
  title  = {NeverMIN: Never Mind the confusion — I'm gonna use this to speed up understanding},
  year   = {2026},
  url    = {https://github.com/}
}
```

---

## License

Specify your preferred license in this repository (for example MIT) before publishing publicly. Until then, treat the project as authored by **Abdul Wahid Rukua** and request permission for redistribution if unclear.

---

## Author

**Abdul Wahid Rukua**

Built with:

- [VS Code Extension API](https://code.visualstudio.com/api)
- [web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web) + [tree-sitter-wasms](https://www.npmjs.com/package/tree-sitter-wasms)
- [Cytoscape.js](https://js.cytoscape.org/)

[![GitHub](https://img.shields.io/badge/GitHub-Abdul%20Wahid%20Rukua-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/)

---

<p align="center">
  <strong>NeverMIN</strong><br />
  <em>Never Mind the confusion — I'm gonna use this to speed up understanding.</em><br /><br />
  Author: <strong>Abdul Wahid Rukua</strong>
</p>