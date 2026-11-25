// supabase/functions/company-backup/index.ts
//
// The Backup & Restore screen's server side (company administrators only):
//   create   -> make a backup now (kind "manual") and return a download link
//   download -> a fresh download link for a stored backup
//   delete   -> remove a stored backup
//   restore  -> put a stored backup (or one the admin uploaded from their computer) back. A safety backup of the current data is
//               made first. Safe by default: only what is missing comes back; overwrite=true also resets edited items.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { corsHeaders, HttpError, jsonResponse, rateLimit, requireEmployeeCaller, serviceClient } from "../_shared/auth.ts";
import { BUCKET, createBackup, readBackupFile, signedLink } from "../_shared/companyBackup.ts";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = serviceClient();
    const caller = await requireEmployeeCaller(req, admin);

    const { data: roleRows } = await admin
      .from("employee_roles").select("active, roles!inner(role_code, company_id)").eq("employee_id", caller.employeeId).eq("active", true);
    const isAdmin = (roleRows ?? []).some((row: Record<string, unknown>) => {
      const role = row.roles as { role_code?: string; company_id?: string } | { role_code?: string; company_id?: string }[] | null;
      const r = Array.isArray(role) ? role[0] : role;
      return r?.company_id === caller.companyId && ADMIN_ROLES.includes(r?.role_code ?? "");
    });
    if (!isAdmin) throw new HttpError(403, "Only company administrators can use backups.");

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "create") {
      await rateLimit(admin, `backup-create:${caller.employeeId}`, 5, 3600);
      const row = await createBackup(admin, caller.companyId, "manual", caller.employeeId);
      return jsonResponse({ backup: row, url: await signedLink(admin, row.file_path) });
    }

    // the other actions work on one stored backup of THIS company
    const owned = async (id: string) => {
      const { data } = await admin.from("company_backups").select("*").eq("id", id).eq("company_id", caller.companyId).maybeSingle();
      if (!data) throw new HttpError(404, "That backup was not found.");
      return data as { id: string; file_path: string };
    };

    if (action === "download") {
      const row = await owned(String(body?.id ?? ""));
      return jsonResponse({ url: await signedLink(admin, row.file_path) });
    }

    if (action === "delete") {
      const row = await owned(String(body?.id ?? ""));
      await admin.storage.from(BUCKET).remove([row.file_path]);
      await admin.from("company_backups").delete().eq("id", row.id);
      return jsonResponse({ ok: true });
    }

    if (action === "restore") {
      await rateLimit(admin, `backup-restore:${caller.employeeId}`, 5, 3600);
      let path = "";
      if (body?.id) path = (await owned(String(body.id))).file_path;
      else if (typeof body?.upload_path === "string" && body.upload_path.startsWith(`${caller.companyId}/uploads/`) && !body.upload_path.includes("..")) path = body.upload_path;
      else throw new HttpError(400, "Choose a backup to restore.");

      const tables = await readBackupFile(admin, path, caller.companyId);
      // a safety copy of what is there right now, so a restore can itself be undone
      const safety = await createBackup(admin, caller.companyId, "before_restore", caller.employeeId, "Made automatically just before a restore");
      const { data, error } = await admin.rpc("restore_company_data", { p_company: caller.companyId, p_tables: tables, p_overwrite: body?.overwrite === true });
      if (error) throw new HttpError(500, `The restore did not finish: ${error.message}`);
      if (path.includes("/uploads/")) await admin.storage.from(BUCKET).remove([path]);
      return jsonResponse({ result: data, safety_backup_id: safety.id });
    }

    throw new HttpError(400, "Unknown action.");
  } catch (e) {
    if (e instanceof HttpError) return jsonResponse({ error: e.message }, e.status);
    console.error("[company-backup]", e);
    return jsonResponse({ error: "Something went wrong. Please try again." }, 500);
  }
});
