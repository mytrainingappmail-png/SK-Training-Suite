// Shared pieces of the company backup: make a backup file (gzipped JSON, signed so only files this system made can be restored),
// store it in the private "company-backups" bucket, keep a row about it, and read one back for a restore.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HttpError } from "./auth.ts";

export const BUCKET = "company-backups";
export type BackupKind = "manual" | "weekly" | "before_restore";

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

async function hmacHex(text: string): Promise<string> {
  const secret = Deno.env.get("BACKUP_SIGNING_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secret) throw new HttpError(500, "Backups are not set up on the server yet.");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipIfNeeded(bytes: Uint8Array): Promise<string> {
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  return new TextDecoder().decode(bytes);
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");

export interface BackupRow {
  id: string; company_id: string; kind: BackupKind; created_at: string; created_by: string | null;
  file_path: string; size_bytes: number; row_counts: Record<string, number>; note: string | null;
}

/** Makes a backup of the company's data, stores it and records it. */
export async function createBackup(admin: SupabaseClient, companyId: string, kind: BackupKind, createdBy: string | null, note: string | null = null): Promise<BackupRow> {
  const { data, error } = await admin.rpc("backup_company_data", { p_company: companyId });
  if (error || !data) throw new HttpError(500, `The backup could not be made: ${error?.message ?? "no data"}`);
  const tables = (data as Record<string, unknown>).tables as Record<string, unknown>;
  const meta = {
    format: "company-backup", version: 1, kind, company_id: companyId,
    company_code: (data as Record<string, unknown>).company_code, created_at: (data as Record<string, unknown>).created_at,
    row_counts: (data as Record<string, unknown>).row_counts,
  };
  const sig = await hmacHex(`${companyId}|${meta.created_at}|${await sha256Hex(JSON.stringify(tables))}`);
  const bytes = await gzip(JSON.stringify({ meta, tables, sig }));
  const path = `${companyId}/${stamp()}-${kind}.json.gz`;
  const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "application/gzip", upsert: false });
  if (up.error) throw new HttpError(500, `The backup file could not be saved: ${up.error.message}`);
  const { data: row, error: rowError } = await admin.from("company_backups")
    .insert({ company_id: companyId, kind, created_by: createdBy, file_path: path, size_bytes: bytes.length, row_counts: meta.row_counts ?? {}, note })
    .select("*").single();
  if (rowError || !row) {
    await admin.storage.from(BUCKET).remove([path]);
    throw new HttpError(500, `The backup was made but could not be recorded: ${rowError?.message ?? ""}`);
  }
  return row as BackupRow;
}

/** A link that downloads the backup file (valid for `seconds`). */
export async function signedLink(admin: SupabaseClient, path: string, seconds = 600): Promise<string> {
  const name = path.split("/").pop() ?? "backup.json.gz";
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, seconds, { download: name });
  if (error || !data?.signedUrl) throw new HttpError(500, "Could not make the download link.");
  return data.signedUrl;
}

/** Reads a stored / uploaded backup file and checks it is one this system made, for this company. Returns its tables. */
export async function readBackupFile(admin: SupabaseClient, path: string, companyId: string): Promise<Record<string, unknown>> {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) throw new HttpError(404, "That backup file could not be found.");
  let parsed: { meta?: Record<string, unknown>; tables?: Record<string, unknown>; sig?: string };
  try { parsed = JSON.parse(await gunzipIfNeeded(new Uint8Array(await data.arrayBuffer()))); }
  catch { throw new HttpError(400, "That file is not a readable backup."); }
  const meta = parsed.meta;
  if (!meta || meta.format !== "company-backup" || !parsed.tables || !parsed.sig) throw new HttpError(400, "That file is not a backup made by this app.");
  if (meta.company_id !== companyId) throw new HttpError(403, "That backup belongs to a different company.");
  const expected = await hmacHex(`${companyId}|${meta.created_at}|${await sha256Hex(JSON.stringify(parsed.tables))}`);
  if (expected !== parsed.sig) throw new HttpError(400, "That backup file was changed after it was made, so it cannot be restored.");
  return parsed.tables;
}
