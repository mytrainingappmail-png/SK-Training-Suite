// supabase/functions/company-backup-weekly/index.ts
//
// Run by the pg_cron job "company-weekly-backup" (service-role bearer only). Makes a "weekly" backup of every active company
// that has not switched weekly backups off, keeps only the newest N per company (the company's own setting, default 8), and - if
// the company gave an email address and email is set up - sends a link to download it (valid for 7 days). Safe to run twice: a
// company that already has a weekly backup from the last 6 days is skipped.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { isServiceRoleRequest, jsonResponse, serviceClient } from "../_shared/auth.ts";
import { BUCKET, createBackup, signedLink } from "../_shared/companyBackup.ts";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

async function sendLink(to: string, company: string, url: string, sizeKb: number): Promise<string> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) return "email_not_configured";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;padding:20px">
    <h2 style="margin:0 0 8px;color:#0e1c3d">Your weekly backup is ready</h2>
    <p style="color:#374151;font-size:14px">The weekly backup of <b>${esc(company)}</b> was made automatically (${sizeKb.toLocaleString("en-IN")} KB). Keep this file somewhere safe, for example your Google Drive.</p>
    <p style="margin:20px 0"><a href="${esc(url)}" style="background:#fbbf24;color:#111827;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">Download the backup</a></p>
    <p style="color:#6b7280;font-size:12px">The link works for 7 days. The backup is also stored inside the app: Admin &rarr; Backup &amp; Restore.</p></div>`;
  const res = await fetch(`${Deno.env.get("RESEND_API_BASE") || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: `Weekly backup of ${company}`, html }),
  });
  return res.ok ? "sent" : `email_error: ${(await res.text()).slice(0, 120)}`;
}

serve(async (req) => {
  if (!isServiceRoleRequest(req)) return jsonResponse({ success: false, error: "Not allowed." }, 403);
  const admin = serviceClient();
  const report: Record<string, string> = {};

  const { data: companies } = await admin.from("companies").select("id, company_name, company_code").eq("active", true).is("offboarded_at", null);
  const { data: settingsRows } = await admin.from("company_backup_settings").select("*");
  const settings = new Map((settingsRows ?? []).map((s: Record<string, unknown>) => [s.company_id as string, s]));
  const since = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString();

  for (const c of (companies ?? []) as { id: string; company_name: string; company_code: string }[]) {
    const st = settings.get(c.id) as { weekly_enabled?: boolean; keep_count?: number; notify_email?: string } | undefined;
    if (st && st.weekly_enabled === false) { report[c.company_code] = "off"; continue; }
    try {
      const { count } = await admin.from("company_backups").select("id", { count: "exact", head: true }).eq("company_id", c.id).eq("kind", "weekly").gte("created_at", since);
      if ((count ?? 0) > 0) { report[c.company_code] = "already done this week"; continue; }
      const row = await createBackup(admin, c.id, "weekly", null);
      await admin.from("company_backup_settings").upsert({ company_id: c.id, last_weekly_at: row.created_at, updated_at: new Date().toISOString() }, { onConflict: "company_id" });

      // keep only the newest N weekly backups
      const keep = Math.min(52, Math.max(1, Number(st?.keep_count ?? 8)));
      const { data: weekly } = await admin.from("company_backups").select("id, file_path").eq("company_id", c.id).eq("kind", "weekly").order("created_at", { ascending: false });
      const old = (weekly ?? []).slice(keep) as { id: string; file_path: string }[];
      if (old.length > 0) {
        await admin.storage.from(BUCKET).remove(old.map((o) => o.file_path));
        await admin.from("company_backups").delete().in("id", old.map((o) => o.id));
      }

      let mail = "";
      const to = (st?.notify_email ?? "").trim();
      if (to) mail = ` · email ${await sendLink(to, c.company_name, await signedLink(admin, row.file_path, 7 * 24 * 3600), Math.round(row.size_bytes / 1024))}`;
      report[c.company_code] = `backed up (${Math.round(row.size_bytes / 1024)} KB)${mail}`;
    } catch (e) {
      console.error("[company-backup-weekly]", c.company_code, e);
      report[c.company_code] = `failed: ${e instanceof Error ? e.message : "error"}`;
    }
  }
  return jsonResponse({ success: true, report });
});
