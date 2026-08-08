import { FaGitAlt } from 'react-icons/fa';
import { Network } from 'lucide-react';
import type { LlmInsightsStatus, MermaidGraphView, RepoMermaidBundle } from '../types';
import { postToExtension } from '../vscodeApi';
import { tw } from '../i18n';

function viewDefs(): {
  id: MermaidGraphView;
  label: string;
  hint: string;
  icon?: 'git';
}[] {
  return [
    {
      id: 'architecture',
      label: tw('view.architecture'),
      hint: tw('view.architecture.hint')
    },
    {
      id: 'modules',
      label: tw('view.modules'),
      hint: tw('view.modules.hint')
    },
    {
      id: 'flow',
      label: tw('view.flow'),
      hint: tw('view.flow.hint')
    },
    {
      id: 'functions',
      label: tw('view.functions'),
      hint: tw('view.functions.hint')
    },
    {
      id: 'git',
      label: tw('view.git'),
      hint: tw('view.git.hint'),
      icon: 'git'
    }
  ];
}

interface HeaderBarProps {
  view: MermaidGraphView;
  onViewChange: (view: MermaidGraphView) => void;
  insightsOpen: boolean;
  onToggleInsights: () => void;
  status: string;
  bundle: RepoMermaidBundle | null;
  llmStatus?: LlmInsightsStatus;
  /** Bump when language catalog changes so labels re-render. */
  i18nTick?: number;
}

function sourceForView(bundle: RepoMermaidBundle, view: MermaidGraphView): string {
  if (view === 'modules') return bundle.modules;
  if (view === 'flow') return bundle.flow;
  if (view === 'functions') return bundle.functions;
  if (view === 'git') return '';
  return bundle.architecture;
}

export function HeaderBar({
  view,
  onViewChange,
  insightsOpen,
  onToggleInsights,
  status,
  bundle,
  llmStatus = 'idle',
  i18nTick = 0
}: HeaderBarProps) {
  const llmInspecting = llmStatus === 'inspecting';
  const views = viewDefs();
  void i18nTick;
  const copySource = bundle ? sourceForView(bundle, view) : '';
  return (
    <header className="relative z-40 flex h-11 shrink-0 items-center gap-3 overflow-visible border-b border-[color-mix(in_srgb,var(--text-lo)_28%,transparent)] bg-[var(--panel)] px-3">
      <nav className="flex items-center gap-1 overflow-visible">
        {views.map((v, index) => {
          const align =
            index === 0 ? 'left' : index === views.length - 1 ? 'right' : 'center';
          const tipPos =
            align === 'left'
              ? 'left-0 translate-x-0'
              : align === 'right'
                ? 'right-0 left-auto translate-x-0'
                : 'left-1/2 -translate-x-1/2';
          return (
            <div key={v.id} className="group/view relative overflow-visible">
              <button
                type="button"
                onClick={() => onViewChange(v.id)}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                aria-describedby={`view-hint-${v.id}`}
                title={v.hint}
                className={[
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition',
                  view === v.id
                    ? v.id === 'git'
                      ? 'bg-[color-mix(in_srgb,#f97316_22%,transparent)] text-[#fdba74]'
                      : 'bg-[color-mix(in_srgb,var(--role-entry)_22%,transparent)] text-[var(--role-entry)]'
                    : 'text-[var(--text-lo)] hover:bg-[color-mix(in_srgb,var(--text-lo)_12%,transparent)] hover:text-[var(--text-hi)]'
                ].join(' ')}
              >
                {v.icon === 'git' ? <FaGitAlt size={13} aria-hidden /> : null}
                {v.label}
              </button>
              <div
                id={`view-hint-${v.id}`}
                role="tooltip"
                className={[
                  'pointer-events-none absolute top-full z-50 mt-1.5 hidden w-56 rounded-md border border-[color-mix(in_srgb,var(--text-lo)_30%,transparent)] bg-[var(--panel)] px-2.5 py-2 text-[10px] leading-snug text-[var(--text-lo)] shadow-lg group-hover/view:block',
                  tipPos
                ].join(' ')}
              >
                {v.hint}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-[10px] text-[var(--text-lo)] sm:inline">{status}</span>
        <button
          type="button"
          onClick={() => postToExtension({ type: 'openMindMap' })}
          title={tw('webview.mindMap')}
          className="inline-flex items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--role-pipeline)_45%,transparent)] bg-[color-mix(in_srgb,var(--role-pipeline)_14%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--role-pipeline)] transition hover:bg-[color-mix(in_srgb,var(--role-pipeline)_22%,transparent)]"
        >
          <Network size={13} strokeWidth={2.25} aria-hidden />
          {tw('webview.mindMap')}
        </button>
        {bundle && copySource ? (
          <button
            type="button"
            onClick={() => postToExtension({ type: 'copySource', source: copySource })}
            className="rounded px-2 py-1 text-[11px] text-[var(--text-lo)] hover:bg-[color-mix(in_srgb,var(--text-lo)_12%,transparent)] hover:text-[var(--text-hi)]"
          >
            {tw('header.copy')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggleInsights}
          className={[
            'rounded px-2.5 py-1 text-xs transition',
            insightsOpen || llmInspecting
              ? 'bg-[color-mix(in_srgb,var(--role-entry)_22%,transparent)] text-[var(--role-entry)]'
              : 'text-[var(--text-lo)] hover:bg-[color-mix(in_srgb,var(--text-lo)_12%,transparent)]'
          ].join(' ')}
        >
          {llmInspecting ? tw('header.llmBusy') : tw('header.insights')}
        </button>
      </div>
    </header>
  );
}
