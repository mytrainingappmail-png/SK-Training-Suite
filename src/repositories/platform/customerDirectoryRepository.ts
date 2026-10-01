// Platform-owner-only data for the Customer Directory. Every call below is
// refused by the database for anyone who is not the platform owner, so nothing
// here can leak to a customer company even if the screen were somehow opened.

import { supabase } from "../../lib/supabase";

export interface DirectoryAdmin {
  employee_code: string;
  name: string;
  email: string | null;
  mobile: string | null;
  has_login: boolean;
  auth_user_id: string | null;
  last_login: string | null;
  active: boolean;
}

export type EffectiveStatus = "no_licence" | "suspended" | "complimentary" | "active" | "grace" | "expired";

export interface DirectoryRow {
  company_id: string;
  company_code: string;
  company_name: string;
  short_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  city: string | null;
  state: string | null;
  company_active: boolean;
  offboarded_at: string | null;
  is_platform_operator: boolean;
  created_at: string;
  admins: DirectoryAdmin[];
  licence_id: string | null;
  licence_no: string | null;
  plan_name: string | null;
  plan_code: string | null;
  billing_cycle: string | null;
  licence_status: string | null;
  effective_status: EffectiveStatus;
  start_date: string | null;
  end_date: string | null;
  days_left: number | null;
  grace_period_days: number | null;
  is_complimentary: boolean | null;
  plan_price: number | null;
  employees_active: number;
  employees_total: number;
  max_employees: number | null;
  courses: number;
  max_courses: number | null;
  certificates_this_month: number;
  max_certificates: number | null;
  storage_mb: number;
  last_login: string | null;
  paid_total: number;
  payments_count: number;
  last_payment_on: string | null;
  failed_reminders: number;
  note: string | null;
  follow_up_date: string | null;
  note_updated_at: string | null;
}

export interface PlatformPayment {
  id: string;
  company_id: string;
  paid_on: string;
  amount: number;
  method: "upi" | "bank" | "cash" | "cheque" | "razorpay" | "other";
  reference: string | null;
  note: string | null;
}

function fail(label: string, error: { message: string }): never {
  console.error(`[customerDirectoryRepository] ${label}:`, error);
  throw new Error(error.message);
}

export async function getCompanyDirectory(): Promise<DirectoryRow[]> {
  const { data, error } = await supabase.rpc("get_company_directory");
  if (error) fail("getCompanyDirectory", error);
  return ((data as DirectoryRow[] | null) ?? []).map((r) => ({
    ...r,
    plan_price: r.plan_price === null ? null : Number(r.plan_price),
    storage_mb: Number(r.storage_mb),
    paid_total: Number(r.paid_total),
    admins: r.admins ?? [],
  }));
}

export async function saveCompanyNote(companyId: string, note: string, followUpDate: string | null): Promise<void> {
  const { error } = await supabase.from("platform_company_notes").upsert(
    { company_id: companyId, note: note.trim() || null, follow_up_date: followUpDate || null, updated_at: new Date().toISOString() },
    { onConflict: "company_id" },
  );
  if (error) fail("saveCompanyNote", error);
}

export async function listPayments(companyId: string): Promise<PlatformPayment[]> {
  const { data, error } = await supabase
    .from("platform_payments")
    .select("id, company_id, paid_on, amount, method, reference, note")
    .eq("company_id", companyId)
    .order("paid_on", { ascending: false });
  if (error) fail("listPayments", error);
  return ((data as PlatformPayment[] | null) ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));
}

export async function addPayment(p: Omit<PlatformPayment, "id">): Promise<void> {
  const { error } = await supabase.from("platform_payments").insert({
    company_id: p.company_id,
    paid_on: p.paid_on,
    amount: p.amount,
    method: p.method,
    reference: p.reference?.trim() || null,
    note: p.note?.trim() || null,
  });
  if (error) fail("addPayment", error);
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from("platform_payments").delete().eq("id", id);
  if (error) fail("deletePayment", error);
}
