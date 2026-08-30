import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadCompany } from '../../services/company/companyService';
import {
  loadEntries,
  groupByCity,
  computeMetricsForPeriod,
  availableQuarters,
  availableHalves,
  availableYears,
} from '../../services/marketData/marketDataService';
import type { MarketDataEntry, MarketPeriodSelector, MarketPeriodType } from '../../types/marketData';

const CARD_BG = '#1E293B';
const PAGE_BG = 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)';
const SELECT_CLS = 'rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/50';

function MiniBarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 90 }}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t-md" style={{ height: `${Math.max(4, (d.value / max) * 70)}px`, background: `linear-gradient(180deg, ${color} 0%, ${color}99 100%)`, boxShadow: `0 0 12px ${color}55` }} />
          <span className="truncate text-[10px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Badge({ value, label, suffix = '%' }: { value: number | null; label?: string; suffix?: string }) {
  if (value === null) return <span className="text-xs text-slate-500">—</span>;
  const positive = value >= 0;
  return (
    <span className="text-xs">
      <span className={`font-semibold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {positive ? '▲' : '▼'} {Math.abs(value)}{suffix}
      </span>
      {label && <span className="ml-1 text-slate-500">{label}</span>}
    </span>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-2xl p-4 shadow-lg ring-1 ring-white/5" style={{ backgroundColor: CARD_BG, borderTop: `3px solid ${accent}` }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent }}>{value}</p>
      {sub && <div className="mt-1 flex flex-wrap gap-2">{sub}</div>}
    </div>
  );
}

function PercentBars({ data, color }: { data: Record<string, number>; color: string }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      {entries.map(([label, pct]) => (
        <div key={label}>
          <div className="mb-0.5 flex justify-between text-xs text-slate-400"><span>{label}</span><span className="text-slate-300">{pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const PERIOD_TYPES: { value: MarketPeriodType; label: string }[] = [
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom Range' },
];

function MarketAnalyticsDashboard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<MarketDataEntry[]>([]);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCity, setActiveCity] = useState<string | null>(null);

  const [periodType, setPeriodType] = useState<MarketPeriodType>('quarterly');
  const [quarterlySel, setQuarterlySel] = useState<{ year: number; quarter: number } | null>(null);
  const [halfSel, setHalfSel] = useState<{ year: number; half: 1 | 2 } | null>(null);
  const [yearlySel, setYearlySel] = useState<{ year: number } | null>(null);
  const [customFrom, setCustomFrom] = useState<{ year: number; quarter: number } | null>(null);
  const [customTo, setCustomTo] = useState<{ year: number; quarter: number } | null>(null);
  const [customApplied, setCustomApplied] = useState<{ from: { year: number; quarter: number }; to: { year: number; quarter: number } } | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;
    Promise.all([loadCompany()])
      .then(async ([company]) => {
        setEnabled(company?.market_analytics_enabled ?? false);
        setSourceNote(company?.market_analytics_source_note ?? null);
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
  const cityEntries = useMemo(() => (activeCity ? grouped.get(activeCity) ?? [] : []), [grouped, activeCity]);

  const quarters = useMemo(() => availableQuarters(cityEntries), [cityEntries]);
  const halves = useMemo(() => availableHalves(cityEntries), [cityEntries]);
  const years = useMemo(() => availableYears(cityEntries), [cityEntries]);

  // Whenever the city (or the set of entries) changes, snap every period
  // selector to that city's most recent real data — never leaves a filter
  // pointing at a period the newly-selected city has nothing in.
  useEffect(() => {
    if (quarters.length > 0) setQuarterlySel((prev) => (prev && quarters.some((q) => q.year === prev.year && q.quarter === prev.quarter) ? prev : quarters[0]));
    else setQuarterlySel(null);
    if (halves.length > 0) setHalfSel((prev) => (prev && halves.some((h) => h.year === prev.year && h.half === prev.half) ? prev : halves[0]));
    else setHalfSel(null);
    if (years.length > 0) setYearlySel((prev) => (prev && years.includes(prev.year) ? prev : { year: years[0] }));
    else setYearlySel(null);
    if (quarters.length > 0) {
      const oldest = quarters[quarters.length - 1];
      const newest = quarters[0];
      setCustomFrom((prev) => prev ?? oldest);
      setCustomTo((prev) => prev ?? newest);
      setCustomApplied((prev) => prev ?? { from: oldest, to: newest });
    } else {
      setCustomFrom(null);
      setCustomTo(null);
      setCustomApplied(null);
    }
  }, [activeCity, quarters, halves, years]);

  const selector: MarketPeriodSelector | null = useMemo(() => {
    if (periodType === 'quarterly') return quarterlySel ? { type: 'quarterly', ...quarterlySel } : null;
    if (periodType === 'half_yearly') return halfSel ? { type: 'half_yearly', ...halfSel } : null;
    if (periodType === 'yearly') return yearlySel ? { type: 'yearly', ...yearlySel } : null;
    return customApplied
      ? { type: 'custom', fromYear: customApplied.from.year, fromQuarter: customApplied.from.quarter, toYear: customApplied.to.year, toQuarter: customApplied.to.quarter }
      : null;
  }, [periodType, quarterlySel, halfSel, yearlySel, customApplied]);

  const metrics = useMemo(() => (selector ? computeMetricsForPeriod(cityEntries, selector) : null), [cityEntries, selector]);

  const customRangeInvalid = periodType === 'custom' && customFrom && customTo
    && (customTo.year * 4 + customTo.quarter) < (customFrom.year * 4 + customFrom.quarter);

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-800" />;
  if (error) return <div className="rounded-2xl border border-red-800 bg-red-950 p-6 text-sm text-red-300">{error}</div>;

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-12 text-center">
        <p className="font-semibold text-slate-300">Market Analytics is not enabled for your company.</p>
        <p className="mt-1 text-sm text-slate-500">This is an optional add-on — contact your platform admin to turn it on.</p>
      </div>
    );
  }

  return (
    <div className="-m-8 space-y-6 p-8" style={{ background: PAGE_BG, minHeight: '100%' }}>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6 text-white shadow-xl" style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', border: '1px solid #33415580' }}>
        <div className="space-y-1">
          <p className="text-sm text-amber-400">📈 Live Market Intelligence</p>
          <h2 className="text-2xl font-bold">Market Analytics</h2>
          <p className="text-sm text-slate-400">Real estate market data, updated by your admin team each quarter.</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-slate-400">Cities Tracked</p>
          <p className="mt-1 text-4xl font-bold" style={{ color: '#D4AF37' }}>{cities.length}</p>
        </div>
      </div>

      {cities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 py-16 text-center text-slate-500">
          <p className="font-medium">No market data has been added yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 rounded-2xl p-5 shadow-lg ring-1 ring-white/5" style={{ backgroundColor: CARD_BG }}>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">City</p>
              <div className="flex flex-wrap gap-2">
                {cities.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveCity(c)}
                    className="rounded-full px-4 py-2 text-sm font-semibold shadow-md transition"
                    style={activeCity === c
                      ? { background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#0F172A' }
                      : { backgroundColor: '#0F172A', color: '#CBD5E1' }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Period</p>
              <div className="flex flex-wrap gap-2">
                {PERIOD_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    onClick={() => setPeriodType(pt.value)}
                    className="rounded-full px-4 py-2 text-sm font-semibold shadow-md transition"
                    style={periodType === pt.value
                      ? { background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#0F172A' }
                      : { backgroundColor: '#0F172A', color: '#CBD5E1' }}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {periodType === 'quarterly' && quarterlySel && (
                <select
                  className={SELECT_CLS}
                  value={`${quarterlySel.year}-${quarterlySel.quarter}`}
                  onChange={(e) => {
                    const [year, quarter] = e.target.value.split('-').map(Number);
                    setQuarterlySel({ year, quarter });
                  }}
                >
                  {quarters.map((q) => (
                    <option key={`${q.year}-${q.quarter}`} value={`${q.year}-${q.quarter}`}>Q{q.quarter} {q.year}</option>
                  ))}
                </select>
              )}

              {periodType === 'half_yearly' && halfSel && (
                <select
                  className={SELECT_CLS}
                  value={`${halfSel.year}-${halfSel.half}`}
                  onChange={(e) => {
                    const [year, half] = e.target.value.split('-').map(Number);
                    setHalfSel({ year, half: half as 1 | 2 });
                  }}
                >
                  {halves.map((h) => (
                    <option key={`${h.year}-${h.half}`} value={`${h.year}-${h.half}`}>H{h.half} {h.year}</option>
                  ))}
                </select>
              )}

              {periodType === 'yearly' && yearlySel && (
                <select
                  className={SELECT_CLS}
                  value={yearlySel.year}
                  onChange={(e) => setYearlySel({ year: Number(e.target.value) })}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}

              {periodType === 'custom' && customFrom && customTo && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">From</span>
                    <select
                      className={SELECT_CLS}
                      value={`${customFrom.year}-${customFrom.quarter}`}
                      onChange={(e) => {
                        const [year, quarter] = e.target.value.split('-').map(Number);
                        setCustomFrom({ year, quarter });
                      }}
                    >
                      {quarters.map((q) => (
                        <option key={`${q.year}-${q.quarter}`} value={`${q.year}-${q.quarter}`}>Q{q.quarter} {q.year}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">To</span>
                    <select
                      className={SELECT_CLS}
                      value={`${customTo.year}-${customTo.quarter}`}
                      onChange={(e) => {
                        const [year, quarter] = e.target.value.split('-').map(Number);
                        setCustomTo({ year, quarter });
                      }}
                    >
                      {quarters.map((q) => (
                        <option key={`${q.year}-${q.quarter}`} value={`${q.year}-${q.quarter}`}>Q{q.quarter} {q.year}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => !customRangeInvalid && setCustomApplied({ from: customFrom, to: customTo })}
                    disabled={!!customRangeInvalid}
                    className="rounded-lg px-4 py-2 text-sm font-semibold shadow-md disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#0F172A' }}
                  >
                    Apply
                  </button>
                  {customRangeInvalid && <span className="text-xs text-red-400">"To" must be on or after "From".</span>}
                </>
              )}
            </div>
          </div>

          {metrics && (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard
                  accent="#6366f1"
                  label="Avg Rate"
                  value={`₹${metrics.avgRate.toLocaleString()}/sqft`}
                  sub={<><Badge value={metrics.priceChange} label={metrics.comparisonLabel} />{metrics.comparisonLabelYoY && <Badge value={metrics.priceChangeYoY} label={metrics.comparisonLabelYoY} />}</>}
                />
                <StatCard
                  accent="#10b981"
                  label="Rental Yield"
                  value={`${metrics.rentalAvg}%`}
                  sub={<><Badge value={metrics.rentalChange} label={metrics.comparisonLabel} />{metrics.comparisonLabelYoY && <Badge value={metrics.rentalChangeYoY} label={metrics.comparisonLabelYoY} />}</>}
                />
                <StatCard accent="#D4AF37" label="Invest Score" value={`${metrics.investScore}/100`} sub={<span className="text-xs text-slate-400">{metrics.latest.trend || '—'}</span>} />
                <StatCard accent="#a855f7" label="Segment" value={metrics.latest.segment || '—'} sub={<span className="text-xs text-slate-400">{metrics.periodLabel}</span>} />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-2xl p-5 shadow-lg ring-1 ring-white/5" style={{ backgroundColor: CARD_BG }}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200">Rate Trend (₹/sqft)</h3>
                    {metrics.comparisonLabelYoY && <Badge value={metrics.priceChangeYoY} label={metrics.comparisonLabelYoY} />}
                  </div>
                  <MiniBarChart data={metrics.rateHistory} color="#6366f1" />
                </div>
                <div className="rounded-2xl p-5 shadow-lg ring-1 ring-white/5" style={{ backgroundColor: CARD_BG }}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200">Demand vs Supply Index</h3>
                    <Badge value={metrics.demandChange} label={metrics.comparisonLabel} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MiniBarChart data={metrics.demandHistory} color="#10b981" />
                    <MiniBarChart data={metrics.supplyHistory} color="#f59e0b" />
                  </div>
                </div>
              </div>

              {metrics.latest.micromarkets.length > 0 && (
                <div className="rounded-2xl p-5 shadow-lg ring-1 ring-white/5" style={{ backgroundColor: CARD_BG }}>
                  <h3 className="mb-3 text-sm font-bold text-slate-200">Micromarkets</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="pb-2">Area</th><th className="pb-2">Rate (₹/sqft)</th><th className="pb-2">Demand</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.latest.micromarkets.map((m) => (
                          <tr key={m.name} className="border-t border-white/5">
                            <td className="py-2 font-medium text-slate-200">{m.name}</td>
                            <td className="py-2 text-slate-400">₹{m.rate.toLocaleString()}</td>
                            <td className="py-2 text-slate-400">{m.demand}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="rounded-2xl p-5 shadow-xl text-white ring-1 ring-amber-400/20" style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' }}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#D4AF37' }}>Property Price Index — {activeCity}</h3>
                    <p className="text-xs text-slate-400">Base 100 at the earliest quarter on record — a relative price benchmark, not an absolute rate.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold" style={{ color: '#D4AF37' }}>{metrics.priceIndex}</p>
                    <div className="flex flex-wrap justify-end gap-3">
                      <Badge value={metrics.priceIndexChange} label={metrics.comparisonLabel} />
                      {metrics.comparisonLabelYoY && <Badge value={metrics.priceIndexChangeYoY} label={metrics.comparisonLabelYoY} />}
                    </div>
                  </div>
                </div>
                <MiniBarChart data={metrics.priceIndexHistory} color="#D4AF37" />
              </div>

              {(Object.keys(metrics.latest.bhk_demand).length > 0 || Object.keys(metrics.latest.price_segment).length > 0) && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {Object.keys(metrics.latest.bhk_demand).length > 0 && (
                    <div className="rounded-2xl p-5 shadow-lg ring-1 ring-white/5" style={{ backgroundColor: CARD_BG }}>
                      <h3 className="mb-3 text-sm font-bold text-slate-200">BHK Demand Split</h3>
                      <PercentBars data={metrics.latest.bhk_demand} color="#6366f1" />
                    </div>
                  )}
                  {Object.keys(metrics.latest.price_segment).length > 0 && (
                    <div className="rounded-2xl p-5 shadow-lg ring-1 ring-white/5" style={{ backgroundColor: CARD_BG }}>
                      <h3 className="mb-3 text-sm font-bold text-slate-200">Price Segment Split</h3>
                      <PercentBars data={metrics.latest.price_segment} color="#a855f7" />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!metrics && (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 py-12 text-center text-slate-500">
              <p className="font-medium">No data for {activeCity} in this period — try a different city or period.</p>
            </div>
          )}
        </>
      )}

      {sourceNote && (
        <p className="text-center text-xs text-slate-500">{sourceNote}</p>
      )}
    </div>
  );
}

export default MarketAnalyticsDashboard;
