// Real file upload for quiz branding images (logo, login background, login
// banner) — stored in the public "quiz-branding" Storage bucket, one folder
// per company. Quiz admins are real Supabase Auth users (unlike LMS
// employees), so this can upload directly from the browser under RLS —
// no edge function / service-role proxy needed, unlike the LMS's
// upload-course-content function.

import { supabaseQuiz } from "../../lib/supabaseQuiz";

const BUCKET = "quiz-branding";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

export type BrandingImageKind = "logo" | "login-background" | "login-banner" | "favicon" | "signatory-1" | "signatory-2" | "cert-logo" | "candidate-photo" | "question-image" | "cert-watermark-image" | "screen-background";

export interface UploadedBrandingImage {
  url: string;
  path: string;
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] || "png";
}

export async function uploadBrandingImage(
  companyId: string,
  kind: BrandingImageKind,
  file: File
): Promise<UploadedBrandingImage> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Please upload a PNG, JPEG, WEBP, GIF, SVG or ICO image.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("Image must be under 5 MB.");
  }

  const path = `${companyId}/${kind}-${Date.now()}.${extensionFor(file)}`;

  const { error } = await supabaseQuiz.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    console.error("[quizBrandingUploadRepository] uploadBrandingImage:", error);
    throw new Error(error.message);
  }

  const { data } = supabaseQuiz.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// -- Own music for the wait music / champions music: an audio file picked from the phone or computer ----------------
// Goes to the same public bucket (trainees must be able to play it without logging in), in the company's own folder.
const MAX_MUSIC_BYTES = 15 * 1024 * 1024;
const MUSIC_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "weba", "webm", "flac"];
const MUSIC_TYPE_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg",
  opus: "audio/ogg", weba: "audio/webm", webm: "audio/webm", flac: "audio/flac",
};

export async function uploadQuizMusic(companyId: string, file: File): Promise<UploadedBrandingImage & { name: string }> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  // some phones give an empty type for a music file, so the file name is checked too
  if (!file.type.startsWith("audio/") && !MUSIC_EXTENSIONS.includes(ext)) {
    throw new Error("Please choose a music file (mp3, m4a, wav, ogg).");
  }
  if (file.size > MAX_MUSIC_BYTES) {
    throw new Error("The music file must be under 15 MB. Use a shorter or smaller mp3.");
  }
  const safeExt = MUSIC_EXTENSIONS.includes(ext) ? ext : "mp3";
  const path = `${companyId}/music-${Date.now()}.${safeExt}`;
  const contentType = file.type.startsWith("audio/") ? file.type : MUSIC_TYPE_BY_EXT[safeExt];

  const { error } = await supabaseQuiz.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType });
  if (error) {
    console.error("[quizBrandingUploadRepository] uploadQuizMusic:", error);
    throw new Error(error.message);
  }
  const { data } = supabaseQuiz.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, name: file.name };
}
