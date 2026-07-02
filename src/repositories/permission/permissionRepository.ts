import { supabase } from "../../lib/supabase";

export async function getPermissions() {
  const { data, error } = await supabase
    .from("permissions")
    .select("*")
    .order("module_name");

  if (error) throw error;

  return data ?? [];
}