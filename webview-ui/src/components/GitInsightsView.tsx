import { useMemo, useState, type ReactNode } from 'react';
import { FaGitAlt } from 'react-icons/fa';
import {
  Flame,
  Snowflake,
  GitCommitHorizontal,
  Link2,
  Clock3,
  FolderGit2,
  FileCode2,
  Star,
  Info,
  ChevronRight,
  Sparkles,
  LoaderCircle,
  Users,
  Workflow,
  ExternalLink
} from 'lucide-react';
import type {
  GitCouplingInsight,
  GitFileChurn,
  GitHistoryInsights,
  GitOwnerInsight,
  LlmInsightsStatus
} from '../types';
import { tw } from '../i18n';
import { renderMarkdownLite } from '../lib/markdownLite';
import { postToExtension } from '../vscodeApi';

const PREVIEW = 7;

function shortPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return parts.join('/') || filePath;
  return parts.slice(-2).join('/');
}

function shortHash(hash: string): string {
  return hash.length > 7 ? hash.slice(0, 7) : hash;
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

function RankedFileRow({
  file,
  index,
  accent,
  onOpen
}: {
  file: GitFileChurn;
  index: number;
  accent: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/[0.04]"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold"
        style={{ color: accent }}
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12px] font-medium text-[var(--text-hi)]">
          {shortPath(file.path)}
        </div>
        <div className="mt-0.5 text-[10px] text-[var(--text-lo)]">
          {tw('git.ui.commitsCount', { count: file.commits })}
        </div>
      </div>
      <span className="shrink-0 text-[10px] text-[var(--text-lo)]">
        {tw('git.ui.daysAgo', { days: file.daysSinceChange })}
      </span>
    </button>
  );
}

function ColumnCard({
  accent,
  icon,
  title,
  hint,
  children,
  footerLabel,
  showFooter,
  expanded,
  onToggle
}: {
  accent: string;
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
  footerLabel: string;
  showFooter: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section
      className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--panel)_90%,transparent)]"
    >
      <header className="shrink-0 border-b border-white/10 bg-transparent px-4 py-3.5">
        <div className="flex items-center gap-2" style={{ color: accent }}>
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-lo)]">{hint}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">{children}</div>
      {showFooter ? (
        <footer className="shrink-0 border-t border-white/5 px-3 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition hover:bg-white/[0.04]"
            style={{ color: accent }}
          >
            <span>{footerLabel}</span>
            <ChevronRight
              size={14}
              className={['transition', expanded ? 'rotate-90' : ''].join(' ')}
            />
          </button>
        </footer>
      ) : null}
    </section>
  );
}

function LlmSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[92, 78, 86, 64].map((w, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-white/10" />
          <div
            className="h-3 animate-pulse rounded bg-white/[0.06]"
            style={{ width: `${w}%` }}
          />
          <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

function GitLlmInsightsPanel({
  gitHistory,
  gitLlmStatus,
  gitLlmMessage
}: {
  gitHistory: GitHistoryInsights;
  gitLlmStatus: LlmInsightsStatus;
  gitLlmMessage?: string;
}) {
  const inspecting = gitLlmStatus === 'inspecting';
  const structuralMode = gitLlmStatus === 'error' || gitLlmStatus === 'skipped';
  const narrative = gitHistory.narrative?.trim() ?? '';
  const narrativeHtml = useMemo(
    () => (narrative ? renderMarkdownLite(narrative) : ''),
    [narrative]
  );
  const bullets = gitHistory.summaryBullets ?? [];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel)]"
      aria-busy={inspecting}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 px-4 py-3.5 md:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#fdba74]">
            {inspecting ? (
              <LoaderCircle className="animate-spin" size={18} strokeWidth={2} />
            ) : structuralMode && !narrative ? (
              <Workflow size={18} strokeWidth={2} />
            ) : (
              <Sparkles size={18} strokeWidth={2} />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{tw('git.ui.llmTitle')}</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-lo)]">
              {inspecting
                ? gitLlmMessage || tw('git.ui.llmInspecting')
                : structuralMode && !narrative
                  ? tw('git.ui.llmStructural')
                  : narrative
                    ? tw('git.ui.llmSubtitle')
                    : tw('git.ui.llmWaiting')}
            </p>
          </div>
        </div>
        {narrative && !inspecting ? (
          <button
            type="button"
            onClick={() => postToExtension({ type: 'openGitNarrative' })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-[#fdba74] transition hover:bg-white/[0.04]"
          >
            {tw('git.ui.openNarrative')}
            <ExternalLink size={12} />
          </button>
        ) : null}
      </header>

      <div className="px-4 py-4 md:px-5">
        {inspecting ? (
          <LlmSkeleton />
        ) : narrativeHtml ? (
          <div className="nm-md" dangerouslySetInnerHTML={{ __html: narrativeHtml }} />
        ) : bullets.length > 0 ? (
          <div>
            <p className="mb-3 text-[11px] text-[var(--text-lo)]">{tw('git.ui.llmStructuralHint')}</p>
            <ul className="space-y-2">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-[var(--text-hi)]"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[12px] text-[var(--text-lo)]">{tw('git.ui.llmNone')}</p>
        )}
      </div>
    </section>
  );
}

function OwnersList({
  owners,
  onOpen
}: {
  owners: GitOwnerInsight[];
  onOpen: (path: string) => void;
}) {
  if (owners.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-[11px] text-[var(--text-lo)]">
        {tw('git.ui.none')}
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {owners.slice(0, PREVIEW).map((owner) => (
        <li key={`${owner.path}:${owner.author}`}>
          <button
            type="button"
            onClick={() => onOpen(owner.path)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/[0.04]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-[var(--text-hi)]">
                {owner.author}
              </div>
              <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-lo)]">
                {shortPath(owner.path)}
              </div>
            </div>
            <span className="shrink-0 text-[10px] text-[var(--text-lo)]">
              {Math.round(owner.share * 100)}% · {owner.commits}x
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CouplingsList({
  couplings,
  onOpen
}: {
  couplings: GitCouplingInsight[];
  onOpen: (path: string) => void;
}) {
  if (couplings.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-[11px] text-[var(--text-lo)]">
        {tw('git.ui.none')}
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {couplings.slice(0, PREVIEW).map((pair) => (
        <li key={`${pair.a}|${pair.b}`} className="rounded-xl px-2 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
            <button
              type="button"
              onClick={() => onOpen(pair.a)}
              className="font-mono text-[var(--text-hi)] hover:underline"
            >
              {shortPath(pair.a)}
            </button>
            <span className="text-[var(--text-lo)]">↔</span>
            <button
              type="button"
              onClick={() => onOpen(pair.b)}
              className="font-mono text-[var(--text-hi)] hover:underline"
            >
              {shortPath(pair.b)}
            </button>
          </div>
          <div className="mt-1 text-[10px] text-[var(--text-lo)]">
            {tw('git.ui.together', { count: pair.together })}
          </div>
        </li>
      ))}
    </ul>
  );
}

interface GitInsightsViewProps {
  gitHistory: GitHistoryInsights | null | undefined;
  gitLlmStatus?: LlmInsightsStatus;
  gitLlmMessage?: string;
  i18nTick?: number;
}

export function GitInsightsView({
  gitHistory,
  gitLlmStatus = 'idle',
  gitLlmMessage = '',
  i18nTick = 0
}: GitInsightsViewProps) {
  void i18nTick;
  const [showAllAlive, setShowAllAlive] = useState(false);
  const [showAllFrozen, setShowAllFrozen] = useState(false);
  const [showAllCommits, setShowAllCommits] = useState(false);

  const hottest = gitHistory?.aliveFiles?.[0];
  const coldest = gitHistory?.frozenFiles?.[0];
  const topCoupling = gitHistory?.couplings?.[0];

  const aliveTotal = gitHistory?.aliveFiles?.length ?? 0;
  const frozenTotal = gitHistory?.frozenFiles?.length ?? 0;
  const commitTotal = gitHistory?.recentCommits?.length ?? 0;

  const aliveList = useMemo(() => {
    const files = gitHistory?.aliveFiles ?? [];
    return showAllAlive ? files : files.slice(0, PREVIEW);
  }, [gitHistory, showAllAlive]);

  const frozenList = useMemo(() => {
    const files = gitHistory?.frozenFiles ?? [];
    return showAllFrozen ? files : files.slice(0, PREVIEW);
  }, [gitHistory, showAllFrozen]);

  const commitList = useMemo(() => {
    const commits = gitHistory?.recentCommits ?? [];
    return showAllCommits ? commits : commits.slice(0, PREVIEW);
  }, [gitHistory, showAllCommits]);

  if (!gitHistory) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[var(--void)]">
        <div className="relative z-10 mx-auto max-w-md px-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#f97316] text-white">
            <FaGitAlt size={34} />
          </div>
          <h2 className="text-lg font-semibold text-white">{tw('git.ui.empty')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-lo)]">{tw('git.ui.emptyHint')}</p>
          <button
            type="button"
            onClick={() => postToExtension({ type: 'runGitHistory' })}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-[#fdba74] transition hover:bg-white/[0.07]"
          >
            <FaGitAlt size={16} />
            {tw('git.ui.run')}
          </button>
        </div>
      </div>
    );
  }

  const openFile = (relativePath: string) => {
    postToExtension({
      type: 'openGitFile',
      repoRoot: gitHistory.repoRoot,
      relativePath
    });
  };

  return (
    <div className="relative h-full w-full overflow-auto bg-[var(--void)]">
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-4 p-4 md:gap-5 md:p-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#f97316] text-white">
              <FaGitAlt size={26} />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">{tw('view.git')}</h2>
              <p className="mt-0.5 max-w-xl text-xs text-[var(--text-lo)]">{tw('view.git.hint')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-[var(--text-hi)]">
              <GitCommitHorizontal size={13} className="text-[#fdba74]" />
              {tw('git.ui.statsCommits', { count: gitHistory.commitCountSampled })}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-[var(--text-hi)]">
              <Clock3 size={13} className="text-[#93c5fd]" />
              {tw('git.ui.statsWindow', { days: gitHistory.windowDays })}
            </span>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            accent="#22c55e"
            icon={<FolderGit2 size={20} />}
            label={tw('git.ui.sample')}
            title={tw('git.ui.statsCommits', { count: gitHistory.commitCountSampled })}
            subtitle={tw('git.ui.sampleSub', { days: gitHistory.windowDays })}
          />
          <SummaryCard
            accent="#3b82f6"
            icon={<FileCode2 size={20} />}
            label={tw('git.ui.hottest')}
            title={hottest ? shortPath(hottest.path) : tw('git.ui.none')}
            subtitle={
              hottest ? tw('git.ui.commitsCount', { count: hottest.commits }) : tw('git.ui.none')
            }
          />
          <SummaryCard
            accent="#a78bfa"
            icon={<Snowflake size={20} />}
            label={tw('git.ui.coldest')}
            title={coldest ? shortPath(coldest.path) : tw('git.ui.none')}
            subtitle={
              coldest
                ? tw('git.ui.coldestSub', { days: coldest.daysSinceChange })
                : tw('git.ui.none')
            }
          />
          <SummaryCard
            accent="#f97316"
            icon={<Link2 size={20} />}
            label={tw('git.ui.topCoupling')}
            title={
              topCoupling
                ? `${shortPath(topCoupling.a)} ↔ ${shortPath(topCoupling.b)}`
                : tw('git.ui.none')
            }
            subtitle={
              topCoupling
                ? tw('git.ui.together', { count: topCoupling.together })
                : tw('git.ui.none')
            }
          />
        </div>

        <GitLlmInsightsPanel
          gitHistory={gitHistory}
          gitLlmStatus={gitLlmStatus}
          gitLlmMessage={gitLlmMessage}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <ColumnCard
            accent="#22c55e"
            icon={<Flame size={16} />}
            title={tw('git.ui.alive')}
            hint={tw('git.ui.aliveHint')}
            footerLabel={
              showAllAlive ? tw('git.ui.collapse') : tw('git.ui.seeAlive')
            }
            showFooter={aliveTotal > PREVIEW}
            expanded={showAllAlive}
            onToggle={() => setShowAllAlive((v) => !v)}
          >
            {aliveList.length === 0 ? (
              <p className="px-2 py-8 text-center text-[11px] text-[var(--text-lo)]">
                {tw('git.ui.none')}
              </p>
            ) : (
              aliveList.map((file, i) => (
                <RankedFileRow
                  key={file.path}
                  file={file}
                  index={i}
                  accent="#22c55e"
                  onOpen={() => openFile(file.path)}
                />
              ))
            )}
          </ColumnCard>

          <ColumnCard
            accent="#3b82f6"
            icon={<Snowflake size={16} />}
            title={tw('git.ui.frozen')}
            hint={tw('git.ui.frozenHint')}
            footerLabel={
              showAllFrozen ? tw('git.ui.collapse') : tw('git.ui.seeFrozen')
            }
            showFooter={frozenTotal > PREVIEW}
            expanded={showAllFrozen}
            onToggle={() => setShowAllFrozen((v) => !v)}
          >
            {frozenList.length === 0 ? (
              <p className="px-2 py-8 text-center text-[11px] text-[var(--text-lo)]">
                {tw('git.ui.none')}
              </p>
            ) : (
              frozenList.map((file, i) => (
                <RankedFileRow
                  key={file.path}
                  file={file}
                  index={i}
                  accent="#3b82f6"
                  onOpen={() => openFile(file.path)}
                />
              ))
            )}
          </ColumnCard>

          <ColumnCard
            accent="#f97316"
            icon={<Star size={16} />}
            title={tw('git.ui.recent')}
            hint={tw('git.ui.recentHint')}
            footerLabel={
              showAllCommits ? tw('git.ui.collapse') : tw('git.ui.seeCommits')
            }
            showFooter={commitTotal > PREVIEW}
            expanded={showAllCommits}
            onToggle={() => setShowAllCommits((v) => !v)}
          >
            {commitList.length === 0 ? (
              <p className="px-2 py-8 text-center text-[11px] text-[var(--text-lo)]">
                {tw('git.ui.none')}
              </p>
            ) : (
              <ul className="space-y-1">
                {commitList.map((commit) => (
                  <li key={commit.hash} className="rounded-xl px-2 py-2.5">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[#fdba74]">
                        {shortHash(commit.hash)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium leading-snug text-[var(--text-hi)]">
                          {commit.subject}
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--text-lo)]">
                          {commit.author} · {commit.date}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ColumnCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ColumnCard
            accent="#93c5fd"
            icon={<Users size={16} />}
            title={tw('git.ui.owners')}
            hint={tw('git.ui.ownersHint')}
            footerLabel=""
            showFooter={false}
            expanded={false}
            onToggle={() => undefined}
          >
            <OwnersList owners={gitHistory.owners ?? []} onOpen={openFile} />
          </ColumnCard>

          <ColumnCard
            accent="#fdba74"
            icon={<Link2 size={16} />}
            title={tw('git.ui.couplings')}
            hint={tw('git.ui.couplingsHint')}
            footerLabel=""
            showFooter={false}
            expanded={false}
            onToggle={() => undefined}
          >
            <CouplingsList couplings={gitHistory.couplings ?? []} onOpen={openFile} />
          </ColumnCard>
        </div>

        <p className="flex items-center gap-2 pb-2 text-[11px] text-[var(--text-lo)]">
          <Info size={13} className="shrink-0" />
          {tw('git.ui.footerNote', { days: gitHistory.windowDays })}
        </p>
      </div>
    </div>
  );
}
