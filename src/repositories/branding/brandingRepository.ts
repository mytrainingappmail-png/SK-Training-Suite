import { supabase } from "../../lib/supabase";

export interface PublicBrandingRow {
  company_name: string;
  logo: string;
  login_logo_url: string;
  app_icon_url: string;
  favicon: string;
}

// Works with no session (anon) — get_public_branding() is a SECURITY DEFINER
// function that only ever returns non-sensitive branding fields, safe to
// call pre-login. Pass the company code as the user types it on the login
// page so the RIGHT company's branding shows — without it, this resolves
// to whichever company was created first (a sensible default before the
// user has typed anything yet).
export async function getPublicBranding(companyCode?: string): Promise<PublicBrandingRow | null> {
  const { data, error } = await supabase.rpc("get_public_branding", { p_company_code: companyCode?.trim() || null });

  if (error) {
    console.error("[brandingRepository] getPublicBranding:", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
