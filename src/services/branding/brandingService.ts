// Resolves the company name + logo + login image + app icon shown across
// the app. Order of precedence:
//   1. VITE_BRAND_OVERRIDE_* env vars — set only on a specific deployment
//      that shares another company's database (e.g. a sales demo) so it can
//      show different branding without touching the real company row.
//   2. The real companies.* columns from the database (via
//      get_public_branding()) — genuinely admin-uploadable from Company
//      Management, no code change or redeploy ever needed for a real,
//      single-tenant deployment.
//   3. The static BRAND config / bundled assets, if the database has
//      nothing set yet, or the call fails for any reason (offline, etc.) —
//      the app must never show a blank name/logo/icon.

import { getPublicBranding } from "../../repositories/branding/brandingRepository";
import { getActiveTheme } from "../../repositories/theme/themeRuntimeRepository";
import { BRAND } from "../../config/branding";

export interface ResolvedBranding {
  companyName: string;
  // Empty string means "use the bundled static logo asset". Used by the
  // sidebar/header, where the logo sits in a small white box.
  logoUrl: string;
  // Login-page hero logo — usually the same image as logoUrl, but can be a
  // transparent-background variant so it blends into the dark hero panel
  // instead of sitting in a white box.
  loginLogoUrl: string;
  // Browser tab / PWA install-prompt / home-screen icon.
  appIconUrl: string;
  // Browser tab favicon specifically — falls back to appIconUrl when unset,
  // so companies that only upload one icon still get a tab icon.
  faviconUrl: string;
  // From the active row in Theme Management (Admin → Theme) — falls back
  // to the static BRAND colors when no theme is marked active.
  primaryColor: string;
  secondaryColor: string;
  sidebarColor: string;
}

export const BRANDING_CHANGED_EVENT = "sk:branding-changed";

// Cached only for the no-company-code case (post-login, sidebar/header/
// app icon — always the CURRENT session's own company, safe to cache).
// A companyCode-specific lookup (login page, before the session exists)
// always fetches fresh — it's called rarely (as the user types) and must
// never show a stale OTHER company's branding from an earlier cache.
let cached: ResolvedBranding | null = null;

// Called after Company Management saves a new logo/image so every already-
// mounted component (sidebar, header) re-fetches instead of showing a stale
// in-memory value until the next full page reload.
export function invalidateBrandingCache(): void {
  cached = null;
  window.dispatchEvent(new CustomEvent(BRANDING_CHANGED_EVENT));
}

export async function loadBranding(companyCode?: string): Promise<ResolvedBranding> {
  if (!companyCode && cached) return cached;

  const overrideName = import.meta.env.VITE_BRAND_OVERRIDE_NAME as string | undefined;
  const overrideLogo = import.meta.env.VITE_BRAND_OVERRIDE_LOGO_URL as string | undefined;
  const overrideLoginLogo = import.meta.env.VITE_BRAND_OVERRIDE_LOGIN_LOGO_URL as string | undefined;
  const overrideIcon = (import.meta.env.VITE_BRAND_OVERRIDE_ICON_512_URL || import.meta.env.VITE_BRAND_OVERRIDE_ICON_192_URL) as string | undefined;

  const [row, theme] = await Promise.all([getPublicBranding(companyCode), getActiveTheme()]);
  const dbLogo = row?.logo?.trim() || "";
  const dbLoginLogo = row?.login_logo_url?.trim() || "";
  const dbIcon = row?.app_icon_url?.trim() || "";
  const dbFavicon = row?.favicon?.trim() || "";

  const logoUrl = overrideLogo?.trim() || dbLogo;
  const appIconUrl = overrideIcon?.trim() || dbIcon;
  const resolved: ResolvedBranding = {
    companyName: overrideName?.trim() || row?.company_name?.trim() || BRAND.companyName,
    logoUrl,
    loginLogoUrl: overrideLoginLogo?.trim() || dbLoginLogo || logoUrl,
    appIconUrl,
    faviconUrl: dbFavicon || appIconUrl,
    primaryColor: theme?.primary_color?.trim() || BRAND.primaryColor,
    secondaryColor: theme?.secondary_color?.trim() || BRAND.secondaryColor,
    sidebarColor: theme?.sidebar_color?.trim() || BRAND.primaryColor,
  };

  if (!companyCode) cached = resolved;
  return resolved;
}

// Applies a custom app icon + name at runtime — the browser tab favicon
// and the Apple touch icon update immediately and reliably (plain DOM link
// swaps). The PWA "Install app" prompt (icon AND name) is best-effort:
// browsers read manifest.webmanifest as a real file, so this patches the
// <link rel="manifest"> to point at a regenerated copy carrying the real,
// DB-sourced company name and icon — otherwise the install prompt is stuck
// showing whatever was baked in at build time (the static "SK Training
// Suite" default, unless a VITE_BRAND_OVERRIDE_* env var was set for that
// specific deployment). Some browsers may still show the old value in the
// install prompt until their own manifest cache expires — everything else
// (favicon, in-app logo, login page) updates immediately regardless.
export async function applyDynamicIcon(iconUrl: string, faviconUrl?: string, companyName?: string): Promise<void> {
  const tabIconUrl = faviconUrl || iconUrl;

  if (tabIconUrl) {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = tabIconUrl;

    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleIcon) appleIcon.href = tabIconUrl;
  }

  if (!iconUrl && !companyName) return;

  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifestLink) return;

  try {
    const res = await fetch(manifestLink.href);
    const manifest = await res.json();
    if (iconUrl) {
      manifest.icons = (manifest.icons ?? []).map((icon: { sizes?: string; purpose?: string }) => ({
        ...icon,
        src: iconUrl,
      }));
    }
    if (companyName) {
      manifest.name = companyName;
      manifest.short_name = companyName;
    }
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    manifestLink.href = URL.createObjectURL(blob);
  } catch {
    // Non-fatal — the install prompt just keeps the default icon/name.
  }
}
