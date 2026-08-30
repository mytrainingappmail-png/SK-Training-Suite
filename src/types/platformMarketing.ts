// Public marketing homepage — content is fully admin-editable (platform
// operator only) and readable pre-login, since the page itself is
// logged-out. Nothing about this page's copy/branding is hardcoded in
// the frontend; every field below comes from the database.

export interface PlatformMarketingSettings {
  id: string;
  logo_url: string | null;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_label: string;
  about_title: string;
  about_content_html: string;
  footer_company_name: string | null;
  footer_tagline: string | null;
  footer_copyright_text: string | null;
  whatsapp_number: string | null;
  whatsapp_default_message: string;
  contact_email: string | null;
  contact_phone: string | null;
  updated_at: string;
}

export type PlatformMarketingSettingsForm = Omit<PlatformMarketingSettings, "id" | "updated_at">;

export interface PlatformMarketingFeature {
  id: string;
  icon: string;
  title: string;
  description: string;
  display_order: number;
  created_at: string;
}

export type PlatformMarketingFeatureForm = Omit<PlatformMarketingFeature, "id" | "created_at">;

export const defaultPlatformMarketingFeatureForm: PlatformMarketingFeatureForm = {
  icon: "✨",
  title: "",
  description: "",
  display_order: 0,
};
