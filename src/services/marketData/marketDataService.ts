import * as repo from "../../repositories/marketData/marketDataRepository";
import type { MarketDataEntry, MarketDataEntryForm, MarketMetrics, MarketPeriodSelector } from "../../types/marketData";

export async function loadEntries(companyId: string): Promise<MarketDataEntry[]> {
  return repo.getAllEntries(companyId);
}

export async function saveEntry(companyId: string, createdBy: string | null, createdByName: string, form: MarketDataEntryForm): Promise<MarketDataEntry> {
  return repo.upsertEntry(companyId, createdBy, createdByName, form);
}

export async function deleteEntry(id: string): Promise<void> {
  return repo.deleteEntry(id);
}

export function groupByCity(entries: MarketDataEntry[]): Map<string, MarketDataEntry[]> {
  const map = new Map<string, MarketDataEntry[]>();
  for (const e of entries) {
    const list = map.get(e.city_name) ?? [];
    list.push(e);
    map.set(e.city_name, list);
  }
  return map;
}

// A quarter is addressed as a single integer so period math (previous
// period, same period a year ago, range bounds) is just integer add/subtract
// — quarter 1-4 maps to offset 0-3 within its year.
function quarterKey(e: { year: number; quarter: number }): number {
  return e.year * 4 + (e.quarter - 1);
}

function sortByQuarter(entries: MarketDataEntry[]): MarketDataEntry[] {
  return [...entries].sort((a, b) => quarterKey(a) - quarterKey(b));
}

function entriesInBounds(sorted: MarketDataEntry[], startKey: number, endKey: number): MarketDataEntry[] {
  return sorted.filter((e) => {
    const k = quarterKey(e);
    return k >= startKey && k <= endKey;
  });
}

