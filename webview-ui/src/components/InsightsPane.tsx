import { useMemo, type ReactNode } from 'react';
import {
  BookOpen,
  ChevronRight,
  Crosshair,
  GitBranch,
  Info,
  Layers,
  LoaderCircle,
  Network,
  Play,
  Puzzle,
  Sparkles,
  Waypoints,
  Workflow
} from 'lucide-react';
import type {
  InsightRef,
  LlmInsightsStatus,
  MainFlow,
  WebviewInsights
} from '../types';
import {
  formatInsightInline,
  inferPrimaryLanguage,
  resolveInsightPanel
} from '../lib/insightPanel';
import { getLanguageColor, getLanguageIcon } from '../lib/languageIcons';
import { tw } from '../i18n';
import { postToExtension } from '../vscodeApi';

function formatTokenCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value >= 10_000) {
    return `${(value / 1000).toFixed(value >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  }
  return String(Math.round(value));
}

interface InsightsPaneProps {
  insights: WebviewInsights | null;
  open: boolean;
  llmStatus: LlmInsightsStatus;
  llmMessage?: string;
  onOpenMainFlow: () => void;
  onSelectRef: (ref: InsightRef) => void;
  i18nTick?: number;
}

function shortPath(filePath?: string): string {
  if (!filePath) return '';
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return parts.join('/');
  return parts.slice(-2).join('/');
}

function friendlyRefMeta(ref: InsightRef): string {
  const path = shortPath(ref.filePath);
  const kind = (ref.kind || '').trim();
  if (path && kind) return `${kind} · ${path}`;
  return path || kind || '';
}

function SectionCard({
  accent,
  icon,
  title,
  children
}: {
  accent: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 28%, transparent)`,
        background: `color-mix(in srgb, ${accent} 6%, #0d1524)`
      }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            color: accent,
            background: `color-mix(in srgb, ${accent} 16%, transparent)`
          }}
        >
          {icon}
        </span>
        <h3 className="text-sm font-semibold" style={{ color: accent }}>
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function RefList({
  refs,
  accent,
  onSelectRef
}: {
  refs: InsightRef[];
  accent: string;
  onSelectRef: (ref: InsightRef) => void;
}) {
  return (
    <ul className="space-y-1">
      {refs.slice(0, 6).map((ref, index) => {
        const meta = friendlyRefMeta(ref);
        return (
          <li key={ref.id}>
            <button
              type="button"
              onClick={() => onSelectRef(ref)}
              className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  color: accent,
                  background: `color-mix(in srgb, ${accent} 18%, transparent)`
                }}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-white">{ref.name}</span>
                {meta ? (
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--text-lo)]">
                    {meta}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StructuralFlow({ flow }: { flow: MainFlow }) {
  const stages =
    flow.stages && flow.stages.length > 0
      ? flow.stages.map((s) => s.name)
      : [flow.input, ...(flow.process ?? []), flow.output].filter(Boolean);

  return (
    <ol className="relative ml-1 space-y-0">
      {stages.map((name, index) => (
        <li key={`${index}-${name}`} className="relative flex gap-3 pb-3 last:pb-0">
          {index < stages.length - 1 ? (
            <span
              className="absolute left-[11px] top-7 bottom-0 w-px border-l border-dashed border-[color-mix(in_srgb,#a78bfa_45%,transparent)]"
              aria-hidden
            />
          ) : null}
          <span className="relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#a78bfa_22%,transparent)] text-[11px] font-semibold text-[#c4b5fd]">
            {index + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="truncate text-[13px] font-medium text-[#e8ecf4]">{name}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StructuralBanner({
  status,
  message
}: {
  status: LlmInsightsStatus;
  message?: string;
}) {
  if (status !== 'error' && status !== 'skipped') {
    return null;
  }
  const detail =
    message?.trim() && !/^fetch failed$/i.test(message.trim())
      ? message.trim()
      : status === 'skipped'
        ? tw('insights.fallbackSkipped')
        : tw('insights.fallbackError');

  return (
    <div
      className="rounded-xl border border-[color-mix(in_srgb,#2dd4bf_28%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,#2dd4bf_10%,transparent),color-mix(in_srgb,#3b82f6_8%,transparent))] px-4 py-3"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,#2dd4bf_16%,transparent)] text-[#2dd4bf]">
          <Workflow size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#5eead4]">{tw('insights.structuralMode')}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-hi)]">
            {tw('insights.structuralHint')}
          </p>
          <p className="mt-1.5 text-[10px] text-[var(--text-lo)]">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function HeuristicFallback({
  insights,
  llmStatus,
  llmMessage,
  onSelectRef,
  onOpenMainFlow
}: {
  insights: WebviewInsights;
  llmStatus: LlmInsightsStatus;
  llmMessage?: string;
  onSelectRef: (ref: InsightRef) => void;
  onOpenMainFlow: () => void;
}) {
  const stats = insights.stats;
  const overviewBits = [
    stats ? `${stats.nodeCount} nodes · ${stats.edgeCount} edges` : null,
    stats?.edgesByKind
      ? `${stats.edgesByKind.imports ?? 0} imports · ${stats.edgesByKind.calls ?? 0} calls`
      : null
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3">
      <StructuralBanner status={llmStatus} message={llmMessage} />

      {overviewBits.length > 0 || insights.summaryBullets?.length ? (
        <SectionCard
          accent="#3b82f6"
          icon={<Layers size={16} />}
          title={tw('insights.structuralOverview')}
        >
          {overviewBits.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {overviewBits.map((bit) => (
                <span
                  key={bit}
                  className="rounded-full border border-[color-mix(in_srgb,#60a5fa_30%,transparent)] bg-[color-mix(in_srgb,#60a5fa_10%,transparent)] px-2.5 py-1 font-mono text-[10px] text-[#93c5fd]"
                >
                  {bit}
                </span>
              ))}
            </div>
          ) : null}
          {insights.summaryBullets?.length ? (
            <ul className="space-y-2">
              {insights.summaryBullets.slice(0, 4).map((b) => (
                <li key={b} className="text-[12px] leading-relaxed text-[#e8ecf4]">
                  {b}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] leading-relaxed text-[var(--text-lo)]">
              {tw('insights.structuralHint')}
            </p>
          )}
        </SectionCard>
      ) : null}

      {insights.mainFlow ? (
        <SectionCard accent="#a78bfa" icon={<GitBranch size={16} />} title={tw('insights.mainFlow')}>
          <StructuralFlow flow={insights.mainFlow} />
          <button
            type="button"
            onClick={onOpenMainFlow}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,#a78bfa_40%,transparent)] px-2.5 py-1.5 text-[11px] font-medium text-[#c4b5fd] hover:bg-[color-mix(in_srgb,#a78bfa_12%,transparent)]"
          >
            {tw('insights.openFlow')}
            <ChevronRight size={12} />
          </button>
        </SectionCard>
      ) : null}

      {(insights.entryPoints?.length ?? 0) > 0 ? (
        <SectionCard
          accent="#2dd4bf"
          icon={<Crosshair size={16} />}
          title={tw('graph.arch.section.entry')}
        >
          <RefList refs={insights.entryPoints} accent="#2dd4bf" onSelectRef={onSelectRef} />
        </SectionCard>
      ) : null}

      {(insights.hubs?.length ?? 0) > 0 ? (
        <SectionCard accent="#f0b429" icon={<Puzzle size={16} />} title={tw('insights.hubs')}>
          <RefList refs={insights.hubs} accent="#f0b429" onSelectRef={onSelectRef} />
        </SectionCard>
      ) : null}

      <SectionCard accent="#38bdf8" icon={<BookOpen size={16} />} title={tw('insights.howToRead')}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: tw('insights.startHere'), text: insights.entryPoints?.[0]?.name },
            { label: tw('insights.followModules'), text: insights.hubs?.[0]?.name },
            {
              label: tw('insights.trackExecution'),
              text: insights.mainFlow
                ? `${insights.mainFlow.input} → ${insights.mainFlow.output}`
                : undefined
            }
          ]
            .filter((c) => c.text)
            .map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-[color-mix(in_srgb,#38bdf8_22%,transparent)] bg-[color-mix(in_srgb,#38bdf8_6%,transparent)] p-3"
              >
                <div className="mb-1 text-[11px] font-semibold text-[#7dd3fc]">{card.label}</div>
                <p className="truncate text-[11px] leading-snug text-[#e8ecf4]">{card.text}</p>
              </div>
            ))}
        </div>
        <button
          type="button"
          onClick={() => postToExtension({ type: 'openMindMap' })}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,#38bdf8_40%,transparent)] bg-[color-mix(in_srgb,#38bdf8_12%,transparent)] px-3 py-2 text-xs font-medium text-[#7dd3fc] transition hover:bg-[color-mix(in_srgb,#38bdf8_20%,transparent)]"
        >
          <Network size={14} />
          {tw('insights.openMindMap')}
        </button>
      </SectionCard>
    </div>
  );
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={[
        'animate-pulse rounded bg-[color-mix(in_srgb,var(--text-lo)_20%,transparent)]',
        className
      ].join(' ')}
    />
  );
}

function InsightsSectionSkeletons() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={tw('insights.inspecting')}>
      <SectionCard accent="#2dd4bf" icon={<Crosshair size={16} />} title={tw('insights.purpose')}>
        <div className="space-y-2">
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-[94%]" />
          <SkeletonBar className="h-3 w-[72%]" />
        </div>
      </SectionCard>
      <SectionCard accent="#3b82f6" icon={<Layers size={16} />} title={tw('insights.overview')}>
        <div className="space-y-2">
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-[88%]" />
          <SkeletonBar className="h-3 w-[60%]" />
        </div>
      </SectionCard>
      <SectionCard accent="#a78bfa" icon={<GitBranch size={16} />} title={tw('insights.mainFlow')}>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <SkeletonBar className="h-6 w-6 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5 pt-1">
                <SkeletonBar className="h-2.5 w-full" />
                <SkeletonBar className="h-2.5 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard accent="#f0b429" icon={<BookOpen size={16} />} title={tw('insights.howToRead')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[tw('insights.startHere'), tw('insights.followModules'), tw('insights.trackExecution')].map(
            (label) => (
              <div
                key={label}
                className="rounded-lg border border-[color-mix(in_srgb,#f0b429_22%,transparent)] bg-[color-mix(in_srgb,#f0b429_6%,transparent)] p-3"
              >
                <div className="mb-2 text-[11px] font-semibold text-[#f0b429]">{label}</div>
                <div className="space-y-1.5">
                  <SkeletonBar className="h-2 w-full" />
                  <SkeletonBar className="h-2 w-[85%]" />
                  <SkeletonBar className="h-2 w-[70%]" />
                </div>
              </div>
            )
          )}
        </div>
      </SectionCard>
      <p className="pt-1 text-center text-[11px] text-[var(--text-lo)]">{tw('insights.inspecting')}</p>
    </div>
  );
}

export function InsightsPane({
  insights,
  open,
  llmStatus,
  llmMessage,
  onOpenMainFlow,
  onSelectRef,
  i18nTick = 0
}: InsightsPaneProps) {
  void i18nTick;
  const panel = useMemo(() => resolveInsightPanel(insights), [insights]);
  const language = useMemo(
    () => (insights ? inferPrimaryLanguage(insights) : null),
    [insights]
  );
  const nodeCount = insights?.stats?.nodeCount;
  const inspecting = llmStatus === 'inspecting';
  const structuralMode = llmStatus === 'error' || llmStatus === 'skipped';
  const tokenUsage = insights?.tokenUsage;
  const promptTokens = tokenUsage?.promptTokens;
  const completionTokens = tokenUsage?.completionTokens;
  const totalTokens =
    tokenUsage?.totalTokens ??
    (promptTokens != null || completionTokens != null
      ? (promptTokens ?? 0) + (completionTokens ?? 0)
      : undefined);
  const hasTokenUsage = totalTokens != null && totalTokens > 0;
  const hasLlmPanel = Boolean(
    panel &&
      (panel.purpose ||
        panel.overview ||
        panel.flowSteps.length > 0 ||
        panel.readingGuide.startHere ||
        panel.readingGuide.followModules ||
        panel.readingGuide.trackExecution)
  );

  if (!open) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex justify-end p-3 md:p-4">
      <aside
        className="pointer-events-auto flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,#5eead4_22%,transparent)] bg-[#0b1220]/95] shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md"
        aria-label={tw('insights.title')}
        aria-busy={inspecting}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,#2dd4bf_18%,transparent)] text-[#2dd4bf]">
              {inspecting ? (
                <LoaderCircle className="animate-spin" size={18} strokeWidth={2} />
              ) : structuralMode ? (
                <Workflow size={18} strokeWidth={2} />
              ) : (
                <Sparkles size={18} strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-white">{tw('insights.title')}</h2>
              <p className="mt-0.5 text-xs leading-snug text-[var(--text-lo)]">
                {inspecting
                  ? tw('insights.inspecting')
                  : structuralMode
                    ? tw('insights.structuralMode')
                    : tw('insights.subtitle')}
              </p>
            </div>
          </div>
          {insights?.mainFlow && !inspecting ? (
            <button
              type="button"
              onClick={onOpenMainFlow}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,#2dd4bf_45%,transparent)] px-2.5 py-1.5 text-[11px] font-medium text-[#2dd4bf] hover:bg-[color-mix(in_srgb,#2dd4bf_12%,transparent)]"
            >
              {tw('insights.openFlow')}
              <ChevronRight size={12} />
            </button>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
          {inspecting ? (
            <InsightsSectionSkeletons />
          ) : !insights ? (
            <p className="text-xs text-[var(--text-lo)]">{tw('insights.none')}</p>
          ) : (
            <>
              {hasLlmPanel && !structuralMode ? (
            <>
              {panel!.purpose ? (
                <SectionCard
                  accent="#2dd4bf"
                  icon={<Crosshair size={16} />}
                  title={tw('insights.purpose')}
                >
                  <p
                    className="text-[13px] leading-relaxed text-[#e8ecf4]"
                    dangerouslySetInnerHTML={{
                      __html: formatInsightInline(panel!.purpose, '#2dd4bf')
                    }}
                  />
                </SectionCard>
              ) : null}

              {panel!.overview ? (
                <SectionCard accent="#3b82f6" icon={<Layers size={16} />} title={tw('insights.overview')}>
                  <p
                    className="text-[13px] leading-relaxed text-[#e8ecf4]"
                    dangerouslySetInnerHTML={{
                      __html: formatInsightInline(panel!.overview, '#60a5fa')
                    }}
                  />
                </SectionCard>
              ) : null}

              {panel!.flowSteps.length > 0 ? (
                <SectionCard
                  accent="#a78bfa"
                  icon={<GitBranch size={16} />}
                  title={tw('insights.mainFlow')}
                >
                  <ol className="relative ml-1 space-y-0">
                    {panel!.flowSteps.map((step, index) => (
                      <li
                        key={`${index}-${step.slice(0, 24)}`}
                        className="relative flex gap-3 pb-4 last:pb-0"
                      >
                        {index < panel!.flowSteps.length - 1 ? (
                          <span
                            className="absolute left-[11px] top-7 bottom-0 w-px border-l border-dashed border-[color-mix(in_srgb,#a78bfa_45%,transparent)]"
                            aria-hidden
                          />
                        ) : null}
                        <span className="relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#a78bfa_22%,transparent)] text-[11px] font-semibold text-[#c4b5fd]">
                          {index + 1}
                        </span>
                        <p
                          className="pt-0.5 text-[13px] leading-relaxed text-[#e8ecf4]"
                          dangerouslySetInnerHTML={{
                            __html: formatInsightInline(step, '#c4b5fd')
                          }}
                        />
                      </li>
                    ))}
                  </ol>
                </SectionCard>
              ) : null}

              {(panel!.readingGuide.startHere ||
                panel!.readingGuide.followModules ||
                panel!.readingGuide.trackExecution) && (
                <SectionCard
                  accent="#f0b429"
                  icon={<BookOpen size={16} />}
                  title={tw('insights.howToRead')}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      {
                        key: 'start',
                        label: tw('insights.startHere'),
                        icon: <Play size={14} />,
                        text: panel!.readingGuide.startHere
                      },
                      {
                        key: 'follow',
                        label: tw('insights.followModules'),
                        icon: <Puzzle size={14} />,
                        text: panel!.readingGuide.followModules
                      },
                      {
                        key: 'track',
                        label: tw('insights.trackExecution'),
                        icon: <Waypoints size={14} />,
                        text: panel!.readingGuide.trackExecution
                      }
                    ]
                      .filter((c) => c.text)
                      .map((card) => (
                        <div
                          key={card.key}
                          className="rounded-lg border border-[color-mix(in_srgb,#f0b429_22%,transparent)] bg-[color-mix(in_srgb,#f0b429_6%,transparent)] p-3"
                        >
                          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#f0b429]">
                            {card.icon}
                            {card.label}
                          </div>
                          <p
                            className="text-[11px] leading-snug text-[#e8ecf4]"
                            dangerouslySetInnerHTML={{
                              __html: formatInsightInline(card.text, '#fbbf24')
                            }}
                          />
                        </div>
                      ))}
                  </div>
                </SectionCard>
              )}
            </>
              ) : (
                <HeuristicFallback
                  insights={insights}
                  llmStatus={llmStatus}
                  llmMessage={llmMessage}
                  onSelectRef={onSelectRef}
                  onOpenMainFlow={onOpenMainFlow}
                />
              )}
            </>
          )}
        </div>

        {insights && !inspecting && (nodeCount != null || language || hasTokenUsage) ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-white/5 px-5 py-3 text-[11px] text-[var(--text-lo)]">
            <span className="inline-flex items-center gap-1.5">
              <Info size={12} />
              {nodeCount != null ? (
                <>
                  {tw('insights.totalComponents')}{' '}
                  <strong className="text-white">{nodeCount}</strong>
                </>
              ) : (
                tw('insights.title')
              )}
            </span>
            {hasTokenUsage ? (
              <span
                className="inline-flex items-center gap-1.5"
                title={
                  promptTokens != null || completionTokens != null
                    ? tw('insights.tokenUsageSplit', {
                        prompt: formatTokenCount(promptTokens ?? 0),
                        completion: formatTokenCount(completionTokens ?? 0)
                      })
                    : undefined
                }
              >
                {tw('insights.tokenUsage')}{' '}
                <strong className="text-white">{formatTokenCount(totalTokens!)}</strong>
                {promptTokens != null && completionTokens != null ? (
                  <span className="text-[10px] text-[var(--text-lo)]">
                    ({formatTokenCount(promptTokens)}→{formatTokenCount(completionTokens)})
                  </span>
                ) : null}
              </span>
            ) : null}
            {language ? (
              <span className="inline-flex items-center gap-1.5">
                {tw('lang.label')}:
                {(() => {
                  const LangIcon = getLanguageIcon(language);
                  return LangIcon ? (
                    <LangIcon size={14} color={getLanguageColor(language)} aria-hidden />
                  ) : null;
                })()}
                <strong className="text-white">{language}</strong>
              </span>
            ) : null}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
