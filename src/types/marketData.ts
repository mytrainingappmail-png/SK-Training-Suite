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

/** Computed, never stored — derived from comparing one quarter's entry
 * against the prior quarter (QoQ) and the same quarter a year earlier (YoY). */
export interface MarketMetrics {
  latest: MarketDataEntry;
  priceQoQ: number | null;
  priceYoY: number | null;
  demandQoQ: number | null;
  supplyQoQ: number | null;
  rentalQoQ: number | null;
  rentalYoY: number | null;
  investScore: number;
  priceIndex: number;
  priceIndexQoQ: number | null;
  priceIndexYoY: number | null;
  rateHistory: { label: string; value: number }[];
  demandHistory: { label: string; value: number }[];
  supplyHistory: { label: string; value: number }[];
  rentalHistory: { label: string; value: number }[];
  priceIndexHistory: { label: string; value: number }[];
}
