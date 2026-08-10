import { FileCode, Folder, getLucideIcon, inferNodeIcon } from '../lib/icons';
import { tw } from '../i18n';
import type { SensitivityLevel } from '../types';

export type NodeRole = 'entry' | 'hub' | 'pipeline' | 'support';

const roleBorder: Record<NodeRole, string> = {
  entry: 'border-[var(--role-entry)]',
  hub: 'border-[var(--role-hub)]',
  pipeline: 'border-[var(--role-pipeline)]',
  support: 'border-[var(--role-support)]'
};

const roleAccent: Record<NodeRole, string> = {
  entry: 'text-[var(--role-entry)]',
  hub: 'text-[var(--role-hub)]',
  pipeline: 'text-[var(--role-pipeline)]',
  support: 'text-[#94A3B8]'
};

const roleGlow: Record<NodeRole, string> = {
  entry:
    'bg-[color-mix(in_srgb,var(--role-entry)_16%,transparent)] text-[var(--role-entry)] ring-1 ring-[color-mix(in_srgb,var(--role-entry)_40%,transparent)]',
  hub: 'bg-[color-mix(in_srgb,var(--role-hub)_16%,transparent)] text-[var(--role-hub)] ring-1 ring-[color-mix(in_srgb,var(--role-hub)_40%,transparent)]',
  pipeline:
    'bg-[color-mix(in_srgb,var(--role-pipeline)_16%,transparent)] text-[var(--role-pipeline)] ring-1 ring-[color-mix(in_srgb,var(--role-pipeline)_40%,transparent)]',
  support:
    'bg-[color-mix(in_srgb,var(--role-support)_16%,transparent)] text-[#94A3B8] ring-1 ring-[color-mix(in_srgb,var(--role-support)_35%,transparent)]'
};

const roleBadge: Record<NodeRole, string> = {
  entry:
    'border-[color-mix(in_srgb,var(--role-entry)_45%,transparent)] bg-[color-mix(in_srgb,var(--role-entry)_10%,transparent)] text-[var(--role-entry)]',
  hub: 'border-[color-mix(in_srgb,var(--role-hub)_45%,transparent)] bg-[color-mix(in_srgb,var(--role-hub)_10%,transparent)] text-[var(--role-hub)]',
  pipeline:
    'border-[color-mix(in_srgb,var(--role-pipeline)_45%,transparent)] bg-[color-mix(in_srgb,var(--role-pipeline)_10%,transparent)] text-[var(--role-pipeline)]',
  support:
    'border-[color-mix(in_srgb,var(--role-support)_45%,transparent)] bg-[color-mix(in_srgb,var(--role-support)_12%,transparent)] text-[#94A3B8]'
};

/** Border / glow / accent untuk tab Sensitive code (bukan pill badge). */
const sensitivityBorder: Record<SensitivityLevel, string> = {
  critical: 'border-[#f87171]',
  high: 'border-[#fb923c]',
  medium: 'border-[#fbbf24]',
  low: 'border-[#94a3b8]'
};

const sensitivityAccent: Record<SensitivityLevel, string> = {
  critical: 'text-[#fca5a5]',
  high: 'text-[#fdba74]',
  medium: 'text-[#fcd34d]',
  low: 'text-[#94a3b8]'
};

const sensitivityGlow: Record<SensitivityLevel, string> = {
  critical:
    'bg-[color-mix(in_srgb,#f87171_18%,transparent)] text-[#fca5a5] ring-1 ring-[color-mix(in_srgb,#f87171_45%,transparent)]',
  high: 'bg-[color-mix(in_srgb,#fb923c_18%,transparent)] text-[#fdba74] ring-1 ring-[color-mix(in_srgb,#fb923c_45%,transparent)]',
  medium:
    'bg-[color-mix(in_srgb,#fbbf24_16%,transparent)] text-[#fcd34d] ring-1 ring-[color-mix(in_srgb,#fbbf24_40%,transparent)]',
  low: 'bg-[color-mix(in_srgb,#94a3b8_14%,transparent)] text-[#94a3b8] ring-1 ring-[color-mix(in_srgb,#94a3b8_35%,transparent)]'
};

