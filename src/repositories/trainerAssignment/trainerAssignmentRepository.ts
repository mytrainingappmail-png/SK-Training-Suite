import { supabase } from "../../lib/supabase";
import type { TrainerAssignment } from "../../types/trainerAssignment";
import type { TrainerAssignmentForm } from "../../types/trainerAssignment";

// Optional fields whose empty-string "no value" placeholder must become
// null before reaching Postgres — branch_id is a uuid column ("" is
// invalid input for uuid), and assigned_from/assigned_to are date
// columns (which reject "" the same way).
function sanitize<T extends Partial<TrainerAssignmentForm>>(assignment: T): T {
  const cleaned = { ...assignment };
  if ("branch_id" in cleaned && cleaned.branch_id === "") {
    (cleaned as Record<string, unknown>).branch_id = null;
  }
  if ("assigned_from" in cleaned && cleaned.assigned_from === "") {
    (cleaned as Record<string, unknown>).assigned_from = null;
  }
  if ("assigned_to" in cleaned && cleaned.assigned_to === "") {
    (cleaned as Record<string, unknown>).assigned_to = null;
  }
  return cleaned;
}

export async function getTrainerAssignments(): Promise<TrainerAssignment[]> {
  const { data, error } = await supabase
    .from("trainer_assignments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[trainerAssignmentRepository] getTrainerAssignments:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getTrainerAssignment(
  id: string
): Promise<TrainerAssignment> {
  const { data, error } = await supabase
    .from("trainer_assignments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[trainerAssignmentRepository] getTrainerAssignment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createTrainerAssignment(
  assignment: TrainerAssignmentForm
): Promise<TrainerAssignment> {
  const { data, error } = await supabase
    .from("trainer_assignments")
    .insert(sanitize(assignment))
    .select()
    .single();

  if (error) {
    console.error("[trainerAssignmentRepository] createTrainerAssignment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateTrainerAssignment(
  id: string,
  assignment: Partial<TrainerAssignmentForm>
): Promise<TrainerAssignment> {
  const { data, error } = await supabase
    .from("trainer_assignments")
    .update(sanitize(assignment))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[trainerAssignmentRepository] updateTrainerAssignment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteTrainerAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from("trainer_assignments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[trainerAssignmentRepository] deleteTrainerAssignment:", error);
    throw new Error(error.message);
  }
}

export async function toggleIsActive(
  id: string,
  is_active: boolean
): Promise<TrainerAssignment> {
  const { data, error } = await supabase
    .from("trainer_assignments")
    .update({ is_active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[trainerAssignmentRepository] toggleIsActive:", error);
    throw new Error(error.message);
  }

  return data;
}