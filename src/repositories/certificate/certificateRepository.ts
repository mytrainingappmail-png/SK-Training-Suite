import { supabase } from "../../lib/supabase";
import type { Certificate } from "../../types/certificate";
import type { CertificateForm } from "../../types/certificate";

export async function getCertificates(): Promise<Certificate[]> {
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[certificateRepository] getCertificates:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getCertificate(id: string): Promise<Certificate> {
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[certificateRepository] getCertificate:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createCertificate(
  certificate: CertificateForm
): Promise<Certificate> {
  const { data, error } = await supabase
    .from("certificates")
    .insert(certificate)
    .select()
    .single();

  if (error) {
    console.error("[certificateRepository] createCertificate:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateCertificate(
  id: string,
  certificate: Partial<CertificateForm>
): Promise<Certificate> {
  const { data, error } = await supabase
    .from("certificates")
    .update(certificate)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateRepository] updateCertificate:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteCertificate(id: string): Promise<void> {
  const { error } = await supabase
    .from("certificates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[certificateRepository] deleteCertificate:", error);
    throw new Error(error.message);
  }
}

export async function togglePublished(
  id: string,
  published: boolean
): Promise<Certificate> {
  const { data, error } = await supabase
    .from("certificates")
    .update({ published })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateRepository] togglePublished:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Certificate> {
  const { data, error } = await supabase
    .from("certificates")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}