const sensitivityFolderBadge: Record<SensitivityLevel, string> = {
  critical:
    'border-[color-mix(in_srgb,#f87171_45%,transparent)] bg-[color-mix(in_srgb,#f87171_10%,transparent)] text-[#fca5a5]',
  high: 'border-[color-mix(in_srgb,#fb923c_45%,transparent)] bg-[color-mix(in_srgb,#fb923c_10%,transparent)] text-[#fdba74]',
  medium:
    'border-[color-mix(in_srgb,#fbbf24_45%,transparent)] bg-[color-mix(in_srgb,#fbbf24_10%,transparent)] text-[#fcd34d]',
  low: 'border-[color-mix(in_srgb,#94a3b8_40%,transparent)] bg-[color-mix(in_srgb,#94a3b8_10%,transparent)] text-[#94a3b8]'
};

const SENSITIVITY_HANDLE: Record<SensitivityLevel, string> = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#fbbf24',
  low: '#94a3b8'
};

export const ROLE_HANDLE_COLOR: Record<NodeRole, string> = {
  entry: 'var(--role-entry)',
  hub: 'var(--role-hub)',
  pipeline: 'var(--role-pipeline)',
  support: 'var(--role-support)'
};

export function handleColorForCard(
  role: NodeRole,
  sensitivityLevel?: SensitivityLevel
): string {
  if (sensitivityLevel) return SENSITIVITY_HANDLE[sensitivityLevel];
  return ROLE_HANDLE_COLOR[role] ?? 'var(--role-entry)';
}

export interface GraphNodeCardProps {
  name: string;
  filePath: string;
  summary?: string;
  iconKey?: string;
  role?: NodeRole;
  kind?: string;
  selected?: boolean;
  /** LLM masih menulis summary node. */
  skeleton?: boolean;
  /** Hanya diisi di tab Sensitive — mewarnai border/ikon (bukan pill). */
  sensitivityLevel?: SensitivityLevel;
  sensitivityReason?: string;
  onClick?: () => void;
}

function fileBase(path: string): string {
  const n = path.replace(/\\/g, '/');
  const i = n.lastIndexOf('/');
  return i >= 0 ? n.slice(i + 1) : n;
}

function folderBadge(path: string): string {
  const n = path.replace(/\\/g, '/');
  const parts = n.split('/').filter(Boolean);
  if (parts.length <= 1) return 'root/';
  const folder = parts.slice(-3, -1).join('/') || parts[0] || 'root';
  return folder.endsWith('/') ? folder : `${folder}/`;
}

/** Badge untuk kartu module: pakai nama folder model apa adanya. */
function moduleBadge(folderName: string): string {
  const n = folderName.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!n) return 'root/';
  return n.endsWith('/') ? n : `${n}/`;
}

/** Nama yang jadi ujung tombak kartu: symbol/function, atau folder untuk module. */
function spearheadName(name: string, filePath: string, kind?: string): string {
  const raw = (name || '').trim();
  // Kartu modul/folder: selalu pakai nama folder dari model, bukan sample file (__init__.py).
  if (kind === 'module' || kind === 'folder') {
    return raw || fileBase(filePath);
  }
  // Overview Functions / file card: spearhead = nama file.
  if (kind === 'file-group' || kind === 'file') {
    return fileBase(filePath || name);
  }
  if (!raw) return fileBase(filePath);
  // Path penuh → basename; selain itu biarkan apa adanya (MainConfig.__init__, n_layer, …)
  if (raw.includes('/') || raw.includes('\\')) return fileBase(raw);
  return raw;
}

function kindLabel(kind?: string, role?: NodeRole): string {
  if (role === 'entry' && (kind === 'function' || kind === 'method' || kind === 'class')) {
    return 'start';
  }
  switch (kind) {
    case 'function':
      return 'fn';
    case 'method':
      return 'method';
    case 'class':
      return 'class';
    case 'file-group':
    case 'file':
      return 'file';
    case 'folder':
    case 'module':
      return 'module';
    default:
      return kind && kind.length <= 10 ? kind : 'symbol';
  }
}

function SummarySkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden>
      <div className="h-2.5 w-[92%] animate-pulse rounded bg-[color-mix(in_srgb,var(--text-lo)_22%,transparent)]" />
      <div className="h-2.5 w-[78%] animate-pulse rounded bg-[color-mix(in_srgb,var(--text-lo)_18%,transparent)]" />
      <div className="h-2.5 w-[64%] animate-pulse rounded bg-[color-mix(in_srgb,var(--text-lo)_14%,transparent)]" />
    </div>
  );
}

