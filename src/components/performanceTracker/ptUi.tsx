// src/components/performanceTracker/ptUi.tsx
//
// Small shared UI primitives for Performance Tracker's tabs — this app has
// no generic <Card>/<Badge> kit (every screen hand-rolls its own Tailwind),
// so these stay local to this module rather than becoming a new app-wide
// dependency.

import { useEffect, useRef, useState } from 'react';
import { IconSpinner } from './ptIcons';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

const BADGE_TONES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  rejected: 'bg-rose-50 text-rose-700',
  gray: 'bg-slate-100 text-slate-600',
  info: 'bg-sky-50 text-sky-700',
};

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone]}`}>{children}</span>;
}

const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40';

export function NumField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type="number" min={0} value={value}
        // `min={0}` is only an HTML hint — it doesn't stop someone typing
        // "-5". `|| 0` alone doesn't catch that either (a negative number is
        // still truthy), so clamp explicitly.
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`mt-1 ${INPUT_CLS}`}
      />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={INPUT_CLS}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export const ptInputCls = INPUT_CLS;

// A checkbox-dropdown multi-select — this module has no such control
// anywhere ("Team"/"Department" filters are all single-select `SelectField`s),
// but a flexible report needs "pick any combination of employees/teams",
// not just one at a time.
export function MultiSelectField({ label, values, onChange, options, placeholder = 'All' }: {
  label: string; values: string[]; onChange: (v: string[]) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()));
  const allSelected = options.length > 0 && values.length === options.length;

  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }

  const summary = values.length === 0 ? placeholder : allSelected ? `All (${options.length})` : `${values.length} selected`;

  return (
    <div ref={ref} className="relative">
      {label && <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>}
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className={`${INPUT_CLS} flex items-center justify-between gap-2 text-left`}
      >
        <span className={values.length === 0 ? 'text-slate-400' : ''}>{summary}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {options.length > 6 && (
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="mb-2 w-full rounded-md bg-slate-50 px-2 py-1.5 text-xs outline-none"
            />
          )}
          <div className="mb-1 flex items-center justify-between px-1">
            <button
              type="button" onClick={() => onChange(allSelected ? [] : options.map((o) => o.value))}
              className="text-[11px] font-medium text-emerald-700 hover:underline"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
            {values.length > 0 && <span className="text-[11px] text-slate-500">{values.length} selected</span>}
          </div>
          {filtered.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-slate-50">
              <input
                type="checkbox" checked={values.includes(o.value)} onChange={() => toggle(o.value)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
              />
              {o.label}
            </label>
          ))}
          {filtered.length === 0 && <p className="px-1.5 py-2 text-xs text-slate-400">No matches.</p>}
        </div>
      )}
    </div>
  );
}

export function LoadingBlock() {
  return <div className="flex h-32 items-center justify-center text-slate-500"><IconSpinner className="mr-2 h-4 w-4 text-emerald-500" /> Loading...</div>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function initials(name: string): string {
  return name.split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();
}

export function employeeName(e: { first_name: string; last_name: string } | undefined | null): string {
  return e ? `${e.first_name} ${e.last_name}`.trim() : 'Unknown';
}
