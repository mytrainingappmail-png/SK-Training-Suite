// The trainer's own list of locations for the Live Quiz / Exam module (migration 20261022100000).
// Nothing is built in: every company adds its own.

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { QuizLocation } from "../../types/quiz";

function fail(label: string, error: { message: string; code?: string }): never {
  console.error(`[quizLocationRepository] ${label}:`, error);
  if (error.code === "23505") throw new Error("That location already exists.");
  throw new Error(error.message);
}

export async function listLocations(companyId: string): Promise<QuizLocation[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_locations")
    .select("*")
    .eq("company_id", companyId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) fail("listLocations", error);
  return data ?? [];
}

export async function createLocation(companyId: string, name: string): Promise<QuizLocation> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Type the location name.");
  const { data: last } = await supabaseQuiz
    .from("quiz_locations")
    .select("display_order")
    .eq("company_id", companyId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabaseQuiz
    .from("quiz_locations")
    .insert({ company_id: companyId, name: clean, display_order: (last?.display_order ?? 0) + 1 })
    .select()
    .single();
  if (error) fail("createLocation", error);
  return data;
}

/** Puts these tests (quizzes / exams) at a location - or at none (null). Sessions already run keep the location they had. */
export async function setQuizzesLocation(quizIds: string[], locationId: string | null): Promise<void> {
  if (quizIds.length === 0) return;
  const { error } = await supabaseQuiz.from("quizzes").update({ location_id: locationId }).in("id", quizIds);
  if (error) {
    console.error("[quizLocationRepository] setQuizzesLocation:", error);
    throw new Error(error.message);
  }
}

export async function renameLocation(id: string, name: string): Promise<void> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Type the location name.");
  const { error } = await supabaseQuiz.from("quiz_locations").update({ name: clean }).eq("id", id);
  if (error) fail("renameLocation", error);
}

export async function setLocationActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_locations").update({ active }).eq("id", id);
  if (error) fail("setLocationActive", error);
}

/** Quizzes and past sessions keep existing — they just show under "No location". */
export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_locations").delete().eq("id", id);
  if (error) fail("deleteLocation", error);
}