export function GraphNodeCard({
  name,
  filePath,
  summary,
  iconKey,
  role = 'support',
  kind,
  selected,
  skeleton,
  sensitivityLevel,
  sensitivityReason,
  onClick
}: GraphNodeCardProps) {
  const spearhead = spearheadName(name, filePath, kind);
  const file = fileBase(filePath || name);
  const isModuleCard = kind === 'module' || kind === 'folder';
  const badge = isModuleCard ? moduleBadge(name) : folderBadge(filePath || name);
  const showFileSecondary = !isModuleCard && Boolean(file) && file !== spearhead;
  const resolvedIcon = iconKey || inferNodeIcon(name, filePath, kind);
  const Icon = getLucideIcon(resolvedIcon);
  const hasLlmSummary = Boolean(summary?.trim());
  const useSensitivityChrome = Boolean(sensitivityLevel);
  const borderClass = useSensitivityChrome
    ? sensitivityBorder[sensitivityLevel!]
    : roleBorder[role];
  const accentClass = useSensitivityChrome
    ? sensitivityAccent[sensitivityLevel!]
    : roleAccent[role];
  const glowClass = useSensitivityChrome
    ? sensitivityGlow[sensitivityLevel!]
    : roleGlow[role];
  const folderBadgeClass = useSensitivityChrome
    ? sensitivityFolderBadge[sensitivityLevel!]
    : roleBadge[role];
  const body =
    summary?.trim() ||
    (role === 'entry'
      ? tw('graph.card.entry', { name: spearhead })
      : role === 'hub'
        ? tw('graph.card.hub', { name: spearhead })
        : tw('graph.card.component', { name: spearhead }));

  return (
    <button
      type="button"
      onClick={onClick}
      aria-busy={skeleton || undefined}
      title={sensitivityReason ? `${spearhead} — ${sensitivityReason}` : spearhead}
      className={[
        'box-border flex w-[300px] cursor-pointer rounded-2xl border bg-[color-mix(in_srgb,var(--panel)_92%,transparent)] p-3.5 text-left shadow-[0_8px_28px_rgba(0,0,0,0.28)] transition',
        borderClass,
        selected
          ? 'bg-[var(--panel-l3)]'
          : 'hover:bg-[color-mix(in_srgb,var(--panel-l2)_88%,transparent)]'
      ].join(' ')}
    >
      <div className="flex w-full gap-0">
        <div className="mr-3.5 flex w-14 shrink-0 items-center justify-center border-r border-[color-mix(in_srgb,var(--text-lo)_28%,transparent)] pr-3.5">
          <span
            className={['flex h-12 w-12 items-center justify-center rounded-full', glowClass].join(
              ' '
            )}
          >
            <Icon size={22} strokeWidth={1.85} />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <FileCode
                size={14}
                strokeWidth={2}
                className={['shrink-0', accentClass].join(' ')}
              />
              <span className="truncate font-mono text-[10px] uppercase tracking-wide text-[var(--text-lo)]">
                {useSensitivityChrome && sensitivityLevel
                  ? tw(`sensitivity.level.${sensitivityLevel}`)
                  : kindLabel(kind, role)}
              </span>
            </div>
            <span
              className={[
                'inline-flex max-w-[108px] shrink-0 items-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 font-mono text-[10px]',
                folderBadgeClass
              ].join(' ')}
            >
              <Folder size={11} strokeWidth={2} />
              <span className="truncate">{badge}</span>
            </span>
          </div>

          <div
            className={['truncate font-mono text-[14px] font-semibold leading-snug', accentClass].join(
              ' '
            )}
          >
            {spearhead}
          </div>

          {showFileSecondary ? (
            <div className="truncate font-mono text-[11px] text-[var(--text-lo)]">{file}</div>
          ) : null}

          <div className="h-px w-full bg-[color-mix(in_srgb,var(--text-lo)_30%,transparent)]" />

          {skeleton && !hasLlmSummary ? (
            <SummarySkeleton />
          ) : (
            <div className="min-h-[2.75em] text-[12px] leading-relaxed text-[var(--text-lo)]">
              {body}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
