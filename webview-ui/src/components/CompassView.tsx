import { useState, type ReactNode } from 'react';
import {
  Compass,
  BookOpen,
  ListOrdered,
  Sparkles,
  LoaderCircle,
  Workflow,
  FolderGit2,
  ChevronRight,
  ChevronDown,
  Target,
  CircleAlert,
  ShieldCheck,
  ShieldAlert,
  TriangleAlert,
  FileCode2
} from 'lucide-react';
import type {
  CompassItem,
  CompassStep,
  ContributionCompassModel,
  ContributionGap,
  GapExplainEffort,
  GapType,
  RiskBadge
} from '../types';
import { tw } from '../i18n';
import { postToExtension } from '../vscodeApi';

function shortPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return parts.join('/') || filePath;
  return parts.slice(-2).join('/');
}

function gapTypeLabel(type: GapType): string {
  return tw(`compass.type.${type}`);
}

function riskLabel(badge: RiskBadge): string {
  return tw(`compass.risk.${badge}`);
}

function riskAccent(badge: RiskBadge): string {
  if (badge === 'critical-zone') return '#f87171';
  if (badge === 'needs-review') return '#fbbf24';
  return '#34d399';
}

function RiskIcon({ badge }: { badge: RiskBadge }) {
  if (badge === 'critical-zone') return <ShieldAlert size={12} />;
  if (badge === 'needs-review') return <TriangleAlert size={12} />;
  return <ShieldCheck size={12} />;
}

function SummaryCard({
  accent,
  icon,
  label,
  title,
  subtitle
}: {
  accent: string;
  icon: ReactNode;
  label: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[var(--panel)] px-4 py-3.5">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"
        style={{ color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium" style={{ color: accent }}>
          {label}
        </div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-white">{title}</div>
        <div className="mt-0.5 truncate text-[10px] text-[var(--text-lo)]">{subtitle}</div>
      </div>
    </div>
  );
}

function SectionCard({
  accent,
  icon,
  title,
  hint,
  children
}: {
  accent: string;
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--panel)_90%,transparent)]">
      <header className="border-b border-white/10 px-4 py-3.5">
        <div className="flex items-center gap-2" style={{ color: accent }}>
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-lo)]">{hint}</p>
      </header>
      <div className="space-y-2 px-3 py-3">{children}</div>
    </section>
  );
}

