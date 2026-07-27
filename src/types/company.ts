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

  created_at: string;

  updated_at: string;
}

export type CompanyForm = Omit<
  Company,
  "id" | "created_at" | "updated_at"
>;