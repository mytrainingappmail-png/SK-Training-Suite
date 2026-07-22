// src/services/license/licenseService.ts
//
// Service layer — business logic, validation, orchestration. Delegates
// all Supabase access to licenseRepository.ts. Real usage numbers are
// computed from existing, unmodified services (employeeService,
// courseService) — never mocked.

import {
  getPlans, createPlan, updatePlan, deletePlan,
  getCompanyLicenses, createCompanyLicense, updateCompanyLicense, deleteCompanyLicense,
  getDiscountCodes, createDiscountCode, updateDiscountCode, deleteDiscountCode,
  getLicenseNotifications, recordLicenseNotification,
} from '../../repositories/license/licenseRepository';

import { employeeService } from '../employee/employeeService';
import { loadCourses } from '../course/courseService';

import type {
  SubscriptionPlan, SubscriptionPlanForm,
  CompanyLicense, CompanyLicenseForm, LicenseStatus,
  DiscountCode, DiscountCodeForm,
  LicenseNotification, LicenseNotificationForm,
} from '../../types/license';
import { DEFAULT_PLANS } from '../../types/license';

// ── Subscription Plans ───────────────────────────────────────────────────────

export async function loadPlans(): Promise<SubscriptionPlan[]> {
  return getPlans();
}

function validatePlanForm(form: SubscriptionPlanForm): void {
  if (!form.plan_name.trim()) throw new Error('Plan name is required.');
  if (!form.plan_code.trim()) throw new Error('Plan code is required.');
  if (form.max_employees < 1) throw new Error('Max employees must be at least 1.');
  if (form.max_courses < 1) throw new Error('Max courses must be at least 1.');
  if (form.price_monthly < 0 || form.price_yearly < 0) throw new Error('Price cannot be negative.');
}

export async function saveNewPlan(form: SubscriptionPlanForm): Promise<SubscriptionPlan> {
  validatePlanForm(form);
  return createPlan(form);
}

export async function savePlan(id: string, form: Partial<SubscriptionPlanForm>): Promise<SubscriptionPlan> {
  if (!id) throw new Error('Invalid plan id.');
  return updatePlan(id, form);
}

export async function removePlan(id: string): Promise<void> {
  await deletePlan(id);
}

export async function seedDefaultPlans(existingPlans: SubscriptionPlan[]): Promise<SubscriptionPlan[]> {
  const existingCodes = new Set(existingPlans.map((p) => p.plan_code));
  const missing = DEFAULT_PLANS.filter((p) => !existingCodes.has(p.plan_code));
  const created: SubscriptionPlan[] = [];
  for (const form of missing) {
    created.push(await createPlan(form));
  }
  return created;
}

// ── Status computation (real dates, no mock) ─────────────────────────────────

export function computeLicenseStatus(endDate: string, gracePeriodDays: number): LicenseStatus {
  const end = new Date(endDate);
  const graceEnd = new Date(end);
  graceEnd.setDate(graceEnd.getDate() + gracePeriodDays);
  const now = new Date();

  if (now <= end) return 'active';
  if (now <= graceEnd) return 'grace_period';
  return 'expired';
}

