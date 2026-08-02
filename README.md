# NeverMIN

> **Never Mind the confusion — I’m gonna use this to speed up understanding.**

NeverMIN is a VS Code extension that acts like an onboarding buddy for unfamiliar codebases. It parses your project, builds a code relationship graph, infers the main **Input → Process → Output** data flow, and helps you explain code with an LLM (Gemini or DeepSeek).

---

## Citation

If you use, fork, or reference this project, please cite it as:

```text
NeverMIN — Never Mind the confusion — I’m gonna use this to speed up understanding.
Author: Abdul Wahid Rukua
```

**Author:** [Abdul Wahid Rukua](https://github.com/)

---

## Why NeverMIN?

Joining a new repo often feels like noise: too many files, unclear entry points, and no obvious “where does data come in / go out?”

NeverMIN focuses on that gap:

| Goal | What you get |
|------|----------------|
| Speed up understanding | Repo analysis + graph + insights in one sidebar |
| Reduce confusion | Main data flow shown as **Input → Process → Output** |
| Stay in the editor | Explain selection, open symbols from the graph, open graph in the browser |
| Optional AI narrative | LLM summary when an API key is configured |

---

## Features

- **Sidebar onboarding flow** — status, run analysis, select files, view results, settings
- **Repo / selected-file analysis** — folder overview, important files, symbol counts
- **Code graph (Cytoscape)** — files & symbols with `imports`, `calls`, `uses`, `defines`
- **Graph Insights** — entry points, hubs, orphan files, and **main data flow**
- **Main flow in the sidebar** — explicit Input / Process / Output for onboarding
- **Light & dark graph themes** — compact overview mode (files) and detail mode (symbols)
- **Open graph in browser** — full-screen view outside the VS Code webview
- **Explain selection** — context chunks + Gemini / DeepSeek
- **Secure API keys** — primary storage in VS Code `SecretStorage`

---

## Requirements

- VS Code `^1.90.0` (or compatible forks)
- Node.js 20+ recommended for development
- Optional: Gemini or DeepSeek API key for explanations and narrative insights

---

## Quick start (development)

```bash
git clone <your-repo-url> NeverMIN
cd NeverMIN
npm install
npm run compile
```

Then in VS Code:

1. Open this folder
2. Press **F5** (`Run Extension`) to launch the Extension Development Host
3. Open a workspace you want to explore
4. Open the **NeverMIN** activity bar view

`npm install` runs `postinstall` to copy Tree-sitter WASM grammars into `media/grammars/`.

Useful scripts:

| Script | Purpose |
|--------|---------|
| `npm run compile` | Build `src/` → `dist/` |
| `npm run watch` | Rebuild on change |
| `npm test` | Unit tests |
| `npm run copy-grammars` | Refresh Tree-sitter WASM files |
| `npm run package` | Package the `.vsix` |

---

## Usage

### 1. Configure a provider (optional but recommended)

In the NeverMIN sidebar → **Settings**, or Command Palette:

- `NeverMIN: Simpan API Key`
- `NeverMIN: Pakai Gemini` / `NeverMIN: Pakai DeepSeek`

Settings keys:

- `nevermin.provider` — `gemini` | `deepseek`
- `nevermin.apiKey` — fallback only; prefer SecretStorage via the command above

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

- `NeverMIN: Jelaskan Kode Ini`

---

## Main data flow (sidebar)

After analysis, NeverMIN tries to present the application’s primary path as:

```text
Input   →  where data enters (forms, pickers, handlers, …)
Process →  transforms / services / utils in the middle
Output  →  where results appear (tables, views, dashboards, …)
```

This is heuristic (names, paths, and graph edges). It is meant as an onboarding map, not a formal data-flow proof.

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

---

## Supported languages (parser)

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

### Highest priority: UI

The most needed help right now is **UI**:

- Sidebar clarity and visual hierarchy (especially **Flow Utama**)
- Graph readability (layout, density, light mode polish)
- Empty / loading / error states that feel intentional
- Browser graph experience
- Accessibility and responsive layout inside the webview

If you want to contribute and are unsure where to start: **pick UI**.

### Other welcome areas

- Stronger Input → Output flow heuristics
- Better import / call / JSX edge detection
- Retrieval / ranking for explain-context chunks
- Tests around graph insights and parser edge cases
- Docs and examples for common stacks (Next.js, Nest, Django, …)

### Suggested workflow

1. Fork and create a branch  
2. `npm install && npm run compile && npm test`  
3. Keep `src/core` free of `vscode` imports when possible  
4. Describe the UX problem you solved in the PR  

---

## Roadmap (high level)

- [ ] Richer UI for main flow and graph overview  
- [ ] More language grammars (JavaScript / JSX first)  
- [ ] Symbol-aware retrieval for explanations  
- [ ] Stable Tree-sitter loading across Windows / WSL / remote hosts  
- [ ] Publish a polished Marketplace release  

---

## License

Specify your preferred license in this repository (for example MIT) before publishing publicly. Until then, treat the project as authored by **Abdul Wahid Rukua** and request permission for redistribution if unclear.

---

## Acknowledgements

Built with:

- [VS Code Extension API](https://code.visualstudio.com/api)
- [web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web) + [tree-sitter-wasms](https://www.npmjs.com/package/tree-sitter-wasms)
- [Cytoscape.js](https://js.cytoscape.org/)

---

<p align="center">
  <strong>NeverMIN</strong><br />
  <em>Never Mind the confusion — I’m gonna use this to speed up understanding.</em><br /><br />
  Author: <strong>Abdul Wahid Rukua</strong>
</p>
