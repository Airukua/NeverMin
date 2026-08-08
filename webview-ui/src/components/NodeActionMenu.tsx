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
  const left = Math.max(8, Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 400) - maxW - 8));
  const top = Math.max(8, Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 400) - 180));

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        aria-label={tw('nodeMenu.close')}
        onClick={onClose}
      />
      <div
        className="fixed z-50 w-[240px] overflow-hidden rounded-xl border border-white/10 bg-[var(--panel)] py-1.5 text-[var(--text-hi)]"
        style={{ left, top }}
        role="menu"
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
            onClick={onClose}
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
          onClick={() => {
            onExplain(menu.meta);
            onClose();
          }}
        >
          <Sparkles size={15} className="shrink-0 text-[#2dd4bf]" />
          <span>{tw('nodeMenu.explain')}</span>
        </button>

        {showFlowChart ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] transition hover:bg-white/[0.05]"
            onClick={() => {
              onFlowChart(menu.meta);
              onClose();
            }}
          >
            <GitBranch size={15} className="shrink-0 text-[#60a5fa]" />
            <span>{tw('nodeMenu.flowChart')}</span>
          </button>
        ) : null}

        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] transition hover:bg-white/[0.05]"
          onClick={() => {
            onOpenFile(menu.meta);
            onClose();
          }}
        >
          <FileCode2 size={15} className="shrink-0 text-[#fdba74]" />
          <span>{tw('nodeMenu.openFile')}</span>
        </button>
      </div>
    </>
  );
}
