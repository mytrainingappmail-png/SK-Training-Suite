import * as repo from "../../repositories/platformMarketing/platformMarketingRepository";
import type { PlatformMarketingSettingsForm, PlatformMarketingFeatureForm } from "../../types/platformMarketing";

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
