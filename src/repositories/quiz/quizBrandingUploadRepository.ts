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

export type BrandingImageKind = "logo" | "login-background" | "login-banner" | "favicon" | "signatory-1" | "signatory-2" | "cert-logo" | "candidate-photo";

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

/** Best-effort — only cleans up files this app itself uploaded (path starts with the bucket's public URL); a plain pasted external URL is left alone. */
export async function deleteBrandingImageIfOwned(url: string | null): Promise<void> {
  if (!url) return;
  const { data } = supabaseQuiz.storage.from(BUCKET).getPublicUrl("");
  const prefix = data.publicUrl;
  if (!url.startsWith(prefix)) return;

  const path = url.slice(prefix.length).replace(/^\/+/, "");
  const { error } = await supabaseQuiz.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("[quizBrandingUploadRepository] deleteBrandingImageIfOwned:", error);
  }
}
