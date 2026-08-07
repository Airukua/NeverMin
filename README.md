# NeverMIN

**Never Mind the confusion** — a VS Code / Cursor extension to quickly understand unfamiliar codebases.

NeverMIN parses your project, builds a *code graph*, then shows you:

- **Entry points** & **hubs** (heuristic centrality score)
- **Main flow** Input → Process → Output (Mermaid)
- **Learning Mind Map** (exploration order)
- **Explain Code** via LLM (optional)

Repo: [github.com/abdulwahidrukua/NeverMIN](https://github.com/abdulwahidrukua/NeverMIN)

---

## Privacy & security — analyze without leaking your code

NeverMIN is built so you can map a private or proprietary codebase **without sending source to a third party**, as long as you stay on the local path.

### First choice in the sidebar

When you open NeverMIN, the sidebar asks you to pick **before** other features unlock:

| Choice | Meaning |
|--------|---------|
| **Private codebase** | Local-only path: parse/graph/git stay on disk; LLM locked to **Ollama**; cloud API keys are cleared |
| **Public codebase** | Same local tools, plus optional cloud LLM (Gemini, OpenAI, …) when you save a key |

You can change this later under **Settings → Change privacy mode** (`NeverMIN: Choose Private / Public Codebase`).

### What stays on your machine by default

| Step | Where it runs | Leaves your machine? |
|------|----------------|----------------------|
| Parse files (Tree-sitter / fallback) | Local VS Code / Cursor process | **No** |
| Build code graph, entry/hub/flow insights | Local | **No** |
| Mermaid diagrams & Learning Mind Map | Local webview | **No** |
| Git History (churn, owners, co-change) | Local `git` CLI | **No** |
| Sidebar results & logs | Local workspace state / Output channel | **No** |

You can run full structural analysis and Git History **with no API key and no network LLM call**. Your repo is read from disk; nothing is uploaded for that pipeline.

### Fully private LLM mode (recommended for sensitive repos)

1. In the sidebar, choose **Private codebase** (or Command Palette → `NeverMIN: Use Private Codebase Mode`).
2. Install and run [Ollama](https://ollama.com), then pick a model (`NeverMIN: Pilih Model Ollama`).
3. Cloud API keys are cleared automatically; provider switching to Gemini/OpenAI/etc. is blocked until you switch to Public mode.

With Ollama:

- Explain Code / insight narration talks to `127.0.0.1` (or your configured `nevermin.ollamaBaseUrl`) only.
- No cloud API key is required or kept for that session path.
- Your prompts and code snippets are not sent to NeverMIN’s authors or a hosted NeverMIN server — there is none.

### When code *can* leave your machine

Only if **you** choose a **cloud** provider (Gemini, OpenAI, Anthropic, OpenRouter, …) and run an LLM feature (Explain Code, narrative enrichment). Then the prompt (including selected code / insight summaries) goes to **that** provider under **their** terms.

To stay leak-free: keep `nevermin.provider` = `ollama`, or skip LLM features entirely and use graph + Git History alone.

### Practical checklist for a secure setup

```text
1. nevermin.provider = ollama   (auto when Private mode is chosen)
2. nevermin.ollamaBaseUrl = http://127.0.0.1:11434/v1
3. Do not Save API Key while on Ollama / Private mode
4. When finished: sidebar → Settings → Wipe this workspace data
```

**Wipe this workspace data** clears analysis, Git History, file checks, and LLM prompt cache from VS Code `workspaceState` for the current workspace (repo files unchanged). Choose **Full reset** if you also want to re-pick Private/Public.

---

## How to use in VS Code / Cursor

### A. Install permanently in VS Code (recommended)

Marketplace release is not available yet. Install from a local `.vsix` so NeverMIN stays enabled like any other extension (no F5 needed).

#### 1. Build the `.vsix`

Requirements: **Node.js 18+**, **npm**.

```bash
git clone https://github.com/abdulwahidrukua/NeverMIN.git
cd NeverMIN
npm install
npm run package
```

This compiles the extension and writes a file such as `nevermin-0.0.1.vsix` in the repo root (version matches `package.json`).

#### 2. Install into VS Code

**UI**

1. Open **VS Code**.
2. Go to **Extensions** (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Open the `…` menu (top-right of the Extensions view).
4. Choose **Install from VSIX…**.
5. Select the generated `nevermin-*.vsix`.
6. Reload VS Code if prompted.

**CLI**

```bash
code --install-extension ./nevermin-0.0.1.vsix
```

For **Cursor**, use the same VSIX flow in Cursor’s Extensions view, or:

```bash
cursor --install-extension ./nevermin-0.0.1.vsix
```

#### 3. Confirm it is installed

- Extensions list → search **NeverMIN** → it should show as installed and enabled.
- Left **Activity Bar** → NeverMIN icon should appear.
- Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → commands starting with `NeverMIN:` should be listed.

#### 4. Use it on a project

1. **File → Open Folder…** and open the codebase you want to understand (not the NeverMIN extension repo, unless you are analyzing NeverMIN itself).
2. Click the **NeverMIN** icon in the Activity Bar.
3. First run: choose **Private codebase** (local / Ollama only) or **Public codebase** (optional cloud LLM).
4. In the sidebar:
   - **2. Run** → analyze the whole repo, or
   - **3. Select Files** → check files → analyze the selection.
5. After analysis:
   - **4. Structure** → Folder → File → Function; click an item to open the **Functions** graph in the Code Graph webview.
   - **5. Analysis Results** → entry / hub / main flow / mind map.
   - **6. Git History** → optional churn / owners / coupling (needs a git repo).

Optional LLM: Command Palette → `NeverMIN: Pilih LLM Provider` (prefer **Ollama** for private code). See [Everyday workflow](#everyday-workflow) and [Privacy & security](#privacy--security--analyze-without-leaking-your-code).

#### 5. Update or uninstall

- **Update:** pull latest code → `npm run package` → Install from VSIX again (same steps; VS Code replaces the previous version).
- **Uninstall:** Extensions → NeverMIN → **Uninstall**.

### B. Run from source (development)

For hacking on NeverMIN itself (Extension Development Host):

1. Clone and build:

```bash
git clone https://github.com/abdulwahidrukua/NeverMIN.git
cd NeverMIN
npm install
npm run compile
```

2. Open the `NeverMIN` folder in VS Code / Cursor.
3. Press **F5** (*Run Extension*) → an **Extension Development Host** window opens.
4. In that window, go to **File → Open Folder** and select the project you want to analyze.
5. In the left Activity Bar, click the **NeverMIN** icon.

> Development Host is temporary for testing. For daily use, prefer [Install permanently](#a-install-permanently-in-vs-code-recommended) via `.vsix`.

---

## Everyday workflow

### 1. (Optional) Configure language & LLM

In the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Function |
|---------|----------|
| `NeverMIN: Pilih Bahasa / Choose Language` | UI in `id` or `en` |
| `NeverMIN: Pilih LLM Provider` | Gemini, OpenAI, Anthropic, OpenRouter, DeepSeek, Groq, Mistral, Together, xAI, **Ollama (local)** |
| `NeverMIN: Pilih Model Ollama` | Detect installed / loaded Ollama models |
| `NeverMIN: Simpan API Key` | Cloud providers only — stored in SecretStorage (cleared when you switch to Ollama) |

Without a cloud API key, graph analysis, diagrams, and structural Git History still work. For private LLM narration, use **Ollama** (see [Privacy & security](#privacy--security--analyze-without-leaking-your-code)).

### 2. Analyze the repo

In the NeverMIN sidebar:

1. Check the **Status** (workspace open, key configured or not).
2. (Optional) check off files in **Select Files**, or leave it as full-repo.
3. In **Run**, choose whole-repo analysis or the selected files.

Same commands are available via the Command Palette:

- `NeverMIN: Analyze Repo Structure`
- `NeverMIN: Select Files to Analyze`

### 3. Analyze Git History (sidebar only)

Answers: what is alive vs frozen, why the code looks like this, who knows the area, and hidden coupling (files often committed together).

1. Ensure the folder is a **git repository**.
2. In **Run** → **Analyze Git History**, or open **6. Git History** → **Run Git History analysis**.
3. Results stay in the sidebar (no webview):
   - LLM summary (if Ollama or a cloud provider is configured)
   - Alive / Frozen
   - Why it looks like this (commits)
   - Who knows this (owners)
   - Hidden coupling

Command: `NeverMIN: Analisis Git History`

### 4. Read the graph results

In **5. Analysis Results** you'll typically see:

- graph statistics
- **Main Flow** (Input → Process → Output)
- entry points & hubs
- summary / narration (if LLM is enabled)

Open diagrams:

| Command | Content |
|---------|---------|
| `NeverMIN: Open Main Flow (Mermaid)` | flowchart of the main data flow |
| `NeverMIN: Open Insight Graph` | architecture / module / functions panel |
| `NeverMIN: Open Learning Mind Map` | mind map of learning order |
| `NeverMIN: Open Insights Summary` | insights narration |
| `NeverMIN: Buka Ringkasan Git History` | Git History narration |

Or use **4. Structure**: expand Folder → File → Function and click an item to open the focused **Functions** graph.

Click a node / insight chip to jump to the related file.

### 5. Explain a code snippet

1. Select code in the editor (or focus the active file).
2. Command Palette → `NeverMIN: Jelaskan Kode Ini`.

Uses the active provider. For a private repo, prefer **Ollama** so the snippet never hits a cloud API.

---

## Settings

Open **Settings** and search for `nevermin`, or run `NeverMIN: Open Settings`.

| Setting | Description |
|---------|--------------|
| `nevermin.language` | `id` \| `en` |
| `nevermin.provider` | LLM provider |
| `nevermin.model` | Override model (empty = provider default) |
| `nevermin.temperature` | Generation temperature |
| `nevermin.maxAnalysisFiles` | File limit during analysis |
| `nevermin.ollamaBaseUrl` | Ollama OpenAI-compatible base URL (default local) |
| `nevermin.apiKey` | Cloud fallback only — avoided when using Ollama (keys are cleared) |

---

## Other commands

| Command | Function |
|---------|----------|
| `NeverMIN: Refresh Sidebar` | Reload the sidebar tree |
| `NeverMIN: Buka Output Logs` | NeverMIN log channel |
| `NeverMIN: Bersihkan Logs` | Clear activity log |
| `NeverMIN: Centang Semua File` / `Kosongkan Centang File` | File selection for analysis |
| `NeverMIN: Pilih Model Ollama` | List & select local Ollama models |

---

## Parsed languages

| Extension | Parser |
|-----------|--------|
| `.ts` | Tree-sitter TypeScript |
| `.tsx` | Tree-sitter TSX |
| `.py` | Tree-sitter Python |
| `.js` / `.jsx` | Regex fallback |

If the Tree-sitter WASM fails to load, symbol extraction still falls back and works.

---

## Development scripts

| Script | Function |
|--------|----------|
| `npm run compile` | Build `src/` → `dist/` |
| `npm run watch` | Auto-rebuild |
| `npm test` | Unit tests |
| `npm run copy-grammars` | Copy Tree-sitter WASM grammars |
| `npm run package` | Create `.vsix` |

`npm install` runs a `postinstall` step that copies grammars into `media/grammars/`.

---

## Quick note

Insights (entry / hub / flow) are based on heuristic graph analysis (degree + centrality), **not** formal proof of data flow. Good for an onboarding map, not a replacement for a full architecture review.

---

## License

[MIT](LICENSE)

**Abdul Wahid Rukua** — [GitHub](https://github.com/abdulwahidrukua)