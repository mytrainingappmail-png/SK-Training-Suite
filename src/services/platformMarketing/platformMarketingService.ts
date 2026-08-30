import * as repo from "../../repositories/platformMarketing/platformMarketingRepository";
import type {
  PlatformMarketingSettingsForm,
  PlatformMarketingFeatureForm,
  PlatformMarketingTestimonialForm,
  PlatformMarketingInquiryForm,
  PlatformMarketingInquiry,
} from "../../types/platformMarketing";

export async function loadMarketingSettings() {
  return repo.getMarketingSettings();
}

export async function saveMarketingSettings(id: string, patch: Partial<PlatformMarketingSettingsForm>) {
  return repo.updateMarketingSettings(id, patch);
}

export async function loadMarketingFeatures() {
  return repo.getMarketingFeatures();
}

export async function addMarketingFeature(form: PlatformMarketingFeatureForm) {
  if (!form.title.trim()) throw new Error("Feature title is required.");
  return repo.createMarketingFeature(form);
}

export async function editMarketingFeature(id: string, patch: Partial<PlatformMarketingFeatureForm>) {
  return repo.updateMarketingFeature(id, patch);
}

export async function removeMarketingFeature(id: string) {
  return repo.deleteMarketingFeature(id);
}

export async function checkCompanyCodeExists(companyCode: string) {
  return repo.checkCompanyCodeExists(companyCode);
}

export async function loadMarketingTestimonials() {
  return repo.getMarketingTestimonials();
}

export async function addMarketingTestimonial(form: PlatformMarketingTestimonialForm) {
  if (!form.name.trim()) throw new Error("Name is required.");
  if (!form.quote.trim()) throw new Error("Quote is required.");
  return repo.createMarketingTestimonial(form);
}

export async function editMarketingTestimonial(id: string, patch: Partial<PlatformMarketingTestimonialForm>) {
  return repo.updateMarketingTestimonial(id, patch);
}

export async function removeMarketingTestimonial(id: string) {
  return repo.deleteMarketingTestimonial(id);
}

export async function loadPublicPricing() {
  return repo.getPublicSubscriptionPlans();
}

export async function submitInquiry(form: PlatformMarketingInquiryForm) {
  if (!form.name.trim()) throw new Error("Name is required.");
  if (!form.phone?.trim() && !form.email?.trim()) throw new Error("Please provide a phone number or email so we can reach you.");
  return repo.submitMarketingInquiry(form);
}

export async function loadInquiries() {
  return repo.getMarketingInquiries();
}

export async function setInquiryStatus(id: string, status: PlatformMarketingInquiry["status"]) {
  return repo.updateMarketingInquiryStatus(id, status);
}
