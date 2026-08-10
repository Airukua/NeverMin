import { LoaderCircle, ShieldAlert, Sparkles, X } from 'lucide-react';
import type { MermaidNodeMeta, SensitivityLevel } from '../types';
import { renderMarkdownLite } from '../lib/markdownLite';
import { tw } from '../i18n';

export type NodeExplainStatus = 'loading' | 'streaming' | 'ready' | 'error' | 'cancelled';

export interface NodeExplainState {
  meta: MermaidNodeMeta;
  x: number;
  y: number;
  status: NodeExplainStatus;
  text?: string;
  thinking?: string;
  sensitivityLevel?: SensitivityLevel;
  sensitivityReason?: string;
  message?: string;
  scope?: 'file' | 'module' | 'function' | 'sensitivity';
}

interface NodeExplainModalProps {
  state: NodeExplainState;
  onClose: () => void;
}

function shortPath(filePath?: string): string {
  if (!filePath) return '';
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return parts.join('/');
  return parts.slice(-2).join('/');
}

export function NodeExplainModal({ state, onClose }: NodeExplainModalProps) {
  const live = state.status === 'streaming' || state.status === 'ready';
  const bodyHtml = live && state.text ? renderMarkdownLite(state.text) : '';
  const thinking = state.status === 'ready' ? state.thinking?.trim() : '';
  const sensitivityLevel =
    state.sensitivityLevel || state.meta.sensitivityLevel;
  const sensitivityReason =
    state.sensitivityReason || state.meta.sensitivityReason;
  const showSensitivity =
    sensitivityLevel === 'critical' ||
    sensitivityLevel === 'high' ||
    sensitivityLevel === 'medium';

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default bg-black/35"
        aria-label={tw('explain.modal.close')}
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] flex w-[min(640px,calc(100vw-32px))] max-h-[min(78vh,calc(100vh-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel)] text-[var(--text-hi)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nm-explain-title"
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3.5 py-3">
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2dd4bf]">
              <Sparkles size={12} aria-hidden />
              {state.status === 'streaming'
                ? tw('explain.modal.badgeLive')
                : tw('explain.modal.badge')}
            </div>
            <div id="nm-explain-title" className="truncate text-[13px] font-semibold text-white">
              {state.meta.name}
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-lo)]">
              {shortPath(state.meta.filePath)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-lo)] transition hover:bg-white/[0.06] hover:text-white"
            aria-label={tw('explain.modal.close')}
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          {showSensitivity && sensitivityLevel ? (
            <div className="mb-3 rounded-lg border border-[color-mix(in_srgb,#f87171_28%,transparent)] bg-[color-mix(in_srgb,#f87171_8%,transparent)] px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#fca5a5]">
                <ShieldAlert size={13} />
                {tw('explain.modal.sensitivity', {
                  level: tw(`sensitivity.level.${sensitivityLevel}`)
                })}
              </div>
              {sensitivityReason ? (
                <p className="text-[11px] leading-relaxed text-[var(--text-lo)]">{sensitivityReason}</p>
              ) : null}
            </div>
          ) : null}

          {state.status === 'loading' ? (
            <div className="flex items-start gap-2.5 py-2 text-[12px] text-[var(--text-lo)]">
              <LoaderCircle size={16} className="mt-0.5 shrink-0 animate-spin text-[#2dd4bf]" />
              <span>{state.message || tw('explain.modal.loading')}</span>
            </div>
          ) : null}

          {state.status === 'error' ? (
            <p className="text-[12px] leading-relaxed text-red-300">
              {state.message || tw('explain.modal.error')}
            </p>
          ) : null}

          {state.status === 'cancelled' ? (
            <>
              <p className="mb-2 text-[12px] leading-relaxed text-[var(--text-lo)]">
                {state.message || tw('explain.modal.cancelled')}
              </p>
              {state.text ? (
                <div
                  className="nm-md opacity-80"
                  dangerouslySetInnerHTML={{ __html: renderMarkdownLite(state.text) }}
                />
              ) : null}
            </>
          ) : null}

          {state.status === 'streaming' || state.status === 'ready' ? (
            <>
              {state.status === 'streaming' ? (
                <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--text-lo)]">
                  <LoaderCircle size={13} className="shrink-0 animate-spin text-[#2dd4bf]" />
                  <span>{state.message || tw('explain.modal.streaming')}</span>
                </div>
              ) : null}
              {thinking ? (
                <details className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <summary className="cursor-pointer select-none text-[11px] font-semibold tracking-wide text-[var(--text-lo)]">
                    {tw('explain.modal.thinking')}
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-[var(--text-lo)]">
                    {thinking}
                  </pre>
                </details>
              ) : null}
              {bodyHtml ? (
                <div className="nm-md" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              ) : state.status === 'ready' ? (
                <p className="text-[12px] text-[var(--text-lo)]">{tw('explain.modal.empty')}</p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
