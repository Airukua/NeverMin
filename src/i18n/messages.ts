export type MessageKey =
  | 'lang.label'
  | 'lang.current'
  | 'lang.pickTitle'
  | 'lang.changed'
  | 'sidebar.section.status'
  | 'sidebar.section.actions'
  | 'sidebar.section.files'
  | 'sidebar.section.structure'
  | 'sidebar.section.results'
  | 'sidebar.section.gitHistory'
  | 'sidebar.section.logs'
  | 'sidebar.section.settings'
  | 'sidebar.status.openFolderFirst'
  | 'sidebar.status.noCodeFiles'
  | 'sidebar.status.apiKeyMissing'
  | 'sidebar.status.analyzing'
  | 'sidebar.status.ready'
  | 'sidebar.actions.analyzeN'
  | 'sidebar.actions.analyzeOrExplain'
  | 'sidebar.results.running'
  | 'sidebar.results.failed'
  | 'sidebar.results.ready'
  | 'sidebar.results.none'
  | 'sidebar.results.rerun'
  | 'sidebar.results.rerunHint'
  | 'sidebar.results.rerunTooltip'
  | 'sidebar.results.clear'
  | 'sidebar.results.clearHint'
  | 'sidebar.results.clearTooltip'
  | 'sidebar.results.savedAt'
  | 'results.cleared'
  | 'results.alreadyEmpty'
  | 'git.cleared'
  | 'git.alreadyEmpty'
  | 'sidebar.logs.running'
  | 'sidebar.logs.count'
  | 'sidebar.logs.empty'
  | 'sidebar.files.checked'
  | 'sidebar.files.checkTarget'
  | 'sidebar.folder.selected'
  | 'sidebar.folder.files'
  | 'sidebar.folder.checkboxHint'
  | 'sidebar.apiKey.ok'
  | 'sidebar.apiKey.fallback'
  | 'sidebar.apiKey.missing'
  | 'sidebar.apiKey.tooltip.ok'
  | 'sidebar.apiKey.tooltip.fallback'
  | 'sidebar.apiKey.tooltip.missing'
  | 'sidebar.workspace.ready'
  | 'sidebar.workspace.notReady'
  | 'sidebar.workspace.codeFiles'
  | 'sidebar.workspace.codeFilesMany'
  | 'sidebar.workspace.openProject'
  | 'sidebar.workspace.readyHint'
  | 'sidebar.workspace.openHint'
  | 'sidebar.selection.count'
  | 'sidebar.selection.none'
  | 'sidebar.selection.hint'
  | 'sidebar.selection.tooltip'
  | 'sidebar.analysis.running'
  | 'sidebar.analysis.failed'
  | 'sidebar.analysis.hasResult'
  | 'sidebar.analysis.none'
  | 'sidebar.analysis.wait'
  | 'sidebar.action.openFolderRequired'
  | 'sidebar.action.openFolderRequiredHint'
  | 'sidebar.action.analyzeSelected'
  | 'sidebar.action.analyzeSelectedN'
  | 'sidebar.action.recommended'
  | 'sidebar.action.checkFirst'
  | 'sidebar.action.analyzeSelectedHint'
  | 'sidebar.action.analyzeSelectedEmptyHint'
  | 'sidebar.action.analyzeRepo'
  | 'sidebar.action.analyzeRepoHint'
  | 'sidebar.action.analyzeGit'
  | 'sidebar.action.analyzeGitHint'
  | 'sidebar.action.explain'
  | 'sidebar.action.explainHint'
  | 'sidebar.action.saveApiKey'
  | 'sidebar.action.openSettings'
  | 'sidebar.action.pickProvider'
  | 'sidebar.action.pickLanguage'
  | 'sidebar.files.selectAll'
  | 'sidebar.files.clear'
  | 'sidebar.logs.open'
  | 'sidebar.logs.openDetail'
  | 'sidebar.logs.openTooltip'
  | 'sidebar.logs.clear'
  | 'sidebar.logs.none'
  | 'sidebar.logs.noneHint'
  | 'sidebar.git.running'
  | 'sidebar.git.failed'
  | 'sidebar.git.ready'
  | 'sidebar.git.none'
  | 'sidebar.git.run'
  | 'sidebar.git.runHint'
  | 'sidebar.git.rerun'
  | 'sidebar.git.rerunHint'
  | 'sidebar.git.rerunTooltip'
  | 'sidebar.git.clear'
  | 'sidebar.git.clearHint'
  | 'sidebar.git.clearTooltip'
  | 'sidebar.git.scanning'
  | 'sidebar.git.retry'
  | 'sidebar.git.noneDetail'
  | 'sidebar.git.noneHint'
  | 'sidebar.git.narrative'
  | 'sidebar.git.narrativeHint'
  | 'sidebar.git.stats'
  | 'sidebar.git.alive'
  | 'sidebar.git.aliveMeta'
  | 'sidebar.git.frozen'
  | 'sidebar.git.frozenMeta'
  | 'sidebar.git.why'
  | 'sidebar.git.owners'
  | 'sidebar.git.ownerMeta'
  | 'sidebar.git.coupling'
  | 'sidebar.git.couplingMeta'
  | 'git.notRepo'
  | 'git.noCommits'
  | 'git.done'
  | 'git.error'
  | 'git.noNarrative'
  | 'ollama.detecting'
  | 'ollama.detectFail'
  | 'ollama.noModels'
  | 'ollama.pickTitle'
  | 'ollama.pickPlaceholder'
  | 'ollama.pickPlaceholderRunning'
  | 'ollama.modelSet'
  | 'ollama.keysCleared'
  | 'ollama.apiKeyBlocked'
  | 'privacy.gate.title'
  | 'privacy.gate.subtitle'
  | 'privacy.gate.tooltip'
  | 'privacy.gate.banner'
  | 'privacy.pickTitle'
  | 'privacy.pickPlaceholder'
  | 'privacy.private.label'
  | 'privacy.private.badge'
  | 'privacy.private.detail'
  | 'privacy.private.applied'
  | 'privacy.public.label'
  | 'privacy.public.badge'
  | 'privacy.public.detail'
  | 'privacy.public.applied'
  | 'privacy.mode.private'
  | 'privacy.mode.public'
  | 'privacy.mode.unset'
  | 'privacy.mode.privateShort'
  | 'privacy.mode.publicShort'
  | 'privacy.mode.privateBanner'
  | 'privacy.change'
  | 'privacy.changeHint'
  | 'privacy.providerLocked'
  | 'privacy.cloudBlocked'
  | 'wipe.sidebar'
  | 'wipe.sidebarHint'
  | 'wipe.sidebarPrivateHint'
  | 'wipe.sidebarTooltip'
  | 'wipe.confirm'
  | 'wipe.confirmDetail'
  | 'wipe.choice.data'
  | 'wipe.choice.full'
  | 'wipe.doneData'
  | 'wipe.doneFull'
  | 'sidebar.action.refresh'
  | 'sidebar.ollama.pickModel'
  | 'sidebar.ollama.pickModelHint'
  | 'sidebar.results.mainFlow'
  | 'sidebar.results.summary'
  | 'sidebar.results.entries'
  | 'sidebar.results.hubs'
  | 'sidebar.results.otherFlows'
  | 'sidebar.results.folders'
  | 'sidebar.results.importantFiles'
  | 'sidebar.results.symbols'
  | 'sidebar.results.noInsights'
  | 'sidebar.results.runAnalyze'
  | 'sidebar.results.openNarrative'
  | 'sidebar.results.openFlow'
  | 'sidebar.results.openMindMap'
  | 'sidebar.results.flowHint'
  | 'sidebar.results.mindMapHint'
  | 'sidebar.results.nFlows'
  | 'sidebar.results.spotlight'
  | 'sidebar.results.dominant'
  | 'sidebar.results.steps'
  | 'sidebar.results.input'
  | 'sidebar.results.process'
  | 'sidebar.results.output'
  | 'msg.logsCleared'
  | 'msg.noFilesToCheck'
  | 'msg.selectionCleared'
  | 'msg.noInsights'
  | 'msg.noMainFlow'
  | 'msg.noMindMap'
  | 'msg.insightNoPath'
  | 'msg.insightOpenFail'
  | 'msg.apiKeySaved'
  | 'msg.pickProvider'
  | 'msg.providerSet'
  | 'msg.usingGemini'
  | 'msg.usingDeepSeek'
  | 'msg.saveApiKeyTitle'
  | 'msg.apiKeyMissing'
  | 'explain.noSelection'
  | 'explain.noEditor'
  | 'explain.progress'
  | 'explain.question'
  | 'explain.done'
  | 'explain.failed'
  | 'analyze.fileCap'
  | 'analyze.cancelled'
  | 'analyze.noValidFiles'
  | 'analyze.progressCollect'
  | 'analyze.progressSummary'
  | 'analyze.progressCollecting'
  | 'analyze.progressAnalyzing'
  | 'analyze.progressInsights'
  | 'analyze.progressDiagram'
  | 'analyze.progressLlm'
  | 'analyze.done'
  | 'analyze.emptyGraph'
  | 'analyze.error'
  | 'structure.needAnalyze'
  | 'structure.needAnalyzeHint'
  | 'structure.emptySymbols'
  | 'structure.emptySymbolsHint'
  | 'structure.none'
  | 'structure.ready'
  | 'structure.folder.files'
  | 'structure.file.symbols'
  | 'structure.openFileGraph'
  | 'structure.openSymbolGraph'
  | 'structure.focusFile'
  | 'structure.focusSymbol'
  | 'webview.modules'
  | 'webview.flow'
  | 'webview.functions'
  | 'webview.insights'
  | 'webview.copyMermaid'
  | 'webview.openSource'
  | 'webview.theme'
  | 'webview.themeLight'
  | 'webview.themeDark'
  | 'webview.fullFlow'
  | 'webview.mindMap'
  | 'webview.openMindMap'
  | 'webview.mindMapHint'
  | 'webview.closeInsights'
  | 'webview.zoomHint'
  | 'webview.loadingTitle'
  | 'webview.loadingBody'
  | 'webview.emptyTitle'
  | 'webview.emptyBody'
  | 'webview.errorTitle'
  | 'webview.errorBody'
  | 'webview.insightsTitle'
  | 'webview.purposeHeading'
  | 'webview.summaryHeading'
  | 'webview.mainFlowHeading'
  | 'webview.mainFlowEmpty'
  | 'webview.mainFlowEmptyHint'
  | 'webview.mainFlowWeak'
  | 'webview.openFullFlow'
  | 'webview.entryHeading'
  | 'webview.hubHeading'
  | 'webview.statsHeading'
  | 'webview.statFiles'
  | 'webview.statEdges'
  | 'webview.statTotal'
  | 'webview.statNodes'
  | 'webview.noInsightsPurpose'
  | 'webview.noInsightsSummary'
  | 'webview.rendering'
  | 'webview.noMermaid'
  | 'webview.mermaidMissing'
  | 'webview.mermaidFail'
  | 'webview.copied'
  | 'webview.noDiagramYet'
  | 'webview.truncateNote'
  | 'webview.purposeFallback'
  | 'llm.empty'
  | 'llm.call'
  | 'llm.ok'
  | 'llm.fail'
  | 'llm.parseFail'
  | 'llm.notice.noKey'
  | 'llm.notice.quota'
  | 'llm.notice.quotaHint'
  | 'llm.notice.auth'
  | 'llm.notice.authHint'
  | 'llm.notice.empty'
  | 'llm.notice.partial'
  | 'llm.notice.failed'
  | 'llm.notice.failedHint'
  | 'flow.mermaidMissing'
  | 'flow.renderFail';

