import type {
  LearningMindMapLeaf,
  LearningMindMapModel
} from '../core/graph/learningMindMap';
import {
  listMindMapLeavesNeedingBreakdown,
  mergeMindMapBreakdown
} from '../core/graph/learningMindMap';
import { createLlmProvider } from '../core/llm/llmClient';
import { getLanguage, getLlmTemperature } from '../utils/config';
import { runLoggedLlmCall, withCompletionUsageSummary } from '../utils/llmActivity';
import type { LlmSession } from '../utils/llmSession';
import { Logger } from '../utils/logger';
import { setCachedPromptResponse } from '../core/llm/promptCache';

function buildBreakdownPrompt(leaves: LearningMindMapLeaf[], lang: 'id' | 'en'): string {
  const items = leaves.map((leaf, i) => ({
    i: i + 1,
    id: leaf.id,
    name: leaf.name,
    filePath: leaf.filePath || '',
    role: leaf.role || '',
    kind: leaf.kind || ''
  }));

  if (lang === 'en') {
    return [
      'You deepen a learning mind map for onboarding engineers.',
      'For each parent node, list 2–5 concrete sub-steps (functions/helpers/stages) that exist inside that parent’s responsibility.',
      'If you cannot confidently break a parent further, return an empty children array for that id — never invent files.',
      'Respond with JSON only:',
      '{"items":[{"id":"parent-id","children":[{"name":"...","role":"step","kind":"function"}]}]}',
      'Parents:',
      JSON.stringify(items, null, 2)
    ].join('\n');
  }

  return [
    'Kamu memperdalam mind map belajar untuk onboarding engineer.',
    'Untuk setiap parent, daftar 2–5 sub-langkah konkret (fungsi/helper/tahap) di dalam tanggung jawab parent itu.',
    'Jika tidak yakin bisa dipecah, kembalikan children [] untuk id itu — jangan mengarang file.',
    'Jawab JSON saja:',
    '{"items":[{"id":"parent-id","children":[{"name":"...","role":"step","kind":"function"}]}]}',
    'Parents:',
    JSON.stringify(items, null, 2)
  ].join('\n');
}

function parseBreakdownResponse(
  raw: string,
  parents: LearningMindMapLeaf[]
): Record<string, LearningMindMapLeaf[]> {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return {};
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      items?: Array<{
        id?: string;
        children?: Array<{ name?: string; role?: string; kind?: string; filePath?: string }>;
      }>;
    };
    const parentById = new Map(parents.map((p) => [p.id, p]));
    const out: Record<string, LearningMindMapLeaf[]> = {};
    for (const item of parsed.items ?? []) {
      if (!item?.id || !parentById.has(item.id)) continue;
      const parent = parentById.get(item.id)!;
      const kids: LearningMindMapLeaf[] = [];
      for (const child of item.children ?? []) {
        const name = typeof child?.name === 'string' ? child.name.trim() : '';
        if (!name) continue;
        kids.push({
          id: `${parent.id}::${name}`,
          name: name.slice(0, 64),
          filePath: typeof child.filePath === 'string' && child.filePath.trim()
            ? child.filePath.trim()
            : parent.filePath,
          startLine: parent.startLine,
          endLine: parent.endLine,
          role: typeof child.role === 'string' ? child.role.slice(0, 24) : 'step',
          kind: typeof child.kind === 'string' ? child.kind : 'function'
        });
        if (kids.length >= 5) break;
      }
      if (kids.length > 0) {
        out[item.id] = kids;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * LLM memecah leaf yang masih datar. Yang tidak bisa dipecah → biarkan kosong.
 */
export async function enrichMindMapBreakdownWithLlm(options: {
  model: LearningMindMapModel;
  session: LlmSession;
}): Promise<LearningMindMapModel> {
  const lang = getLanguage();
  const parents = listMindMapLeavesNeedingBreakdown(options.model, 10);
  if (parents.length === 0) {
    return options.model;
  }

  const prompt = buildBreakdownPrompt(parents, lang);
  const task = lang === 'en' ? 'mind map breakdown' : 'pecah mind map';

  try {
    const provider = createLlmProvider(options.session.provider, options.session.apiKey, {
      model: options.session.model,
      temperature: getLlmTemperature(),
      baseUrl: options.session.baseUrl
    });
    const completion = await runLoggedLlmCall(
      {
        task,
        provider: options.session.providerLabel,
        model: options.session.model
      },
      () =>
        provider.complete(prompt, {
          skipCache: false,
          cacheResponse: false
        }),
      withCompletionUsageSummary((text) =>
        text.trim() ? `breakdown ${Math.min(text.trim().length, 9999)}c` : 'empty'
      )
    );
    setCachedPromptResponse(prompt, completion.text, {
      namespace: options.session.provider,
      usage: completion.usage
    });
    const byParent = parseBreakdownResponse(completion.text, parents);
    const filled = Object.keys(byParent).length;
    Logger.info(`Mind map LLM breakdown · ${filled}/${parents.length} parent terisi`);
    if (filled === 0) {
      return options.model;
    }
    return mergeMindMapBreakdown(options.model, byParent);
  } catch (error) {
    Logger.warn(
      `Mind map LLM breakdown gagal: ${error instanceof Error ? error.message : String(error)}`
    );
    return options.model;
  }
}
