import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModal } from '../../hooks/useModal';

export function ActionSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(ref, true, onClose);
  return createPortal(<div className="workspace-modal fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="w-full max-w-sm overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2 pl-2"><h2 id={titleId} className="truncate text-base font-semibold">{title}</h2><button aria-label="Close actions" onClick={onClose} className="touch-target rounded-md hover:bg-slate-100"><X size={20} /></button></div>
      <div className="space-y-1">{children}</div>
    </div>
  </div>, document.body);
}
