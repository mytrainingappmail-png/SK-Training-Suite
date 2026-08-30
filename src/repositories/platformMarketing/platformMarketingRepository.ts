import { supabase } from "../../lib/supabase";
import type {
  PlatformMarketingSettings,
  PlatformMarketingSettingsForm,
  PlatformMarketingFeature,
  PlatformMarketingFeatureForm,
  PlatformMarketingTestimonial,
  PlatformMarketingTestimonialForm,
  PublicSubscriptionPlan,
  PlatformMarketingInquiry,
  PlatformMarketingInquiryForm,
} from "../../types/platformMarketing";

// Singleton settings row — a migration seeds exactly one, so this always
// resolves. select() + limit(1) (not .single()) so a genuinely missing row
// degrades to null instead of throwing.
export async function getMarketingSettings(): Promise<PlatformMarketingSettings | null> {
  const { data, error } = await supabase
    .from("platform_marketing_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[platformMarketingRepository] getMarketingSettings:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateMarketingSettings(id: string, patch: Partial<PlatformMarketingSettingsForm>): Promise<PlatformMarketingSettings> {
  const { data, error } = await supabase
    .from("platform_marketing_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[platformMarketingRepository] updateMarketingSettings:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function getMarketingFeatures(): Promise<PlatformMarketingFeature[]> {
  const { data, error } = await supabase
    .from("platform_marketing_features")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[platformMarketingRepository] getMarketingFeatures:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function createMarketingFeature(form: PlatformMarketingFeatureForm): Promise<PlatformMarketingFeature> {
  const { data, error } = await supabase
    .from("platform_marketing_features")
    .insert(form)
    .select()
    .single();

  if (error) {
    console.error("[platformMarketingRepository] createMarketingFeature:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateMarketingFeature(id: string, patch: Partial<PlatformMarketingFeatureForm>): Promise<PlatformMarketingFeature> {
  const { data, error } = await supabase
    .from("platform_marketing_features")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[platformMarketingRepository] updateMarketingFeature:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function deleteMarketingFeature(id: string): Promise<void> {
  const { error } = await supabase.from("platform_marketing_features").delete().eq("id", id);
  if (error) {
    console.error("[platformMarketingRepository] deleteMarketingFeature:", error);
    throw new Error(error.message);
  }
}

/** Pre-auth check for the /:companyCode branded login link — resolves
 * only whether that company exists and is active, nothing else. */
export async function checkCompanyCodeExists(companyCode: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("company_exists_and_active", { p_company_code: companyCode });
  if (error) {
    console.error("[platformMarketingRepository] checkCompanyCodeExists:", error);
    return false;
  }
  return data === true;
}

export async function getMarketingTestimonials(): Promise<PlatformMarketingTestimonial[]> {
  const { data, error } = await supabase
    .from("platform_marketing_testimonials")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[platformMarketingRepository] getMarketingTestimonials:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function createMarketingTestimonial(form: PlatformMarketingTestimonialForm): Promise<PlatformMarketingTestimonial> {
  const { data, error } = await supabase
    .from("platform_marketing_testimonials")
    .insert(form)
    .select()
    .single();

  if (error) {
    console.error("[platformMarketingRepository] createMarketingTestimonial:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateMarketingTestimonial(id: string, patch: Partial<PlatformMarketingTestimonialForm>): Promise<PlatformMarketingTestimonial> {
  const { data, error } = await supabase
    .from("platform_marketing_testimonials")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[platformMarketingRepository] updateMarketingTestimonial:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function deleteMarketingTestimonial(id: string): Promise<void> {
  const { error } = await supabase.from("platform_marketing_testimonials").delete().eq("id", id);
  if (error) {
    console.error("[platformMarketingRepository] deleteMarketingTestimonial:", error);
    throw new Error(error.message);
  }
}

/** Public, pre-auth pricing data — active plans only, safe fields only. */
export async function getPublicSubscriptionPlans(): Promise<PublicSubscriptionPlan[]> {
  const { data, error } = await supabase.rpc("get_public_subscription_plans");
  if (error) {
    console.error("[platformMarketingRepository] getPublicSubscriptionPlans:", error);
    return [];
  }
  return (data as PublicSubscriptionPlan[] | null) ?? [];
}

/** Public, pre-auth — anyone can submit; RLS forbids reading any inquiry
 * back (including the one just created), so this never returns the row. */
export async function submitMarketingInquiry(form: PlatformMarketingInquiryForm): Promise<void> {
  const { error } = await supabase.from("platform_marketing_inquiries").insert(form);
  if (error) {
    console.error("[platformMarketingRepository] submitMarketingInquiry:", error);
    throw new Error(error.message);
  }
}

/** Operator-only — listing/managing submitted inquiries. */
export async function getMarketingInquiries(): Promise<PlatformMarketingInquiry[]> {
  const { data, error } = await supabase
    .from("platform_marketing_inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[platformMarketingRepository] getMarketingInquiries:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function updateMarketingInquiryStatus(id: string, status: PlatformMarketingInquiry["status"]): Promise<PlatformMarketingInquiry> {
  const { data, error } = await supabase
    .from("platform_marketing_inquiries")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[platformMarketingRepository] updateMarketingInquiryStatus:", error);
    throw new Error(error.message);
  }
  return data;
}
