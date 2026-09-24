export interface Company {
  id: string;

  company_code: string;

  company_name: string;

  short_name: string;

  legal_name: string;

  website: string;

  email: string;

  phone: string;

  logo: string;

  // Login-page hero image (dark panel) — falls back to logo, then the
  // bundled static asset, when empty.
  login_logo_url: string;

  // Browser tab / PWA install-prompt / home-screen icon — falls back to
  // the bundled static icon when empty.
  app_icon_url: string;

  favicon: string;

  address: string;

  city: string;

  state: string;

  country: string;

  pincode: string;

  gst_number: string;

  pan_number: string;

  timezone: string;

  currency: string;

  language: string;

  theme: string;

  active: boolean;

  is_platform_operator: boolean;

  // Optional, paid add-on — only the platform operator can toggle this
  // (see companies_update_platform_operator RLS policy).
  market_analytics_enabled: boolean;

  // Optional, paid add-on — the Live Quiz module (its own isolated
  // schema/auth, opens in a new tab). Same platform-operator-only toggle
  // pattern as market_analytics_enabled.
  live_quiz_enabled: boolean;

  // Free-text attribution shown in the Market Analytics dashboard footer
  // (e.g. "Data compiled from RERA filings and internal broker network").
  // White-label — fully editable by the tenant's own admin (unlike
  // market_analytics_enabled above, which only the platform operator can
  // flip), null/blank shows no footer at all.
  market_analytics_source_note: string | null;

  // How many cards show per page in the Courses/Modules/Lessons grids
  // before a "Next" button appears.
  cards_per_page: number;

  // Per-company Super Admin Console appearance -- each subscribing
  // company picks its own card background/button/border colors instead
  // of one fixed look for everyone.
  admin_console_bg_color: string;

  admin_console_button_color: string;

  admin_console_border_color: string;

  // Where the company name sits under the sidebar logo — left-aligned or
  // centered. The name itself always auto-shrinks to stay on one line
  // regardless of how long it is (see Sidebar.tsx's FitText).
  sidebar_name_position: "left" | "center";

  // Admin-controlled display order for the employee-facing sidebar —
  // an ordered array of MenuItem ids (see src/config/menu.ts). null/empty
  // means "use the built-in order" (Sidebar.tsx's fallback).
  sidebar_menu_order: string[] | null;

  // Real Estate Project brochures: a PDF upload sits in storage forever, counting against the
  // plan's quota; a Google Drive (or any) link costs nothing. Off by default — a company
  // starts link-only, and turns uploads back on deliberately if it wants them.
  brochure_pdf_upload_enabled: boolean;

  // Content-protection defaults (operator-only) — what NEW Induction pages/Project
  // sections/Courses start with, and what "Apply to all" stamps onto existing ones.
  default_watermark_enabled: boolean;
  default_watermark_text: string | null;
  default_watermark_orientation: 'horizontal' | 'vertical' | 'diagonal';
  default_watermark_opacity: number;
  default_no_copy: boolean;

  created_at: string;

  updated_at: string;
}

export type CompanyForm = Omit<
  Company,
  "id" | "created_at" | "updated_at"
>;