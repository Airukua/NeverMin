import * as vscode from 'vscode';
import {
  applyContributionCompassLlmPayload,
  buildContributionCompass,
  type ContributionCompassModel
} from '../core/graph/contributionCompass';
import { collectContributionDocs } from '../core/graph/contributionDocs';
import type { GraphInsights } from '../core/graph/graphInsights';
import type { CodeGraph } from '../core/graph/types';
import type { GitHistoryInsights } from '../core/git/gitHistoryInsights';
import {
  buildContributionCompassPrompt,
  parseContributionCompassLlmResponse
} from '../core/llm/contributionCompassPrompt';
import { createLlmProvider } from '../core/llm/llmClient';
import { accumulateCompletionUsage } from '../core/llm/tokenUsage';
import type { LlmTokenUsage } from '../types';
import { getLanguage, getLlmTemperature } from '../utils/config';
import { runLoggedLlmCall, withCompletionUsageSummary } from '../utils/llmActivity';
import type { LlmSession } from '../utils/llmSession';
import { classifyLlmError, type LlmIssue } from '../utils/llmUserNotice';
import { Logger } from '../utils/logger';
import { setCachedPromptResponse } from '../core/llm/promptCache';

async function readWorkspaceFile(filePath: string): Promise<string> {
  const uri = vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  return doc.getText();
}

export async function enrichContributionCompassWithLlm(options: {
  insights: GraphInsights;
  graph?: CodeGraph | null;
  gitHistory?: GitHistoryInsights | null;
  session: LlmSession;
  candidateDocPaths: string[];
  fileContents?: Array<{ path: string; content: string }>;
}): Promise<{
  compass: ContributionCompassModel;
  issue?: LlmIssue;
  tokenUsage?: LlmTokenUsage;
}> {
  const lang = getLanguage();
  const git = options.gitHistory ?? null;
  const { snippets, usedPaths } = await collectContributionDocs(
    options.candidateDocPaths,
    readWorkspaceFile
  );
  const docsText = snippets.map((s) => s.content).join('\n\n');
  const base = buildContributionCompass({
    insights: options.insights,
    graph: options.graph,
    git,
    docsText,
    docsPaths: usedPaths,
    fileContents: options.fileContents,
    lang,
    llmStatus: 'pending'
  });

  const providerLabel = options.session.providerLabel;
  const task = lang === 'en' ? 'contribution gaps agent' : 'agen gap kontribusi';
  const prompt = buildContributionCompassPrompt({
    model: base,
    docs: snippets,
    lang
  });

  try {
    const provider = createLlmProvider(options.session.provider, options.session.apiKey, {
      model: options.session.model,
      temperature: getLlmTemperature(),
      baseUrl: options.session.baseUrl
    });
    const completion = await runLoggedLlmCall(
      {
        task,
        provider: providerLabel,
        model: options.session.model
      },
      () =>
        provider.complete(prompt, {
          skipCache: false,
          cacheResponse: false
        }),
      withCompletionUsageSummary((text) =>
        text.trim() ? `gaps ${Math.min(text.trim().length, 9999)}c` : 'empty'
      )
    );
    const tokenUsage = accumulateCompletionUsage(undefined, {
      ...completion,
      fromCache: false
    });
    const payload = parseContributionCompassLlmResponse(completion.text);
    if (!payload) {
      Logger.warn(`LLM hasil · ${task} · unparseable`);
      return {
        compass: { ...base, llmStatus: 'error' },
        issue: { kind: 'empty', providerLabel, detail: 'unparseable gaps JSON' },
        tokenUsage
      };
    }
    setCachedPromptResponse(prompt, completion.text, {
      namespace: options.session.provider,
      usage: completion.usage
    });
    const merged = applyContributionCompassLlmPayload(base, payload, lang);
    return { compass: { ...merged, docsUsed: usedPaths }, tokenUsage };
  } catch (error) {
    const issue: LlmIssue = {
      kind: classifyLlmError(error),
      providerLabel,
      detail: error instanceof Error ? error.message : String(error)
    };
    Logger.warn(`LLM hasil · ${task} · gagal · ${issue.detail}`);
    return {
      compass: { ...base, llmStatus: 'error' },
      issue
    };
  }
}

export function heuristicCompass(
  insights: GraphInsights,
  gitHistory?: GitHistoryInsights | null,
  llmStatus: ContributionCompassModel['llmStatus'] = 'idle',
  extras?: {
    graph?: CodeGraph | null;
    fileContents?: Array<{ path: string; content: string }>;
    docsText?: string;
    docsPaths?: string[];
  }
): ContributionCompassModel {
  return buildContributionCompass({
    insights,
    git: gitHistory ?? null,
    lang: getLanguage(),
    llmStatus,
    graph: extras?.graph,
    fileContents: extras?.fileContents,
    docsText: extras?.docsText,
    docsPaths: extras?.docsPaths
  });
}
