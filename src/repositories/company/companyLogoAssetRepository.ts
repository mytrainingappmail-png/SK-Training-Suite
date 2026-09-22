import { supabase } from "../../lib/supabase";

export interface CompanyLogoAsset {
  id: string;
  company_id: string;
  url: string;
  label: string;
  created_at: string;
}

export async function listCompanyLogoAssets(companyId: string): Promise<CompanyLogoAsset[]> {
  const { data, error } = await supabase
    .from("company_logo_assets")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[companyLogoAssetRepository] listCompanyLogoAssets:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function addCompanyLogoAsset(companyId: string, url: string, label = ""): Promise<CompanyLogoAsset> {
  const { data, error } = await supabase
    .from("company_logo_assets")
    .insert({ company_id: companyId, url, label })
    .select()
    .single();
  if (error) {
    console.error("[companyLogoAssetRepository] addCompanyLogoAsset:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function removeCompanyLogoAsset(id: string): Promise<void> {
  const { error } = await supabase.from("company_logo_assets").delete().eq("id", id);
  if (error) {
    console.error("[companyLogoAssetRepository] removeCompanyLogoAsset:", error);
    throw new Error(error.message);
  }
}
