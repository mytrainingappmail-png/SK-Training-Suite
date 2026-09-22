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
  /** Design controls — a hex color and an alignment/toggle the platform operator sets themselves, no code change needed. */
  accent_from: string;
  accent_to: string;
  hero_bg_from: string;
  hero_bg_to: string;
  hero_align: "left" | "center";
  about_bg_from: string;
  about_bg_to: string;
  about_text_light: boolean;
  /** 50-300, a percentage relative to the default header logo size. */
  logo_scale: number;
  /** Optional cover photo behind the hero text (a color overlay from hero_bg_from/to keeps text legible). */
  hero_image_url: string | null;
  /** Optional portrait shown above the About Us title — e.g. the founder's own photo. */
  about_photo_url: string | null;
  about_photo_frame: "circle" | "square" | "rounded_square" | "hexagon" | "oval" | "polaroid";
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

export interface PlatformMarketingTestimonial {
  id: string;
  name: string;
  role_or_company: string | null;
  quote: string;
  photo_url: string | null;
  rating: number;
  display_order: number;
  created_at: string;
}

export type PlatformMarketingTestimonialForm = Omit<PlatformMarketingTestimonial, "id" | "created_at">;

export const defaultPlatformMarketingTestimonialForm: PlatformMarketingTestimonialForm = {
  name: "",
  role_or_company: null,
  quote: "",
  photo_url: null,
  rating: 5,
  display_order: 0,
};

export interface PlatformMarketingUpdate {
  id: string;
  title: string;
  description: string;
  display_order: number;
  created_at: string;
}

export type PlatformMarketingUpdateForm = Omit<PlatformMarketingUpdate, "id" | "created_at">;

export const defaultPlatformMarketingUpdateForm: PlatformMarketingUpdateForm = {
  title: "",
  description: "",
  display_order: 0,
};

export interface PlatformMarketingIndustryNews {
  id: string;
  title: string;
  description: string;
  source_name: string | null;
  source_url: string | null;
  display_order: number;
  created_at: string;
}

export type PlatformMarketingIndustryNewsForm = Omit<PlatformMarketingIndustryNews, "id" | "created_at">;

export const defaultPlatformMarketingIndustryNewsForm: PlatformMarketingIndustryNewsForm = {
  title: "",
  description: "",
  source_name: null,
  source_url: null,
  display_order: 0,
};

/** Public-safe subset of subscription_plans, via get_public_subscription_plans(). */
export interface PublicSubscriptionPlan {
  id: string;
  plan_name: string;
  plan_code: string;
  description: string;
  max_employees: number;
  max_courses: number;
  max_storage_gb: number;
  max_certificates_per_month: number;
  price_monthly: number;
  price_yearly: number;
  yearly_discount_pct: number;
  price_six_month: number | null;
  six_month_discount_pct: number | null;
  features: string;
}

/** One included feature (a module the plan turns on), with its explanation — via get_public_plan_features(). */
export interface PublicPlanFeature {
  plan_id: string;
  module_key: string;
  label: string;
  description: string;
  is_addon: boolean;
  display_order: number;
}

export type InquirySource = "trial" | "query";
export type InquiryStatus = "new" | "contacted" | "converted" | "dismissed";

export interface PlatformMarketingInquiry {
  id: string;
  source: InquirySource;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: InquiryStatus;
  created_at: string;
}

export interface PlatformMarketingInquiryForm {
  source: InquirySource;
  name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  message?: string;
}
