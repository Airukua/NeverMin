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
  | 'sidebar.action.openSettingsHint'
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
  | 'ollama.pickRequired'
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
  | 'privacy.public.pickCloudTitle'
  | 'privacy.public.pickCloudPlaceholder'
  | 'privacy.public.pickCloud'
  | 'privacy.public.pickCloudHint'
  | 'privacy.public.stillOllama'
  | 'privacy.public.needCloudFirst'
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
  | 'privacy.cloudBlockedAsk'
  | 'privacy.switchToPublic'
  | 'privacy.keepPrivateOllama'
  | 'privacy.providerKept'
  | 'privacy.switchToOllama'
  | 'privacy.switchToOllamaAsk'
  | 'privacy.keepCloudProvider'
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
  | 'explain.modal.badge'
  | 'explain.modal.badgeLive'
  | 'explain.modal.loading'
  | 'explain.modal.loadingScope'
  | 'explain.modal.streaming'
  | 'explain.modal.error'
  | 'explain.modal.cancelled'
  | 'explain.modal.empty'
  | 'explain.modal.close'
  | 'explain.modal.thinking'
  | 'explain.scope.file'
  | 'explain.scope.module'
  | 'explain.scope.function'
  | 'explain.scope.sensitivity'
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
  | 'webview.openSource'
  | 'webview.mindMap'
  | 'webview.mainFlowHeading'
  | 'webview.mermaidMissing'
  | 'webview.copied'
  | 'webview.noDiagramYet'
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
  | 'flow.renderFail'
  | 'lang.active'
  | 'graph.card.entry'
  | 'graph.card.hub'
  | 'graph.card.output'
  | 'graph.card.step'
  | 'graph.card.file'
  | 'graph.card.component'
  | 'graph.arch.empty'
  | 'graph.arch.section.entry'
  | 'graph.arch.section.entryHint'
  | 'graph.arch.section.hub'
  | 'graph.arch.section.hubHint'
  | 'graph.arch.section.pipeline'
  | 'graph.arch.section.pipelineHint'
  | 'graph.arch.section.support'
  | 'graph.flow.empty'
  | 'graph.flow.section.start'
  | 'graph.flow.section.startHint'
  | 'graph.flow.section.step'
  | 'graph.flow.section.stepHint'
  | 'graph.flow.section.end'
  | 'graph.flow.section.endHint'
  | 'graph.flow.section.other'
  | 'graph.flow.section.otherHint'
  | 'graph.flow.card.start'
  | 'graph.flow.card.step'
  | 'graph.flow.card.end'
  | 'graph.modules.empty'
  | 'graph.modules.summary'
  | 'graph.functions.empty'
  | 'graph.functions.openHint'
  | 'graph.functions.noneInFile'
  | 'graph.functions.pickFile'
  | 'graph.sensitive.empty'
  | 'graph.sensitive.section.critical'
  | 'graph.sensitive.section.criticalHint'
  | 'graph.sensitive.section.high'
  | 'graph.sensitive.section.highHint'
  | 'graph.sensitive.section.medium'
  | 'graph.sensitive.section.mediumHint'
  | 'graph.flow.mermaidEmpty'
  | 'graph.view.empty'
  | 'graph.loading'
  | 'graph.error'
  | 'graph.none'
  | 'graph.backAllFiles'
  | 'graph.backNodeFlow'
  | 'graph.panelMissing'
  | 'graph.reactMissing'
  | 'insights.waitingLlm'
  | 'insights.none'
  | 'insights.title'
  | 'insights.subtitle'
  | 'insights.inspecting'
  | 'insights.openFlow'
  | 'insights.purpose'
  | 'insights.overview'
  | 'insights.mainFlow'
  | 'insights.howToRead'
  | 'insights.startHere'
  | 'insights.followModules'
  | 'insights.trackExecution'
  | 'insights.totalComponents'
  | 'insights.tokenUsage'
  | 'insights.tokenUsageSplit'
  | 'insights.llmUnavailable'
  | 'insights.llmFailed'
  | 'insights.fallbackSkipped'
  | 'insights.fallbackError'
  | 'insights.structuralMode'
  | 'insights.structuralHint'
  | 'insights.structuralOverview'
  | 'insights.hubs'
  | 'insights.sensitivity'
  | 'insights.sensitivityHint'
  | 'sensitivity.level.critical'
  | 'sensitivity.level.high'
  | 'sensitivity.level.medium'
  | 'sensitivity.level.low'
  | 'explain.modal.sensitivity'
  | 'insights.openMindMap'
  | 'view.architecture'
  | 'view.architecture.hint'
  | 'view.modules'
  | 'view.modules.hint'
  | 'view.flow'
  | 'view.flow.hint'
  | 'view.functions'
  | 'view.functions.hint'
  | 'view.sensitive'
  | 'view.sensitive.hint'
  | 'view.compass'
  | 'view.compass.hint'
  | 'view.git'
  | 'view.git.hint'
  | 'compass.empty'
  | 'compass.emptyHint'
  | 'compass.runGit'
  | 'compass.noGitHint'
  | 'compass.summary.gaps'
  | 'compass.summary.gapsHint'
  | 'compass.summary.highPriority'
  | 'compass.summary.highPriorityHint'
  | 'compass.summary.safeRisk'
  | 'compass.summary.safeRiskHint'
  | 'compass.agentTitle'
  | 'compass.agentSubtitle'
  | 'compass.agentFallback'
  | 'compass.llmInspecting'
  | 'compass.llmSkipped'
  | 'compass.docsUsed'
  | 'compass.none'
  | 'compass.section.gaps'
  | 'compass.section.gapsHint'
  | 'compass.section.read'
  | 'compass.section.readHint'
  | 'compass.section.steps'
  | 'compass.section.stepsHint'
  | 'compass.evidence'
  | 'compass.opportunity'
  | 'compass.confidence'
  | 'compass.confidence.low'
  | 'compass.confidence.medium'
  | 'compass.confidence.high'
  | 'compass.priority'
  | 'compass.expand'
  | 'compass.collapse'
  | 'compass.detail.why'
  | 'compass.detail.whyFallback'
  | 'compass.detail.contribute'
  | 'compass.openFile'
  | 'compass.explain'
  | 'compass.explain.again'
  | 'compass.explain.loading'
  | 'compass.explain.hint'
  | 'compass.explain.error'
  | 'compass.explain.why'
  | 'compass.explain.example'
  | 'compass.explain.options'
  | 'compass.explain.confidenceWhy'
  | 'compass.effort.low'
  | 'compass.effort.medium'
  | 'compass.effort.high'
  | 'compass.risk.safe'
  | 'compass.risk.needs-review'
  | 'compass.risk.critical-zone'
  | 'compass.type.orphan-promise'
  | 'compass.type.bug-pattern'
  | 'compass.type.yagni'
  | 'compass.type.incomplete-feature'
  | 'compass.type.coupling'
  | 'compass.type.test-gap'
  | 'compass.type.dead-config'
  | 'compass.type.misleading-contract'
  | 'compass.type.duplicate-logic'
  | 'compass.type.silent-fallback'
  | 'compass.type.missing-observability'
  | 'compass.type.unbounded-resource'
  | 'compass.type.missing-idempotency'
  | 'compass.type.schema-api-drift'
  | 'compass.type.dependency-risk'
  | 'compass.type.feature-flag-graveyard'
  | 'compass.type.ownership-gap'
  | 'compass.type.convention-drift'
  | 'compass.type.migration-incomplete'
  | 'compass.type.naming-mismatch'
  | 'compass.type.circular-dependency'
  | 'compass.type.magic-value'
  | 'compass.type.inconsistent-error-handling'
  | 'compass.type.copy-pasted-config'
  | 'git.ui.empty'
  | 'git.ui.emptyHint'
  | 'git.ui.run'
  | 'git.ui.statsCommits'
  | 'git.ui.statsWindow'
  | 'git.ui.alive'
  | 'git.ui.aliveHint'
  | 'git.ui.frozen'
  | 'git.ui.frozenHint'
  | 'git.ui.recent'
  | 'git.ui.recentHint'
  | 'git.ui.owners'
  | 'git.ui.couplings'
  | 'git.ui.narrative'
  | 'git.ui.daysAgo'
  | 'git.ui.commitsCount'
  | 'git.ui.together'
  | 'git.ui.openNarrative'
  | 'git.ui.sample'
  | 'git.ui.sampleSub'
  | 'git.ui.hottest'
  | 'git.ui.coldest'
  | 'git.ui.coldestSub'
  | 'git.ui.topCoupling'
  | 'git.ui.seeAlive'
  | 'git.ui.seeFrozen'
  | 'git.ui.seeCommits'
  | 'git.ui.collapse'
  | 'git.ui.footerNote'
  | 'git.ui.none'
  | 'git.ui.ownersHint'
  | 'git.ui.couplingsHint'
  | 'git.ui.llmTitle'
  | 'git.ui.llmSubtitle'
  | 'git.ui.llmInspecting'
  | 'git.ui.llmStructural'
  | 'git.ui.llmStructuralHint'
  | 'git.ui.llmWaiting'
  | 'git.ui.llmNone'
  | 'git.ui.sectionAlive'
  | 'git.ui.sectionWhy'
  | 'git.ui.sectionWho'
  | 'git.ui.sectionCoupling'
  | 'git.ui.activityLevel'
  | 'git.ui.activityNoFrozen'
  | 'git.ui.activityMix'
  | 'git.ui.aliveFallback'
  | 'git.ui.primaryOwner'
  | 'git.ui.ownerFocusFallback'
  | 'header.copy'
  | 'header.insights'
  | 'header.llmBusy'
  | 'nodeMenu.explain'
  | 'nodeMenu.flowChart'
  | 'nodeMenu.openFile'
  | 'nodeMenu.close'
  | 'mindmap.empty'
  | 'mindmap.root'
  | 'mindmap.start'
  | 'mindmap.flow'
  | 'mindmap.hubs'
  | 'mindmap.modules'
  | 'mindmap.later'
  | 'mindmap.subtitle'
  | 'insights.bullet.stats'
  | 'insights.bullet.mainFlow'
  | 'insights.bullet.primaryFlow'
  | 'insights.bullet.entries'
  | 'insights.bullet.hubs'
  | 'insights.bullet.orphans'
  | 'insights.hubReason'
  | 'insights.hubUtil'
  | 'insights.orphanReason'
  | 'webview.buildMissing'
  | 'webview.buildHint'
  | 'standalone.noDiagram';

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
  'sidebar.action.openSettingsHint': 'Bahasa, provider, model, Ollama URL, batas file',
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
  'ollama.pickRequired':
    'Pilih model Ollama yang terpasang (NeverMIN: Pilih Model Ollama), atau ganti ke provider cloud di mode Public.',
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
  'privacy.public.applied':
    'Mode Public aktif — pilih provider cloud lalu simpan API key (Ollama tidak dihapus otomatis).',
  'privacy.public.pickCloudTitle': 'Pilih provider LLM cloud',
  'privacy.public.pickCloudPlaceholder': 'Gemini, OpenAI, Anthropic, … (bukan Ollama)',
  'privacy.public.pickCloud': 'Pilih provider cloud & simpan API key',
  'privacy.public.pickCloudHint': 'Provider masih Ollama',
  'privacy.public.stillOllama': 'Masih Ollama — ganti untuk API key',
  'privacy.public.needCloudFirst':
    'Mode Public masih memakai Ollama. Pilih provider cloud dulu baru bisa menyimpan API key.',
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
  'privacy.cloudBlockedAsk':
    'Mode Private hanya mengizinkan Ollama. Ganti ke Public supaya provider/API key cloud bisa dipakai?',
  'privacy.switchToPublic': 'Ganti ke Public',
  'privacy.keepPrivateOllama': 'Tetap Private (Ollama)',
  'privacy.providerKept': 'Mode Public aktif — provider tetap {provider}.',
  'privacy.switchToOllama': 'Pakai Ollama',
  'privacy.switchToOllamaAsk':
    'Ini akan mengganti provider cloud ke Ollama lokal dan menghapus API key cloud yang tersimpan. Lanjut?',
  'privacy.keepCloudProvider': 'Tetap pakai provider cloud',
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
  'explain.modal.badge': 'Penjelasan AI',
  'explain.modal.badgeLive': 'Penjelasan AI · Live',
  'explain.modal.loading': 'LLM sedang menjelaskan komponen ini…',
  'explain.modal.loadingScope': 'Menyiapkan konteks {scope}…',
  'explain.modal.streaming': 'Menulis penjelasan…',
  'explain.modal.error': 'Gagal menjelaskan komponen ini.',
  'explain.modal.cancelled': 'Penjelasan dibatalkan.',
  'explain.modal.empty': 'Tidak ada penjelasan.',
  'explain.modal.close': 'Tutup penjelasan',
  'explain.modal.thinking': 'Thinking model (klik untuk buka)',
  'explain.scope.file': 'file utuh',
  'explain.scope.module': 'folder module',
  'explain.scope.function': 'fungsi',
  'explain.scope.sensitivity': 'sensitivitas',
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
  'webview.openSource': 'Buka sumber',
  'webview.mindMap': 'Mind Map',
  'webview.mainFlowHeading': 'Alur Utama',
  'webview.mermaidMissing': 'Library Mermaid tidak tersedia di webview. Cek CSP / path mermaid.min.js.',
  'webview.copied': 'Sumber Mermaid disalin ke clipboard.',
  'webview.noDiagramYet': 'Belum ada diagram untuk dibuka.',
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
  'flow.renderFail': 'Mermaid gagal dirender.',
  'lang.active': 'Aktif',
  'graph.card.entry': 'Titik masuk arsitektur untuk {name}.',
  'graph.card.hub': 'Hub pusat yang menghubungkan alur {name}.',
  'graph.card.output': 'Keluar hasil / tampilan dari alur {name}.',
  'graph.card.step': 'Bagian alur yang menangani {name}.',
  'graph.card.file': 'Modul berkas {name} dalam code graph.',
  'graph.card.component': 'Komponen {name} dalam code graph.',
  'graph.arch.empty': 'Belum ada insights arsitektur. Jalankan analisis repo.',
  'graph.arch.section.entry': '1 · Entry Points',
  'graph.arch.section.entryHint': 'Titik masuk — mulai baca dari sini',
  'graph.arch.section.hub': '2 · Core Hubs',
  'graph.arch.section.hubHint': 'Komponen pusat yang paling banyak dihubungkan',
  'graph.arch.section.pipeline': '3 · Main Pipeline',
  'graph.arch.section.pipelineHint': 'Alur utama Input → Process → Output',
  'graph.arch.section.support': '4 · Supporting Modules',
  'graph.flow.empty': 'Main flow belum terdeteksi. Jalankan analisis repo.',
  'graph.flow.section.start': '1 · Start',
  'graph.flow.section.startHint': 'Mulai baca dari sini — titik masuk alur',
  'graph.flow.section.step': '{n} · Langkah berikutnya',
  'graph.flow.section.stepHint': 'Dipanggil dari langkah sebelumnya',
  'graph.flow.section.end': 'End · Hasil / leaf',
  'graph.flow.section.endHint': 'Ujung alur — jarang memanggil fungsi lain di file ini',
  'graph.flow.section.other': 'Lainnya',
  'graph.flow.section.otherHint': 'Tidak terhubung ke alur calls utama',
  'graph.flow.card.start': 'Mulai dari sini — {name} memulai alur di file ini.',
  'graph.flow.card.step': '{name} adalah langkah di tengah alur pemanggilan.',
  'graph.flow.card.end': '{name} cenderung ujung alur (leaf) di file ini.',
  'graph.modules.empty': 'Belum ada modul untuk ditampilkan.',
  'graph.modules.summary': '{count} file · skor relasi {score}',
  'graph.functions.empty': 'Tidak ada fungsi terdeteksi di graph.',
  'graph.functions.openHint': '{count} symbol · klik untuk membuka',
  'graph.functions.noneInFile': 'Tidak ada fungsi di {file}.',
  'graph.functions.pickFile': 'Pilih file untuk melihat fungsi.',
  'graph.sensitive.empty': 'Belum ada kode sensitif terdeteksi. Jalankan analisis repo.',
  'graph.sensitive.section.critical': 'Critical',
  'graph.sensitive.section.criticalHint': 'Risiko tertinggi — salah ubah bisa merusak inti sistem',
  'graph.sensitive.section.high': 'High',
  'graph.sensitive.section.highHint': 'Dampak luas — auth, hub, payment, atau coupling kuat',
  'graph.sensitive.section.medium': 'Medium',
  'graph.sensitive.section.mediumHint': 'Perlu hati-hati — entry, pipeline, config, atau API',
  'graph.flow.mermaidEmpty': 'Belum ada flow',
  'graph.view.empty': 'Belum ada data untuk view ini.',
  'graph.loading': 'Memuat graph…',
  'graph.error': 'Gagal memuat graph.',
  'graph.none': 'Belum ada graph. Jalankan Analyze Repo.',
  'graph.backAllFiles': 'Semua file',
  'graph.backNodeFlow': 'Kembali',
  'graph.panelMissing': 'Buka panel Code Graph dulu, lalu coba Flow Chart lagi.',
  'graph.reactMissing': 'Graph belum punya view React. Compile ulang extension.',
  'insights.waitingLlm': 'Menunggu ringkasan LLM…',
  'insights.none': 'Belum ada insights.',
  'insights.title': 'Insights',
  'insights.subtitle': 'Pahami tujuan, struktur, dan alur data codebase ini.',
  'insights.inspecting': 'LLM sedang memeriksa codebase…',
  'insights.openFlow': 'Buka flow',
  'insights.purpose': 'Untuk apa codebase ini',
  'insights.overview': 'Overview',
  'insights.mainFlow': 'Alur data utama',
  'insights.howToRead': 'Cara membaca codebase ini',
  'insights.startHere': 'Mulai di sini',
  'insights.followModules': 'Ikuti modul',
  'insights.trackExecution': 'Lacak eksekusi',
  'insights.totalComponents': 'Total komponen:',
  'insights.tokenUsage': 'Token:',
  'insights.tokenUsageSplit': '{prompt} masuk · {completion} keluar',
  'insights.llmUnavailable': 'Mode struktural',
  'insights.llmFailed': 'Mode struktural',
  'insights.fallbackSkipped': 'LLM belum aktif — insights disusun dari code graph.',
  'insights.fallbackError': 'LLM gagal — insights disusun dari code graph.',
  'insights.structuralMode': 'Insights dari code graph',
  'insights.structuralHint':
    'Tanpa LLM, NeverMIN tetap menampilkan entry, hub, dan alur utama dari struktur repo.',
  'insights.structuralOverview': 'Ringkasan struktural',
  'insights.hubs': 'Core hubs',
  'insights.sensitivity': 'Hati-hati mengubah',
  'insights.sensitivityHint':
    'Komponen dengan sensitivitas tinggi — salah ubah bisa berdampak luas ke sistem atau data.',
  'sensitivity.level.critical': 'critical',
  'sensitivity.level.high': 'high',
  'sensitivity.level.medium': 'medium',
  'sensitivity.level.low': 'low',
  'explain.modal.sensitivity': 'Sensitivitas: {level}',
  'insights.openMindMap': 'Buka Mind Map',
  'view.architecture': 'Architecture',
  'view.architecture.hint': 'Peta sistem tingkat tinggi — entry point, hub, dan koneksi komponen utama.',
  'view.modules': 'Modules',
  'view.modules.hint': 'Tampilan folder/paket — modul mana yang saling bergantung.',
  'view.flow': 'Flow',
  'view.flow.hint': 'Jalur data utama — Input → Process → Output di codebase.',
  'view.functions': 'Functions',
  'view.functions.hint': 'Semua file berisi symbol — kartu tertutup sampai dibuka.',
  'view.sensitive': 'Sensitive code',
  'view.sensitive.hint':
    'File/simbol berisiko tinggi — dibedakan critical / high / medium. Explain menjelaskan kenapa sensitif.',
  'view.compass': 'Contribution',
  'view.compass.hint':
    'Gaps & Opportunities — deteksi celah, lalu peluang kontribusi (risiko hanya badge).',
  'compass.empty': 'Belum ada Gaps & Opportunities',
  'compass.emptyHint': 'Jalankan analisis repo agar NeverMIN mendeteksi gap dan peluang kontribusi.',
  'compass.runGit': 'Analisis Git History',
  'compass.noGitHint':
    'Git History belum dijalankan — gap tetap terdeteksi, tapi tanpa sinyal coupling/churn.',
  'compass.summary.gaps': 'Gap',
  'compass.summary.gapsHint': 'Celah terdeteksi di codebase',
  'compass.summary.highPriority': 'Prioritas tinggi',
  'compass.summary.highPriorityHint': 'evidence × value / effort',
  'compass.summary.safeRisk': 'Risiko rendah',
  'compass.summary.safeRiskHint': 'Gap dengan badge aman disentuh',
  'compass.agentTitle': 'Saran agen',
  'compass.agentSubtitle': 'Jelaskan gap + saring false positive dari docs',
  'compass.agentFallback':
    'Tutup gap ber-evidence tinggi dan effort rendah dulu; baca entry point sebelum ubah hub.',
  'compass.llmInspecting': 'Agen sedang menjelaskan gap dan peluang…',
  'compass.llmSkipped': 'Mode struktural — gap dari detektor (LLM dilewati/gagal).',
  'compass.docsUsed': 'Docs: {files}',
  'compass.none': 'Tidak ada item di kategori ini.',
  'compass.section.gaps': 'Gaps & Opportunities',
  'compass.section.gapsHint': 'GAP · Evidence · Opportunity · Risk badge · Confidence',
  'compass.section.read': 'Mulai baca di sini',
  'compass.section.readHint': 'Entry point untuk memahami sistem dulu',
  'compass.section.steps': 'Langkah pertama',
  'compass.section.stepsHint': 'Quest singkat hari pertama',
  'compass.evidence': 'Evidence',
  'compass.opportunity': 'Opportunity',
  'compass.confidence': 'Confidence',
  'compass.confidence.low': 'rendah',
  'compass.confidence.medium': 'sedang',
  'compass.confidence.high': 'tinggi',
  'compass.priority': 'prio {score}',
  'compass.expand': 'Detail',
  'compass.collapse': 'Tutup',
  'compass.detail.why': 'Kenapa ini gap',
  'compass.detail.whyFallback': 'Detektor menemukan pola yang menandakan celah di area ini.',
  'compass.detail.contribute': 'Apa yang bisa dikontribusikan',
  'compass.openFile': 'Buka file terkait',
  'compass.explain': 'Explain detail',
  'compass.explain.again': 'Explain ulang',
  'compass.explain.loading': 'Menjelaskan…',
  'compass.explain.hint':
    'Tekan Explain detail untuk alasan semantik, contoh commit/kode, opsi kontribusi, dan justifikasi confidence.',
  'compass.explain.error': 'Gagal menjelaskan gap. Coba lagi.',
  'compass.explain.why': 'Kenapa ini penting',
  'compass.explain.example': 'Contoh konkret',
  'compass.explain.options': 'Opsi kontribusi (effort rendah → tinggi)',
  'compass.explain.confidenceWhy': 'Kenapa confidence ini',
  'compass.effort.low': 'effort rendah',
  'compass.effort.medium': 'effort sedang',
  'compass.effort.high': 'effort tinggi',
  'compass.risk.safe': 'Aman',
  'compass.risk.needs-review': 'Perlu review',
  'compass.risk.critical-zone': 'Zona kritis',
  'compass.type.orphan-promise': 'Orphan promise',
  'compass.type.bug-pattern': 'Bug pattern',
  'compass.type.yagni': 'YAGNI',
  'compass.type.incomplete-feature': 'Incomplete',
  'compass.type.coupling': 'Coupling',
  'compass.type.test-gap': 'Test gap',
  'compass.type.dead-config': 'Dead config',
  'compass.type.misleading-contract': 'Misleading contract',
  'compass.type.duplicate-logic': 'Duplicate logic',
  'compass.type.silent-fallback': 'Silent fallback',
  'compass.type.missing-observability': 'Missing observability',
  'compass.type.unbounded-resource': 'Unbounded resource',
  'compass.type.missing-idempotency': 'Missing idempotency',
  'compass.type.schema-api-drift': 'Schema/API drift',
  'compass.type.dependency-risk': 'Dependency risk',
  'compass.type.feature-flag-graveyard': 'Feature flag graveyard',
  'compass.type.ownership-gap': 'Ownership gap',
  'compass.type.convention-drift': 'Convention drift',
  'compass.type.migration-incomplete': 'Migration incomplete',
  'compass.type.naming-mismatch': 'Naming mismatch',
  'compass.type.circular-dependency': 'Circular dependency',
  'compass.type.magic-value': 'Magic value',
  'compass.type.inconsistent-error-handling': 'Inconsistent errors',
  'compass.type.copy-pasted-config': 'Copy-pasted config',
  'view.git': 'Git Insights',
  'view.git.hint': 'Churn, file hidup/beku, pemilik, dan coupling dari riwayat git.',
  'git.ui.empty': 'Belum ada Git Insights',
  'git.ui.emptyHint': 'Jalankan Analyze Git History dari sidebar NeverMIN.',
  'git.ui.run': 'Analisis Git History',
  'git.ui.statsCommits': '{count} commit',
  'git.ui.statsWindow': '{days} hari',
  'git.ui.alive': 'File Hidup',
  'git.ui.aliveHint': 'File dengan perubahan paling sering',
  'git.ui.frozen': 'File Beku',
  'git.ui.frozenHint': 'File yang tidak berubah dalam waktu lama',
  'git.ui.recent': 'Commit Terbaru',
  'git.ui.recentHint': 'Commit terbaru dari repository',
  'git.ui.owners': 'Pemilik file',
  'git.ui.couplings': 'Coupling',
  'git.ui.narrative': 'Narasi',
  'git.ui.daysAgo': '{days}h lalu',
  'git.ui.commitsCount': '{count} commit',
  'git.ui.together': '{count}x bareng',
  'git.ui.openNarrative': 'Buka narasi',
  'git.ui.sample': 'Sampel',
  'git.ui.sampleSub': 'dalam {days} hari terakhir',
  'git.ui.hottest': 'Paling hidup',
  'git.ui.coldest': 'Paling beku',
  'git.ui.coldestSub': '{days} hari sejak ubah terakhir',
  'git.ui.topCoupling': 'Coupling tertinggi',
  'git.ui.seeAlive': 'Lihat semua file hidup',
  'git.ui.seeFrozen': 'Lihat semua file beku',
  'git.ui.seeCommits': 'Lihat semua commit',
  'git.ui.collapse': 'Ciutkan',
  'git.ui.footerNote': 'Data berdasarkan riwayat git dalam {days} hari terakhir.',
  'git.ui.none': 'tidak ada',
  'git.ui.ownersHint': 'Author yang paling sering menyentuh file penting',
  'git.ui.couplingsHint': 'Pasangan file yang sering berubah bersama',
  'git.ui.llmTitle': 'LLM Insights',
  'git.ui.llmSubtitle': 'Narasi dari riwayat git — kenapa, siapa, dan coupling tersembunyi.',
  'git.ui.llmInspecting': 'LLM sedang menulis Git Insights…',
  'git.ui.llmStructural': 'Ringkasan struktural dari git history',
  'git.ui.llmStructuralHint':
    'Narasi LLM belum tersedia. Menampilkan ringkasan heuristik dari commit sample.',
  'git.ui.llmWaiting': 'Menunggu narasi LLM…',
  'git.ui.llmNone': 'Belum ada ringkasan untuk ditampilkan.',
  'git.ui.sectionAlive': 'Apa yang hidup vs beku',
  'git.ui.sectionWhy': 'Kenapa kode terlihat begini',
  'git.ui.sectionWho': 'Siapa yang ditanya',
  'git.ui.sectionCoupling': 'Coupling tersembunyi',
  'git.ui.activityLevel': 'Level aktivitas',
  'git.ui.activityNoFrozen': 'Tidak ada file beku di jendela ini — churn tersebar di file hidup.',
  'git.ui.activityMix': '{alive} hidup · {frozen} beku di jendela sample',
  'git.ui.aliveFallback':
    '{alive} file hidup dan {frozen} file beku di sample — fokus ke churn terbaru dulu.',
  'git.ui.primaryOwner': 'Primary Owner',
  'git.ui.ownerFocusFallback': 'Kontributor paling aktif di file kunci sample ini.',
  'header.copy': 'Salin',
  'header.insights': 'Insights',
  'header.llmBusy': 'LLM…',
  'nodeMenu.explain': 'Explain With LLM',
  'nodeMenu.flowChart': 'Flow Chart',
  'nodeMenu.openFile': 'Buka file',
  'nodeMenu.close': 'Tutup menu',
  'mindmap.empty': 'Belum ada data mind map. Jalankan Analyze Repo dulu.',
  'mindmap.root': 'Pecahan belajar',
  'mindmap.start': 'Mulai di sini',
  'mindmap.flow': 'Alur utama',
  'mindmap.hubs': 'Konsep inti (hub)',
  'mindmap.modules': 'Modul untuk dijelajahi',
  'mindmap.later': 'Cek belakangan',
  'mindmap.subtitle': '{entries} entry · {hubs} hub · pelajari berurutan',
  'insights.bullet.stats':
    'Graph punya {nodes} node dan {edges} edge ({imports} imports, {calls} calls, {uses} uses).',
  'insights.bullet.mainFlow': 'Flow utama data: Input: {input} → Output: {output}',
  'insights.bullet.primaryFlow': 'Alur utama: {label}.',
  'insights.bullet.entries': 'Titik masuk yang menonjol: {names}.',
  'insights.bullet.hubs': 'Hub yang sering dipakai: {names}.',
  'insights.bullet.orphans':
    '{count} file terlihat terisolasi (tanpa relasi antar-file), mis. {example}.',
  'insights.hubReason': 'PR {pr}%, diver modul {div}%{util}',
  'insights.hubUtil': ', util↓',
  'insights.orphanReason': 'Tidak punya relasi imports/calls/uses ke file lain',
  'webview.buildMissing': 'NeverMIN webview belum di-build',
  'webview.buildHint': 'Jalankan npm run build:webview lalu reload window.',
  'standalone.noDiagram': 'Belum ada diagram untuk dibuka di browser.'
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
  'sidebar.action.openSettingsHint': 'Language, provider, model, Ollama URL, file cap',
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
  'ollama.pickRequired':
    'Pick an installed Ollama model (NeverMIN: Choose Ollama Model), or switch to a cloud provider in Public mode.',
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
  'privacy.public.applied':
    'Public mode on — pick a cloud provider, then save an API key (Ollama is not cleared automatically).',
  'privacy.public.pickCloudTitle': 'Choose a cloud LLM provider',
  'privacy.public.pickCloudPlaceholder': 'Gemini, OpenAI, Anthropic, … (not Ollama)',
  'privacy.public.pickCloud': 'Pick cloud provider & save API key',
  'privacy.public.pickCloudHint': 'Provider is still Ollama',
  'privacy.public.stillOllama': 'Still Ollama — switch to use an API key',
  'privacy.public.needCloudFirst':
    'Public mode is still on Ollama. Pick a cloud provider before saving an API key.',
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
  'privacy.cloudBlockedAsk':
    'Private mode only allows Ollama. Switch to Public so you can use a cloud provider / API key?',
  'privacy.switchToPublic': 'Switch to Public',
  'privacy.keepPrivateOllama': 'Keep Private (Ollama)',
  'privacy.providerKept': 'Public mode on — provider kept as {provider}.',
  'privacy.switchToOllama': 'Use Ollama',
  'privacy.switchToOllamaAsk':
    'This switches from your cloud provider to local Ollama and clears stored cloud API keys. Continue?',
  'privacy.keepCloudProvider': 'Keep cloud provider',
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
  'explain.modal.badge': 'AI Explanation',
  'explain.modal.badgeLive': 'AI Explanation · Live',
  'explain.modal.loading': 'LLM is explaining this component…',
  'explain.modal.loadingScope': 'Preparing {scope} context…',
  'explain.modal.streaming': 'Writing explanation…',
  'explain.modal.error': 'Failed to explain this component.',
  'explain.modal.cancelled': 'Explanation cancelled.',
  'explain.modal.empty': 'No explanation available.',
  'explain.modal.close': 'Close explanation',
  'explain.modal.thinking': 'Model thinking (click to expand)',
  'explain.scope.file': 'whole file',
  'explain.scope.module': 'module folder',
  'explain.scope.function': 'function',
  'explain.scope.sensitivity': 'sensitivity',
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
  'webview.openSource': 'Open source',
  'webview.mindMap': 'Mind Map',
  'webview.mainFlowHeading': 'Main Flow',
  'webview.mermaidMissing': 'Mermaid library is unavailable in the webview. Check CSP / mermaid.min.js path.',
  'webview.copied': 'Mermaid source copied to clipboard.',
  'webview.noDiagramYet': 'No diagram to open yet.',
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
  'flow.renderFail': 'Mermaid failed to render.',
  'lang.active': 'Active',
  'graph.card.entry': 'Architecture entry point for {name}.',
  'graph.card.hub': 'Central hub connecting the {name} flow.',
  'graph.card.output': 'Output / presentation stage for {name}.',
  'graph.card.step': 'Pipeline step handling {name}.',
  'graph.card.file': 'File module {name} in the code graph.',
  'graph.card.component': 'Component {name} in the code graph.',
  'graph.arch.empty': 'No architecture insights yet. Run repo analysis.',
  'graph.arch.section.entry': '1 · Entry Points',
  'graph.arch.section.entryHint': 'Entry points — start reading here',
  'graph.arch.section.hub': '2 · Core Hubs',
  'graph.arch.section.hubHint': 'Central components with the most connections',
  'graph.arch.section.pipeline': '3 · Main Pipeline',
  'graph.arch.section.pipelineHint': 'Main path Input → Process → Output',
  'graph.arch.section.support': '4 · Supporting Modules',
  'graph.flow.empty': 'Main flow not detected yet. Run repo analysis.',
  'graph.flow.section.start': '1 · Start',
  'graph.flow.section.startHint': 'Start reading here — entry of this call flow',
  'graph.flow.section.step': '{n} · Next steps',
  'graph.flow.section.stepHint': 'Called from the previous step',
  'graph.flow.section.end': 'End · Results / leaves',
  'graph.flow.section.endHint': 'End of the flow — rarely calls other locals',
  'graph.flow.section.other': 'Other',
  'graph.flow.section.otherHint': 'Not connected to the main call flow',
  'graph.flow.card.start': 'Start here — {name} begins the flow in this file.',
  'graph.flow.card.step': '{name} is a mid-flow call step.',
  'graph.flow.card.end': '{name} tends to be a leaf / end of this file flow.',
  'graph.modules.empty': 'No modules to display yet.',
  'graph.modules.summary': '{count} files · relation score {score}',
  'graph.functions.empty': 'No functions detected in the graph.',
  'graph.functions.openHint': '{count} symbols · click to open',
  'graph.functions.noneInFile': 'No functions in {file}.',
  'graph.functions.pickFile': 'Pick a file to view its functions.',
  'graph.sensitive.empty': 'No sensitive code detected yet. Run repo analysis.',
  'graph.sensitive.section.critical': 'Critical',
  'graph.sensitive.section.criticalHint': 'Highest risk — a bad change can break the system core',
  'graph.sensitive.section.high': 'High',
  'graph.sensitive.section.highHint': 'Wide impact — auth, hubs, payment, or strong coupling',
  'graph.sensitive.section.medium': 'Medium',
  'graph.sensitive.section.mediumHint': 'Handle with care — entry, pipeline, config, or API',
  'graph.flow.mermaidEmpty': 'No flow yet',
  'graph.view.empty': 'No data for this view yet.',
  'graph.loading': 'Loading graph…',
  'graph.error': 'Failed to load graph.',
  'graph.none': 'No graph yet. Run Analyze Repo.',
  'graph.backAllFiles': 'All files',
  'graph.backNodeFlow': 'Back',
  'graph.panelMissing': 'Open the Code Graph panel first, then try Flow Chart again.',
  'graph.reactMissing': 'Graph has no React views yet. Recompile the extension.',
  'insights.waitingLlm': 'Waiting for LLM summary…',
  'insights.none': 'No insights yet.',
  'insights.title': 'Insights',
  'insights.subtitle': 'Understand the purpose, structure, and data flow of this codebase.',
  'insights.inspecting': 'LLM is inspecting this codebase…',
  'insights.openFlow': 'Open flow',
  'insights.purpose': 'What this codebase is for',
  'insights.overview': 'Overview',
  'insights.mainFlow': 'Main data flow',
  'insights.howToRead': 'How to read this codebase',
  'insights.startHere': 'Start here',
  'insights.followModules': 'Follow modules',
  'insights.trackExecution': 'Track execution',
  'insights.totalComponents': 'Total components:',
  'insights.tokenUsage': 'Tokens:',
  'insights.tokenUsageSplit': '{prompt} in · {completion} out',
  'insights.llmUnavailable': 'Structural mode',
  'insights.llmFailed': 'Structural mode',
  'insights.fallbackSkipped': 'LLM is off — insights are built from the code graph.',
  'insights.fallbackError': 'LLM failed — insights are built from the code graph.',
  'insights.structuralMode': 'Insights from the code graph',
  'insights.structuralHint':
    'Without the LLM, NeverMIN still shows entries, hubs, and the main flow from repo structure.',
  'insights.structuralOverview': 'Structural overview',
  'insights.hubs': 'Core hubs',
  'insights.sensitivity': 'Change with care',
  'insights.sensitivityHint':
    'High-sensitivity components — changing them wrongly can have wide system or data impact.',
  'sensitivity.level.critical': 'critical',
  'sensitivity.level.high': 'high',
  'sensitivity.level.medium': 'medium',
  'sensitivity.level.low': 'low',
  'explain.modal.sensitivity': 'Sensitivity: {level}',
  'insights.openMindMap': 'Open Mind Map',
  'view.architecture': 'Architecture',
  'view.architecture.hint':
    'High-level system map — entry points, hubs, and how major components connect.',
  'view.modules': 'Modules',
  'view.modules.hint': 'Folder / package view — which modules depend on each other.',
  'view.flow': 'Flow',
  'view.flow.hint': 'Main data path — Input → Process → Output through the codebase.',
  'view.functions': 'Functions',
  'view.functions.hint': 'All files with symbols — cards stay closed until you open one.',
  'view.sensitive': 'Sensitive code',
  'view.sensitive.hint':
    'High-risk files/symbols — grouped critical / high / medium. Explain covers why they are sensitive.',
  'view.compass': 'Contribution',
  'view.compass.hint':
    'Gaps & Opportunities — detect what’s missing, then turn gaps into contribution chances (risk is a badge only).',
  'compass.empty': 'No Gaps & Opportunities yet',
  'compass.emptyHint': 'Run repo analysis so NeverMIN can detect gaps and contribution opportunities.',
  'compass.runGit': 'Analyze Git History',
  'compass.noGitHint':
    'Git History has not run yet — gaps still detect, but without coupling/churn signals.',
  'compass.summary.gaps': 'Gaps',
  'compass.summary.gapsHint': 'Detected codebase gaps',
  'compass.summary.highPriority': 'High priority',
  'compass.summary.highPriorityHint': 'evidence × value / effort',
  'compass.summary.safeRisk': 'Low risk',
  'compass.summary.safeRiskHint': 'Gaps with a safe-to-touch badge',
  'compass.agentTitle': 'Agent advice',
  'compass.agentSubtitle': 'Explain gaps + filter false positives from docs',
  'compass.agentFallback':
    'Close high-evidence low-effort gaps first; read entry points before changing hubs.',
  'compass.llmInspecting': 'Agent is explaining gaps and opportunities…',
  'compass.llmSkipped': 'Structural mode — detector gaps (LLM skipped/failed).',
  'compass.docsUsed': 'Docs: {files}',
  'compass.none': 'No items in this category.',
  'compass.section.gaps': 'Gaps & Opportunities',
  'compass.section.gapsHint': 'GAP · Evidence · Opportunity · Risk badge · Confidence',
  'compass.section.read': 'Read first',
  'compass.section.readHint': 'Entry points to understand the system',
  'compass.section.steps': 'First steps',
  'compass.section.stepsHint': 'Short day-one quest',
  'compass.evidence': 'Evidence',
  'compass.opportunity': 'Opportunity',
  'compass.confidence': 'Confidence',
  'compass.confidence.low': 'low',
  'compass.confidence.medium': 'medium',
  'compass.confidence.high': 'high',
  'compass.priority': 'prio {score}',
  'compass.expand': 'Details',
  'compass.collapse': 'Close',
  'compass.detail.why': 'Why this is a gap',
  'compass.detail.whyFallback': 'A detector found a pattern that signals a gap in this area.',
  'compass.detail.contribute': 'What you can contribute',
  'compass.openFile': 'Open related file',
  'compass.explain': 'Explain detail',
  'compass.explain.again': 'Explain again',
  'compass.explain.loading': 'Explaining…',
  'compass.explain.hint':
    'Press Explain detail for semantic why, a concrete commit/code example, contribution options, and confidence justification.',
  'compass.explain.error': 'Failed to explain this gap. Try again.',
  'compass.explain.why': 'Why this matters',
  'compass.explain.example': 'Concrete example',
  'compass.explain.options': 'Contribution options (low → high effort)',
  'compass.explain.confidenceWhy': 'Why this confidence',
  'compass.effort.low': 'low effort',
  'compass.effort.medium': 'medium effort',
  'compass.effort.high': 'high effort',
  'compass.risk.safe': 'Safe',
  'compass.risk.needs-review': 'Needs review',
  'compass.risk.critical-zone': 'Critical zone',
  'compass.type.orphan-promise': 'Orphan promise',
  'compass.type.bug-pattern': 'Bug pattern',
  'compass.type.yagni': 'YAGNI',
  'compass.type.incomplete-feature': 'Incomplete',
  'compass.type.coupling': 'Coupling',
  'compass.type.test-gap': 'Test gap',
  'compass.type.dead-config': 'Dead config',
  'compass.type.misleading-contract': 'Misleading contract',
  'compass.type.duplicate-logic': 'Duplicate logic',
  'compass.type.silent-fallback': 'Silent fallback',
  'compass.type.missing-observability': 'Missing observability',
  'compass.type.unbounded-resource': 'Unbounded resource',
  'compass.type.missing-idempotency': 'Missing idempotency',
  'compass.type.schema-api-drift': 'Schema/API drift',
  'compass.type.dependency-risk': 'Dependency risk',
  'compass.type.feature-flag-graveyard': 'Feature flag graveyard',
  'compass.type.ownership-gap': 'Ownership gap',
  'compass.type.convention-drift': 'Convention drift',
  'compass.type.migration-incomplete': 'Migration incomplete',
  'compass.type.naming-mismatch': 'Naming mismatch',
  'compass.type.circular-dependency': 'Circular dependency',
  'compass.type.magic-value': 'Magic value',
  'compass.type.inconsistent-error-handling': 'Inconsistent errors',
  'compass.type.copy-pasted-config': 'Copy-pasted config',
  'view.git': 'Git Insights',
  'view.git.hint': 'Churn, alive/frozen files, owners, and couplings from git history.',
  'git.ui.empty': 'No Git Insights yet',
  'git.ui.emptyHint': 'Run Analyze Git History from the NeverMIN sidebar.',
  'git.ui.run': 'Analyze Git History',
  'git.ui.statsCommits': '{count} commits',
  'git.ui.statsWindow': '{days} days',
  'git.ui.alive': 'Hot files',
  'git.ui.aliveHint': 'Files that change most often',
  'git.ui.frozen': 'Frozen files',
  'git.ui.frozenHint': 'Files that have not changed for a long time',
  'git.ui.recent': 'Latest commits',
  'git.ui.recentHint': 'Most recent commits in the repository',
  'git.ui.owners': 'File owners',
  'git.ui.couplings': 'Couplings',
  'git.ui.narrative': 'Narrative',
  'git.ui.daysAgo': '{days}d ago',
  'git.ui.commitsCount': '{count} commits',
  'git.ui.together': '{count}x together',
  'git.ui.openNarrative': 'Open narrative',
  'git.ui.sample': 'Sample',
  'git.ui.sampleSub': 'in the last {days} days',
  'git.ui.hottest': 'Hottest',
  'git.ui.coldest': 'Most frozen',
  'git.ui.coldestSub': '{days} days since last change',
  'git.ui.topCoupling': 'Highest coupling',
  'git.ui.seeAlive': 'See all hot files',
  'git.ui.seeFrozen': 'See all frozen files',
  'git.ui.seeCommits': 'See all commits',
  'git.ui.collapse': 'Collapse',
  'git.ui.footerNote': 'Data is based on git history from the last {days} days.',
  'git.ui.none': 'none',
  'git.ui.ownersHint': 'Authors who most often touch key files',
  'git.ui.couplingsHint': 'File pairs that frequently change together',
  'git.ui.llmTitle': 'LLM Insights',
  'git.ui.llmSubtitle': 'Narrative from git history — why, who, and hidden coupling.',
  'git.ui.llmInspecting': 'LLM is writing Git Insights…',
  'git.ui.llmStructural': 'Structural summary from git history',
  'git.ui.llmStructuralHint':
    'LLM narrative is unavailable. Showing a heuristic summary from the commit sample.',
  'git.ui.llmWaiting': 'Waiting for LLM narrative…',
  'git.ui.llmNone': 'No summary to show yet.',
  'git.ui.sectionAlive': 'What is alive vs frozen',
  'git.ui.sectionWhy': 'Why the code looks like this',
  'git.ui.sectionWho': 'Who to ask',
  'git.ui.sectionCoupling': 'Hidden coupling',
  'git.ui.activityLevel': 'ACTIVITY LEVEL',
  'git.ui.activityNoFrozen': 'No strictly frozen files in sampled window.',
  'git.ui.activityMix': '{alive} alive · {frozen} frozen in sampled window',
  'git.ui.aliveFallback':
    '{alive} active files and {frozen} relatively frozen files in this commit sample.',
  'git.ui.primaryOwner': 'Primary Owner',
  'git.ui.ownerFocusFallback': 'Frequently touches this area based on git signals.',
  'header.copy': 'Copy',
  'header.insights': 'Insights',
  'header.llmBusy': 'LLM…',
  'nodeMenu.explain': 'Explain With LLM',
  'nodeMenu.flowChart': 'Flow Chart',
  'nodeMenu.openFile': 'Open file',
  'nodeMenu.close': 'Close menu',
  'mindmap.empty': 'No mind map data yet. Run Analyze Repo first.',
  'mindmap.root': 'Learning breakdown',
  'mindmap.start': 'Start here',
  'mindmap.flow': 'Main flow',
  'mindmap.hubs': 'Core hubs',
  'mindmap.modules': 'Modules to explore',
  'mindmap.later': 'Check later',
  'mindmap.subtitle': '{entries} entries · {hubs} hubs · learn in this order',
  'insights.bullet.stats':
    'Graph has {nodes} nodes and {edges} edges ({imports} imports, {calls} calls, {uses} uses).',
  'insights.bullet.mainFlow': 'Main data flow: Input: {input} → Output: {output}',
  'insights.bullet.primaryFlow': 'Primary flow: {label}.',
  'insights.bullet.entries': 'Notable entry points: {names}.',
  'insights.bullet.hubs': 'Frequently used hubs: {names}.',
  'insights.bullet.orphans':
    '{count} files look isolated (no cross-file relations), e.g. {example}.',
  'insights.hubReason': 'PR {pr}%, module-div {div}%{util}',
  'insights.hubUtil': ', util↓',
  'insights.orphanReason': 'No imports/calls/uses relations to other files',
  'webview.buildMissing': 'NeverMIN webview is not built yet',
  'webview.buildHint': 'Run npm run build:webview then reload the window.',
  'standalone.noDiagram': 'No diagram to open in the browser yet.'
};

export const messages: Record<'id' | 'en', Catalog> = { id, en };
