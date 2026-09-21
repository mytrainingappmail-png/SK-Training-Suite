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
  CallingAppAdmin,
  MasterSheetListSummary,
  EmployeeDistributionSummary,
  DuplicateMobileMatch,
  DuplicateContactGroup,
  CallingAppHandoff,
  CallingAppBreak,
  BreakType,
  CallingAppSettings,
  CallingAppNotification,
  CallingAppBatchPerformance,
} from "../../types/callingApp";

/** Supabase caps every SELECT at 1000 rows, silently. A company with a few thousand leads or
 * call logs would otherwise see a truncated list - wrong dashboard counts, missing leads, an
 * incomplete duplicate scan - with no error. This pages through the whole result. */
const PAGE = 1000;
async function fetchAllRows<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/** Big id/mobile lists go in the URL of an `in()` filter, which breaks past a few hundred values. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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
  return fetchAllRows<CallingAppContact>((from, to) =>
    client.from("calling_app_contacts").select("*").eq("company_id", companyId)
      .order("created_at", { ascending: false }).order("id").range(from, to));
}

/** Bulk import: a few round trips per 500 rows instead of one per row. Rows come back in input order. */
export async function createContactsBulk(client: SupabaseClient, companyId: string, listId: string | null, forms: CallingAppContactForm[]): Promise<CallingAppContact[]> {
  const created: CallingAppContact[] = [];
  for (const part of chunk(forms, 500)) {
    const { data, error } = await client
      .from("calling_app_contacts")
      .insert(part.map((f) => ({ ...f, company_id: companyId, list_id: listId })))
      .select();
    if (error) throw new Error(error.message);
    created.push(...(data ?? []));
  }
  return created;
}

