import { supabase } from "./supabase";

const BUCKET = "course-content";

/**
 * Uploads a file into the shared "course-content" storage bucket (the same
 * one Real Estate Projects/Video Library/Course thumbnails already use —
 * no new bucket or RLS policy needed) and returns its public URL.
 *
 * `folder` groups uploads by feature (e.g. "learning-paths",
 * "certificate-templates"); `id` is the owning record's id, or "new"
 * before it's been saved for the first time.
 */
export async function uploadToCourseContent(file: File, folder: string, id: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${id}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) {
    console.error("[mediaUpload] uploadToCourseContent:", error);
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