export function daysUntilExpiry(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ── Company Licenses ─────────────────────────────────────────────────────────

export async function loadCompanyLicenses(): Promise<CompanyLicense[]> {
  const rows = await getCompanyLicenses();
  // Refresh computed status on every load — never trust a stale stored
  // status, since "active" today can be "expired" tomorrow with zero
  // user action.
  return rows.map((row) => ({
    ...row,
    status: row.status === 'suspended' ? 'suspended' : computeLicenseStatus(row.end_date, row.grace_period_days),
  }));
}

function validateCompanyLicenseForm(form: CompanyLicenseForm): void {
  if (!form.company_id) throw new Error('Company is required.');
  if (!form.plan_id) throw new Error('Plan is required.');
  if (!form.start_date) throw new Error('Start date is required.');
  if (!form.end_date) throw new Error('End date is required.');
  if (new Date(form.end_date) <= new Date(form.start_date)) {
    throw new Error('End date must be after the start date.');
  }
  if (form.grace_period_days < 0) throw new Error('Grace period cannot be negative.');
}

export async function saveNewCompanyLicense(form: CompanyLicenseForm): Promise<CompanyLicense> {
  validateCompanyLicenseForm(form);
  const status = computeLicenseStatus(form.end_date, form.grace_period_days);
  return createCompanyLicense({ ...form, status });
}

export async function saveCompanyLicense(id: string, form: Partial<CompanyLicenseForm>): Promise<CompanyLicense> {
  if (!id) throw new Error('Invalid license id.');
  return updateCompanyLicense(id, form);
}

export async function suspendCompanyLicense(id: string): Promise<CompanyLicense> {
  if (!id) throw new Error('Invalid license id.');
  return updateCompanyLicense(id, { status: 'suspended' });
}

export async function reactivateCompanyLicense(id: string, license: CompanyLicense): Promise<CompanyLicense> {
  if (!id) throw new Error('Invalid license id.');
  const status = computeLicenseStatus(license.end_date, license.grace_period_days);
  return updateCompanyLicense(id, { status });
}

export async function removeCompanyLicense(id: string): Promise<void> {
  await deleteCompanyLicense(id);
}

// ── Real usage (never mocked — derived from existing services) ──────────────

export interface LicenseUsage {
  employeeCount: number;
  courseCount: number;
}

export async function loadUsageForCompany(companyId: string): Promise<LicenseUsage> {
  const [employees, courses] = await Promise.all([employeeService.getAll(), loadCourses()]);
  return {
    employeeCount: employees.filter((e) => e.company_id === companyId).length,
    courseCount: courses.filter((c) => c.company_id === companyId).length,
  };
}

// ── Discount Codes ───────────────────────────────────────────────────────────

export async function loadDiscountCodes(): Promise<DiscountCode[]> {
  return getDiscountCodes();
}

function validateDiscountCodeForm(form: DiscountCodeForm): void {
  if (!form.code.trim()) throw new Error('Code is required.');
  if (form.discount_type === 'percentage' && (form.discount_value <= 0 || form.discount_value > 100)) {
    throw new Error('Percentage discount must be between 1 and 100.');
  }
  if (form.discount_type === 'flat' && form.discount_value <= 0) {
    throw new Error('Flat discount amount must be greater than 0.');
  }
  if (!form.valid_from || !form.valid_to) throw new Error('Valid From and Valid To dates are required.');
  if (new Date(form.valid_to) <= new Date(form.valid_from)) {
    throw new Error('Valid To must be after Valid From.');
  }
  if (form.max_uses < 1) throw new Error('Max uses must be at least 1.');
}

export async function saveNewDiscountCode(form: DiscountCodeForm): Promise<DiscountCode> {
  validateDiscountCodeForm(form);
  return createDiscountCode({ ...form, code: form.code.trim().toUpperCase() });
}

export async function saveDiscountCode(id: string, form: Partial<DiscountCodeForm>): Promise<DiscountCode> {
  if (!id) throw new Error('Invalid discount code id.');
  return updateDiscountCode(id, form);
}

export async function removeDiscountCode(id: string): Promise<void> {
  await deleteDiscountCode(id);
}

export interface DiscountValidationResult {
  valid: boolean;
  reason?: string;
  discountedPrice?: number;
}

export function validateDiscountCode(code: DiscountCode, planId: string, originalPrice: number): DiscountValidationResult {
  if (!code.active) return { valid: false, reason: 'This code is no longer active.' };
  const now = new Date();
  if (now < new Date(code.valid_from)) return { valid: false, reason: 'This code is not active yet.' };
  if (now > new Date(code.valid_to)) return { valid: false, reason: 'This code has expired.' };
  if (code.times_used >= code.max_uses) return { valid: false, reason: 'This code has reached its usage limit.' };
  if (code.applicable_plan_id && code.applicable_plan_id !== planId) {
    return { valid: false, reason: 'This code does not apply to the selected plan.' };
  }
  const discountedPrice =
    code.discount_type === 'percentage'
      ? Math.max(0, originalPrice - (originalPrice * code.discount_value) / 100)
      : Math.max(0, originalPrice - code.discount_value);
  return { valid: true, discountedPrice };
}

export async function redeemDiscountCode(code: DiscountCode): Promise<DiscountCode> {
  return updateDiscountCode(code.id, { times_used: code.times_used + 1 });
}

// ── License Notifications ────────────────────────────────────────────────────

export async function loadLicenseNotifications(companyLicenseId: string): Promise<LicenseNotification[]> {
  return getLicenseNotifications(companyLicenseId);
}

export async function logLicenseNotification(form: LicenseNotificationForm): Promise<LicenseNotification> {
  return recordLicenseNotification(form);
}

/**
 * Determines which (if any) warning should fire today for a given
 * license, based on days-until-expiry, without duplicating a warning
 * already logged in license_notifications.
 */
export function getDueNotificationType(
  endDate: string,
  alreadySentTypes: Set<string>
): 'expiry_7_days' | 'expiry_3_days' | 'expiry_today' | null {
  const days = daysUntilExpiry(endDate);
  if (days === 7 && !alreadySentTypes.has('expiry_7_days')) return 'expiry_7_days';
  if (days === 3 && !alreadySentTypes.has('expiry_3_days')) return 'expiry_3_days';
  if (days === 0 && !alreadySentTypes.has('expiry_today')) return 'expiry_today';
  return null;
}
