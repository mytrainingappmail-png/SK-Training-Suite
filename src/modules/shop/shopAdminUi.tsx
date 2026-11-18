// Small building blocks for the shop's admin screens (light theme, like the other admin pages).

import type { ReactNode } from 'react';

export const A_INPUT = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100';
export const A_BTN = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
export const A_BTN_GOLD = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50';
export const A_BTN_LIGHT = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50';
export const A_BTN_DANGER = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50';

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-bold text-slate-600">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function Card({ title, subtitle, children, right }: { title?: string; subtitle?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h3 className="text-base font-extrabold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </button>
      {label && <span className="text-sm font-semibold text-slate-700">{label}</span>}
    </label>
  );
}

export function Notice({ kind, children }: { kind: 'ok' | 'error' | 'info'; children: ReactNode }) {
  const cls = kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : kind === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-sky-50 text-sky-800 border-sky-200';
  return <div className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${cls}`}>{children}</div>;
}

export function money(n: number | null | undefined, symbol: string): string {
  return `${symbol}${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
