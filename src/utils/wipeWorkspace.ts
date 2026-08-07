import * as vscode from 'vscode';
import { clearPromptCache } from '../core/llm/promptCache';
import { clearCachedCodeGraph } from './codeGraphCache';
import { clearGitHistory } from './gitHistoryAnalysis';
import { clearPrivacyMode } from './privacyMode';
import { clearLastAnalysisMode, clearRepoAnalysis } from './repoAnalysis';
import { clearSelectedAnalysisFilePaths } from './repoAnalysisSelection';
import { Logger } from './logger';

export type WipeWorkspaceOptions = {
  /** Juga hapus pilihan Private/Public → user harus pilih lagi. */
  resetPrivacyMode?: boolean;
};

/**
 * Hapus semua data NeverMIN di workspaceState + prompt cache LLM.
 * Tidak menghapus API key SecretStorage (global); Private mode membersihkan key cloud terpisah.
 */
export async function wipeNeverminWorkspaceData(
  context: vscode.ExtensionContext,
  options: WipeWorkspaceOptions = {}
): Promise<void> {
  clearPromptCache();
  await clearRepoAnalysis(context);
  await clearCachedCodeGraph(context);
  await clearLastAnalysisMode(context);
  await clearGitHistory(context);
  await clearSelectedAnalysisFilePaths(context);

  if (options.resetPrivacyMode) {
    await clearPrivacyMode(context);
  }

  Logger.info(
    options.resetPrivacyMode
      ? 'Workspace wipe · analysis/git/selection/cache + privacy mode reset'
      : 'Workspace wipe · analysis/git/selection/cache (privacy mode kept)'
  );
}
