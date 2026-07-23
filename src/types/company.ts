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

  created_at: string;

  updated_at: string;
}

export type CompanyForm = Omit<
  Company,
  "id" | "created_at" | "updated_at"
>;