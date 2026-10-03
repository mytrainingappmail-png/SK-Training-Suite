// The frame around every "Preview as employee" — a full-screen panel with a clear "nothing here is
// saved" bar, so the owner/admin sees exactly what an employee sees without touching any real progress.
//
// It is drawn through a portal straight into <body>. Inside the admin page a parent can carry a CSS
// transform/animation, which makes a "fixed" child size itself to that parent instead of the screen —
// the page's own sidebar then peeks out at the edges of the preview.

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function PreviewModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-100" role="dialog" aria-modal="true">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-3 text-white">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">👁 Preview — this is how employees see it</p>
          <p className="truncate text-sm font-bold">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-300 sm:inline">Nothing you do here is saved.</span>
          <button type="button" onClick={onClose} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Close preview</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
