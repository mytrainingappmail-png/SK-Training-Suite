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
  price_yearly: number;
  features: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type SubscriptionPlanForm = Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>;

export const defaultPlanForm: SubscriptionPlanForm = {
  plan_name: '',
  plan_code: '',
  description: '',
  max_employees: 10,
  max_courses: 5,
  max_storage_gb: 5,
  max_certificates_per_month: 10,
  price_monthly: 0,
  price_yearly: 0,
  features: '',
  active: true,
};

export const DEFAULT_PLANS: SubscriptionPlanForm[] = [
  { plan_name: 'Trial', plan_code: 'trial', description: '14-day free trial.', max_employees: 5, max_courses: 3, max_storage_gb: 1, max_certificates_per_month: 5, price_monthly: 0, price_yearly: 0, features: 'Basic course authoring,Up to 5 employees,Email support', active: true },
  { plan_name: 'Basic', plan_code: 'basic', description: 'For small teams getting started.', max_employees: 25, max_courses: 20, max_storage_gb: 10, max_certificates_per_month: 50, price_monthly: 2999, price_yearly: 29999, features: 'Course authoring,Assessments,Certificates,Email support', active: true },
  { plan_name: 'Professional', plan_code: 'professional', description: 'For growing organizations.', max_employees: 100, max_courses: 100, max_storage_gb: 50, max_certificates_per_month: 250, price_monthly: 9999, price_yearly: 99999, features: 'Everything in Basic,Learning Paths,Reports & Analytics,Priority support', active: true },
  { plan_name: 'Enterprise', plan_code: 'enterprise', description: 'For large enterprises with custom needs.', max_employees: 1000, max_courses: 1000, max_storage_gb: 500, max_certificates_per_month: 5000, price_monthly: 29999, price_yearly: 299999, features: 'Everything in Professional,Custom branding,Dedicated support,SLA', active: true },
];

export type LicenseStatus = 'active' | 'grace_period' | 'expired' | 'suspended';
export type BillingCycle = 'monthly' | 'yearly';

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