type Catalog = Record<MessageKey, string>;

const id: Catalog = {
  'lang.label': 'Bahasa',
  'lang.current': 'Bahasa: {name}',
  'lang.pickTitle': 'Pilih bahasa NeverMIN',
  'lang.changed': 'Bahasa NeverMIN: {name}',
  'sidebar.section.status': '1. Status',
  'sidebar.section.actions': '2. Jalankan',
  'sidebar.section.files': '3. Pilih File',
  'sidebar.section.structure': '4. Struktur',
  'sidebar.section.results': '5. Hasil Analisis',
  'sidebar.section.gitHistory': '6. Git History',
  'sidebar.section.logs': '7. Logs',
  'sidebar.section.settings': 'Pengaturan',
  'sidebar.status.openFolderFirst': 'Buka folder dulu',
  'sidebar.status.noCodeFiles': 'Belum ada file kode',
  'sidebar.status.apiKeyMissing': 'API key belum diset',
  'sidebar.status.analyzing': 'Sedang menganalisis',
  'sidebar.status.ready': 'Siap dipakai',
  'sidebar.actions.analyzeN': 'Analisis {count} file',
  'sidebar.actions.analyzeOrExplain': 'Analisis repo / jelaskan kode',
  'sidebar.results.running': 'Berjalan...',
  'sidebar.results.failed': 'Gagal',
  'sidebar.results.ready': 'Siap',
  'sidebar.results.none': 'Belum ada hasil',
  'sidebar.results.rerun': 'Hapus & rerun analisis',
  'sidebar.results.rerunHint': 'Buang hasil + cache LLM',
  'sidebar.results.rerunTooltip':
    'Menghapus hasil tersimpan dan prompt cache, lalu menjalankan analisis ulang (narasi LLM baru).',
  'sidebar.results.clear': 'Hapus hasil analisis',
  'sidebar.results.clearHint': 'Kosongkan sidebar',
  'sidebar.results.clearTooltip':
    'Menghapus hasil dari workspaceState dan mengosongkan prompt cache LLM.',
  'sidebar.results.savedAt': 'Hasil tersimpan di workspace ini',
  'results.cleared': 'Hasil analisis dihapus. Jalankan analisis lagi untuk hasil baru.',
  'results.alreadyEmpty': 'Belum ada hasil analisis untuk dihapus.',
  'git.cleared': 'Hasil Git History dihapus.',
  'git.alreadyEmpty': 'Belum ada hasil Git History untuk dihapus.',
  'sidebar.logs.running': 'Berjalan…',
  'sidebar.logs.count': '{count} event',
  'sidebar.logs.empty': 'Kosong',
  'sidebar.files.checked': '{count} dicentang',
  'sidebar.files.checkTarget': 'Centang file target',
  'sidebar.folder.selected': '{selected}/{total} dipilih',
  'sidebar.folder.files': '{count} file',
  'sidebar.folder.checkboxHint':
    'Centang folder "{folder}" untuk memilih semua {count} file di dalamnya.',
  'sidebar.apiKey.ok': 'API key tersimpan',
  'sidebar.apiKey.fallback': 'API key di settings (sementara)',
  'sidebar.apiKey.missing': 'API key belum diset',
  'sidebar.apiKey.tooltip.ok': 'Key disimpan aman di SecretStorage.',
  'sidebar.apiKey.tooltip.fallback': 'Pindahkan key ke SecretStorage lewat Simpan API Key.',
  'sidebar.apiKey.tooltip.missing': 'Simpan API key agar fitur LLM aktif.',
  'sidebar.workspace.ready': 'Workspace siap',
  'sidebar.workspace.notReady': 'Workspace belum siap',
  'sidebar.workspace.codeFiles': '{count} file kode',
  'sidebar.workspace.codeFilesMany': '25+ file kode',
  'sidebar.workspace.openProject': 'Buka folder project',
  'sidebar.workspace.readyHint': 'NeverMIN menemukan file kode di workspace ini.',
  'sidebar.workspace.openHint': 'Buka folder project yang berisi source code.',
  'sidebar.selection.count': '{count} file dipilih',
  'sidebar.selection.none': 'Belum memilih file',
  'sidebar.selection.hint': 'Untuk analisis terfokus',
  'sidebar.selection.tooltip': 'Centang file di bagian "Pilih File" jika ingin analisis sebagian repo saja.',
  'sidebar.analysis.running': 'Analisis berjalan',
  'sidebar.analysis.failed': 'Analisis gagal',
  'sidebar.analysis.hasResult': 'Ada hasil analisis',
  'sidebar.analysis.none': 'Belum ada analisis',
  'sidebar.analysis.wait': 'Tunggu sebentar',
  'sidebar.action.openFolderRequired': 'Buka folder project dulu',
  'sidebar.action.openFolderRequiredHint': 'Sidebar akan aktif setelah ada workspace berisi file kode.',
  'sidebar.action.analyzeSelected': 'Analisis file terpilih',
  'sidebar.action.analyzeSelectedN': 'Analisis {count} file terpilih',
  'sidebar.action.recommended': 'Direkomendasikan',
  'sidebar.action.checkFirst': 'Centang file dulu',
  'sidebar.action.analyzeSelectedHint': 'Membangun graph dan ringkasan dari {count} file yang dicentang.',
  'sidebar.action.analyzeSelectedEmptyHint': 'Centang file di bagian Pilih File, lalu klik lagi di sini.',
  'sidebar.action.analyzeRepo': 'Analisis seluruh repo',
  'sidebar.action.analyzeRepoHint': 'Scan file kode di workspace lalu bangun graph + insights.',
  'sidebar.action.analyzeGit': 'Analisis Git History',
  'sidebar.action.analyzeGitHint':
    'Churn hidup/beku, niat commit, owner, dan coupling co-change — lalu ringkas dengan LLM.',
  'sidebar.action.explain': 'Jelaskan kode terpilih',
  'sidebar.action.explainHint': 'Pilih teks di editor, lalu minta penjelasan LLM.',
  'sidebar.action.saveApiKey': 'Simpan API Key',
  'sidebar.action.openSettings': 'Buka Settings',
  'sidebar.action.pickProvider': 'Pilih LLM Provider',
  'sidebar.action.pickLanguage': 'Pilih bahasa UI/LLM',
  'sidebar.files.selectAll': 'Centang semua file',
  'sidebar.files.clear': 'Kosongkan centang',
  'sidebar.logs.open': 'Buka Output Channel',
  'sidebar.logs.openDetail': 'Detail',
  'sidebar.logs.openTooltip': 'Tampilkan log lengkap NeverMIN di panel Output',
  'sidebar.logs.clear': 'Bersihkan logs',
  'sidebar.logs.none': 'Belum ada aktivitas',
  'sidebar.logs.noneHint': 'Jalankan analisis',
  'sidebar.git.running': 'Memindai git…',
  'sidebar.git.failed': 'Gagal',
  'sidebar.git.ready': '{commits} commit · {alive} hidup',
  'sidebar.git.none': 'Belum dipindai',
  'sidebar.git.run': 'Jalankan analisis Git History',
  'sidebar.git.runHint':
    'Baca commit window, ranking churn, owner, coupling tersembunyi, lalu minta LLM menjelaskan.',
  'sidebar.git.rerun': 'Hapus & rerun Git History',
  'sidebar.git.rerunHint': 'Buang hasil + cache LLM',
  'sidebar.git.rerunTooltip':
    'Menghapus hasil Git History tersimpan dan prompt cache, lalu memindai ulang.',
  'sidebar.git.clear': 'Hapus hasil Git History',
  'sidebar.git.clearHint': 'Kosongkan bagian ini',
  'sidebar.git.clearTooltip': 'Menghapus Git History dari workspaceState dan mengosongkan prompt cache.',
  'sidebar.git.scanning': 'Sedang memindai history…',
  'sidebar.git.retry': 'Coba lagi',
  'sidebar.git.noneDetail': 'Belum ada hasil Git History',
  'sidebar.git.noneHint': 'Klik Jalankan analisis Git History di atas',
  'sidebar.git.narrative': 'Ringkasan LLM (kenapa / siapa / coupling)',
  'sidebar.git.narrativeHint': 'Buka markdown',
  'sidebar.git.stats': '{commits} commit · {days} hari',
  'sidebar.git.alive': 'Hidup (sering berubah)',
  'sidebar.git.aliveMeta': '{commits}x · {days}h lalu',
  'sidebar.git.frozen': 'Beku (jarang berubah)',
  'sidebar.git.frozenMeta': '{days} hari diam',
  'sidebar.git.why': 'Kenapa ditulis begini (commit)',
  'sidebar.git.owners': 'Siapa yang paham (owner)',
  'sidebar.git.ownerMeta': '{path} · {commits} commit · {share}%',
  'sidebar.git.coupling': 'Coupling tersembunyi',
  'sidebar.git.couplingMeta': '{count}x bareng',
  'git.notRepo': 'Folder ini bukan git repository.',
  'git.noCommits': 'Tidak ada commit di jendela waktu yang dipindai.',
  'git.done':
    'Git History: {commits} commit · {alive} file hidup · {frozen} beku. Lihat bagian 5 di sidebar.',
  'git.error': 'Git History gagal: {error}',
  'git.noNarrative': 'Belum ada ringkasan LLM untuk Git History.',
  'ollama.detecting': 'Mendeteksi model Ollama…',
  'ollama.detectFail': 'Gagal menghubungi Ollama di {url}: {error}',
  'ollama.noModels': 'Ollama jalan di {url}, tapi belum ada model. Jalankan: ollama pull llama3.2',
  'ollama.pickTitle': 'Pilih model Ollama',
  'ollama.pickPlaceholder': 'Model terpasang lokal',
  'ollama.pickPlaceholderRunning': '{count} model sedang loaded di RAM',
  'ollama.modelSet': 'NeverMIN memakai Ollama model {model}.',
  'ollama.keysCleared':
    '{label} lokal aktif — {count} API key cloud dihapus dari SecretStorage/settings.',
  'ollama.apiKeyBlocked':
    'Ollama tidak memakai API key cloud. {count} key yang tersimpan sudah dihapus.',
  'privacy.gate.title': 'Pilih cara analisis workspace ini',
  'privacy.gate.subtitle': 'Wajib sebelum onboarding',
  'privacy.gate.tooltip':
    'Private = lokal saja (Ollama). Public = boleh LLM cloud.',
  'privacy.gate.banner': 'Langkah pertama: pilih Private atau Public codebase',
  'privacy.pickTitle': 'NeverMIN — privasi codebase',
  'privacy.pickPlaceholder': 'Private (lokal) atau Public (LLM cloud diizinkan)',
  'privacy.private.label': 'Private codebase',
  'privacy.private.badge': 'Lokal saja · anti-leak',
  'privacy.private.detail':
    'Parse/graph/git tetap di disk. LLM hanya Ollama. API key cloud dihapus.',
  'privacy.private.applied': 'Mode Private aktif — analisis lokal + Ollama saja.',
  'privacy.public.label': 'Public codebase',
  'privacy.public.badge': 'LLM cloud diizinkan',
  'privacy.public.detail':
    'Tool graph lokal sama, plus Gemini/OpenAI/… opsional jika ada API key.',
  'privacy.public.applied': 'Mode Public aktif — provider LLM cloud diizinkan.',
  'privacy.mode.private': 'Mode: Private codebase',
  'privacy.mode.public': 'Mode: Public codebase',
  'privacy.mode.unset': 'Mode: belum dipilih',
  'privacy.mode.privateShort': 'Private · lokal',
  'privacy.mode.publicShort': 'Public · cloud OK',
  'privacy.mode.privateBanner': 'Mode Private — kode tetap lokal (Ollama untuk LLM)',
  'privacy.change': 'Ganti mode privasi',
  'privacy.changeHint': 'Ganti Private / Public untuk workspace ini',
  'privacy.providerLocked': 'Terkunci ke Ollama',
  'privacy.cloudBlocked':
    'Mode Private memblokir LLM cloud. Ganti ke Public di Pengaturan jika perlu.',
  'wipe.sidebar': 'Hapus data workspace ini',
  'wipe.sidebarHint': 'Analisis + Git + cache',
  'wipe.sidebarPrivateHint': 'Penting untuk Private',
  'wipe.sidebarTooltip':
    'Menghapus hasil analisis, Git History, centang file, dan prompt cache LLM dari storage VS Code untuk workspace ini.',
  'wipe.confirm': 'Hapus data NeverMIN untuk workspace ini?',
  'wipe.confirmDetail':
    'Ini menghapus hasil analisis/Git History/centang file + cache LLM dari workspaceState. File di repo tidak diubah. API key SecretStorage tidak ikut terhapus lewat aksi ini (Private mode sudah membersihkan key cloud saat dipilih).',
  'wipe.choice.data': 'Hapus data analisis',
  'wipe.choice.full': 'Full reset (+ pilih Private/Public lagi)',
  'wipe.doneData': 'Data workspace NeverMIN dihapus. Mode privasi tetap.',
  'wipe.doneFull': 'Full reset selesai. Pilih lagi Private atau Public codebase.',
  'sidebar.action.refresh': 'Refresh sidebar',
  'sidebar.ollama.pickModel': 'Pilih model Ollama',
  'sidebar.ollama.pickModelHint': 'Deteksi model terpasang + yang sedang loaded (ollama ps).',
  'sidebar.results.mainFlow': 'Flow Utama',
  'sidebar.results.summary': 'Ringkasan',
  'sidebar.results.entries': 'Entry points',
  'sidebar.results.hubs': 'Hubs',
  'sidebar.results.otherFlows': 'Alur lain',
  'sidebar.results.folders': 'Folder teratas',
  'sidebar.results.importantFiles': 'File penting',
  'sidebar.results.symbols': 'Symbol utama',
  'sidebar.results.noInsights': 'Belum ada insights',
  'sidebar.results.runAnalyze': 'Jalankan analisis dulu',
  'sidebar.results.openNarrative': 'Buka ringkasan narasi',
  'sidebar.results.openFlow': 'Buka Flow Utama',
  'sidebar.results.openMindMap': 'Buka Mind Map Belajar',
  'sidebar.results.flowHint': 'Buka diagram Mermaid Flow utama',
  'sidebar.results.mindMapHint': 'Lihat pecahan belajar dari entry, flow, hub, dan modul',
  'sidebar.results.nFlows': '{count} alur',
  'sidebar.results.spotlight': 'Sorotan',
  'sidebar.results.dominant': 'Paling dominan',
  'sidebar.results.steps': '{count} langkah',
  'sidebar.results.input': 'Input: {value}',
  'sidebar.results.process': 'Proses: {value}',
  'sidebar.results.output': 'Output: {value}',
  'msg.logsCleared': 'Logs NeverMIN dibersihkan.',
  'msg.noFilesToCheck': 'Workspace belum punya file yang bisa dicentang.',
  'msg.selectionCleared': 'Centang file NeverMIN dikosongkan.',
  'msg.noInsights': 'Belum ada ringkasan insights untuk ditampilkan.',
  'msg.noMainFlow': 'Belum ada Flow utama untuk ditampilkan.',
  'msg.noMindMap': 'Belum ada data analisis untuk mind map belajar.',
  'msg.insightNoPath': 'Insight tidak punya file path.',
  'msg.insightOpenFail': 'Gagal membuka insight {name}: {error}',
  'msg.apiKeySaved': 'API key {label} disimpan di SecretStorage.',
  'msg.pickProvider': 'Pilih LLM Provider NeverMIN',
  'msg.providerSet': 'NeverMIN memakai {label}.',
  'msg.usingGemini': 'NeverMIN sekarang memakai Google Gemini.',
  'msg.usingDeepSeek': 'NeverMIN sekarang memakai DeepSeek.',
  'msg.saveApiKeyTitle': 'Simpan API Key — {label}',
  'msg.apiKeyMissing':
    'API key {label} belum diset. Simpan lewat NeverMIN: Simpan API Key (untuk provider aktif).',
  'explain.noSelection': 'Pilih kode di editor dulu.',
  'explain.noEditor': 'Buka file di editor dulu.',
  'explain.progress': 'NeverMIN menjelaskan kode…',
  'explain.question': 'Jelaskan kode yang diseleksi dengan singkat.',
  'explain.done': 'Penjelasan siap.',
  'explain.failed': 'Gagal menjelaskan kode: {error}',
  'analyze.fileCap':
    'NeverMIN membatasi analisis ke {max} file pertama (dari {total}). Centang subset lebih kecil untuk fokus.',
  'analyze.cancelled': 'Analisis NeverMIN dibatalkan.',
  'analyze.noValidFiles': 'Tidak ada file valid yang bisa dianalisis.',
  'analyze.progressCollect': 'NeverMIN: menganalisis file',
  'analyze.progressSummary': 'NeverMIN: menyusun ringkasan',
  'analyze.progressCollecting': 'Mengumpulkan file terpilih',
  'analyze.progressAnalyzing': 'Menganalisis {count} file',
  'analyze.progressInsights': 'Menyusun insights dari graph',
  'analyze.progressDiagram': 'Menampilkan diagram',
  'analyze.progressLlm': 'Melengkapi penjelasan LLM (background)…',
  'analyze.done': 'Analisis selesai · {files} file · {symbols} symbol',
  'analyze.emptyGraph':
    'Graph kosong karena file yang dipilih belum punya symbol yang bisa divisualkan.',
  'analyze.error': 'Analisis gagal: {error}',
  'structure.needAnalyze': 'Jalankan analisis dulu',
  'structure.needAnalyzeHint': 'Struktur Folder → File → Fungsi muncul setelah graph siap.',
  'structure.emptySymbols': 'Belum ada fungsi terdeteksi',
  'structure.emptySymbolsHint': 'Parser belum menemukan function/class di file yang dianalisis.',
  'structure.none': 'Belum ada graph',
  'structure.ready': '{count} symbol',
  'structure.folder.files': '{count} file',
  'structure.file.symbols': '{count} fungsi',
  'structure.openFileGraph': 'Buka graph fungsi file',
  'structure.openSymbolGraph': 'Buka graph fungsi',
  'structure.focusFile': 'Fungsi di {file}',
  'structure.focusSymbol': 'Fokus: {name}',
  'webview.modules': 'Modul',
  'webview.flow': 'Flow',
  'webview.functions': 'Fungsi',
  'webview.insights': 'Insights',
  'webview.copyMermaid': 'Salin Mermaid',
  'webview.openSource': 'Buka sumber',
  'webview.theme': 'Tema',
  'webview.themeLight': 'Terang',
  'webview.themeDark': 'Gelap',
  'webview.fullFlow': 'Flow penuh',
  'webview.mindMap': 'Mind Map',
  'webview.openMindMap': 'Buka mind map',
  'webview.mindMapHint':
    'Pecahan belajar: mulai dari entry → ikuti alur utama → pahami hub → jelajahi modul.',
  'webview.closeInsights': 'Tutup Insights',
  'webview.zoomHint': 'Scroll = zoom · drag = geser · klik node = buka file',
  'webview.loadingTitle': 'Menyiapkan diagram',
  'webview.loadingBody': 'Menyusun arsitektur Mermaid…',
  'webview.emptyTitle': 'Belum ada diagram',
  'webview.emptyBody': 'Jalankan analisis repo untuk membangun arsitektur.',
  'webview.errorTitle': 'Diagram gagal dimuat',
  'webview.errorBody': 'Ada masalah saat merender Mermaid.',
  'webview.insightsTitle': 'Insights',
  'webview.purposeHeading': 'Kodingan ini untuk apa',
  'webview.summaryHeading': 'Ringkasan',
  'webview.mainFlowHeading': 'Alur Utama',
  'webview.mainFlowEmpty': 'Belum ada alur',
  'webview.mainFlowEmptyHint': 'Jalankan analisis untuk melihat input, proses, dan output.',
  'webview.mainFlowWeak': 'Analisis belum menemukan input, proses, dan output yang kuat.',
  'webview.openFullFlow': 'Buka flow penuh',
  'webview.entryHeading': 'Entry',
  'webview.hubHeading': 'Hub',
  'webview.statsHeading': 'Stats',
  'webview.statFiles': 'File ditampilkan',
  'webview.statEdges': 'Relasi',
  'webview.statTotal': 'File total',
  'webview.statNodes': 'Symbol graph',
  'webview.noInsightsPurpose': 'Jalankan analisis + API key untuk penjelasan aplikasi.',
  'webview.noInsightsSummary': 'Jalankan analisis untuk ringkasan.',
  'webview.rendering': 'Merender…',
  'webview.noMermaid': 'Belum ada konten Mermaid.',
  'webview.mermaidMissing': 'Library Mermaid tidak tersedia di webview. Cek CSP / path mermaid.min.js.',
  'webview.mermaidFail': 'Mermaid gagal dirender: {detail}',
  'webview.copied': 'Sumber Mermaid disalin ke clipboard.',
  'webview.noDiagramYet': 'Belum ada diagram untuk dibuka.',
  'webview.truncateNote': 'Ditampilkan {shown} dari {total} file (prioritas entry/hub/relasi).',
  'webview.purposeFallback':
    'Aplikasi ini adalah aplikasi untuk (belum terdeteksi — jalankan ulang analisis dengan API key).',
  'llm.empty': 'hasil kosong',
  'llm.call': 'LLM panggil · {task} · {provider}{model}',
  'llm.ok': 'LLM sukses · {task} · {ms}ms · {summary}',
  'llm.fail': 'LLM gagal · {task} · {ms}ms · {error}',
  'llm.parseFail': '0/{count} node terisi (parse gagal/kosong)',
  'llm.notice.noKey':
    'LLM tidak dipanggil: API key {label} belum diset. Diagram tetap ada, tapi narasi/insights LLM kosong.',
  'llm.notice.quota':
    'LLM {label} ditolak (kuota/rate limit). Cek billing atau tunggu sebentar. Detail: {detail}',
  'llm.notice.quotaHint': 'kemungkinan kuota habis atau terlalu banyak request',
  'llm.notice.auth':
    'LLM {label} gagal autentikasi. API key mungkin salah/expired. Detail: {detail}',
  'llm.notice.authHint': 'periksa API key di Pengaturan',
  'llm.notice.empty':
    'LLM {label} dipanggil tapi hasil kosong. Diagram tetap tampil tanpa narasi/ringkas fungsi.',
  'llm.notice.partial':
    'LLM {label} hanya berhasil sebagian (narasi atau ringkas fungsi). Cek Output Logs.',
  'llm.notice.failed':
    'LLM {label} gagal dipanggil. Diagram tetap tampil. Detail: {detail}',
  'llm.notice.failedHint': 'lihat Output NeverMIN untuk detail',
  'flow.mermaidMissing': 'Sumber Mermaid kosong.',
  'flow.renderFail': 'Mermaid gagal dirender.'
};

