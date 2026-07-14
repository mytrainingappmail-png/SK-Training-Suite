import { supabase } from "../../lib/supabase";
import type { TrainerAssignment } from "../../types/trainerAssignment";
import type { TrainerAssignmentForm } from "../../types/trainerAssignment";

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
    .insert(assignment)
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
    .update(assignment)
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
