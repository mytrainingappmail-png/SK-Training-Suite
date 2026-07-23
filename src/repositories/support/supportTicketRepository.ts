import { supabase } from "../../lib/supabase";
import type { SupportTicket, SupportTicketForm, SupportTicketMessage } from "../../types/supportTicket";

export async function getAllTicketsForCompany(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[supportTicketRepository] getAllTicketsForCompany:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getTicketsForEmployee(employeeId: string): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[supportTicketRepository] getTicketsForEmployee:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createTicket(
  companyId: string,
  employeeId: string,
  raiserName: string,
  form: SupportTicketForm,
  audience: SupportTicket["audience"] = "internal",
  raiserCompanyName = ""
): Promise<SupportTicket> {
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({ ...form, company_id: companyId, employee_id: employeeId, raiser_name: raiserName, audience, raiser_company_name: raiserCompanyName })
    .select()
    .single();

  if (error) {
    console.error("[supportTicketRepository] createTicket:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function getPlatformTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("audience", "platform")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[supportTicketRepository] getPlatformTickets:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getPlatformOperatorAdmins(): Promise<{ id: string; first_name: string; last_name: string; email: string }[]> {
  const { data, error } = await supabase.rpc("get_platform_operator_admins");

  if (error) {
    console.error("[supportTicketRepository] getPlatformOperatorAdmins:", error);
    return [];
  }

  return data ?? [];
}

export async function notifyOperatorOfPlatformTicket(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc("notify_operator_of_platform_ticket", { p_ticket_id: ticketId });
  if (error) console.error("[supportTicketRepository] notifyOperatorOfPlatformTicket:", error);
}

export async function notifyRaiserOfPlatformReply(ticketId: string, authorName: string, message: string): Promise<void> {
  const { error } = await supabase.rpc("notify_raiser_of_platform_reply", { p_ticket_id: ticketId, p_author_name: authorName, p_message: message });
  if (error) console.error("[supportTicketRepository] notifyRaiserOfPlatformReply:", error);
}

export async function getPlatformTicketRaiser(ticketId: string): Promise<{ email: string; first_name: string } | null> {
  const { data, error } = await supabase.rpc("get_platform_ticket_raiser", { p_ticket_id: ticketId });
  if (error) {
    console.error("[supportTicketRepository] getPlatformTicketRaiser:", error);
    return null;
  }
  return data?.[0] ?? null;
}

export async function updateTicketStatus(id: string, status: SupportTicket["status"]): Promise<SupportTicket> {
  const { data, error } = await supabase
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString(), resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[supportTicketRepository] updateTicketStatus:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function getMessagesForTicket(ticketId: string): Promise<SupportTicketMessage[]> {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[supportTicketRepository] getMessagesForTicket:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function addTicketMessage(
  companyId: string,
  ticketId: string,
  authorEmployeeId: string | null,
  authorName: string,
  isAdminReply: boolean,
  message: string
): Promise<SupportTicketMessage> {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({
      company_id: companyId,
      ticket_id: ticketId,
      author_employee_id: authorEmployeeId,
      author_name: authorName,
      is_admin_reply: isAdminReply,
      message,
    })
    .select()
    .single();

  if (error) {
    console.error("[supportTicketRepository] addTicketMessage:", error);
    throw new Error(error.message);
  }

  // Any reply bumps the ticket back into view / touches updated_at.
  await supabase.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);

  return data;
}

// Three sequential queries (rather than a two-level nested embed filter,
// which PostgREST handles inconsistently) — resolves this company's
// SUPER_ADMIN/ADMIN/HR roles, then their active employee_roles rows, then
// the employee records themselves.
export async function getAdminEmployeesForCompany(companyId: string): Promise<{ id: string; first_name: string; last_name: string; email: string }[]> {
  const { data: roleRows, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("company_id", companyId)
    .in("role_code", ["SUPER_ADMIN", "ADMIN", "HR"]);

  if (roleError || !roleRows?.length) {
    if (roleError) console.error("[supportTicketRepository] getAdminEmployeesForCompany (roles):", roleError);
    return [];
  }

  const { data: assignments, error: assignError } = await supabase
    .from("employee_roles")
    .select("employee_id")
    .eq("active", true)
    .in("role_id", roleRows.map((r) => r.id));

  if (assignError || !assignments?.length) {
    if (assignError) console.error("[supportTicketRepository] getAdminEmployeesForCompany (employee_roles):", assignError);
    return [];
  }

  const { data: employeeRows, error: employeeError } = await supabase
    .from("employees")
    .select("id, first_name, last_name, email")
    .eq("active", true)
    .in("id", Array.from(new Set(assignments.map((a) => a.employee_id))));

  if (employeeError) {
    console.error("[supportTicketRepository] getAdminEmployeesForCompany (employees):", employeeError);
    return [];
  }

  return employeeRows ?? [];
}
