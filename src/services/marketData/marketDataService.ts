import * as repo from "../../repositories/marketData/marketDataRepository";
import type { MarketDataEntry, MarketDataEntryForm, MarketMetrics } from "../../types/marketData";

export async function loadEntries(companyId: string): Promise<MarketDataEntry[]> {
  return repo.getAllEntries(companyId);
}

export async function saveEntry(companyId: string, createdBy: string | null, createdByName: string, form: MarketDataEntryForm): Promise<MarketDataEntry> {
  return repo.upsertEntry(companyId, createdBy, createdByName, form);
}

export async function deleteEntry(id: string): Promise<void> {
  return repo.deleteEntry(id);
}

function sortKey(e: { year: number; quarter: number }): number {
  return e.year * 4 + e.quarter;
}

function pctChange(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Every QoQ/YoY percentage and the invest score are computed here from the
 * admin's raw quarterly entries — never typed in directly. investScore is
 * a transparent weighted blend (not a rigorous financial model): recent
 * price growth, demand-vs-supply balance, and rental yield.
 */
export function computeMetricsForCity(entriesForCity: MarketDataEntry[]): MarketMetrics | null {
  if (entriesForCity.length === 0) return null;

  const sorted = [...entriesForCity].sort((a, b) => sortKey(a) - sortKey(b));
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : undefined;
  const yearAgo = sorted.find((e) => e.year === latest.year - 1 && e.quarter === latest.quarter);

  const priceQoQ = pctChange(latest.avg_rate, previous?.avg_rate);
  const priceYoY = pctChange(latest.avg_rate, yearAgo?.avg_rate);
  const demandQoQ = pctChange(latest.demand_index, previous?.demand_index);
  const supplyQoQ = pctChange(latest.supply_index, previous?.supply_index);
  const rentalQoQ = pctChange(latest.rental_avg, previous?.rental_avg);
  const rentalYoY = pctChange(latest.rental_avg, yearAgo?.rental_avg);

  const investScoreRaw =
    40 +
    (priceYoY ?? 0) * 0.6 +
    (latest.demand_index - latest.supply_index) * 0.3 +
    latest.rental_avg * 5;
  const investScore = Math.max(0, Math.min(100, Math.round(investScoreRaw)));

  const label = (e: MarketDataEntry) => `Q${e.quarter} ${e.year}`;

  // Property Price Index (base 100 at the city's earliest entry) —
  // computed automatically from avg_rate unless the admin entered an
  // explicit override for that quarter (price_index !== 0).
  const baseRate = sorted[0].avg_rate || 1;
  const indexFor = (e: MarketDataEntry) => (e.price_index !== 0 ? e.price_index : Math.round((e.avg_rate / baseRate) * 1000) / 10);
  const priceIndexHistory = sorted.map((e) => ({ label: label(e), value: indexFor(e) }));
  const priceIndex = indexFor(latest);
  const priceIndexQoQ = pctChange(priceIndex, previous ? indexFor(previous) : undefined);
  const priceIndexYoY = pctChange(priceIndex, yearAgo ? indexFor(yearAgo) : undefined);

  return {
    latest,
    priceQoQ,
    priceYoY,
    demandQoQ,
    supplyQoQ,
    rentalQoQ,
    rentalYoY,
    investScore,
    priceIndex,
    priceIndexQoQ,
    priceIndexYoY,
    rateHistory: sorted.map((e) => ({ label: label(e), value: e.avg_rate })),
    demandHistory: sorted.map((e) => ({ label: label(e), value: e.demand_index })),
    supplyHistory: sorted.map((e) => ({ label: label(e), value: e.supply_index })),
    rentalHistory: sorted.map((e) => ({ label: label(e), value: e.rental_avg })),
    priceIndexHistory,
  };
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
