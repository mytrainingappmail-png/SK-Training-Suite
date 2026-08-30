export interface Micromarket {
  name: string;
  rate: number;
  demand: string;
}

export interface MarketDataEntry {
  id: string;
  company_id: string;
  city_name: string;
  state_name: string;
  year: number;
  quarter: number;
  segment: string;
  trend: string;
  avg_rate: number;
  rental_avg: number;
  demand_index: number;
  supply_index: number;
  // 0 means "not set" — the dashboard computes a default (base 100 at the
  // city's earliest entry). A non-zero value overrides the computed default.
  price_index: number;
  bhk_demand: Record<string, number>;
  price_segment: Record<string, number>;
  micromarkets: Micromarket[];
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export type MarketDataEntryForm = Pick<
  MarketDataEntry,
  "city_name" | "state_name" | "year" | "quarter" | "segment" | "trend" |
  "avg_rate" | "rental_avg" | "demand_index" | "supply_index" | "price_index" |
  "bhk_demand" | "price_segment" | "micromarkets"
>;

export type MarketPeriodType = "quarterly" | "half_yearly" | "yearly" | "custom";

/** What the dashboard's period filter is currently set to. Only the fields
 * relevant to `type` are read — e.g. `half` is ignored unless type is
 * "half_yearly". Always resolved against real entries that exist for the
 * selected city (see availableQuarters/availableHalves/availableYears in
 * marketDataService.ts) — never a hardcoded list of periods. */
export interface MarketPeriodSelector {
  type: MarketPeriodType;
  year?: number;
  quarter?: number; // 1-4, quarterly only
  half?: 1 | 2; // half_yearly only
  fromYear?: number; // custom only
  fromQuarter?: number; // custom only
  toYear?: number; // custom only
  toQuarter?: number; // custom only
}

/** Computed, never stored — every number here is derived live from the
 * admin's raw quarterly entries that fall inside the selected period.
 * Quarterly/half-yearly periods get two comparisons (vs the immediately
 * preceding period of the same length, and vs the same period a year ago);
 * yearly/custom periods only get the "previous period" comparison, since a
 * second "year ago" axis isn't well-defined for those. */
export interface MarketMetrics {
  periodLabel: string;
  comparisonLabel: string;
  comparisonLabelYoY: string | null;
  /** The most recent entry inside the selected period — source for
   * non-averaged display fields (segment, trend, micromarkets, bhk_demand,
   * price_segment). */
  latest: MarketDataEntry;
  avgRate: number;
  rentalAvg: number;
  demandIndex: number;
  supplyIndex: number;
  priceIndex: number;
  priceChange: number | null;
  priceChangeYoY: number | null;
  rentalChange: number | null;
  rentalChangeYoY: number | null;
  demandChange: number | null;
  supplyChange: number | null;
  priceIndexChange: number | null;
  priceIndexChangeYoY: number | null;
  investScore: number;
  rateHistory: { label: string; value: number }[];
  demandHistory: { label: string; value: number }[];
  supplyHistory: { label: string; value: number }[];
  rentalHistory: { label: string; value: number }[];
  priceIndexHistory: { label: string; value: number }[];
}
