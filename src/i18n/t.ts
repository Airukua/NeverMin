import { getLanguage } from '../utils/config';
import { NeverminLanguage } from './types';
import { MessageKey, messages } from './messages';

export function t(key: MessageKey, vars?: Record<string, string | number>, lang?: NeverminLanguage): string {
  const locale = lang ?? getLanguage();
  const catalog = messages[locale] ?? messages.id;
  let text = catalog[key] ?? messages.id[key] ?? String(key);
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}

/** Bag string untuk webview (hindari baca config berulang di HTML). */
export function webviewUiMessages(lang?: NeverminLanguage): Record<string, string> {
  const locale = lang ?? getLanguage();
  const keys: MessageKey[] = [
    'webview.modules',
    'webview.flow',
    'webview.functions',
    'webview.insights',
    'webview.copyMermaid',
    'webview.openSource',
    'webview.theme',
    'webview.themeLight',
    'webview.themeDark',
    'webview.fullFlow',
    'webview.mindMap',
    'webview.openMindMap',
    'webview.mindMapHint',
    'webview.closeInsights',
    'webview.zoomHint',
    'webview.loadingTitle',
    'webview.loadingBody',
    'webview.emptyTitle',
    'webview.emptyBody',
    'webview.errorTitle',
    'webview.errorBody',
    'webview.insightsTitle',
    'webview.purposeHeading',
    'webview.summaryHeading',
    'webview.mainFlowHeading',
    'webview.mainFlowEmpty',
    'webview.mainFlowEmptyHint',
    'webview.mainFlowWeak',
    'webview.openFullFlow',
    'webview.entryHeading',
    'webview.hubHeading',
    'webview.statsHeading',
    'webview.statFiles',
    'webview.statEdges',
    'webview.statTotal',
    'webview.statNodes',
    'webview.noInsightsPurpose',
    'webview.noInsightsSummary',
    'webview.rendering',
    'webview.noMermaid',
    'webview.mermaidMissing',
    'webview.mermaidFail',
    'webview.copied',
    'webview.noDiagramYet',
    'webview.truncateNote',
    'webview.purposeFallback'
  ];
  const out: Record<string, string> = { lang: locale };
  for (const key of keys) {
    out[key] = t(key, undefined, locale);
  }
  return out;
}
