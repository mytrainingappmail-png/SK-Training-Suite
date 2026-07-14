import { supabase } from "../../lib/supabase";
import type { TrainingBatch } from "../../types/trainingBatch";
import type { TrainingBatchForm } from "../../types/trainingBatch";

export async function getTrainingBatches(): Promise<TrainingBatch[]> {
  const { data, error } = await supabase
    .from("training_batches")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[trainingBatchRepository] getTrainingBatches:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getTrainingBatch(id: string): Promise<TrainingBatch> {
  const { data, error } = await supabase
    .from("training_batches")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[trainingBatchRepository] getTrainingBatch:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createTrainingBatch(
  batch: TrainingBatchForm
): Promise<TrainingBatch> {
  const { data, error } = await supabase
    .from("training_batches")
    .insert(batch)
    .select()
    .single();

  if (error) {
    console.error("[trainingBatchRepository] createTrainingBatch:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateTrainingBatch(
  id: string,
  batch: Partial<TrainingBatchForm>
): Promise<TrainingBatch> {
  const { data, error } = await supabase
    .from("training_batches")
    .update(batch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[trainingBatchRepository] updateTrainingBatch:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteTrainingBatch(id: string): Promise<void> {
  const { error } = await supabase
    .from("training_batches")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[trainingBatchRepository] deleteTrainingBatch:", error);
    throw new Error(error.message);
  }
}

export async function toggleIsActive(
  id: string,
  is_active: boolean
): Promise<TrainingBatch> {
  const { data, error } = await supabase
    .from("training_batches")
    .update({ is_active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[trainingBatchRepository] toggleIsActive:", error);
    throw new Error(error.message);
  }

  return data;
}
