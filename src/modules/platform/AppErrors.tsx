// Platform owner only: the "Something went wrong" screens your customers have hit, newest first.

import { useCallback, useEffect, useState } from 'react';

import SectionHeroBanner from '../../components/learning/SectionHeroBanner';
import { clearClientErrors, listClientErrors } from '../../repositories/platform/clientErrorRepository';
import type { ClientErrorRow } from '../../repositories/platform/clientErrorRepository';

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AppErrors() {
  const [rows, setRows] = useState<ClientErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setRows(await listClientErrors()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load the error list.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function clearAll() {
    if (!confirm('Clear the whole list? This only removes these reports.')) return;
    try { await clearClientErrors(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not clear the list.'); }
  }

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        eyebrow="Platform owner"
        title="App Errors"
        subtitle="When a customer sees “Something went wrong”, it lands here with the page, the company and the person."
        statLabel="Reports"
        statValue={rows.length}
      />

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{loading ? 'Loading…' : rows.length === 0 ? 'No errors reported. 🎉' : `Showing the latest ${rows.length}.`}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
          {rows.length > 0 && <button type="button" onClick={() => void clearAll()} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Clear list</button>}
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full flex-wrap items-start justify-between gap-2 text-left">
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-semibold text-slate-900">{r.message}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {r.company_name ?? 'Unknown company'}{r.employee_code ? ` · ${r.employee_code}` : ''} · {r.page ?? ''}
                </span>
              </span>
              <span className="text-xs text-slate-400">{when(r.at)}</span>
            </button>
            {open === r.id && (
              <div className="mt-3 space-y-2">
                {r.user_agent && <p className="text-xs text-slate-500">{r.user_agent}</p>}
                {r.stack && <pre className="max-h-64 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px] text-slate-700">{r.stack}</pre>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
