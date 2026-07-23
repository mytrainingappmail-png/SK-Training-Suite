import { supabase } from "../../lib/supabase";

export interface PublicBrandingRow {
  company_name: string;
  logo: string;
  login_logo_url: string;
  app_icon_url: string;
}

// Works with no session (anon) — get_public_branding() is a SECURITY DEFINER
// function that only ever returns non-sensitive branding fields, safe to
// call pre-login.
export async function getPublicBranding(): Promise<PublicBrandingRow | null> {
  const { data, error } = await supabase.rpc("get_public_branding");

  if (error) {
    console.error("[brandingRepository] getPublicBranding:", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
