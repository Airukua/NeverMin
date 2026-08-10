import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCode2, GitBranch, Sparkles, X } from 'lucide-react';
import type { MermaidNodeMeta } from '../types';
import { tw } from '../i18n';

export interface NodeActionMenuState {
  meta: MermaidNodeMeta;
  x: number;
  y: number;
}

interface NodeActionMenuProps {
  menu: NodeActionMenuState;
  onClose: () => void;
  onExplain: (meta: MermaidNodeMeta) => void;
  onFlowChart: (meta: MermaidNodeMeta) => void;
  onOpenFile: (meta: MermaidNodeMeta) => void;
  /** Sembunyikan Flow Chart (mis. sudah di detail Functions). */
  showFlowChart?: boolean;
}

export function NodeActionMenu({
  menu,
  onClose,
  onExplain,
  onFlowChart,
  onOpenFile,
  showFlowChart = true
}: NodeActionMenuProps) {
  const maxW = 240;
  // Offset dari titik klik supaya gesture pembuka tidak “nembus” ke item menu.
  const left = Math.max(
    8,
    Math.min(menu.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 400) - maxW - 8)
  );
  const top = Math.max(
    8,
    Math.min(menu.y + 14, (typeof window !== 'undefined' ? window.innerHeight : 400) - 200)
  );

  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    const id = window.setTimeout(() => setArmed(true), 180);
    return () => window.clearTimeout(id);
  }, [menu.meta.id, menu.x, menu.y]);

  const run = (action: () => void) => {
    if (!armed) return;
    action();
  };

  const tree = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[10000] cursor-default bg-transparent"
        style={{ pointerEvents: armed ? 'auto' : 'none' }}
        aria-label={tw('nodeMenu.close')}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          run(onClose);
        }}
      />
      <div
        className="fixed z-[10001] w-[240px] overflow-hidden rounded-xl border border-white/10 bg-[var(--panel)] py-1.5 text-[var(--text-hi)] shadow-xl"
        style={{ left, top, pointerEvents: armed ? 'auto' : 'none' }}
        role="menu"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/5 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-white">{menu.meta.name}</div>
            <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-lo)]">
              {menu.meta.filePath.replace(/\\/g, '/').split('/').slice(-2).join('/')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => run(onClose)}
            className="rounded-md p-0.5 text-[var(--text-lo)] transition hover:bg-white/[0.06] hover:text-white"
            aria-label={tw('nodeMenu.close')}
          >
            <X size={14} />
          </button>
        </div>

        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] transition hover:bg-white/[0.05]"
          onClick={() =>
            run(() => {
              onExplain(menu.meta);
              onClose();
            })
          }
        >
          <Sparkles size={15} className="shrink-0 text-[#2dd4bf]" />
          <span>{tw('nodeMenu.explain')}</span>
        </button>

        {showFlowChart ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] transition hover:bg-white/[0.05]"
            onClick={() =>
              run(() => {
                onFlowChart(menu.meta);
                onClose();
              })
            }
          >
            <GitBranch size={15} className="shrink-0 text-[#60a5fa]" />
            <span>{tw('nodeMenu.flowChart')}</span>
          </button>
        ) : null}

        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] transition hover:bg-white/[0.05]"
          onClick={() =>
            run(() => {
              onOpenFile(menu.meta);
              onClose();
            })
          }
        >
          <FileCode2 size={15} className="shrink-0 text-[#fdba74]" />
          <span>{tw('nodeMenu.openFile')}</span>
        </button>
      </div>
    </>
  );

  if (typeof document === 'undefined') {
    return tree;
  }
  return createPortal(tree, document.body);
}
