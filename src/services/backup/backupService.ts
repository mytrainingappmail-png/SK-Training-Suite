// Client side of Backup & Restore (Admin). The heavy work happens on the server (company-backup function); this only asks for it.

import { supabase } from "../../lib/supabase";

export interface BackupRow {
  id: string;
  company_id: string;
  kind: "manual" | "weekly" | "before_restore";
  created_at: string;
  file_path: string;
  size_bytes: number;
  row_counts: Record<string, number>;
  note: string | null;
}

export interface BackupSettings {
  company_id: string;
  weekly_enabled: boolean;
  keep_count: number;
  notify_email: string | null;
  last_weekly_at: string | null;
}

export interface RestoreResult {
  tables: Record<string, { brought_back?: number; reset_to_backup?: number; failed?: number; skipped?: string }>;
  dropped_or_cleared_links: Record<string, number>;
  overwrite: boolean;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("company-backup", { body });
  if (error) {
    let message = "Something went wrong. Please try again.";
    const res = (error as { context?: Response }).context;
    if (res?.status === 504 || res?.status === 546 || res?.status === 408) message = "This is taking longer than expected. Please wait a minute, refresh the page and check the list.";
    else if (res?.status === 401) message = "Your sign-in has expired. Please refresh the page and sign in again.";
    try {
      const b = await res?.json();
      if (b?.error) message = b.error;
    } catch { /* keep the sentence above */ }
    throw new Error(message);
  }
  return data as T;
}

export async function listBackups(): Promise<BackupRow[]> {
  const { data, error } = await supabase.from("company_backups").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BackupRow[];
}

export async function loadBackupSettings(companyId: string): Promise<BackupSettings> {
  const { data, error } = await supabase.from("company_backup_settings").select("*").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BackupSettings | null) ?? { company_id: companyId, weekly_enabled: true, keep_count: 8, notify_email: null, last_weekly_at: null };
}

export async function saveBackupSettings(s: BackupSettings): Promise<void> {
  const { error } = await supabase.from("company_backup_settings").upsert({
    company_id: s.company_id, weekly_enabled: s.weekly_enabled, keep_count: s.keep_count,
    notify_email: s.notify_email?.trim() || null, updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" });
  if (error) throw new Error(error.message);
}

export async function createBackupNow(): Promise<{ backup: BackupRow; url: string }> {
  return call({ action: "create" });
}

export async function backupDownloadUrl(id: string): Promise<string> {
  return (await call<{ url: string }>({ action: "download", id })).url;
}

export async function deleteBackup(id: string): Promise<void> {
  await call({ action: "delete", id });
}

/** Puts a stored backup (id) or an uploaded file (uploadPath) back. */
export async function restoreBackup(opts: { id?: string; uploadPath?: string; overwrite: boolean }): Promise<{ result: RestoreResult; safety_backup_id: string }> {
  return call({ action: "restore", id: opts.id, upload_path: opts.uploadPath, overwrite: opts.overwrite });
}

/** Uploads a backup file from the admin's computer (kept private, deleted after the restore). */
export async function uploadBackupFile(companyId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const path = `${companyId}/uploads/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("company-backups").upload(path, file, { contentType: "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Starts the browser's download of a link. */
export function startDownload(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
