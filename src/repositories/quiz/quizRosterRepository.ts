import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { QuizRosterEntry } from "../../types/quiz";

export async function listRoster(companyId: string): Promise<QuizRosterEntry[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_roster")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[quizRosterRepository] listRoster:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function addRosterEntry(
  companyId: string,
  entry: { employee_code: string; name: string; phone: string }
): Promise<QuizRosterEntry> {
  const { data, error } = await supabaseQuiz
    .from("quiz_roster")
    .insert({ ...entry, company_id: companyId })
    .select()
    .single();

  if (error) {
    console.error("[quizRosterRepository] addRosterEntry:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function setRosterActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_roster").update({ active }).eq("id", id);

  if (error) {
    console.error("[quizRosterRepository] setRosterActive:", error);
    throw new Error(error.message);
  }
}

export async function removeRosterEntry(id: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_roster").delete().eq("id", id);

  if (error) {
    console.error("[quizRosterRepository] removeRosterEntry:", error);
    throw new Error(error.message);
  }
}