const en: Catalog = {
  'lang.label': 'Language',
  'lang.current': 'Language: {name}',
  'lang.pickTitle': 'Choose NeverMIN language',
  'lang.changed': 'NeverMIN language: {name}',
  'sidebar.section.status': '1. Status',
  'sidebar.section.actions': '2. Run',
  'sidebar.section.files': '3. Select Files',
  'sidebar.section.structure': '4. Structure',
  'sidebar.section.results': '5. Analysis Results',
  'sidebar.section.gitHistory': '6. Git History',
  'sidebar.section.logs': '7. Logs',
  'sidebar.section.settings': 'Settings',
  'sidebar.status.openFolderFirst': 'Open a folder first',
  'sidebar.status.noCodeFiles': 'No code files yet',
  'sidebar.status.apiKeyMissing': 'API key not set',
  'sidebar.status.analyzing': 'Analyzing',
  'sidebar.status.ready': 'Ready',
  'sidebar.actions.analyzeN': 'Analyze {count} files',
  'sidebar.actions.analyzeOrExplain': 'Analyze repo / explain code',
  'sidebar.results.running': 'Running...',
  'sidebar.results.failed': 'Failed',
  'sidebar.results.ready': 'Ready',
  'sidebar.results.none': 'No results yet',
  'sidebar.results.rerun': 'Clear & rerun analysis',
  'sidebar.results.rerunHint': 'Drop results + LLM cache',
  'sidebar.results.rerunTooltip':
    'Deletes saved results and the prompt cache, then runs analysis again (fresh LLM narrative).',
  'sidebar.results.clear': 'Clear analysis results',
  'sidebar.results.clearHint': 'Empty the sidebar',
  'sidebar.results.clearTooltip':
    'Removes results from workspaceState and clears the LLM prompt cache.',
  'sidebar.results.savedAt': 'Results saved for this workspace',
  'results.cleared': 'Analysis results cleared. Run analysis again for a fresh result.',
  'results.alreadyEmpty': 'No analysis results to clear.',
  'git.cleared': 'Git History results cleared.',
  'git.alreadyEmpty': 'No Git History results to clear.',
  'sidebar.logs.running': 'Running…',
  'sidebar.logs.count': '{count} events',
  'sidebar.logs.empty': 'Empty',
  'sidebar.files.checked': '{count} checked',
  'sidebar.files.checkTarget': 'Check target files',
  'sidebar.folder.selected': '{selected}/{total} selected',
  'sidebar.folder.files': '{count} files',
  'sidebar.folder.checkboxHint':
    'Check folder "{folder}" to select all {count} files inside.',
  'sidebar.apiKey.ok': 'API key saved',
  'sidebar.apiKey.fallback': 'API key in settings (temporary)',
  'sidebar.apiKey.missing': 'API key not set',
  'sidebar.apiKey.tooltip.ok': 'Key is stored securely in SecretStorage.',
  'sidebar.apiKey.tooltip.fallback': 'Move the key to SecretStorage via Save API Key.',
  'sidebar.apiKey.tooltip.missing': 'Save an API key to enable LLM features.',
  'sidebar.workspace.ready': 'Workspace ready',
  'sidebar.workspace.notReady': 'Workspace not ready',
  'sidebar.workspace.codeFiles': '{count} code files',
  'sidebar.workspace.codeFilesMany': '25+ code files',
  'sidebar.workspace.openProject': 'Open a project folder',
  'sidebar.workspace.readyHint': 'NeverMIN found code files in this workspace.',
  'sidebar.workspace.openHint': 'Open a project folder that contains source code.',
  'sidebar.selection.count': '{count} files selected',
  'sidebar.selection.none': 'No files selected',
  'sidebar.selection.hint': 'For focused analysis',
  'sidebar.selection.tooltip': 'Check files under "Select Files" to analyze only part of the repo.',
  'sidebar.analysis.running': 'Analysis running',
  'sidebar.analysis.failed': 'Analysis failed',
  'sidebar.analysis.hasResult': 'Analysis results available',
  'sidebar.analysis.none': 'No analysis yet',
  'sidebar.analysis.wait': 'Please wait',
  'sidebar.action.openFolderRequired': 'Open a project folder first',
  'sidebar.action.openFolderRequiredHint': 'The sidebar activates once a workspace with code files is open.',
  'sidebar.action.analyzeSelected': 'Analyze selected files',
  'sidebar.action.analyzeSelectedN': 'Analyze {count} selected files',
  'sidebar.action.recommended': 'Recommended',
  'sidebar.action.checkFirst': 'Check files first',
  'sidebar.action.analyzeSelectedHint': 'Build a graph and summary from {count} checked files.',
  'sidebar.action.analyzeSelectedEmptyHint': 'Check files under Select Files, then click here again.',
  'sidebar.action.analyzeRepo': 'Analyze whole repo',
  'sidebar.action.analyzeRepoHint': 'Scan workspace code files, then build graph + insights.',
  'sidebar.action.analyzeGit': 'Analyze Git History',
  'sidebar.action.analyzeGitHint':
    'Alive/frozen churn, commit intent, owners, and co-change coupling — then LLM summary.',
  'sidebar.action.explain': 'Explain selected code',
  'sidebar.action.explainHint': 'Select text in the editor, then ask the LLM to explain it.',
  'sidebar.action.saveApiKey': 'Save API Key',
  'sidebar.action.openSettings': 'Open Settings',
  'sidebar.action.pickProvider': 'Choose LLM Provider',
  'sidebar.action.pickLanguage': 'Choose UI/LLM language',
  'sidebar.files.selectAll': 'Check all files',
  'sidebar.files.clear': 'Clear selection',
  'sidebar.logs.open': 'Open Output Channel',
  'sidebar.logs.openDetail': 'Details',
  'sidebar.logs.openTooltip': 'Show full NeverMIN logs in the Output panel',
  'sidebar.logs.clear': 'Clear logs',
  'sidebar.logs.none': 'No activity yet',
  'sidebar.logs.noneHint': 'Run an analysis',
  'sidebar.git.running': 'Scanning git…',
  'sidebar.git.failed': 'Failed',
  'sidebar.git.ready': '{commits} commits · {alive} alive',
  'sidebar.git.none': 'Not scanned yet',
  'sidebar.git.run': 'Run Git History analysis',
  'sidebar.git.runHint':
    'Read the commit window, rank churn/owners/hidden coupling, then ask the LLM to explain.',
  'sidebar.git.rerun': 'Clear & rerun Git History',
  'sidebar.git.rerunHint': 'Drop results + LLM cache',
  'sidebar.git.rerunTooltip':
    'Deletes saved Git History and the prompt cache, then scans again.',
  'sidebar.git.clear': 'Clear Git History results',
  'sidebar.git.clearHint': 'Empty this section',
  'sidebar.git.clearTooltip': 'Removes Git History from workspaceState and clears the prompt cache.',
  'sidebar.git.scanning': 'Scanning history…',
  'sidebar.git.retry': 'Retry',
  'sidebar.git.noneDetail': 'No Git History results yet',
  'sidebar.git.noneHint': 'Click Run Git History analysis above',
  'sidebar.git.narrative': 'LLM summary (why / who / coupling)',
  'sidebar.git.narrativeHint': 'Open markdown',
  'sidebar.git.stats': '{commits} commits · {days} days',
  'sidebar.git.alive': 'Alive (high churn)',
  'sidebar.git.aliveMeta': '{commits}x · {days}d ago',
  'sidebar.git.frozen': 'Frozen (rarely changed)',
  'sidebar.git.frozenMeta': '{days} days quiet',
  'sidebar.git.why': 'Why it looks like this (commits)',
  'sidebar.git.owners': 'Who knows this (owners)',
  'sidebar.git.ownerMeta': '{path} · {commits} commits · {share}%',
  'sidebar.git.coupling': 'Hidden coupling',
  'sidebar.git.couplingMeta': '{count}x together',
  'git.notRepo': 'This folder is not a git repository.',
  'git.noCommits': 'No commits found in the scanned time window.',
  'git.done':
    'Git History: {commits} commits · {alive} alive · {frozen} frozen. See section 5 in the sidebar.',
  'git.error': 'Git History failed: {error}',
  'git.noNarrative': 'No LLM summary for Git History yet.',
  'ollama.detecting': 'Detecting Ollama models…',
  'ollama.detectFail': 'Failed to reach Ollama at {url}: {error}',
  'ollama.noModels': 'Ollama is up at {url}, but no models found. Run: ollama pull llama3.2',
  'ollama.pickTitle': 'Choose Ollama model',
  'ollama.pickPlaceholder': 'Locally installed models',
  'ollama.pickPlaceholderRunning': '{count} model(s) currently loaded in RAM',
  'ollama.modelSet': 'NeverMIN is using Ollama model {model}.',
  'ollama.keysCleared':
    '{label} is local — cleared {count} cloud API key(s) from SecretStorage/settings.',
  'ollama.apiKeyBlocked':
    'Ollama does not use cloud API keys. Cleared {count} stored key(s).',
  'privacy.gate.title': 'Choose how you analyze this workspace',
  'privacy.gate.subtitle': 'Required before onboarding',
  'privacy.gate.tooltip':
    'Private keeps everything local (Ollama). Public allows cloud LLM providers.',
  'privacy.gate.banner': 'First step: pick Private or Public codebase mode',
  'privacy.pickTitle': 'NeverMIN — codebase privacy',
  'privacy.pickPlaceholder': 'Private (local) or Public (cloud LLM allowed)',
  'privacy.private.label': 'Private codebase',
  'privacy.private.badge': 'Local only · no cloud leak',
  'privacy.private.detail':
    'Parse/graph/git stay on disk. LLM uses Ollama only. Cloud API keys are cleared.',
  'privacy.private.applied': 'Private mode on — local analysis + Ollama only.',
  'privacy.public.label': 'Public codebase',
  'privacy.public.badge': 'Cloud LLM allowed',
  'privacy.public.detail':
    'Same local graph tools, plus optional Gemini/OpenAI/… when you save an API key.',
  'privacy.public.applied': 'Public mode on — cloud LLM providers are allowed.',
  'privacy.mode.private': 'Mode: Private codebase',
  'privacy.mode.public': 'Mode: Public codebase',
  'privacy.mode.unset': 'Mode: not chosen yet',
  'privacy.mode.privateShort': 'Private · local',
  'privacy.mode.publicShort': 'Public · cloud OK',
  'privacy.mode.privateBanner': 'Private mode — code stays local (Ollama for LLM)',
  'privacy.change': 'Change privacy mode',
  'privacy.changeHint': 'Switch between Private and Public for this workspace',
  'privacy.providerLocked': 'Locked to Ollama',
  'privacy.cloudBlocked':
    'Private codebase mode blocks cloud LLM. Switch to Public in Settings if you need it.',
  'wipe.sidebar': 'Wipe this workspace data',
  'wipe.sidebarHint': 'Analysis + Git + cache',
  'wipe.sidebarPrivateHint': 'Important for Private',
  'wipe.sidebarTooltip':
    'Deletes analysis results, Git History, file selection, and LLM prompt cache from VS Code storage for this workspace.',
  'wipe.confirm': 'Wipe NeverMIN data for this workspace?',
  'wipe.confirmDetail':
    'Removes analysis/Git History/file checks + LLM cache from workspaceState. Repo files are untouched. SecretStorage API keys are not wiped here (Private mode already clears cloud keys when selected).',
  'wipe.choice.data': 'Wipe analysis data',
  'wipe.choice.full': 'Full reset (+ choose Private/Public again)',
  'wipe.doneData': 'NeverMIN workspace data wiped. Privacy mode kept.',
  'wipe.doneFull': 'Full reset done. Choose Private or Public codebase again.',
  'sidebar.action.refresh': 'Refresh sidebar',
  'sidebar.ollama.pickModel': 'Choose Ollama model',
  'sidebar.ollama.pickModelHint': 'Detect installed models + currently loaded ones (ollama ps).',
  'sidebar.results.mainFlow': 'Main Flow',
  'sidebar.results.summary': 'Summary',
  'sidebar.results.entries': 'Entry points',
  'sidebar.results.hubs': 'Hubs',
  'sidebar.results.otherFlows': 'Other flows',
  'sidebar.results.folders': 'Top folders',
  'sidebar.results.importantFiles': 'Important files',
  'sidebar.results.symbols': 'Main symbols',
  'sidebar.results.noInsights': 'No insights yet',
  'sidebar.results.runAnalyze': 'Run analysis first',
  'sidebar.results.openNarrative': 'Open narrative summary',
  'sidebar.results.openFlow': 'Open Main Flow',
  'sidebar.results.openMindMap': 'Open Learning Mind Map',
  'sidebar.results.flowHint': 'Open the main Mermaid flow diagram',
  'sidebar.results.mindMapHint': 'See the learning breakdown: entries, flow, hubs, and modules',
  'sidebar.results.nFlows': '{count} flows',
  'sidebar.results.spotlight': 'Highlights',
  'sidebar.results.dominant': 'Most dominant',
  'sidebar.results.steps': '{count} steps',
  'sidebar.results.input': 'Input: {value}',
  'sidebar.results.process': 'Process: {value}',
  'sidebar.results.output': 'Output: {value}',
  'msg.logsCleared': 'NeverMIN logs cleared.',
  'msg.noFilesToCheck': 'Workspace has no files that can be checked.',
  'msg.selectionCleared': 'NeverMIN file selection cleared.',
  'msg.noInsights': 'No insights summary to show yet.',
  'msg.noMainFlow': 'No main flow to show yet.',
  'msg.noMindMap': 'No analysis data yet for a learning mind map.',
  'msg.insightNoPath': 'Insight has no file path.',
  'msg.insightOpenFail': 'Failed to open insight {name}: {error}',
  'msg.apiKeySaved': 'API key for {label} saved in SecretStorage.',
  'msg.pickProvider': 'Choose NeverMIN LLM Provider',
  'msg.providerSet': 'NeverMIN is using {label}.',
  'msg.usingGemini': 'NeverMIN is now using Google Gemini.',
  'msg.usingDeepSeek': 'NeverMIN is now using DeepSeek.',
  'msg.saveApiKeyTitle': 'Save API Key — {label}',
  'msg.apiKeyMissing':
    'API key for {label} is not set. Save it via NeverMIN: Save API Key (for the active provider).',
  'explain.noSelection': 'Select code in the editor first.',
  'explain.noEditor': 'Open a file in the editor first.',
  'explain.progress': 'NeverMIN is explaining the code…',
  'explain.question': 'Explain the selected code briefly.',
  'explain.done': 'Explanation ready.',
  'explain.failed': 'Failed to explain code: {error}',
  'analyze.fileCap':
    'NeverMIN limited analysis to the first {max} files (of {total}). Check a smaller subset to focus.',
  'analyze.cancelled': 'NeverMIN analysis cancelled.',
  'analyze.noValidFiles': 'No valid files to analyze.',
  'analyze.progressCollect': 'NeverMIN: analyzing files',
  'analyze.progressSummary': 'NeverMIN: building summary',
  'analyze.progressCollecting': 'Collecting selected files',
  'analyze.progressAnalyzing': 'Analyzing {count} files',
  'analyze.progressInsights': 'Building insights from the graph',
  'analyze.progressDiagram': 'Showing diagram',
  'analyze.progressLlm': 'Enriching with LLM explanations (background)…',
  'analyze.done': 'Analysis finished · {files} files · {symbols} symbols',
  'analyze.emptyGraph':
    'Graph is empty because the selected files have no symbols that can be visualized.',
  'analyze.error': 'Analysis failed: {error}',
  'structure.needAnalyze': 'Run analysis first',
  'structure.needAnalyzeHint': 'Folder → File → Function appears after the graph is ready.',
  'structure.emptySymbols': 'No functions detected',
  'structure.emptySymbolsHint': 'The parser found no function/class symbols in analyzed files.',
  'structure.none': 'No graph yet',
  'structure.ready': '{count} symbols',
  'structure.folder.files': '{count} files',
  'structure.file.symbols': '{count} functions',
  'structure.openFileGraph': 'Open file function graph',
  'structure.openSymbolGraph': 'Open function graph',
  'structure.focusFile': 'Functions in {file}',
  'structure.focusSymbol': 'Focus: {name}',
  'webview.modules': 'Modules',
  'webview.flow': 'Flow',
  'webview.functions': 'Functions',
  'webview.insights': 'Insights',
  'webview.copyMermaid': 'Copy Mermaid',
  'webview.openSource': 'Open source',
  'webview.theme': 'Theme',
  'webview.themeLight': 'Light',
  'webview.themeDark': 'Dark',
  'webview.fullFlow': 'Full flow',
  'webview.mindMap': 'Mind Map',
  'webview.openMindMap': 'Open mind map',
  'webview.mindMapHint':
    'Learning breakdown: start at entries → follow the main flow → learn hubs → explore modules.',
  'webview.closeInsights': 'Close Insights',
  'webview.zoomHint': 'Scroll = zoom · drag = pan · click node = open file',
  'webview.loadingTitle': 'Preparing diagram',
  'webview.loadingBody': 'Building Mermaid architecture…',
  'webview.emptyTitle': 'No diagram yet',
  'webview.emptyBody': 'Run a repo analysis to build the architecture.',
  'webview.errorTitle': 'Diagram failed to load',
  'webview.errorBody': 'Something went wrong while rendering Mermaid.',
  'webview.insightsTitle': 'Insights',
  'webview.purposeHeading': 'What this codebase is for',
  'webview.summaryHeading': 'Summary',
  'webview.mainFlowHeading': 'Main Flow',
  'webview.mainFlowEmpty': 'No flow yet',
  'webview.mainFlowEmptyHint': 'Run analysis to see input, process, and output.',
  'webview.mainFlowWeak': 'Analysis did not find a strong input → process → output path.',
  'webview.openFullFlow': 'Open full flow',
  'webview.entryHeading': 'Entry',
  'webview.hubHeading': 'Hub',
  'webview.statsHeading': 'Stats',
  'webview.statFiles': 'Files shown',
  'webview.statEdges': 'Relations',
  'webview.statTotal': 'Total files',
  'webview.statNodes': 'Graph symbols',
  'webview.noInsightsPurpose': 'Run analysis with an API key for an app explanation.',
  'webview.noInsightsSummary': 'Run analysis for a summary.',
  'webview.rendering': 'Rendering…',
  'webview.noMermaid': 'No Mermaid content yet.',
  'webview.mermaidMissing': 'Mermaid library is unavailable in the webview. Check CSP / mermaid.min.js path.',
  'webview.mermaidFail': 'Mermaid failed to render: {detail}',
  'webview.copied': 'Mermaid source copied to clipboard.',
  'webview.noDiagramYet': 'No diagram to open yet.',
  'webview.truncateNote': 'Showing {shown} of {total} files (entry/hub/relation priority).',
  'webview.purposeFallback':
    'This application is for (not detected yet — rerun analysis with an API key).',
  'llm.empty': 'empty result',
  'llm.call': 'LLM call · {task} · {provider}{model}',
  'llm.ok': 'LLM ok · {task} · {ms}ms · {summary}',
  'llm.fail': 'LLM failed · {task} · {ms}ms · {error}',
  'llm.parseFail': '0/{count} nodes filled (parse failed/empty)',
  'llm.notice.noKey':
    'LLM was not called: {label} API key is not set. The diagram is ready, but LLM narrative/insights are empty.',
  'llm.notice.quota':
    'LLM {label} was rejected (quota/rate limit). Check billing or wait a bit. Detail: {detail}',
  'llm.notice.quotaHint': 'quota may be exhausted or too many requests',
  'llm.notice.auth':
    'LLM {label} authentication failed. The API key may be wrong or expired. Detail: {detail}',
  'llm.notice.authHint': 'check the API key in Settings',
  'llm.notice.empty':
    'LLM {label} was called but returned empty content. The diagram is shown without narrative/summaries.',
  'llm.notice.partial':
    'LLM {label} only partially succeeded (narrative or summaries). Check Output Logs.',
  'llm.notice.failed':
    'LLM {label} failed. The diagram is still shown. Detail: {detail}',
  'llm.notice.failedHint': 'see NeverMIN Output for details',
  'flow.mermaidMissing': 'Mermaid source is empty.',
  'flow.renderFail': 'Mermaid failed to render.'
};

export const messages: Record<'id' | 'en', Catalog> = { id, en };
