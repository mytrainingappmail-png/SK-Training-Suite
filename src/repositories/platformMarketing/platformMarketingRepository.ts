import { supabase } from "../../lib/supabase";
import type {
  PlatformMarketingSettings,
  PlatformMarketingSettingsForm,
  PlatformMarketingFeature,
  PlatformMarketingFeatureForm,
} from "../../types/platformMarketing";

// Singleton settings row — a migration seeds exactly one, so this always
// resolves. select() + limit(1) (not .single()) so a genuinely missing row
// degrades to null instead of throwing.
export async function getMarketingSettings(): Promise<PlatformMarketingSettings | null> {
  const { data, error } = await supabase
    .from("platform_marketing_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[platformMarketingRepository] getMarketingSettings:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateMarketingSettings(id: string, patch: Partial<PlatformMarketingSettingsForm>): Promise<PlatformMarketingSettings> {
  const { data, error } = await supabase
    .from("platform_marketing_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[platformMarketingRepository] updateMarketingSettings:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function getMarketingFeatures(): Promise<PlatformMarketingFeature[]> {
  const { data, error } = await supabase
    .from("platform_marketing_features")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[platformMarketingRepository] getMarketingFeatures:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function createMarketingFeature(form: PlatformMarketingFeatureForm): Promise<PlatformMarketingFeature> {
  const { data, error } = await supabase
    .from("platform_marketing_features")
    .insert(form)
    .select()
    .single();

  if (error) {
    console.error("[platformMarketingRepository] createMarketingFeature:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateMarketingFeature(id: string, patch: Partial<PlatformMarketingFeatureForm>): Promise<PlatformMarketingFeature> {
  const { data, error } = await supabase
    .from("platform_marketing_features")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[platformMarketingRepository] updateMarketingFeature:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function deleteMarketingFeature(id: string): Promise<void> {
  const { error } = await supabase.from("platform_marketing_features").delete().eq("id", id);
  if (error) {
    console.error("[platformMarketingRepository] deleteMarketingFeature:", error);
    throw new Error(error.message);
  }
}

/** Pre-auth check for the /:companyCode branded login link — resolves
 * only whether that company exists and is active, nothing else. */
export async function checkCompanyCodeExists(companyCode: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("company_exists_and_active", { p_company_code: companyCode });
  if (error) {
    console.error("[platformMarketingRepository] checkCompanyCodeExists:", error);
    return false;
  }
  return data === true;
}
