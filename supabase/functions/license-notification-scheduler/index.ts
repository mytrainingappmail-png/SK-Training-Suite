// supabase/functions/license-notification-scheduler/index.ts
//
// The "second small scheduler function" send-license-notification/index.ts's
// own header comment asked for — this is what a pg_cron job actually calls.
// It server-side replicates src/services/license/licenseNotificationService.ts's
// runLicenseNotificationCheck() (same due-date math, same dedup against
// license_notifications) and, for every due warning, calls the existing
// send-license-notification function to actually deliver it. Safe to run
// repeatedly — license_notifications is the source of truth that stops a
// warning from ever being sent twice.
//
// Deploy: supabase functions deploy license-notification-scheduler
// Invoked by: the pg_cron job created in
//   supabase/migrations/20260915160000_license_notification_cron.sql

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function daysUntilExpiry(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

type DueType = "expiry_7_days" | "expiry_3_days" | "expiry_today";

function getDueNotificationType(endDate: string, alreadySentTypes: Set<string>): DueType | null {
  const days = daysUntilExpiry(endDate);
  if (days === 7 && !alreadySentTypes.has("expiry_7_days")) return "expiry_7_days";
  if (days === 3 && !alreadySentTypes.has("expiry_3_days")) return "expiry_3_days";
  if (days === 0 && !alreadySentTypes.has("expiry_today")) return "expiry_today";
  return null;
}

serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const result = { checked: 0, sent: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    const [{ data: licenses, error: licErr }, { data: companies, error: coErr }, { data: plans, error: planErr }] =
      await Promise.all([
        supabase.from("company_licenses").select("id, company_id, plan_id, end_date, grace_period_days, status"),
        supabase.from("companies").select("id, company_name, email, phone"),
        supabase.from("subscription_plans").select("id, plan_name"),
      ]);
    if (licErr) throw licErr;
    if (coErr) throw coErr;
    if (planErr) throw planErr;

    const companyById = new Map((companies ?? []).map((c) => [c.id, c]));
    const planById = new Map((plans ?? []).map((p) => [p.id, p]));

    for (const license of licenses ?? []) {
      result.checked += 1;
      if (license.status === "suspended") {
        result.skipped += 1;
        continue;
      }

      const { data: alreadySent, error: sentErr } = await supabase
        .from("license_notifications")
        .select("notification_type")
        .eq("company_license_id", license.id);
      if (sentErr) throw sentErr;

      const dueType = getDueNotificationType(license.end_date, new Set((alreadySent ?? []).map((n) => n.notification_type)));
      if (!dueType) {
        result.skipped += 1;
        continue;
      }

      const company = companyById.get(license.company_id);
      const plan = planById.get(license.plan_id);

      try {
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-license-notification`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "email",
            notificationType: dueType,
            companyName: company?.company_name ?? "Your organization",
            companyEmail: company?.email ?? "",
            companyMobile: company?.phone ?? "",
            planName: plan?.plan_name ?? "",
            endDate: license.end_date,
            gracePeriodDays: license.grace_period_days,
          }),
        });
        const sendBody = await sendRes.json();
        if (!sendRes.ok || !sendBody.success) throw new Error(sendBody.error ?? `HTTP ${sendRes.status}`);

        const { error: logErr } = await supabase.from("license_notifications").insert({
          company_license_id: license.id,
          channel: "email",
          notification_type: dueType,
          sent_at: new Date().toISOString(),
        });
        if (logErr) throw logErr;

        result.sent += 1;
      } catch (err) {
        result.failed += 1;
        result.errors.push(`${company?.company_name ?? license.company_id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" }, status: 200 });
  } catch (err) {
    return new Response(
      JSON.stringify({ ...result, success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