function pctChange(current: number, previous: number | null | undefined): number | null {
  if (previous === undefined || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function quarterLabel(e: { year: number; quarter: number }): string {
  return `Q${e.quarter} ${e.year}`;
}

interface PeriodBounds {
  startKey: number;
  endKey: number;
  label: string;
  comparisonLabel: string;
  /** "vs same period last year" is only meaningful for quarterly/half-yearly. */
  yoyApplicable: boolean;
}

function resolvePeriodBounds(selector: MarketPeriodSelector): PeriodBounds | null {
  switch (selector.type) {
    case "quarterly": {
      if (selector.year == null || selector.quarter == null) return null;
      const k = quarterKey({ year: selector.year, quarter: selector.quarter });
      return { startKey: k, endKey: k, label: quarterLabel({ year: selector.year, quarter: selector.quarter }), comparisonLabel: "vs previous quarter", yoyApplicable: true };
    }
    case "half_yearly": {
      if (selector.year == null || selector.half == null) return null;
      const startQuarter = selector.half === 1 ? 1 : 3;
      const startKey = quarterKey({ year: selector.year, quarter: startQuarter });
      return { startKey, endKey: startKey + 1, label: `H${selector.half} ${selector.year}`, comparisonLabel: "vs previous half-year", yoyApplicable: true };
    }
    case "yearly": {
      if (selector.year == null) return null;
      const startKey = quarterKey({ year: selector.year, quarter: 1 });
      return { startKey, endKey: startKey + 3, label: `${selector.year}`, comparisonLabel: "vs previous year", yoyApplicable: false };
    }
    case "custom": {
      if (selector.fromYear == null || selector.fromQuarter == null || selector.toYear == null || selector.toQuarter == null) return null;
      const startKey = quarterKey({ year: selector.fromYear, quarter: selector.fromQuarter });
      const endKey = quarterKey({ year: selector.toYear, quarter: selector.toQuarter });
      if (endKey < startKey) return null;
      const label = startKey === endKey
        ? quarterLabel({ year: selector.fromYear, quarter: selector.fromQuarter })
        : `${quarterLabel({ year: selector.fromYear, quarter: selector.fromQuarter })} – ${quarterLabel({ year: selector.toYear, quarter: selector.toQuarter })}`;
      return { startKey, endKey, label, comparisonLabel: "vs previous period", yoyApplicable: false };
    }
  }
}

interface Aggregate {
  avgRate: number;
  rentalAvg: number;
  demandIndex: number;
  supplyIndex: number;
  priceIndex: number;
  representative: MarketDataEntry;
}

function aggregate(entries: MarketDataEntry[], baseRate: number): Aggregate | null {
  if (entries.length === 0) return null;
  const sorted = sortByQuarter(entries);
  const indexFor = (e: MarketDataEntry) => (e.price_index !== 0 ? e.price_index : Math.round((e.avg_rate / baseRate) * 1000) / 10);
  return {
    avgRate: average(sorted.map((e) => e.avg_rate)),
    rentalAvg: average(sorted.map((e) => e.rental_avg)),
    demandIndex: average(sorted.map((e) => e.demand_index)),
    supplyIndex: average(sorted.map((e) => e.supply_index)),
    priceIndex: average(sorted.map(indexFor)),
    representative: sorted[sorted.length - 1],
  };
}

/**
 * Every stat, chart, and comparison badge on the dashboard is derived here
 * from the admin's raw quarterly entries that fall inside the selected
 * period — nothing is precomputed/stored, so switching the period filter
 * always reflects real data for that exact window.
 */
export function computeMetricsForPeriod(entriesForCity: MarketDataEntry[], selector: MarketPeriodSelector): MarketMetrics | null {
  if (entriesForCity.length === 0) return null;

  const sorted = sortByQuarter(entriesForCity);
  const baseRate = sorted[0].avg_rate || 1;
  const indexFor = (e: MarketDataEntry) => (e.price_index !== 0 ? e.price_index : Math.round((e.avg_rate / baseRate) * 1000) / 10);

  const bounds = resolvePeriodBounds(selector);
  if (!bounds) return null;

  const current = aggregate(entriesInBounds(sorted, bounds.startKey, bounds.endKey), baseRate);
  if (!current) return null; // no entries fall inside the selected period at all

  const periodLength = bounds.endKey - bounds.startKey + 1;
  const previous = aggregate(entriesInBounds(sorted, bounds.startKey - periodLength, bounds.endKey - periodLength), baseRate);
  const yearAgo = bounds.yoyApplicable ? aggregate(entriesInBounds(sorted, bounds.startKey - 4, bounds.endKey - 4), baseRate) : null;

  const historyEntries = selector.type === "custom"
    ? entriesInBounds(sorted, bounds.startKey, bounds.endKey)
    : sorted.filter((e) => quarterKey(e) <= bounds.endKey);

  const investScoreRaw =
    40 +
    (pctChange(current.avgRate, yearAgo?.avgRate ?? previous?.avgRate) ?? 0) * 0.6 +
    (current.demandIndex - current.supplyIndex) * 0.3 +
    current.rentalAvg * 5;

  return {
    periodLabel: bounds.label,
    comparisonLabel: bounds.comparisonLabel,
    comparisonLabelYoY: bounds.yoyApplicable ? "vs same period last year" : null,
    latest: current.representative,
    avgRate: current.avgRate,
    rentalAvg: current.rentalAvg,
    demandIndex: current.demandIndex,
    supplyIndex: current.supplyIndex,
    priceIndex: current.priceIndex,
    priceChange: pctChange(current.avgRate, previous?.avgRate),
    priceChangeYoY: yearAgo ? pctChange(current.avgRate, yearAgo.avgRate) : null,
    rentalChange: pctChange(current.rentalAvg, previous?.rentalAvg),
    rentalChangeYoY: yearAgo ? pctChange(current.rentalAvg, yearAgo.rentalAvg) : null,
    demandChange: pctChange(current.demandIndex, previous?.demandIndex),
    supplyChange: pctChange(current.supplyIndex, previous?.supplyIndex),
    priceIndexChange: pctChange(current.priceIndex, previous?.priceIndex),
    priceIndexChangeYoY: yearAgo ? pctChange(current.priceIndex, yearAgo.priceIndex) : null,
    investScore: Math.max(0, Math.min(100, Math.round(investScoreRaw))),
    rateHistory: historyEntries.map((e) => ({ label: quarterLabel(e), value: e.avg_rate })),
    demandHistory: historyEntries.map((e) => ({ label: quarterLabel(e), value: e.demand_index })),
    supplyHistory: historyEntries.map((e) => ({ label: quarterLabel(e), value: e.supply_index })),
    rentalHistory: historyEntries.map((e) => ({ label: quarterLabel(e), value: e.rental_avg })),
    priceIndexHistory: historyEntries.map((e) => ({ label: quarterLabel(e), value: indexFor(e) })),
  };
}

/** Lightweight snapshot for the admin's own entry-management list (just an
 * invest-score badge per city) — doesn't need the full period machinery. */
export function computeLatestSnapshot(entriesForCity: MarketDataEntry[]): { investScore: number } | null {
  if (entriesForCity.length === 0) return null;
  const sorted = sortByQuarter(entriesForCity);
  const latest = sorted[sorted.length - 1];
  const yearAgo = sorted.find((e) => e.year === latest.year - 1 && e.quarter === latest.quarter);
  const priceYoY = pctChange(latest.avg_rate, yearAgo?.avg_rate) ?? 0;
  const investScoreRaw = 40 + priceYoY * 0.6 + (latest.demand_index - latest.supply_index) * 0.3 + latest.rental_avg * 5;
  return { investScore: Math.max(0, Math.min(100, Math.round(investScoreRaw))) };
}

export function availableQuarters(entriesForCity: MarketDataEntry[]): { year: number; quarter: number }[] {
  const map = new Map<string, { year: number; quarter: number }>();
  entriesForCity.forEach((e) => map.set(`${e.year}-${e.quarter}`, { year: e.year, quarter: e.quarter }));
  return Array.from(map.values()).sort((a, b) => quarterKey(b) - quarterKey(a));
}

export function availableHalves(entriesForCity: MarketDataEntry[]): { year: number; half: 1 | 2 }[] {
  const map = new Map<string, { year: number; half: 1 | 2 }>();
  entriesForCity.forEach((e) => {
    const half: 1 | 2 = e.quarter <= 2 ? 1 : 2;
    map.set(`${e.year}-${half}`, { year: e.year, half });
  });
  return Array.from(map.values()).sort((a, b) => (b.year * 2 + b.half) - (a.year * 2 + a.half));
}

export function availableYears(entriesForCity: MarketDataEntry[]): number[] {
  return Array.from(new Set(entriesForCity.map((e) => e.year))).sort((a, b) => b - a);
}
