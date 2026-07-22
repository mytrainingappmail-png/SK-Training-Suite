// src/services/license/licenseNotificationService.ts
//
// Phase 3 — orchestration only. Decides WHO needs a warning and WHEN,
// using the real Phase 1 logic (computeLicenseStatus, daysUntilExpiry,
// getDueNotificationType) and the real license_notifications log to
// avoid duplicate sends. The actual sending is delegated to a Supabase
// Edge Function (send-license-notification) via supabase.functions.invoke —
// this file never talks to an email/WhatsApp provider directly.

import { supabase } from '../../lib/supabase';
import { loadCompanyLicenses, loadPlans, getDueNotificationType, loadLicenseNotifications, logLicenseNotification } from './licenseService';
import { loadCompanies } from '../company/companyService';
import type { NotificationChannel } from '../../types/license';

export interface NotificationRunResult {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Checks every company license and sends (via the Edge Function) any
 * due expiry warning that hasn't already been logged. Safe to call
 * repeatedly — already-sent warnings are never re-sent, thanks to
 * license_notifications acting as the source of truth.
 *
 * channels: which channels to attempt for each due warning. Email only
 * requires an email on the company/admin contact; WhatsApp requires a
 * mobile number — both are resolved from the real companies table.
 */
export async function runLicenseNotificationCheck(
  channels: NotificationChannel[] = ['email']
): Promise<NotificationRunResult> {
  const result: NotificationRunResult = { checked: 0, sent: 0, failed: 0, skipped: 0, errors: [] };

  const [licenses, plans, companies] = await Promise.all([loadCompanyLicenses(), loadPlans(), loadCompanies()]);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  for (const license of licenses) {
    result.checked += 1;

    const alreadySent = await loadLicenseNotifications(license.id);
    const alreadySentTypes = new Set(alreadySent.map((n) => n.notification_type));
    const dueType = getDueNotificationType(license.end_date, alreadySentTypes);

    if (!dueType) {
      result.skipped += 1;
      continue;
    }

    const company = companyById.get(license.company_id);
    const plan = planById.get(license.plan_id);

    for (const channel of channels) {
      try {
        const { error } = await supabase.functions.invoke('send-license-notification', {
          body: {
            channel,
            notificationType: dueType,
            companyName: company?.company_name ?? 'Your organization',
            companyEmail: company?.email ?? '',
            companyMobile: company?.phone ?? '',
            planName: plan?.plan_name ?? '',
            endDate: license.end_date,
            gracePeriodDays: license.grace_period_days,
          },
        });
        if (error) throw new Error(error.message);

        await logLicenseNotification({
          company_license_id: license.id,
          channel,
          notification_type: dueType,
          sent_at: new Date().toISOString(),
        });
        result.sent += 1;
      } catch (err) {
        result.failed += 1;
        result.errors.push(`${company?.company_name ?? license.company_id} (${channel}): ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }

  return result;
}
