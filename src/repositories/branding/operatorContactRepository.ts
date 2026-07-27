import { supabase } from "../../lib/supabase";

export interface PublicOperatorContact {
  company_name: string;
  legal_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  website: string;
}

// Works with no session (anon) — get_public_operator_contact() is a
// SECURITY DEFINER function that only ever returns the platform operator's
// own non-sensitive business contact fields, safe to call pre-login.
export async function getPublicOperatorContact(): Promise<PublicOperatorContact | null> {
  const { data, error } = await supabase.rpc("get_public_operator_contact");

  if (error) {
    console.error("[operatorContactRepository] getPublicOperatorContact:", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
