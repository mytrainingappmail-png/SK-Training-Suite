// Data layer for the Calling App's own screens (Dashboard/Sheet/Reports/
// Settings) — every function takes an explicit `client` because, unlike
// every other module in this app, a Calling App session can legitimately
// be EITHER the main LMS `supabase` client (someone using their existing
// LMS login) OR the dedicated `supabaseCallingApp` client (someone with
// a separate calling-only credential). RLS resolves the right identity
// either way via current_calling_app_admin_id() — this layer just needs
// to send the request through whichever client actually holds that
// person's session.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CallingAppDisposition,
  CallingAppCustomFieldDef,
  CallingAppCallList,
  CallingAppContact,
  CallingAppContactForm,
  CallingAppCustomFieldValue,
  CallingAppCallLog,
} from "../../types/callingApp";

export async function listDispositions(client: SupabaseClient, companyId: string): Promise<CallingAppDisposition[]> {
  const { data, error } = await client
    .from("calling_app_dispositions")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDisposition(client: SupabaseClient, companyId: string, form: Pick<CallingAppDisposition, "label" | "color" | "outcome_type" | "sort_order">): Promise<CallingAppDisposition> {
  const { data, error } = await client.from("calling_app_dispositions").insert({ company_id: companyId, ...form }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDisposition(client: SupabaseClient, id: string, patch: Partial<CallingAppDisposition>): Promise<CallingAppDisposition> {
  const { data, error } = await client.from("calling_app_dispositions").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteDisposition(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("calling_app_dispositions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCustomFieldDefs(client: SupabaseClient, companyId: string): Promise<CallingAppCustomFieldDef[]> {
  const { data, error } = await client
    .from("calling_app_custom_field_defs")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCustomFieldDef(client: SupabaseClient, companyId: string, form: Pick<CallingAppCustomFieldDef, "field_key" | "label" | "field_type" | "dropdown_options" | "sort_order">): Promise<CallingAppCustomFieldDef> {
  const { data, error } = await client.from("calling_app_custom_field_defs").insert({ company_id: companyId, ...form }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCustomFieldDef(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("calling_app_custom_field_defs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCallLists(client: SupabaseClient, companyId: string): Promise<CallingAppCallList[]> {
  const { data, error } = await client
    .from("calling_app_call_lists")
    .select("*")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCallList(client: SupabaseClient, companyId: string, name: string, rowCount: number, uploadedBy: string): Promise<CallingAppCallList> {
  const { data, error } = await client
    .from("calling_app_call_lists")
    .insert({ company_id: companyId, name, row_count: rowCount, uploaded_by: uploadedBy })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listContacts(client: SupabaseClient, companyId: string): Promise<CallingAppContact[]> {
  const { data, error } = await client
    .from("calling_app_contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createContact(client: SupabaseClient, companyId: string, listId: string | null, form: CallingAppContactForm): Promise<CallingAppContact> {
  const { data, error } = await client
    .from("calling_app_contacts")
    .insert({ ...form, company_id: companyId, list_id: listId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateContact(client: SupabaseClient, id: string, patch: Partial<CallingAppContactForm> & { attempt_count?: number }): Promise<CallingAppContact> {
  const { data, error } = await client
    .from("calling_app_contacts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteContact(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("calling_app_contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCustomFieldValuesForContacts(client: SupabaseClient, contactIds: string[]): Promise<CallingAppCustomFieldValue[]> {
  if (contactIds.length === 0) return [];
  const { data, error } = await client.from("calling_app_custom_field_values").select("*").in("contact_id", contactIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertCustomFieldValue(client: SupabaseClient, contactId: string, fieldDefId: string, valueText: string): Promise<void> {
  const { error } = await client
    .from("calling_app_custom_field_values")
    .upsert({ contact_id: contactId, field_def_id: fieldDefId, value_text: valueText }, { onConflict: "contact_id,field_def_id" });
  if (error) throw new Error(error.message);
}

export async function listCallLogs(client: SupabaseClient, companyId: string): Promise<CallingAppCallLog[]> {
  const { data, error } = await client
    .from("calling_app_call_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("called_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Logs the call AND updates the contact's disposition/remarks/attempt
 * count/next-call time in one place, so every call-site does both
 * consistently. */
export async function logCall(
  client: SupabaseClient,
  companyId: string,
  contact: CallingAppContact,
  adminId: string,
  dispositionId: string | null,
  remarks: string,
  nextCallAt: string | null
): Promise<void> {
  const { error: logError } = await client.from("calling_app_call_logs").insert({
    company_id: companyId,
    contact_id: contact.id,
    admin_id: adminId,
    disposition_id: dispositionId,
    remarks,
  });
  if (logError) throw new Error(logError.message);

  const { error: updateError } = await client
    .from("calling_app_contacts")
    .update({
      disposition_id: dispositionId,
      remarks,
      attempt_count: contact.attempt_count + 1,
      next_call_at: nextCallAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contact.id);
  if (updateError) throw new Error(updateError.message);
}
