import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../../services/auth/session';
import { loadCompany } from '../../../services/company/companyService';
import { loadEntries, saveEntry, deleteEntry, groupByCity, computeMetricsForCity } from '../../../services/marketData/marketDataService';
import type { MarketDataEntry, MarketDataEntryForm } from '../../../types/marketData';

const CARD_BG = '#1E293B';
const PAGE_BG = 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)';
const INPUT_CLS = 'w-full rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/50';
const LABEL_CLS = 'mb-1 block text-xs font-semibold text-slate-400';

const EMPTY_FORM: MarketDataEntryForm = {
  city_name: '', state_name: '', year: new Date().getFullYear(), quarter: 1,
  segment: '', trend: '', avg_rate: 0, rental_avg: 0, demand_index: 0, supply_index: 0, price_index: 0,
  bhk_demand: {}, price_segment: {}, micromarkets: [],
};

function EntryForm({ initial, onClose, onSaved }: { initial: MarketDataEntryForm; onClose: () => void; onSaved: (e: MarketDataEntry) => void }) {
  const user = getCurrentUser();
  const [form, setForm] = useState<MarketDataEntryForm>(initial);
  const [micromarketsText, setMicromarketsText] = useState(
    initial.micromarkets.map((m) => `${m.name}, ${m.rate}, ${m.demand}`).join('\n')
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function parseMicromarkets(text: string) {
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [name, rate, demand] = line.split(',').map((p) => p.trim());
      return { name: name ?? '', rate: Number(rate) || 0, demand: demand ?? '' };
    });
  }

  async function handleSave() {
    if (!user) return;
    if (!form.city_name.trim()) {
      setError('City name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const company = await loadCompany();
      const saved = await saveEntry(company!.id, user.id, `${user.firstName} ${user.lastName}`.trim(), {
        ...form,
        micromarkets: parseMicromarkets(micromarketsText),
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 shadow-2xl ring-1 ring-white/10" style={{ backgroundColor: '#0F172A' }}>
        <h3 className="mb-1 text-lg font-bold text-white">📊 Quarterly Market Data</h3>
        <p className="mb-4 text-xs text-slate-400">Enter this quarter's raw numbers only — QoQ/YoY % and the invest score are computed automatically from history.</p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2">
            <label className={LABEL_CLS}>City</label>
            <input value={form.city_name} onChange={(e) => setForm({ ...form, city_name: e.target.value })} className={INPUT_CLS} placeholder="e.g. Gurgaon" />
          </div>
          <div className="col-span-2">
            <label className={LABEL_CLS}>State</label>
            <input value={form.state_name} onChange={(e) => setForm({ ...form, state_name: e.target.value })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Year</label>
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Quarter</label>
            <select value={form.quarter} onChange={(e) => setForm({ ...form, quarter: Number(e.target.value) })} className={INPUT_CLS}>
              {[1, 2, 3, 4].map((q) => (<option key={q} value={q}>Q{q}</option>))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Avg Rate (₹/sqft)</label>
            <input type="number" value={form.avg_rate} onChange={(e) => setForm({ ...form, avg_rate: Number(e.target.value) })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Rental Yield (%)</label>
            <input type="number" step="0.01" value={form.rental_avg} onChange={(e) => setForm({ ...form, rental_avg: Number(e.target.value) })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Demand Index (0-100)</label>
            <input type="number" value={form.demand_index} onChange={(e) => setForm({ ...form, demand_index: Number(e.target.value) })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Supply Index (0-100)</label>
            <input type="number" value={form.supply_index} onChange={(e) => setForm({ ...form, supply_index: Number(e.target.value) })} className={INPUT_CLS} />
          </div>
          <div>
            <label className={LABEL_CLS}>Price Index (optional)</label>
            <input type="number" value={form.price_index || ''} onChange={(e) => setForm({ ...form, price_index: Number(e.target.value) })} className={INPUT_CLS} placeholder="Auto (base 100)" />
          </div>
          <div className="col-span-2">
            <label className={LABEL_CLS}>Segment</label>
            <input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className={INPUT_CLS} placeholder="e.g. Luxury, IT-Premium" />
          </div>
          <div className="col-span-2">
            <label className={LABEL_CLS}>Trend Label</label>
            <input value={form.trend} onChange={(e) => setForm({ ...form, trend: e.target.value })} className={INPUT_CLS} placeholder="e.g. Bull Run, Appreciating" />
          </div>
        </div>

        <div className="mt-4">
          <label className={LABEL_CLS}>Micromarkets (optional — one per line: name, rate, demand)</label>
          <textarea value={micromarketsText} onChange={(e) => setMicromarketsText(e.target.value)} rows={3} className={`${INPUT_CLS} resize-none font-mono`} placeholder={'Whitefield, 12400, High\nKandivali, 16500, High'} />
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl bg-white/5 px-3.5 py-2 text-sm font-semibold text-slate-300 ring-1 ring-white/10 hover:bg-white/10">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#0F172A' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarketDataManagement() {
  const [entries, setEntries] = useState<MarketDataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<MarketDataEntryForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketDataEntry | null>(null);

  function fetchAll() {
    setLoading(true);
    setError('');
    loadCompany()
      .then((company) => (company ? loadEntries(company.id) : []))
      .then(setEntries)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load market data.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const grouped = useMemo(() => groupByCity(entries), [entries]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await deleteEntry(deleteTarget.id);
    setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-800" />;
  if (error) return <div className="rounded-2xl border border-red-800 bg-red-950 p-6 text-sm text-red-300">{error}</div>;

  return (
    <div className="-m-8 space-y-6 p-8" style={{ background: PAGE_BG, minHeight: '100%' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 shadow-xl ring-1 ring-white/5" style={{ backgroundColor: CARD_BG }}>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#D4AF37' }}>📊 Market Analytics Data</h2>
          <p className="mt-1 text-xs text-slate-400">Add one quarter's raw numbers per city — everything else is computed for the employee dashboard.</p>
        </div>
        <button onClick={() => setEditing(EMPTY_FORM)} className="rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg" style={{ background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#0F172A' }}>
          + Add Quarterly Entry
        </button>
      </div>

      {grouped.size === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 py-16 text-center text-slate-500">
          <p className="font-medium">No market data yet — add your first city's quarterly numbers.</p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([city, cityEntries]) => {
          const metrics = computeMetricsForCity(cityEntries);
          return (
            <div key={city} className="rounded-2xl p-5 shadow-lg ring-1 ring-white/5" style={{ backgroundColor: CARD_BG }}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{city}</h3>
                {metrics && (
                  <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: '#D4AF3722', color: '#D4AF37' }}>Invest Score {metrics.investScore}</span>
                )}
              </div>
              <div className="space-y-2">
                {[...cityEntries].sort((a, b) => b.year * 4 + b.quarter - (a.year * 4 + a.quarter)).map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 text-sm">
                    <span className="font-medium text-slate-200">Q{e.quarter} {e.year} — ₹{e.avg_rate.toLocaleString()}/sqft, {e.rental_avg}% yield</span>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(e)} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/20">Edit</button>
                      <button onClick={() => setDeleteTarget(e)} className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {editing && (
        <EntryForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => setEntries((prev) => (prev.some((e) => e.id === saved.id) ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved]))}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl p-6 shadow-2xl ring-1 ring-white/10" style={{ backgroundColor: '#0F172A' }}>
            <h3 className="mb-1 text-lg font-bold text-white">Delete Entry</h3>
            <p className="mb-5 text-sm text-slate-400">Delete Q{deleteTarget.quarter} {deleteTarget.year} for {deleteTarget.city_name}? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-xl bg-white/5 px-3.5 py-2 text-sm font-semibold text-slate-300 ring-1 ring-white/10 hover:bg-white/10">Cancel</button>
              <button onClick={handleDeleteConfirm} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketDataManagement;
