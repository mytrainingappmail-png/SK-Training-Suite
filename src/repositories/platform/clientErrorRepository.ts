// "Something went wrong" reports from customers' screens (see migration 20261002130000).

import { supabase } from "../../lib/supabase";

export interface ClientErrorRow {
  id: string;
  at: string;
  company_id: string | null;
  employee_id: string | null;
  message: string;
  stack: string | null;
  page: string | null;
  user_agent: string | null;
  company_name: string | null;
  employee_code: string | null;
}

/** Fire-and-forget: reporting must never cause another error. */
export async function sendClientError(message: string, stack: string | null, page: string, userAgent: string): Promise<void> {
  try {
    await supabase.rpc("report_client_error", { p_message: message, p_stack: stack, p_page: page, p_user_agent: userAgent });
  } catch {
    // ignore
  }
}

export async function listClientErrors(limit = 200): Promise<ClientErrorRow[]> {
  const { data, error } = await supabase
    .from("client_errors")
    .select("id, at, company_id, employee_id, message, stack, page, user_agent, companies(company_name), employees(employee_code)")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  type Raw = Omit<ClientErrorRow, "company_name" | "employee_code"> & {
    companies: { company_name: string } | { company_name: string }[] | null;
    employees: { employee_code: string } | { employee_code: string }[] | null;
  };
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  return ((data as unknown as Raw[]) ?? []).map((r) => ({
    id: r.id, at: r.at, company_id: r.company_id, employee_id: r.employee_id, message: r.message, stack: r.stack,
    page: r.page, user_agent: r.user_agent,
    company_name: one(r.companies)?.company_name ?? null,
    employee_code: one(r.employees)?.employee_code ?? null,
  }));
}

export async function clearClientErrors(): Promise<void> {
  const { error } = await supabase.from("client_errors").delete().gte("at", "1970-01-01");
  if (error) throw new Error(error.message);
}
