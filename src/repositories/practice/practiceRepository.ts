// AI Practice data access (migration 20261011100000). Scenarios and settings are plain tables guarded by row-level
// security; scoring goes through the practice-evaluate edge function — attempts can never be written from here.

import { supabase } from "../../lib/supabase";

export interface PracticeCriterion { name: string; hint?: string }

export interface PracticeScenario {
  id: string;
  company_id: string;
  title: string;
  customer_says: string;
  context: string;
  criteria: PracticeCriterion[];
  active: boolean;
  display_order: number;
  created_at: string;
}

export interface PracticeScore { name: string; score: number; comment: string }

export interface PracticeAttempt {
  id: string;
  company_id: string;
  scenario_id: string;
  employee_id: string;
  answer_text: string;
  spoken: boolean;
  scores: PracticeScore[];
  total_score: number;
  feedback: string;
  better_answer: string;
  next_step: string;
  created_at: string;
}

export interface PracticeSettings { enabled: boolean; daily_limit: number }

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = { enabled: false, daily_limit: 10 };

/** A starting set of scoring points so a new scenario is usable straight away (the admin can change every one). */
export const STARTER_CRITERIA: PracticeCriterion[] = [
  { name: "Listens and acknowledges the concern", hint: "Does not argue; shows understanding first" },
  { name: "Builds value before talking price", hint: "Location, quality, amenities, appreciation, trust" },
  { name: "Asks a good question", hint: "Finds out what the customer really needs or fears" },
  { name: "Handles the objection with facts", hint: "Specific, honest, no empty promises" },
  { name: "Moves to a clear next step", hint: "Site visit, meeting or follow-up fixed" },
];

export async function getPracticeSettings(companyId: string): Promise<PracticeSettings> {
  const { data, error } = await supabase.from("practice_settings").select("enabled, daily_limit").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? DEFAULT_PRACTICE_SETTINGS;
}

export async function savePracticeSettings(companyId: string, s: PracticeSettings): Promise<void> {
  const { error } = await supabase
    .from("practice_settings")
    .upsert({ company_id: companyId, enabled: s.enabled, daily_limit: s.daily_limit, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function listScenarios(companyId: string): Promise<PracticeScenario[]> {
  const { data, error } = await supabase
    .from("practice_scenarios")
    .select("*")
    .eq("company_id", companyId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PracticeScenario[];
}

export type ScenarioForm = Pick<PracticeScenario, "title" | "customer_says" | "context" | "criteria" | "active">;

export async function createScenario(companyId: string, createdBy: string | null, form: ScenarioForm, order: number): Promise<PracticeScenario> {
  const { data, error } = await supabase
    .from("practice_scenarios")
    .insert({ ...form, company_id: companyId, created_by: createdBy, display_order: order })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PracticeScenario;
}

export async function updateScenario(id: string, patch: Partial<ScenarioForm>): Promise<void> {
  const { error } = await supabase.from("practice_scenarios").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteScenario(id: string): Promise<void> {
  const { error } = await supabase.from("practice_scenarios").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** The signed-in person's own attempts (row-level security already limits this to them). */
export async function listMyAttempts(companyId: string, employeeId: string): Promise<PracticeAttempt[]> {
  const { data, error } = await supabase
    .from("practice_attempts")
    .select("*")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as PracticeAttempt[];
}

/** Admin: everyone's recent attempts. */
export async function listCompanyAttempts(companyId: string, sinceIso: string): Promise<PracticeAttempt[]> {
  const { data, error } = await supabase
    .from("practice_attempts")
    .select("*")
    .eq("company_id", companyId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as PracticeAttempt[];
}

export async function deleteAttempt(id: string): Promise<void> {
  const { error } = await supabase.from("practice_attempts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface EvaluateResult { attempt: PracticeAttempt; remaining_today: number }

/** Sends the answer to the AI scorer. Throws an Error with a plain-words message (the function's own sentence when there is one). */
export async function evaluateAnswer(scenarioId: string, answer: string, spoken: boolean): Promise<EvaluateResult> {
  const { data, error } = await supabase.functions.invoke("practice-evaluate", { body: { scenario_id: scenarioId, answer, spoken } });
  if (error) {
    let message = "Could not check your answer right now. Please try again.";
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
    } catch { /* keep the generic sentence */ }
    throw new Error(message);
  }
  return data as EvaluateResult;
}