export async function upsertCustomFieldValuesBulk(client: SupabaseClient, values: { contact_id: string; field_def_id: string; value_text: string }[]): Promise<void> {
  for (const part of chunk(values, 500)) {
    const { error } = await client.from("calling_app_custom_field_values").upsert(part, { onConflict: "contact_id,field_def_id" });
    if (error) throw new Error(error.message);
  }
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
  return fetchAllRows<CallingAppCallLog>((from, to) =>
    client.from("calling_app_call_logs").select("*").eq("company_id", companyId)
      .order("called_at", { ascending: false }).order("id").range(from, to));
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

// ── Master Sheet distribution ────────────────────────────────────────

/** Checks a batch of mobile numbers against contacts that already exist
 * for this company — so an upload never silently creates a duplicate
 * lead someone else already has. Returns only the ones that DO already
 * exist; the caller decides what to do about them (skip, or import
 * anyway — that choice is always the admin's, never automatic). */
export async function findDuplicateMobiles(client: SupabaseClient, companyId: string, mobiles: string[]): Promise<DuplicateMobileMatch[]> {
  if (mobiles.length === 0) return [];
  const data: { id: string; mobile_no: string; name: string; assigned_to: string | null }[] = [];
  for (const part of chunk(Array.from(new Set(mobiles)), 150)) {
    const { data: rows, error } = await client
      .from("calling_app_contacts")
      .select("id, mobile_no, name, assigned_to")
      .eq("company_id", companyId)
      .in("mobile_no", part);
    if (error) throw new Error(error.message);
    data.push(...(rows ?? []));
  }
  return data.map((row) => ({
    mobile_no: row.mobile_no,
    existingContactId: row.id,
    existingName: row.name,
    assignedToAdminId: row.assigned_to,
  }));
}

/** The Master Sheet itself — every unassigned contact, oldest first
 * (so distribution is predictable: whoever asks next gets the next
 * batch in upload order), optionally narrowed to one list. No limit
 * unless the caller passes one — the pool itself has no size cap. */
export async function getUnassignedContacts(client: SupabaseClient, companyId: string, listId?: string, limit?: number): Promise<CallingAppContact[]> {
  const build = (from: number, to: number) => {
    let query = client
      .from("calling_app_contacts")
      .select("*")
      .eq("company_id", companyId)
      .is("assigned_to", null)
      .order("created_at", { ascending: true })
      .order("id");
    if (listId) query = query.eq("list_id", listId);
    return query.range(from, to);
  };
  if (limit) {
    const { data, error } = await build(0, Math.min(limit, PAGE) - 1);
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  return fetchAllRows<CallingAppContact>(build);
}

/** Cheap head-count of the pool - the Distribute box only needs the number, not every lead. */
export async function countUnassignedContacts(client: SupabaseClient, companyId: string, listId?: string): Promise<number> {
  let query = client.from("calling_app_contacts").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("assigned_to", null);
  if (listId) query = query.eq("list_id", listId);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Hands a specific batch of contacts to one employee in one go —
 * records who distributed it and when, which is what makes "kisko
 * kitna diya" reportable afterwards. Also notifies the employee, same as
 * an automatic top-up would — a manual and an automatic distribution
 * should feel identical from the receiving agent's side. */
export async function distributeContacts(client: SupabaseClient, contactIds: string[], assignTo: string, assignedBy: string, companyId: string): Promise<number> {
  if (contactIds.length === 0) return 0;
  let given = 0;
  for (const part of chunk(contactIds, 100)) {
    // "is assigned_to null" makes this safe when two people distribute at once: a lead someone
    // else already handed out is left alone instead of being silently taken from them.
    const { data, error } = await client
      .from("calling_app_contacts")
      .update({ assigned_to: assignTo, assigned_by: assignedBy, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("id", part)
      .is("assigned_to", null)
      .select("id");
    if (error) throw new Error(error.message);
    given += data?.length ?? 0;
  }
  if (given === 0) return 0;

  const { error: notifyError } = await client.from("calling_app_notifications").insert({
    company_id: companyId,
    recipient_admin_id: assignTo,
    kind: "leads_assigned",
    message: `${given} new lead(s) have been given to you.`,
  });
  if (notifyError) throw new Error(notifyError.message);
  return given;
}

// ── Settings (auto-distribution on/off + batch size) ────────────────────

export async function getSettings(client: SupabaseClient, companyId: string): Promise<CallingAppSettings> {
  const { data, error } = await client.from("calling_app_settings").select("*").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? { company_id: companyId, auto_distribute_enabled: false, auto_distribute_batch_size: 50, updated_at: new Date().toISOString() };
}

export async function saveSettings(client: SupabaseClient, companyId: string, patch: Partial<Pick<CallingAppSettings, "auto_distribute_enabled" | "auto_distribute_batch_size">>): Promise<CallingAppSettings> {
  const { data, error } = await client
    .from("calling_app_settings")
    .upsert({ company_id: companyId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "company_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Notifications ────────────────────────────────────────────────────────

/** Everything the CALLER is allowed to see — their own personal ones, plus
 * (if they can manage the Master Sheet) every "authority broadcast" —
 * enforced by RLS, this just reads without filtering client-side. */
export async function listNotifications(client: SupabaseClient, companyId: string): Promise<CallingAppNotification[]> {
  const { data, error } = await client
    .from("calling_app_notifications")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markNotificationRead(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("calling_app_notifications").update({ is_read: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Recall ───────────────────────────────────────────────────────────────

/** Pulls an agent's leads back into the unassigned pool — onlyUnworked=true
 * (the default, safer case) leaves anything they've already attempted
 * alone; false takes back everything still assigned to them regardless
 * (e.g. they've left the company). Returns how many were recalled. */
export async function recallContacts(client: SupabaseClient, fromAdminId: string, onlyUnworked: boolean): Promise<number> {
  const { data, error } = await client.rpc("recall_calling_app_contacts", { p_from_admin_id: fromAdminId, p_only_unworked: onlyUnworked });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

// ── Batch performance ("who completed their data in how much time") ─────

export async function listBatchPerformance(client: SupabaseClient, companyId: string): Promise<CallingAppBatchPerformance[]> {
  return fetchAllRows<CallingAppBatchPerformance>((from, to) =>
    client.from("calling_app_batch_performance").select("*").eq("company_id", companyId)
      .order("assigned_at", { ascending: false }).range(from, to));
}

// ── Registered mobile number ────────────────────────────────────────────

/** Lets the CURRENT admin set/change which SIM they call from — works for
 * either login type since it goes through an RPC keyed off
 * current_calling_app_admin_id(), not the normal RLS write policy (which
 * only trusts an LMS employee session). Pass "" to clear it. */
export async function updateMyRegisteredMobile(client: SupabaseClient, mobile: string): Promise<void> {
  const { error } = await client.rpc("update_my_registered_mobile", { p_mobile: mobile });
  if (error) throw new Error(error.message);
}

export function buildMasterSheetSummary(lists: CallingAppCallList[], contacts: CallingAppContact[]): MasterSheetListSummary[] {
  return lists.map((list) => {
    const inList = contacts.filter((c) => c.list_id === list.id);
    const assigned = inList.filter((c) => c.assigned_to !== null).length;
    return { list, total: inList.length, assigned, unassigned: inList.length - assigned };
  });
}

/** Finds every mobile number that already has more than one contact row
 * for this company — a maintenance/cleanup view, separate from the
 * upload-time skip-duplicates check (that one stops NEW duplicates;
 * this one finds ones that got in some other way, e.g. two different
 * lists uploaded before this feature existed). Oldest entry first in
 * each group. */
export async function findDuplicateGroups(client: SupabaseClient, companyId: string): Promise<DuplicateContactGroup[]> {
  const data = await fetchAllRows<CallingAppContact>((from, to) =>
    client.from("calling_app_contacts").select("*").eq("company_id", companyId)
      .order("created_at", { ascending: true }).order("id").range(from, to));

  const byMobile = new Map<string, CallingAppContact[]>();
  data.forEach((c) => {
    const list = byMobile.get(c.mobile_no) ?? [];
    list.push(c);
    byMobile.set(c.mobile_no, list);
  });

  return Array.from(byMobile.entries())
    .filter(([, entries]) => entries.length > 1)
    .map(([mobile_no, entries]) => ({ mobile_no, entries }));
}

/** Removes every duplicate EXCEPT the oldest entry in each group — the
 * admin sees the groups first (findDuplicateGroups) and explicitly
 * confirms before this runs; never automatic. */
export async function removeDuplicateContacts(client: SupabaseClient, groups: DuplicateContactGroup[]): Promise<number> {
  const idsToDelete = groups.flatMap((g) => g.entries.slice(1).map((c) => c.id));
  if (idsToDelete.length === 0) return 0;
  for (const part of chunk(idsToDelete, 100)) {
    const { error } = await client.from("calling_app_contacts").delete().in("id", part);
    if (error) throw new Error(error.message);
  }
  return idsToDelete.length;
}

// ── Prospects & handoff ──────────────────────────────────────────────

export async function markProspect(client: SupabaseClient, contactId: string, isProspect: boolean): Promise<void> {
  const { error } = await client.from("calling_app_contacts").update({ is_prospect: isProspect, updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) throw new Error(error.message);
}

export async function listHandoffs(client: SupabaseClient, companyId: string): Promise<CallingAppHandoff[]> {
  return fetchAllRows<CallingAppHandoff>((from, to) =>
    client.from("calling_app_handoffs").select("*").eq("company_id", companyId)
      .order("created_at", { ascending: false }).order("id").range(from, to));
}

/** Requests a handoff — the recipient must accept before ownership
 * actually transfers (see acceptHandoff). RLS only allows this when the
 * caller currently owns the contact being handed off. */
export async function createHandoff(client: SupabaseClient, companyId: string, contactId: string, fromAdminId: string, toAdminId: string, note: string): Promise<CallingAppHandoff> {
  const { data, error } = await client
    .from("calling_app_handoffs")
    .insert({ company_id: companyId, contact_id: contactId, from_admin_id: fromAdminId, to_admin_id: toAdminId, note: note.trim() || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Resolves the handoff AND moves the contact's assigned_to to the
 * recipient, atomically, via a security-definer RPC — a plain client
 * UPDATE of the contact can't do this because the recipient doesn't own
 * it until this exact moment. */
export async function acceptHandoff(client: SupabaseClient, handoffId: string): Promise<void> {
  const { error } = await client.rpc("accept_calling_app_handoff", { p_handoff_id: handoffId });
  if (error) throw new Error(error.message);
}

export async function declineHandoff(client: SupabaseClient, handoffId: string, reason: string): Promise<void> {
  const { error } = await client.rpc("decline_calling_app_handoff", { p_handoff_id: handoffId, p_reason: reason.trim() || null });
  if (error) throw new Error(error.message);
}

// ── Break tracking ───────────────────────────────────────────────────

export async function listBreaks(client: SupabaseClient, companyId: string): Promise<CallingAppBreak[]> {
  return fetchAllRows<CallingAppBreak>((from, to) =>
    client.from("calling_app_breaks").select("*").eq("company_id", companyId)
      .order("started_at", { ascending: false }).order("id").range(from, to));
}

/** The one-active-break-per-admin rule is enforced by a partial unique
 * index in the database — this insert will fail with a clear conflict
 * error if a break is already open. */
export async function startBreak(client: SupabaseClient, companyId: string, adminId: string, breakType: BreakType): Promise<CallingAppBreak> {
  const { data, error } = await client
    .from("calling_app_breaks")
    .insert({ company_id: companyId, admin_id: adminId, break_type: breakType })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function endBreak(client: SupabaseClient, breakId: string): Promise<void> {
  const { error } = await client.from("calling_app_breaks").update({ ended_at: new Date().toISOString() }).eq("id", breakId);
  if (error) throw new Error(error.message);
}

// ── Delegated report scope (Team Leader / Sales Head) ──────────────────

/** Mirrors current_calling_app_report_scope_admin_ids() client-side, so
 * the Dashboard/Reports/Sheet show exactly the set of people the DB
 * would actually let this admin see — the SQL function is the real
 * security boundary (RLS); this is purely for consistent UI filtering. */
export function computeReportScopeAdminIds(me: CallingAppAdmin, allAdmins: CallingAppAdmin[]): Set<string> {
  if (me.is_admin) return new Set(allAdmins.map((a) => a.id));

  if (me.role === "sales_head") {
    const teamLeaderIds = new Set(allAdmins.filter((a) => a.reports_to === me.id).map((a) => a.id));
    const ids = new Set<string>([me.id, ...teamLeaderIds]);
    allAdmins.forEach((a) => {
      if (a.reports_to && teamLeaderIds.has(a.reports_to)) ids.add(a.id);
    });
    return ids;
  }

  if (me.role === "team_leader") {
    return new Set([me.id, ...allAdmins.filter((a) => a.reports_to === me.id).map((a) => a.id)]);
  }

  return new Set([me.id]);
}

export function buildEmployeeDistributionSummary(admins: CallingAppAdmin[], contacts: CallingAppContact[]): EmployeeDistributionSummary[] {
  return admins
    .map((admin) => {
      const mine = contacts.filter((c) => c.assigned_to === admin.id);
      const assignedDates = mine.map((c) => c.assigned_at).filter((d): d is string => !!d).sort();
      return {
        admin,
        totalAssigned: mine.length,
        pending: mine.filter((c) => c.attempt_count === 0).length,
        firstAssignedAt: assignedDates[0] ?? null,
        lastAssignedAt: assignedDates[assignedDates.length - 1] ?? null,
      };
    })
    .filter((row) => row.totalAssigned > 0)
    .sort((a, b) => b.totalAssigned - a.totalAssigned);
}
