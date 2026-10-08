// Public marketing homepage — content is fully admin-editable (platform
// operator only) and readable pre-login, since the page itself is
// logged-out. Nothing about this page's copy/branding is hardcoded in
// the frontend; every field below comes from the database.

export interface PlatformMarketingSettings {
  id: string;
  logo_url: string | null;
  /** Product brand shown in the header, next to the logo — e.g. "RealTrainer". Separate from footer_company_name, which is the operator's actual registered business name. */
  brand_name: string;
  brand_tagline: string | null;
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
  /** The Founder section — see FounderContent below. Raw jsonb; read it through normalizeFounder(). */
  founder: unknown;
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

// ── Founder section (public homepage) ────────────────────────────────────
// Stored as ONE jsonb document on the settings row, so every word, number, colour and the photo are
// editable from Admin → Marketing Website → Founder; nothing about the founder is hardcoded in the page.

export interface FounderContent {
  enabled: boolean;
  eyebrow: string;
  name: string;
  /** The personal-brand line under the name, e.g. "Real Estate Business & Learning Expert". */
  headline: string;
  /** Current role / organisation line. */
  role_line: string;
  tagline: string;
  photo_url: string | null;
  /** Plain text; a blank line starts a new paragraph. */
  bio: string;
  stats: { value: string; label: string }[];
  expertise: string[];
  industries: string[];
  books: { title: string; blurb: string }[];
  journey: { period: string; role: string; org: string; note: string }[];
  why_eyebrow: string;
  why_title: string;
  why_intro: string;
  gaps: { icon: string; title: string; text: string }[];
  compare_left_label: string;
  compare_left_value: string;
  compare_left_note: string;
  compare_right_label: string;
  compare_right_value: string;
  compare_right_note: string;
  mission_quote: string;
  cta_title: string;
  cta_text: string;
  cta_label: string;
  bg_from: string;
  bg_to: string;
  accent: string;
}

/** Structure only (no copy): what an unconfigured / partially configured row falls back to. */
export const EMPTY_FOUNDER: FounderContent = {
  enabled: false, eyebrow: "", name: "", headline: "", role_line: "", tagline: "", photo_url: null, bio: "",
  stats: [], expertise: [], industries: [], books: [], journey: [],
  why_eyebrow: "", why_title: "", why_intro: "", gaps: [],
  compare_left_label: "", compare_left_value: "", compare_left_note: "",
  compare_right_label: "", compare_right_value: "", compare_right_note: "",
  mission_quote: "", cta_title: "", cta_text: "", cta_label: "",
  bg_from: "#0B1B3A", bg_to: "#12274D", accent: "#D4A93A",
};

export function normalizeFounder(raw: unknown): FounderContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...EMPTY_FOUNDER };
  for (const k of Object.keys(EMPTY_FOUNDER) as (keyof FounderContent)[]) {
    const def = EMPTY_FOUNDER[k];
    const v = r[k];
    if (Array.isArray(def)) out[k] = Array.isArray(v) ? v : def;
    else if (typeof def === "boolean") out[k] = typeof v === "boolean" ? v : def;
    else if (k === "photo_url") out[k] = typeof v === "string" && v ? v : null;
    else out[k] = typeof v === "string" ? v : def;
  }
  return out as unknown as FounderContent;
}
