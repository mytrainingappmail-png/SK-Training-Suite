import { supabase } from "../../lib/supabase";
import type { BrainstormingItem, BrainstormingItemForm } from "../../types/brainstorming";

export async function getItems(): Promise<BrainstormingItem[]> {
  const { data, error } = await supabase
    .from("brainstorming_items")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createItem(form: BrainstormingItemForm): Promise<BrainstormingItem> {
  const { data, error } = await supabase.from("brainstorming_items").insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateItem(id: string, form: Partial<BrainstormingItemForm>): Promise<BrainstormingItem> {
  const { data, error } = await supabase.from("brainstorming_items").update(form).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("brainstorming_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
