import { supabase } from "../../lib/supabase";
import type { MarketDataEntry, MarketDataEntryForm } from "../../types/marketData";

export async function getAllEntries(companyId: string): Promise<MarketDataEntry[]> {
  const { data, error } = await supabase
    .from("market_data_entries")
    .select("*")
    .eq("company_id", companyId)
    .order("city_name", { ascending: true })
    .order("year", { ascending: true })
    .order("quarter", { ascending: true });

  if (error) {
    console.error("[marketDataRepository] getAllEntries:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function upsertEntry(
  companyId: string,
  createdBy: string | null,
  createdByName: string,
  form: MarketDataEntryForm
): Promise<MarketDataEntry> {
  const { data, error } = await supabase
    .from("market_data_entries")
    .upsert(
      { ...form, company_id: companyId, created_by: createdBy, created_by_name: createdByName, updated_at: new Date().toISOString() },
      { onConflict: "company_id,city_name,year,quarter" }
    )
    .select()
    .single();

  if (error) {
    console.error("[marketDataRepository] upsertEntry:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from("market_data_entries").delete().eq("id", id);

  if (error) {
    console.error("[marketDataRepository] deleteEntry:", error);
    throw new Error(error.message);
  }
}
