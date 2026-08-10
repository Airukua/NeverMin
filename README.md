<div align="center">

<img src="media/icon.png" alt="NeverMIN logo" width="96" height="96" />

# NeverMIN

**Never Mind the confusion.**
A VS Code / Cursor extension that parses your project, builds a code graph, and shows you where to start.

[![Marketplace](https://img.shields.io/badge/VS%20Code-Install-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=abdul-wahid-rukua.nevermin)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Privacy: Local-first](https://img.shields.io/badge/Privacy-Local--first-brightgreen)](#-privacy--security)
<br>
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=fff)

**[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=abdul-wahid-rukua.nevermin)** · [Quick Start](#-quick-start) · [Privacy & Security](#-privacy--security) · [Commands](#-commands-reference) · [Settings](#%EF%B8%8F-settings)

</div>

---

## ✨ What NeverMIN does

| Feature | Description |
|---|---|
| 🧭 **Entry points & hubs** | Heuristic centrality score highlights where to start reading |
| 🔀 **Main flow diagram** | Mermaid flowchart of Input → Process → Output |
| 🗺️ **Learning Mind Map** | Suggested exploration order for onboarding |
| 💬 **Explain Code** | Optional LLM narration — local (Ollama) or cloud |
| 📜 **Git History insight** | Alive/frozen code, ownership, hidden file coupling |

> Insights are based on heuristic graph analysis (degree + centrality) — a great onboarding map, not a substitute for a full architecture review.

Repo: [github.com/abdulwahidrukua/NeverMIN](https://github.com/abdulwahidrukua/NeverMIN)

---

## 🔒 Privacy & Security

NeverMIN is built so you can map a **private or proprietary codebase without sending source to a third party** — as long as you stay on the local path.

### Step 1: pick a mode in the sidebar

The sidebar asks you to choose **before** other features unlock. Change it any time via **Settings → Change privacy mode** (`NeverMIN: Choose Private / Public Codebase`).

| Mode | Behavior |
|---|---|
| 🔐 **Private codebase** | Local-only: parse/graph/git stay on disk · LLM locked to **Ollama** · cloud API keys cleared |
| 🌐 **Public codebase** | Same local tools, plus optional cloud LLM (Gemini, OpenAI, …) once you save a key |

### What never leaves your machine (either mode)

| Step | Runs where | Leaves your machine? |
|---|---|---|
| Parse files (Tree-sitter / fallback) | Local process | ❌ No |
| Build code graph, entry/hub/flow insights | Local | ❌ No |
| Mermaid diagrams & Mind Map | Local webview | ❌ No |
| Git History (churn, owners, co-change) | Local `git` CLI | ❌ No |
| Sidebar results & logs | Local workspace state | ❌ No |

Full structural analysis and Git History run **with no API key and no network LLM call**.

<details>
<summary><strong>🔐 Fully private LLM mode (recommended for sensitive repos)</strong></summary>

<br>

1. In the sidebar, choose **Private codebase** (or Command Palette → `NeverMIN: Use Private Codebase Mode`).
2. Install and run [Ollama](https://ollama.com), then pick a model (`NeverMIN: Pilih Model Ollama`).
3. Cloud API keys are cleared automatically; switching to Gemini/OpenAI/etc. is blocked until you switch to Public mode.

With Ollama:
- Explain Code / insight narration talks to `127.0.0.1` (or your configured `nevermin.ollamaBaseUrl`) **only**.
- No cloud API key is required or kept for that session path.
- Prompts and code snippets are never sent to NeverMIN's authors or a hosted server — there is none.

</details>

<details>
<summary><strong>⚠️ When code <em>can</em> leave your machine</strong></summary>

<br>

Only if **you** choose a **cloud** provider (Gemini, OpenAI, Anthropic, OpenRouter, …) and run an LLM feature (Explain Code, narrative enrichment). The prompt — including selected code / insight summaries — then goes to **that** provider under **their** terms.

To stay leak-free: keep `nevermin.provider = ollama`, or skip LLM features entirely and use graph + Git History alone.

</details>

### Secure setup checklist

```text
1. nevermin.provider = ollama   (auto when Private mode is chosen)
2. nevermin.ollamaBaseUrl = http://127.0.0.1:11434/v1
3. Do not Save API Key while on Ollama / Private mode
4. When finished: sidebar → Settings → Wipe this workspace data
```

> **Wipe this workspace data** clears analysis, Git History, file checks, and LLM prompt cache from VS Code `workspaceState` for the current workspace — repo files are untouched. Choose **Full reset** to also re-pick Private/Public.

---

## 🚀 Quick Start

### A. Install from the Marketplace *(recommended)*

<table>
<tr><td width="50%" valign="top">

**VS Code**
1. Open Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search **NeverMIN**
3. Click **Install**, reload if prompted

</td><td width="50%" valign="top">

**Cursor**

Extensions → search **NeverMIN** → **Install**.
If it doesn't appear, use [Install from VSIX](#b-install-from-vsix-optional).

</td></tr>
</table>

**Confirm it's installed:** Extensions list shows NeverMIN enabled → NeverMIN icon appears in the Activity Bar → Command Palette lists `NeverMIN:` commands.

### Use it on a project

1. **File → Open Folder…** and open the codebase you want to understand.
2. Click the **NeverMIN** icon in the Activity Bar.
3. First run → choose **Private codebase** (local / Ollama only) or **Public codebase** (optional cloud LLM).
4. In the sidebar: **2. Run** (analyze whole repo) or **3. Select Files** (analyze a selection).
5. After analysis:
   - **4. Structure** → Folder → File → Function → click to open the **Functions** graph
   - **5. Analysis Results** → entry / hub / main flow / mind map
   - **6. Git History** → optional churn / owners / coupling *(needs a git repo)*

Optional LLM: Command Palette → pick a provider (prefer **Ollama** for private code).

<details>
<summary><strong>B. Install from VSIX</strong> <sub>(local build, pre-release, or no Marketplace access)</sub></summary>

<br>

Requirements: **Node.js 18+**, **npm**

```bash
git clone https://github.com/abdulwahidrukua/NeverMIN.git
cd NeverMIN
npm install
npm run package
```

Writes `nevermin-<version>.vsix` in the repo root.

**UI:** Extensions → `…` → **Install from VSIX…** → select the `.vsix` → reload if prompted.

**CLI:**
```bash
code --install-extension ./nevermin-0.0.2.vsix
# or, for Cursor:
cursor --install-extension ./nevermin-0.0.2.vsix
```

**Update / uninstall**
- Marketplace: Extensions → NeverMIN → Update / Uninstall
- VSIX: rebuild with `npm run package` and reinstall (replaces previous version), or Uninstall from Extensions

</details>

<details>
<summary><strong>C. Run from source</strong> <sub>(for hacking on NeverMIN itself)</sub></summary>

<br>

```bash
git clone https://github.com/abdulwahidrukua/NeverMIN.git
cd NeverMIN
npm install
npm run compile
```

1. Open the `NeverMIN` folder in VS Code / Cursor.
2. Press **F5** (*Run Extension*) → an **Extension Development Host** window opens.
3. In that window: **File → Open Folder** → select the project you want to analyze.
4. Click the **NeverMIN** icon in the Activity Bar.

> Development Host is for testing only — for daily use, prefer [installing from the Marketplace](#a-install-from-the-marketplace-recommended).

</details>

---

## 🔄 Everyday Workflow

<table>
<tr><td width="34px" align="center"><strong>1</strong></td><td>

**(Optional) Configure language & LLM** — Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Function |
|---|---|
| `NeverMIN: Pilih Bahasa / Choose Language` | UI in `id` or `en` |
| `NeverMIN: Pilih LLM Provider` | Gemini, OpenAI, Anthropic, OpenRouter, DeepSeek, Groq, Mistral, Together, xAI, **Ollama (local)** |
| `NeverMIN: Pilih Model Ollama` | Detect installed / loaded Ollama models |
| `NeverMIN: Simpan API Key` | Cloud providers only — stored in SecretStorage, cleared when you switch to Ollama |

Without a cloud key, graph analysis, diagrams, and structural Git History still work.

</td></tr>
<tr><td align="center"><strong>2</strong></td><td>

**Analyze the repo** — in the sidebar: check **Status**, optionally check off files in **Select Files**, then **Run** (whole repo or selection).
Same via Command Palette: `NeverMIN: Analyze Repo Structure` · `NeverMIN: Select Files to Analyze`

</td></tr>
<tr><td align="center"><strong>3</strong></td><td>

**Analyze Git History** *(sidebar only)* — answers what's alive vs. frozen, why the code looks like this, who knows the area, and hidden coupling.
1. Ensure the folder is a git repository.
2. **Run → Analyze Git History**, or open **6. Git History → Run Git History analysis**.
3. Results stay in the sidebar: LLM summary (if configured) · Alive/Frozen · Commits · Owners · Hidden coupling

Command: `NeverMIN: Analisis Git History`

</td></tr>
<tr><td align="center"><strong>4</strong></td><td>

**Read the graph results** — **5. Analysis Results** shows graph statistics, Main Flow, entry points/hubs, and narration (if LLM enabled).

| Command | Content |
|---|---|
| `NeverMIN: Open Main Flow (Mermaid)` | Flowchart of the main data flow |
| `NeverMIN: Open Insight Graph` | Architecture / module / functions panel |
| `NeverMIN: Open Learning Mind Map` | Mind map of learning order |
| `NeverMIN: Open Insights Summary` | Insights narration |
| `NeverMIN: Buka Ringkasan Git History` | Git History narration |

Or use **4. Structure**: expand Folder → File → Function, click to open the focused **Functions** graph. Click a node / insight chip to jump to the related file.

</td></tr>
<tr><td align="center"><strong>5</strong></td><td>

**Explain a code snippet** — select code in the editor (or focus the active file), then Command Palette → `NeverMIN: Jelaskan Kode Ini`.
For a private repo, prefer **Ollama** so the snippet never hits a cloud API.

</td></tr>
</table>

---

## ⚙️ Settings

Open **Settings** and search `nevermin`, or run `NeverMIN: Open Settings`.

> Privacy mode (**Private / Public**) is **not** a VS Code setting — it's chosen in the NeverMIN sidebar, per workspace. Private mode locks the provider to Ollama and clears cloud API keys.

| Setting | Default | Description |
|---|---|---|
| `nevermin.language` | `id` | UI + LLM language (`id` \| `en`) |
| `nevermin.provider` | `ollama` | LLM provider — Private mode forces `ollama`; Public allows cloud providers |
| `nevermin.model` | *(empty)* | Model override; empty = provider default. For Ollama prefer `NeverMIN: Pilih Model Ollama` |
| `nevermin.temperature` | `0.2` | LLM sampling temperature |
| `nevermin.ollamaBaseUrl` | `http://127.0.0.1:11434/v1` | Ollama OpenAI-compatible base URL |
| `nevermin.maxAnalysisFiles` | `500` | Cap on files per analysis run |

API keys are **not** a VS Code setting — use `NeverMIN: Simpan API Key` (SecretStorage, per provider). Switching to Private / Ollama clears cloud keys automatically.

The sidebar **Pengaturan** panel mirrors the important actions: privacy mode, language, provider, API key / Ollama model, wipe workspace data.

---

## 📖 Commands Reference

<details>
<summary><strong>Show all other commands</strong></summary>

<br>

| Command | Function |
|---|---|
| `NeverMIN: Refresh Sidebar` | Reload the sidebar tree |
| `NeverMIN: Buka Output Logs` | NeverMIN log channel |
| `NeverMIN: Bersihkan Logs` | Clear activity log |
| `NeverMIN: Centang Semua File` / `Kosongkan Centang File` | File selection for analysis |
| `NeverMIN: Pilih Model Ollama` | List & select local Ollama models |

</details>

## 🧩 Parsed Languages

> **Current scope:** NeverMIN currently supports the **JavaScript family** (JS/JSX/TS/TSX) and **Python** only. Other languages are not yet parsed — support for more is on the roadmap.

| | Extension | Parser |
|---|---|---|
| ![JS](https://img.shields.io/badge/-F7DF1E?logo=javascript&logoColor=000) | `.js` / `.jsx` | Regex fallback |
| ![TS](https://img.shields.io/badge/-3178C6?logo=typescript&logoColor=fff) | `.ts` | Tree-sitter TypeScript |
| ![TSX](https://img.shields.io/badge/-3178C6?logo=react&logoColor=fff) | `.tsx` | Tree-sitter TSX |
| ![Python](https://img.shields.io/badge/-3776AB?logo=python&logoColor=fff) | `.py` | Tree-sitter Python |

If the Tree-sitter WASM fails to load, symbol extraction still falls back and works.

## 🛠️ Development Scripts

| Script | Function |
|---|---|
| `npm run compile` | Build `src/` → `dist/` |
| `npm run watch` | Auto-rebuild |
| `npm test` | Unit tests |
| `npm run copy-grammars` | Copy Tree-sitter WASM grammars |
| `npm run package` | Create `.vsix` |

`npm install` runs a `postinstall` step that copies grammars into `media/grammars/`.

---

<div align="center">

**[MIT License](LICENSE)** · Built by **[Abdul Wahid Rukua](https://github.com/abdulwahidrukua)**

</div>