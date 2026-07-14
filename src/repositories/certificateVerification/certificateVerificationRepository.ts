import { supabase } from "../../lib/supabase";
import type {
  CertificateVerification,
  CertificateVerificationForm,
} from "../../types/certificateVerification";

export async function getVerifications(): Promise<CertificateVerification[]> {
  const { data, error } = await supabase
    .from("certificate_verifications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[certificateVerificationRepository] getVerifications:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getVerification(
  id: string
): Promise<CertificateVerification> {
  const { data, error } = await supabase
    .from("certificate_verifications")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[certificateVerificationRepository] getVerification:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createVerification(
  verification: CertificateVerificationForm
): Promise<CertificateVerification> {
  const { data, error } = await supabase
    .from("certificate_verifications")
    .insert(verification)
    .select()
    .single();

  if (error) {
    console.error("[certificateVerificationRepository] createVerification:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateVerification(
  id: string,
  verification: Partial<CertificateVerificationForm>
): Promise<CertificateVerification> {
  const { data, error } = await supabase
    .from("certificate_verifications")
    .update(verification)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateVerificationRepository] updateVerification:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteVerification(id: string): Promise<void> {
  const { error } = await supabase
    .from("certificate_verifications")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[certificateVerificationRepository] deleteVerification:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<CertificateVerification> {
  const { data, error } = await supabase
    .from("certificate_verifications")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateVerificationRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function incrementVerificationCount(
  id: string
): Promise<CertificateVerification> {
  // Fetch current count, increment, and record last_verified_at
  const { data: current, error: fetchError } = await supabase
    .from("certificate_verifications")
    .select("verified_count")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error("[certificateVerificationRepository] incrementVerificationCount (fetch):", fetchError);
    throw new Error(fetchError.message);
  }

  const { data, error } = await supabase
    .from("certificate_verifications")
    .update({
      verified_count:   (current.verified_count ?? 0) + 1,
      last_verified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateVerificationRepository] incrementVerificationCount:", error);
    throw new Error(error.message);
  }

  return data;
}
