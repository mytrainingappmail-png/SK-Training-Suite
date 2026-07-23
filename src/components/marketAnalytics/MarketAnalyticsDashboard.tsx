import { useEffect, useMemo, useState } from 'react';
import SectionHeroBanner from '../learning/SectionHeroBanner';
import { getCurrentUser } from '../../services/auth/session';
import { loadCompany } from '../../services/company/companyService';
import { loadEntries, groupByCity, computeMetricsForCity } from '../../services/marketData/marketDataService';
import type { MarketDataEntry } from '../../types/marketData';

function MiniBarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 90 }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t-md" style={{ height: `${Math.max(4, (d.value / max) * 70)}px`, backgroundColor: color }} />
          <span className="truncate text-[10px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Badge({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-xs text-slate-400">—</span>;
  const positive = value >= 0;
  return (
    <span className={`text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
      {positive ? '▲' : '▼'} {Math.abs(value)}{suffix}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

function PercentBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      {entries.map(([label, pct]) => (
        <div key={label}>
          <div className="mb-0.5 flex justify-between text-xs text-slate-500"><span>{label}</span><span>{pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MarketAnalyticsDashboard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<MarketDataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCity, setActiveCity] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;
    Promise.all([loadCompany()])
      .then(async ([company]) => {
        setEnabled(company?.market_analytics_enabled ?? false);
        if (company?.market_analytics_enabled) {
          const rows = await loadEntries(company.id);
          setEntries(rows);
          setActiveCity((prev) => prev ?? rows[0]?.city_name ?? null);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load market analytics.'))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => groupByCity(entries), [entries]);
  const cities = useMemo(() => Array.from(grouped.keys()).sort(), [grouped]);
  const metrics = activeCity ? computeMetricsForCity(grouped.get(activeCity) ?? []) : null;

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
        <p className="font-semibold text-slate-600">Market Analytics is not enabled for your company.</p>
        <p className="mt-1 text-sm text-slate-400">This is an optional add-on — contact SK Enterprise to turn it on.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        title="Market Analytics"
        subtitle="Real estate market data, updated by your admin team each quarter."
        statLabel="Cities"
        statValue={cities.length}
      />

      {cities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
          <p className="font-medium">No market data has been added yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCity(c)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeCity === c ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-sm hover:bg-slate-50'}`}
              >
                {c}
              </button>
            ))}
          </div>

          {metrics && (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="Avg Rate" value={`₹${metrics.latest.avg_rate.toLocaleString()}/sqft`} sub={<div className="flex gap-2"><Badge value={metrics.priceQoQ} /><span className="text-xs text-slate-300">QoQ</span></div>} />
                <StatCard label="Rental Yield" value={`${metrics.latest.rental_avg}%`} sub={<div className="flex gap-2"><Badge value={metrics.rentalQoQ} /><span className="text-xs text-slate-300">QoQ</span></div>} />
                <StatCard label="Invest Score" value={`${metrics.investScore}/100`} sub={<span className="text-xs text-slate-400">{metrics.latest.trend || '—'}</span>} />
                <StatCard label="Segment" value={metrics.latest.segment || '—'} sub={<span className="text-xs text-slate-400">Q{metrics.latest.quarter} {metrics.latest.year}</span>} />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700">Rate Trend (₹/sqft)</h3>
                    <Badge value={metrics.priceYoY} />
                  </div>
                  <MiniBarChart data={metrics.rateHistory} color="#6366f1" />
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700">Demand vs Supply Index</h3>
                    <Badge value={metrics.demandQoQ} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MiniBarChart data={metrics.demandHistory} color="#10b981" />
                    <MiniBarChart data={metrics.supplyHistory} color="#f59e0b" />
                  </div>
                </div>
              </div>

              {metrics.latest.micromarkets.length > 0 && (
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold text-slate-700">Micromarkets</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                          <th className="pb-2">Area</th><th className="pb-2">Rate (₹/sqft)</th><th className="pb-2">Demand</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.latest.micromarkets.map((m) => (
                          <tr key={m.name} className="border-t border-slate-100">
                            <td className="py-2 font-medium text-slate-700">{m.name}</td>
                            <td className="py-2 text-slate-600">₹{m.rate.toLocaleString()}</td>
                            <td className="py-2 text-slate-600">{m.demand}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="rounded-2xl p-5 shadow-sm text-white" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Property Price Index — {activeCity}</h3>
                    <p className="text-xs text-slate-400">Base 100 at the earliest quarter on record — a relative price benchmark, not an absolute rate.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold" style={{ color: '#D4AF37' }}>{metrics.priceIndex}</p>
                    <div className="flex justify-end gap-3">
                      <span className="text-xs"><Badge value={metrics.priceIndexQoQ} /> <span className="text-slate-400">QoQ</span></span>
                      <span className="text-xs"><Badge value={metrics.priceIndexYoY} /> <span className="text-slate-400">YoY</span></span>
                    </div>
                  </div>
                </div>
                <MiniBarChart data={metrics.priceIndexHistory} color="#D4AF37" />
              </div>

              {(Object.keys(metrics.latest.bhk_demand).length > 0 || Object.keys(metrics.latest.price_segment).length > 0) && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {Object.keys(metrics.latest.bhk_demand).length > 0 && (
                    <div className="rounded-2xl bg-white p-5 shadow-sm">
                      <h3 className="mb-3 text-sm font-bold text-slate-700">BHK Demand Split</h3>
                      <PercentBars data={metrics.latest.bhk_demand} />
                    </div>
                  )}
                  {Object.keys(metrics.latest.price_segment).length > 0 && (
                    <div className="rounded-2xl bg-white p-5 shadow-sm">
                      <h3 className="mb-3 text-sm font-bold text-slate-700">Price Segment Split</h3>
                      <PercentBars data={metrics.latest.price_segment} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default MarketAnalyticsDashboard;