function GapCard({
  gap,
  onOpen
}: {
  gap: ContributionGap;
  onOpen: (gap: ContributionGap) => void;
}) {
  const [open, setOpen] = useState(false);
  const accent = riskAccent(gap.riskBadge);
  const hasFile = Boolean(gap.filePath);
  const explainStatus = gap.explainStatus ?? 'idle';
  const detail = gap.explainDetail;
  const explaining = explainStatus === 'loading' || explainStatus === 'streaming';

  const runExplain = () => {
    if (explaining) return;
    postToExtension({ type: 'explainGap', gapId: gap.id });
  };

  return (
    <div
      className={[
        'rounded-xl border border-white/5 bg-white/[0.02] transition',
        open ? 'border-white/10 bg-white/[0.03]' : 'hover:bg-white/[0.05]'
      ].join(' ')}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-col gap-2 px-3 py-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#94a3b8]">
            {gapTypeLabel(gap.type)}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              color: accent,
              borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
              background: `color-mix(in srgb, ${accent} 12%, transparent)`
            }}
          >
            <RiskIcon badge={gap.riskBadge} />
            {riskLabel(gap.riskBadge)}
          </span>
          <span className="ml-auto font-mono text-[10px] text-[var(--text-lo)]">
            {tw('compass.priority', { score: gap.priorityScore.toFixed(1) })}
          </span>
        </div>

        <div className="text-[13px] font-medium leading-snug text-white">{gap.title}</div>

        {!open ? (
          <>
            {gap.evidence[0] ? (
              <div className="text-[11px] leading-snug text-[var(--text-lo)]">
                <span className="font-medium text-[#94a3b8]">{tw('compass.evidence')}: </span>
                {gap.evidence[0]}
                {gap.evidence.length > 1 ? ` (+${gap.evidence.length - 1})` : ''}
              </div>
            ) : null}
            <div className="text-[11px] leading-snug text-[#e2e8f0]">
              <span className="font-medium text-[#2dd4bf]">{tw('compass.opportunity')}: </span>
              {gap.opportunity}
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-lo)]">
          <span>
            {tw('compass.confidence')}: {tw(`compass.confidence.${gap.confidence}`)}
          </span>
          {gap.filePath ? (
            <span className="truncate font-mono">{shortPath(gap.filePath)}</span>
          ) : null}
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[var(--text-lo)]">
            <span className="text-[10px]">
              {open ? tw('compass.collapse') : tw('compass.expand')}
            </span>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        </div>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-white/5 px-3 pb-3 pt-2.5">
          {gap.evidence.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                {tw('compass.evidence')}
              </div>
              <ul className="mt-1.5 space-y-1">
                {gap.evidence.map((item, idx) => (
                  <li
                    key={`${gap.id}-ev-${idx}`}
                    className="flex gap-2 text-[11px] leading-snug text-[var(--text-lo)]"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#64748b]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runExplain}
              disabled={explaining}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,#a78bfa_40%,transparent)] bg-[color-mix(in_srgb,#a78bfa_12%,transparent)] px-2.5 py-1.5 text-[11px] font-medium text-[#c4b5fd] transition hover:bg-[color-mix(in_srgb,#a78bfa_20%,transparent)] disabled:opacity-60"
            >
              {explaining ? (
                <LoaderCircle size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {explaining
                ? tw('compass.explain.loading')
                : detail
                  ? tw('compass.explain.again')
                  : tw('compass.explain')}
            </button>
            {hasFile ? (
              <button
                type="button"
                onClick={() => onOpen(gap)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,#2dd4bf_35%,transparent)] bg-[color-mix(in_srgb,#2dd4bf_10%,transparent)] px-2.5 py-1.5 text-[11px] font-medium text-[#5eead4] transition hover:bg-[color-mix(in_srgb,#2dd4bf_18%,transparent)]"
              >
                <FileCode2 size={12} />
                {tw('compass.openFile')}
              </button>
            ) : null}
          </div>

          {explainStatus === 'error' ? (
            <p className="rounded-lg border border-[color-mix(in_srgb,#f87171_30%,transparent)] bg-[color-mix(in_srgb,#f87171_10%,transparent)] px-2.5 py-2 text-[11px] text-[#fecaca]">
              {gap.explainError || tw('compass.explain.error')}
            </p>
          ) : null}

          {explaining && !detail ? (
            <div className="space-y-2" aria-hidden>
              <div className="h-3 w-4/5 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
            </div>
          ) : null}

          {detail && !explaining ? (
            <div className="space-y-3 rounded-xl border border-white/5 bg-black/20 px-3 py-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  {tw('compass.explain.why')}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[#e2e8f0]">
                  {detail.whyItMatters}
                </p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#fbbf24]">
                  {tw('compass.explain.example')}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[#e8ecf4]">
                  {detail.concreteExample}
                </p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#2dd4bf]">
                  {tw('compass.explain.options')}
                </div>
                <ol className="mt-1.5 space-y-2">
                  {detail.contributionOptions.map((opt, idx) => (
                    <li
                      key={`${gap.id}-opt-${idx}`}
                      className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-medium text-white">
                          {idx + 1}. {opt.title}
                        </span>
                        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-[var(--text-lo)]">
                          {tw(`compass.effort.${opt.effort as GapExplainEffort}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-[var(--text-lo)]">
                        {opt.detail}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#a78bfa]">
                  {tw('compass.explain.confidenceWhy')}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[#e2e8f0]">
                  {detail.confidenceJustification}
                </p>
              </div>
            </div>
          ) : !explaining && explainStatus !== 'error' ? (
            <p className="text-[11px] leading-snug text-[var(--text-lo)]">
              {tw('compass.explain.hint')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ItemRow({
  item,
  accent,
  onOpen
}: {
  item: CompassItem;
  accent: string;
  onOpen: (item: CompassItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full flex-col gap-1 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-white">{item.name}</span>
        <span className="shrink-0 font-mono text-[10px]" style={{ color: accent }}>
          {item.kind}
        </span>
      </div>
      <span className="truncate font-mono text-[10px] text-[var(--text-lo)]">
        {shortPath(item.filePath)}
      </span>
      {item.reasons[0] ? (
        <span className="text-[11px] leading-snug text-[var(--text-lo)]">{item.reasons[0]}</span>
      ) : null}
    </button>
  );
}

function StepRow({
  step,
  index,
  onRun
}: {
  step: CompassStep;
  index: number;
  onRun: (step: CompassStep) => void;
}) {
  const clickable = Boolean(step.action);
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onRun(step)}
      className={[
        'flex w-full items-start gap-3 rounded-xl border border-white/5 px-3 py-2.5 text-left transition',
        clickable ? 'bg-white/[0.02] hover:bg-white/[0.05]' : 'bg-transparent opacity-90'
      ].join(' ')}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#2dd4bf_18%,transparent)] text-[11px] font-semibold text-[#5eead4]">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-white">{step.title}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-lo)]">{step.detail}</div>
      </div>
      {clickable ? <ChevronRight size={14} className="mt-1 shrink-0 text-[var(--text-lo)]" /> : null}
    </button>
  );
}

interface CompassViewProps {
  compass: ContributionCompassModel | null;
  i18nTick?: number;
}

export function CompassView({ compass, i18nTick = 0 }: CompassViewProps) {
  void i18nTick;

  if (!compass) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Compass size={28} className="text-[#2dd4bf]" />
        <h2 className="text-lg font-semibold text-white">{tw('compass.empty')}</h2>
        <p className="max-w-md text-xs text-[var(--text-lo)]">{tw('compass.emptyHint')}</p>
      </div>
    );
  }

  const pending = compass.llmStatus === 'pending';
  const skipped = compass.llmStatus === 'skipped' || compass.llmStatus === 'error';
  const gaps = (compass.gaps ?? []).filter((g) => !g.dismissed);

  const openItem = (item: CompassItem) => {
    postToExtension({
      type: 'nodeClick',
      node: {
        id: item.id,
        name: item.name,
        kind: item.kind,
        filePath: item.filePath,
        startLine: item.startLine,
        endLine: item.endLine
      }
    });
  };

  const openGap = (gap: ContributionGap) => {
    if (!gap.filePath) return;
    postToExtension({
      type: 'nodeClick',
      node: {
        id: gap.id,
        name: gap.name || gap.title,
        kind: gap.kind || 'file',
        filePath: gap.filePath,
        startLine: gap.startLine,
        endLine: gap.endLine
      }
    });
  };

  const runStep = (step: CompassStep) => {
    if (step.action === 'openMindMap') {
      postToExtension({ type: 'openMindMap' });
      return;
    }
    if (step.action === 'runGitHistory') {
      postToExtension({ type: 'runGitHistory' });
      return;
    }
    if (step.action === 'openNode' && step.filePath) {
      postToExtension({
        type: 'nodeClick',
        node: {
          id: step.targetId,
          name: step.targetName || step.title,
          kind: step.kind || 'file',
          filePath: step.filePath,
          startLine: step.startLine,
          endLine: step.endLine
        }
      });
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-5 md:px-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,#2dd4bf_35%,transparent)] bg-[color-mix(in_srgb,#2dd4bf_12%,transparent)] text-[#2dd4bf]">
            <Compass size={22} />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">{tw('view.compass')}</h2>
            <p className="mt-0.5 max-w-xl text-xs text-[var(--text-lo)]">{tw('view.compass.hint')}</p>
          </div>
        </div>
        {!compass.hasGit ? (
          <button
            type="button"
            onClick={() => postToExtension({ type: 'runGitHistory' })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,#f97316_40%,transparent)] bg-[color-mix(in_srgb,#f97316_12%,transparent)] px-3 py-1.5 text-[11px] font-medium text-[#fdba74]"
          >
            <FolderGit2 size={13} />
            {tw('compass.runGit')}
          </button>
        ) : null}
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          accent="#2dd4bf"
          icon={<Target size={18} />}
          label={tw('compass.summary.gaps')}
          title={String(compass.summary.gaps ?? gaps.length)}
          subtitle={tw('compass.summary.gapsHint')}
        />
        <SummaryCard
          accent="#a78bfa"
          icon={<CircleAlert size={18} />}
          label={tw('compass.summary.highPriority')}
          title={String(compass.summary.highPriority ?? 0)}
          subtitle={tw('compass.summary.highPriorityHint')}
        />
        <SummaryCard
          accent="#34d399"
          icon={<ShieldCheck size={18} />}
          label={tw('compass.summary.safeRisk')}
          title={String(compass.summary.safe ?? 0)}
          subtitle={tw('compass.summary.safeRiskHint')}
        />
      </div>

      {!compass.hasGit ? (
        <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,#f97316_28%,transparent)] bg-[color-mix(in_srgb,#f97316_8%,transparent)] px-3 py-2 text-[11px] text-[#fdba74]">
          {tw('compass.noGitHint')}
        </p>
      ) : null}

      <section className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel)]">
        <header className="flex items-start gap-3 border-b border-white/5 px-4 py-3.5">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#2dd4bf]">
            {pending ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : skipped ? (
              <Workflow size={18} />
            ) : (
              <Sparkles size={18} />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{tw('compass.agentTitle')}</h3>
            <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
              {pending
                ? tw('compass.llmInspecting')
                : skipped
                  ? tw('compass.llmSkipped')
                  : tw('compass.agentSubtitle')}
            </p>
          </div>
        </header>
        <div className="px-4 py-4">
          {pending ? (
            <div className="space-y-2" aria-hidden>
              <div className="h-3 w-4/5 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed text-[#e8ecf4]">
              {compass.agentAdvice || tw('compass.agentFallback')}
            </p>
          )}
          {compass.docsUsed && compass.docsUsed.length > 0 ? (
            <p className="mt-3 font-mono text-[10px] text-[var(--text-lo)]">
              {tw('compass.docsUsed', { files: compass.docsUsed.map(shortPath).join(', ') })}
            </p>
          ) : null}
        </div>
      </section>

      <div className="mb-4">
        <SectionCard
          accent="#2dd4bf"
          icon={<Target size={16} />}
          title={tw('compass.section.gaps')}
          hint={tw('compass.section.gapsHint')}
        >
          {gaps.length === 0 ? (
            <p className="px-1 text-[11px] text-[var(--text-lo)]">{tw('compass.none')}</p>
          ) : (
            gaps.map((gap) => <GapCard key={gap.id} gap={gap} onOpen={openGap} />)
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          accent="#94a3b8"
          icon={<BookOpen size={16} />}
          title={tw('compass.section.read')}
          hint={tw('compass.section.readHint')}
        >
          {(compass.readFirst ?? []).length === 0 ? (
            <p className="px-1 text-[11px] text-[var(--text-lo)]">{tw('compass.none')}</p>
          ) : (
            compass.readFirst.map((item) => (
              <ItemRow key={`read-${item.id}`} item={item} accent="#94a3b8" onOpen={openItem} />
            ))
          )}
        </SectionCard>

        <SectionCard
          accent="#a78bfa"
          icon={<ListOrdered size={16} />}
          title={tw('compass.section.steps')}
          hint={tw('compass.section.stepsHint')}
        >
          {(compass.firstSteps ?? []).map((step, index) => (
            <StepRow key={step.id} step={step} index={index} onRun={runStep} />
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
