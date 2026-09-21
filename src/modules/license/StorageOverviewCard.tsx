import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface StorageOverview {
  db_bytes: number;
  capacity_gb: number;
  max_upload_mb: number;
  warn_at_pct: number;
  buckets: { bucket: string; files: number; bytes: number }[];
  companies: { company_id: string; name: string; bytes: number; limit_bytes: number | null }[];
  unattributed_bytes: number;
  top_files?: { bucket: string; name: string; bytes: number; created_at: string; client: string | null }[];
}

const GB = 1073741824;
const MB = 1048576;

function fmt(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

export async function loadStorageOverview(): Promise<StorageOverview> {
  const { data, error } = await supabase.rpc('get_storage_overview');
  if (error) throw new Error(error.message);
  return data as StorageOverview;
}

function Bar({ pct, warn }: { pct: number; warn: number }) {
  const color = pct >= 100 ? 'bg-red-500' : pct >= warn ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

/** Platform operator's view of how much of the Supabase project is used, by bucket and by company, with the upload limits editable. */
export default function StorageOverviewCard() {
  const [data, setData] = useState<StorageOverview | null>(null);
  const [error, setError] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [maxUpload, setMaxUpload] = useState('50');
  const [warnPct, setWarnPct] = useState('80');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function apply(d: StorageOverview) {
    setData(d);
    setCapacity(String(d.capacity_gb));
    setMaxUpload(String(d.max_upload_mb));
    setWarnPct(String(d.warn_at_pct));
  }

  useEffect(() => {
    loadStorageOverview().then(apply).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load storage usage.'));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const { error: err } = await supabase.rpc('save_storage_settings', {
        p_max_upload_mb: Math.round(Number(maxUpload)),
        p_project_capacity_gb: Number(capacity),
        p_warn_at_pct: Math.round(Number(warnPct)),
      });
      if (err) throw new Error(err.message);
      apply(await loadStorageOverview());
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) return <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;

  const filesBytes = data.buckets.reduce((s, b) => s + b.bytes, 0);
  const capBytes = data.capacity_gb * GB;
  const pct = capBytes > 0 ? Math.round((filesBytes / capBytes) * 100) : 0;
  const INPUT = 'w-24 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Storage used</h3>
          <p className="text-xs text-slate-500">Files (videos, images, documents, exam photos) counted against your Supabase storage allowance. Live from the database.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{fmt(filesBytes)}</p>
          <p className="text-xs text-slate-500">of {data.capacity_gb} GB · {pct}%</p>
        </div>
      </div>
      <Bar pct={pct} warn={data.warn_at_pct} />
      {pct >= data.warn_at_pct && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          ⚠ Storage is {pct}% full. Upgrade the Supabase plan or clean up files before clients hit the limit.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">Database size: {fmt(data.db_bytes)} (counted separately by Supabase, 500 MB on the Free plan).</p>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">By client</h4>
          {data.companies.length === 0 && <p className="text-xs text-slate-400">Nothing attributed yet.</p>}
          <div className="space-y-2.5">
            {data.companies.map((c) => {
              const lim = c.limit_bytes;
              const p = lim ? Math.round((c.bytes / lim) * 100) : 0;
              return (
                <div key={c.company_id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <span className="text-slate-500">{fmt(c.bytes)}{lim ? ` / ${fmt(lim)} (${p}%)` : ' · no plan limit'}</span>
                  </div>
                  {lim ? <Bar pct={p} warn={data.warn_at_pct} /> : null}
                </div>
              );
            })}
            {data.unattributed_bytes > 0 && (
              <p className="text-xs text-slate-400">Older uploads not tied to a client: {fmt(data.unattributed_bytes)} (new uploads are always tied to their client).</p>
            )}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">By type of file</h4>
          <div className="space-y-1.5 text-xs">
            {data.buckets.map((b) => (
              <div key={b.bucket} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                <span className="font-medium text-slate-700">{b.bucket}</span>
                <span className="text-slate-500">{b.files} files · {fmt(b.bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.top_files && data.top_files.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Biggest files (delete unused ones in Admin → Storage Manager)</h4>
          <div className="space-y-1 text-xs">
            {data.top_files.map((f) => (
              <div key={f.bucket + f.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5">
                <span className="min-w-0 truncate font-medium text-slate-700" title={f.name}>{f.name}</span>
                <span className="shrink-0 text-slate-500">{f.client ?? 'client unknown'} · {fmt(f.bytes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        <label className="text-xs font-semibold text-slate-500">Your Supabase storage (GB)
          <input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" min={0.1} step={0.1} className={`${INPUT} mt-1 block`} />
        </label>
        <label className="text-xs font-semibold text-slate-500">Max size per upload (MB)
          <input value={maxUpload} onChange={(e) => setMaxUpload(e.target.value)} type="number" min={1} className={`${INPUT} mt-1 block`} />
        </label>
        <label className="text-xs font-semibold text-slate-500">Warn at (%)
          <input value={warnPct} onChange={(e) => setWarnPct(e.target.value)} type="number" min={1} max={100} className={`${INPUT} mt-1 block`} />
        </label>
        <button onClick={save} disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        {saved && <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      <p className="mt-2 text-xs text-slate-400">Each client's allowance comes from their plan's "storage GB" (Plans tab). An upload that would go past it, or past the per-upload size, is refused with a clear message.</p>
    </div>
  );
}
