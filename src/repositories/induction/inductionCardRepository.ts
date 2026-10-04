// What employees submit for acknowledgment / feedback / task cards. Row-level security decides who sees what:
// an employee only their own, a company's admins everything of their company.

import { supabase } from '../../lib/supabase';
import type { InductionCardResponse, InductionResponseKind, InductionResponseStatus } from '../../types/induction';

export async function getMyCardResponses(employeeId: string): Promise<InductionCardResponse[]> {
  const { data, error } = await supabase.from('induction_card_responses').select('*').eq('employee_id', employeeId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Adds or REPLACES the employee's answer for a card (a redo clears any earlier review). */
export async function saveMyCardResponse(input: {
  sectionId: string; employeeId: string; companyId: string; kind: InductionResponseKind; response: Record<string, unknown>;
}): Promise<InductionCardResponse> {
  const { data, error } = await supabase
    .from('induction_card_responses')
    .upsert(
      {
        company_id: input.companyId, section_id: input.sectionId, employee_id: input.employeeId, kind: input.kind,
        response: input.response, status: 'submitted', reviewer_comment: null, reviewed_by: null, reviewed_at: null,
      },
      { onConflict: 'section_id,employee_id' },
    )
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Could not save your answer.');
  return data;
}

export async function getCardResponsesForSections(sectionIds: string[]): Promise<InductionCardResponse[]> {
  if (sectionIds.length === 0) return [];
  const { data, error } = await supabase
    .from('induction_card_responses').select('*').in('section_id', sectionIds).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function reviewCardResponse(id: string, status: InductionResponseStatus, comment: string, reviewerId: string): Promise<void> {
  const { error } = await supabase
    .from('induction_card_responses')
    .update({ status, reviewer_comment: comment.trim() || null, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getEmployeeNames(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from('employees').select('id, employee_code, first_name, last_name').in('id', ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const e of data ?? []) out[e.id as string] = `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() + (e.employee_code ? ` (${e.employee_code})` : '');
  }
  return out;
}
