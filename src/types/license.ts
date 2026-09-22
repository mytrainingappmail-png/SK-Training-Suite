// src/types/license.ts
//
// License & Subscription — Phase 1 types.
// Tables: subscription_plans, company_licenses, discount_codes,
// license_notifications.

export interface SubscriptionPlan {
  id: string;
  plan_name: string;
  plan_code: string;
  description: string;
  max_employees: number;
  max_courses: number;
  max_storage_gb: number;
  max_certificates_per_month: number;
  price_monthly: number;
  /** Always derived (monthly x 12 x (1 - yearly_discount_pct/100)) — never write this directly, see yearly_discount_pct. */
  price_yearly: number;
  /** 0-100. The admin's only yearly input; price_yearly is computed from this, never typed in. */
  yearly_discount_pct: number;
  /** null = the plan does not offer 6-month billing. Otherwise 0-100, same computed relationship as yearly_discount_pct. */
  six_month_discount_pct: number | null;
  /** Always derived, null when six_month_discount_pct is null. */
  price_six_month: number | null;
  features: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type SubscriptionPlanForm = Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at' | 'price_yearly' | 'price_six_month'>;

/** Which app_modules a plan includes — see supabase/migrations/20260726410000_plan_modules.sql. Assigning this plan to a company (or changing an existing license's plan) applies this set as that company's module overrides. */
export interface PlanModule {
  plan_id: string;
  module_key: string;
  enabled: boolean;
}

export const defaultPlanForm: SubscriptionPlanForm = {
  plan_name: '',
  plan_code: '',
  description: '',
  max_employees: 10,
  max_courses: 5,
  max_storage_gb: 5,
  max_certificates_per_month: 10,
  price_monthly: 0,
  yearly_discount_pct: 0,
  six_month_discount_pct: null,
  features: '',
  active: true,
};

export const DEFAULT_PLANS: SubscriptionPlanForm[] = [
  { plan_name: 'Trial', plan_code: 'trial', description: '14-day free trial.', max_employees: 5, max_courses: 3, max_storage_gb: 1, max_certificates_per_month: 5, price_monthly: 0, yearly_discount_pct: 0, six_month_discount_pct: null, features: 'Basic course authoring,Up to 5 employees,Email support', active: true },
  { plan_name: 'Basic', plan_code: 'basic', description: 'For small teams getting started.', max_employees: 25, max_courses: 20, max_storage_gb: 10, max_certificates_per_month: 50, price_monthly: 2999, yearly_discount_pct: 17, six_month_discount_pct: 10, features: 'Course authoring,Assessments,Certificates,Email support', active: true },
  { plan_name: 'Professional', plan_code: 'professional', description: 'For growing organizations.', max_employees: 100, max_courses: 100, max_storage_gb: 50, max_certificates_per_month: 250, price_monthly: 9999, yearly_discount_pct: 20, six_month_discount_pct: 10, features: 'Everything in Basic,Learning Paths,Reports & Analytics,Priority support', active: true },
  { plan_name: 'Enterprise', plan_code: 'enterprise', description: 'For large enterprises with custom needs.', max_employees: 1000, max_courses: 1000, max_storage_gb: 500, max_certificates_per_month: 5000, price_monthly: 29999, yearly_discount_pct: 20, six_month_discount_pct: 10, features: 'Everything in Professional,Custom branding,Dedicated support,SLA', active: true },
];

export type LicenseStatus = 'active' | 'grace_period' | 'expired' | 'suspended';
export type BillingCycle = 'monthly' | 'six_month' | 'yearly';

/** Amount due for one cycle of a plan — the single place this is computed, so every screen (License Management, the public Pay page, WhatsApp payment links) agrees. Falls back to 6x monthly if a plan hasn't set a 6-month price. */
export function planAmountForCycle(plan: Pick<SubscriptionPlan, 'price_monthly' | 'price_yearly' | 'price_six_month'>, cycle: BillingCycle): number {
  if (cycle === 'yearly') return plan.price_yearly;
  if (cycle === 'six_month') return plan.price_six_month ?? plan.price_monthly * 6;
  return plan.price_monthly;
}

export interface CompanyLicense {
  id: string;
  company_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  billing_cycle: BillingCycle;
  status: LicenseStatus;
  grace_period_days: number;
  auto_renew: boolean;
  /** No payment expected for this license (e.g. an internal/demo company) — record-keeping only, matches no functional gate since issuance never required payment. */
  is_complimentary: boolean;
  created_at: string;
  updated_at: string;
}

export type CompanyLicenseForm = Omit<CompanyLicense, 'id' | 'created_at' | 'updated_at' | 'status'>;

export const defaultCompanyLicenseForm: CompanyLicenseForm = {
  company_id: '',
  plan_id: '',
  start_date: '',
  end_date: '',
  billing_cycle: 'monthly',
  grace_period_days: 7,
  auto_renew: false,
  is_complimentary: false,
};

export type DiscountType = 'percentage' | 'flat';

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  valid_from: string;
  valid_to: string;
  max_uses: number;
  times_used: number;
  applicable_plan_id: string | null;
  active: boolean;
  created_at: string;
}

export type DiscountCodeForm = Omit<DiscountCode, 'id' | 'created_at' | 'times_used'>;

export const defaultDiscountCodeForm: DiscountCodeForm = {
  code: '',
  discount_type: 'percentage',
  discount_value: 10,
  valid_from: '',
  valid_to: '',
  max_uses: 100,
  applicable_plan_id: null,
  active: true,
};

export type NotificationChannel = 'email' | 'whatsapp';
export type LicenseNotificationType =
  | 'expiry_7_days'
  | 'expiry_3_days'
  | 'expiry_today'
  | 'grace_period_started'
  | 'suspended';

export interface LicenseNotification {
  id: string;
  company_license_id: string;
  channel: NotificationChannel;
  notification_type: LicenseNotificationType;
  sent_at: string;
  created_at: string;
}

export type LicenseNotificationForm = Omit<LicenseNotification, 'id' | 'created_at'>;
