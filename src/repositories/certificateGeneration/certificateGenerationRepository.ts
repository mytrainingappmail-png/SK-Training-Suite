import { supabase } from "../../lib/supabase";
import type {
  CertificateGenerationQueueItem,
  CertificateGenerationQueueForm,
  GenerationStatus,
} from "../../types/certificateGeneration";

export async function getQueue(): Promise<CertificateGenerationQueueItem[]> {
  const { data, error } = await supabase
    .from("certificate_generation_queue")
    .select("*")
    .order("priority", { ascending: true })
    .order("requested_at", { ascending: true });

  if (error) {
    console.error("[certificateGenerationRepository] getQueue:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getQueueItem(
  id: string
): Promise<CertificateGenerationQueueItem> {
  const { data, error } = await supabase
    .from("certificate_generation_queue")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[certificateGenerationRepository] getQueueItem:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createQueueItem(
  item: CertificateGenerationQueueForm
): Promise<CertificateGenerationQueueItem> {
  const { data, error } = await supabase
    .from("certificate_generation_queue")
    .insert(item)
    .select()
    .single();

  if (error) {
    console.error("[certificateGenerationRepository] createQueueItem:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateQueueItem(
  id: string,
  item: Partial<CertificateGenerationQueueForm>
): Promise<CertificateGenerationQueueItem> {
  const { data, error } = await supabase
    .from("certificate_generation_queue")
    .update(item)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateGenerationRepository] updateQueueItem:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteQueueItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("certificate_generation_queue")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[certificateGenerationRepository] deleteQueueItem:", error);
    throw new Error(error.message);
  }
}

export async function updateStatus(
  id: string,
  status: GenerationStatus
): Promise<CertificateGenerationQueueItem> {
  const now = new Date().toISOString();

  const patch: Partial<CertificateGenerationQueueForm> = { status };

  if (status === "processing") patch.started_at  = now;
  if (status === "completed")  patch.completed_at = now;

  const { data, error } = await supabase
    .from("certificate_generation_queue")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateGenerationRepository] updateStatus:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function retryGeneration(
  id: string
): Promise<CertificateGenerationQueueItem> {
  // Fetch current retry_count then increment and reset to pending
  const { data: current, error: fetchError } = await supabase
    .from("certificate_generation_queue")
    .select("retry_count")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error("[certificateGenerationRepository] retryGeneration (fetch):", fetchError);
    throw new Error(fetchError.message);
  }

  const { data, error } = await supabase
    .from("certificate_generation_queue")
    .update({
      status:        "pending",
      retry_count:   (current.retry_count ?? 0) + 1,
      error_message: "",
      started_at:    null,
      completed_at:  null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[certificateGenerationRepository] retryGeneration:", error);
    throw new Error(error.message);
  }

  return data;
}
