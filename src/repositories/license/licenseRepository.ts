// src/repositories/license/licenseRepository.ts
//
// Repository layer — Supabase ONLY, zero business logic. Reuses the
// existing shared Supabase client. Tables: subscription_plans,
// company_licenses, discount_codes, license_notifications.

import { supabase } from '../../lib/supabase';
import type {
  SubscriptionPlan, SubscriptionPlanForm,
  CompanyLicense, CompanyLicenseForm, LicenseStatus,
  DiscountCode, DiscountCodeForm,
  LicenseNotification, LicenseNotificationForm,
} from '../../types/license';

// ── Subscription Plans ──────────────────────────────────────────────────────

export async function getPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase.from('subscription_plans').select('*').order('price_monthly', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPlan(form: SubscriptionPlanForm): Promise<SubscriptionPlan> {
  const { data, error } = await supabase.from('subscription_plans').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  return { id: '', created_at: '', updated_at: '', ...form };
}

export async function updatePlan(id: string, form: Partial<SubscriptionPlanForm>): Promise<SubscriptionPlan> {
  const { data, error } = await supabase.from('subscription_plans').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  throw new Error('Plan not found after update.');
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Company Licenses ────────────────────────────────────────────────────────

export async function getCompanyLicenses(): Promise<CompanyLicense[]> {
  const { data, error } = await supabase.from('company_licenses').select('*').order('end_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCompanyLicense(form: CompanyLicenseForm & { status: LicenseStatus }): Promise<CompanyLicense> {
  const { data, error } = await supabase.from('company_licenses').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  return { id: '', created_at: '', updated_at: '', ...form };
}

export async function updateCompanyLicense(id: string, form: Partial<CompanyLicenseForm> & { status?: LicenseStatus }): Promise<CompanyLicense> {
  const { data, error } = await supabase.from('company_licenses').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  throw new Error('License not found after update.');
}

export async function deleteCompanyLicense(id: string): Promise<void> {
  const { error } = await supabase.from('company_licenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Discount Codes ───────────────────────────────────────────────────────────

export async function getDiscountCodes(): Promise<DiscountCode[]> {
  const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDiscountCode(form: DiscountCodeForm): Promise<DiscountCode> {
  const { data, error } = await supabase.from('discount_codes').insert({ ...form, times_used: 0 }).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  return { id: '', times_used: 0, created_at: '', ...form };
}

export async function updateDiscountCode(id: string, form: Partial<DiscountCodeForm> & { times_used?: number }): Promise<DiscountCode> {
  const { data, error } = await supabase.from('discount_codes').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  throw new Error('Discount code not found after update.');
}

export async function deleteDiscountCode(id: string): Promise<void> {
  const { error } = await supabase.from('discount_codes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── License Notifications (sent-log, prevents duplicate warnings) ───────────

export async function getLicenseNotifications(companyLicenseId: string): Promise<LicenseNotification[]> {
  const { data, error } = await supabase.from('license_notifications').select('*').eq('company_license_id', companyLicenseId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function recordLicenseNotification(form: LicenseNotificationForm): Promise<LicenseNotification> {
  const { data, error } = await supabase.from('license_notifications').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  return { id: '', created_at: '', ...form };
}
