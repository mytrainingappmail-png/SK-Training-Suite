// src/repositories/induction/inductionRepository.ts
//
// Repository layer — Supabase ONLY. Mirrors realEstateProjectRepository.ts
// exactly (same shapes, same conventions) — Induction is deliberately
// modeled on Real Estate Projects.

import { supabase } from '../../lib/supabase';
import type {
  InductionDay,
  InductionDayForm,
  InductionDaySection,
  InductionDaySectionForm,
  InductionAssignment,
  InductionDayCompletion,
} from '../../types/induction';

// ── Days ──────────────────────────────────────────────────────────────────────

export async function getDays(): Promise<InductionDay[]> {
  const { data, error } = await supabase
    .from('induction_days')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDay(form: InductionDayForm): Promise<InductionDay> {
  const { data, error } = await supabase.from('induction_days').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDay(id: string, form: Partial<InductionDayForm>): Promise<InductionDay> {
  const { data, error } = await supabase.from('induction_days').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteDay(id: string): Promise<void> {
  const { error } = await supabase.from('induction_days').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getDay(id: string): Promise<InductionDay | null> {
  const { data, error } = await supabase.from('induction_days').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ── Sections (Page / Test) ───────────────────────────────────────────────────

export async function getSectionsForDay(dayId: string): Promise<InductionDaySection[]> {
  const { data, error } = await supabase
    .from('induction_day_sections')
    .select('*')
    .eq('day_id', dayId)
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllSections(): Promise<InductionDaySection[]> {
  const { data, error } = await supabase
    .from('induction_day_sections')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSection(form: InductionDaySectionForm): Promise<InductionDaySection> {
  const { data, error } = await supabase.from('induction_day_sections').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSection(id: string, form: Partial<InductionDaySectionForm>): Promise<InductionDaySection> {
  const { data, error } = await supabase.from('induction_day_sections').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSection(id: string): Promise<void> {
  const { error } = await supabase.from('induction_day_sections').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Day completion tracking (gates Test sections + the next Day) ────────────

export async function getCompletionsForEmployee(employeeId: string): Promise<InductionDayCompletion[]> {
  const { data, error } = await supabase
    .from('induction_day_completions')
    .select('day_id, completed_at')
    .eq('employee_id', employeeId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markDayComplete(dayId: string, employeeId: string, companyId: string): Promise<void> {
  const { error } = await supabase
    .from('induction_day_completions')
    .upsert({ day_id: dayId, employee_id: employeeId, company_id: companyId }, { onConflict: 'day_id,employee_id' });
  if (error) throw new Error(error.message);
}

// ── Assignments (who's currently in induction — drives the sidebar) ─────────

export async function getAssignments(): Promise<InductionAssignment[]> {
  const { data, error } = await supabase.from('induction_assignments').select('*');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMyAssignment(employeeId: string): Promise<InductionAssignment | null> {
  const { data, error } = await supabase
    .from('induction_assignments')
    .select('*')
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createAssignment(companyId: string, employeeId: string): Promise<InductionAssignment> {
  const { data, error } = await supabase
    .from('induction_assignments')
    .insert({ company_id: companyId, employee_id: employeeId, status: 'active' })
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function setAssignmentStatus(id: string, status: 'active' | 'completed'): Promise<InductionAssignment> {
  const { data, error } = await supabase
    .from('induction_assignments')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from('induction_assignments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
