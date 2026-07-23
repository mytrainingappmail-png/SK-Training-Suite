// Resolves the company name + logo shown on the login page, sidebar and
// header. Order of precedence:
//   1. VITE_BRAND_OVERRIDE_* env vars — set only on a specific deployment
//      (e.g. a sales-demo site sharing the same database as production) so
//      that one deployment can show different branding without touching the
//      shared companies row everyone else reads.
//   2. The real companies.company_name / companies.logo from the database
//      (via get_public_branding()) — this is what makes rebranding an
//      admin-panel edit (Company Management) instead of a code change.
//   3. The static BRAND config / bundled logo asset, if the database call
//      fails for any reason (offline, RPC missing, etc.) — the app must
//      never show a blank name/logo.

import { getPublicBranding } from "../../repositories/branding/brandingRepository";
import { BRAND } from "../../config/branding";

export interface ResolvedBranding {
  companyName: string;
  // Empty string means "use the bundled static logo asset".
  logoUrl: string;
}

let cached: ResolvedBranding | null = null;

export async function loadBranding(): Promise<ResolvedBranding> {
  if (cached) return cached;

  const overrideName = import.meta.env.VITE_BRAND_OVERRIDE_NAME as string | undefined;
  const overrideLogo = import.meta.env.VITE_BRAND_OVERRIDE_LOGO_URL as string | undefined;

  if (overrideName || overrideLogo) {
    cached = {
      companyName: overrideName?.trim() || BRAND.companyName,
      logoUrl: overrideLogo?.trim() || "",
    };
    return cached;
  }

  const row = await getPublicBranding();
  cached = {
    companyName: row?.company_name?.trim() || BRAND.companyName,
    logoUrl: row?.logo?.trim() || "",
  };
  return cached;
}
