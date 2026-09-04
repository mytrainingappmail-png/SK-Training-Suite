// src/services/company/companyOnboardingService.ts
//
// One-shot "new client" onboarding — everything a brand-new company
// needs before anyone can log in and use it: the Company row itself,
// a first Branch/Department/Designation, a Super Admin role with every
// permission and every menu granted, the first employee (with a real
// Supabase Auth login, not the legacy plaintext path), and optionally
// an immediate License. Previously this was a manual, developer-only
// sequence of direct database inserts (see the Realty Smartz migration)
// — this is that same sequence, done for real through the app.

import { supabase } from "../../lib/supabase";
import { createCompany } from "../../repositories/company/companyRepository";
import { createBranch } from "../../repositories/branch/branchRepository";
import { createDepartment } from "../../repositories/department/departmentRepository";
import { createDesignation } from "../../repositories/designation/designationRepository";
import { createRole } from "../../repositories/role/roleRepository";
import { createEmployee } from "../../repositories/employee/employeeRepository";
import { createEmployeeRole } from "../../repositories/employeeRole/employeeRoleRepository";
import { getPermissions, assignAllPermissionsToRole } from "../../repositories/permission/permissionRepository";
import { getMenus } from "../../repositories/menu/menuRepository";
import { replaceMenus } from "../../repositories/menuPermission/menuPermissionRepository";
import { saveNewCompanyLicense } from "../license/licenseService";

import type { Company } from "../../types/company";
import type { Employee, EmployeeForm } from "../../types/employee";
import type { CompanyLicenseForm } from "../../types/license";

export interface CompanyOnboardingInput {
  company: {
    company_code: string;
    company_name: string;
    short_name: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    gst_number: string;
    pan_number: string;
  };
  branchName: string;
  departmentName: string;
  superAdmin: {
    first_name: string;
    last_name: string;
    employee_code: string;
    email: string;
    mobile: string;
    password: string;
  };
  /** Omitted entirely to skip issuing a license right now (can be assigned later from Company Licenses). */
  license?: {
    plan_id: string;
    start_date: string;
    end_date: string;
    billing_cycle: CompanyLicenseForm["billing_cycle"];
    grace_period_days: number;
    auto_renew: boolean;
    is_complimentary: boolean;
  };
}

export interface CompanyOnboardingResult {
  company: Company;
  employee: Employee;
}

/**
 * Runs the full onboarding sequence. Not wrapped in a database
 * transaction (Supabase's client API has none available here) — if a
 * later step fails, earlier rows already exist and the operator should
 * either finish the remaining setup by hand for that company (using the
 * normal Branches/Departments/Employees screens) or delete the partial
 * company and retry. The error message always names which step failed.
 */
export async function onboardCompany(input: CompanyOnboardingInput): Promise<CompanyOnboardingResult> {
  const company = await createCompany({
    ...input.company,
    legal_name: input.company.company_name,
    logo: "",
    login_logo_url: "",
    app_icon_url: "",
    favicon: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
    language: "en",
    theme: "default",
    active: true,
    is_platform_operator: false,
    market_analytics_enabled: false,
    market_analytics_source_note: null,
    live_quiz_enabled: false,
    cards_per_page: 12,
    admin_console_bg_color: "#1e3a8a",
    admin_console_button_color: "#eab308",
    admin_console_border_color: "#facc15",
    sidebar_name_position: "left",
    sidebar_menu_order: null,
  }).catch((err) => {
    throw new Error(`Company create failed: ${err instanceof Error ? err.message : String(err)}`);
  });

  try {
    const branch = await createBranch({
      company_id: company.id,
      branch_code: "HQ",
      branch_name: input.branchName,
      contact_person: "",
      address: input.company.address,
      city: input.company.city,
      state: input.company.state,
      country: input.company.country,
      pincode: input.company.pincode,
      phone: input.company.phone,
      email: input.company.email,
      head_office: true,
      active: true,
    });

    const department = await createDepartment({
      company_id: company.id,
      branch_id: branch.id,
      department_code: "GEN",
      department_name: input.departmentName,
      description: "",
      active: true,
    });

    const designation = await createDesignation({
      company_id: company.id,
      branch_id: branch.id,
      department_id: department.id,
      designation_code: "SUPERADMIN",
      designation_name: "Super Admin",
      description: "",
      hierarchy_level: 1,
      active: true,
    });

    const role = await createRole({
      company_id: company.id,
      role_code: "SUPER_ADMIN",
      role_name: "Super Admin",
      hierarchy_level: 1,
      description: "Full access to every section of this company's account.",
      system_role: true,
      active: true,
    });

    const [allPermissions, allMenus] = await Promise.all([getPermissions(), getMenus()]);
    await assignAllPermissionsToRole(
      role.id,
      allPermissions.map((p) => p.id)
    );
    await replaceMenus(
      role.id,
      allMenus.map((m) => m.id)
    );

    // Declared as EmployeeForm (which has the create-only `password` field)
    // rather than passed as an inline literal, so it can carry `password`
    // through to createEmployee — whose repository signature is the
    // broader Partial<Employee> shared by every caller in this codebase.
    const employeeForm: EmployeeForm = {
      company_id: company.id,
      branch_id: branch.id,
      department_id: department.id,
      designation_id: designation.id,
      employee_code: input.superAdmin.employee_code,
      first_name: input.superAdmin.first_name,
      last_name: input.superAdmin.last_name,
      mobile: input.superAdmin.mobile,
      email: input.superAdmin.email,
      joining_date: new Date().toISOString().slice(0, 10),
      reporting_manager: null,
      active: true,
      attendance_location_scope: "all",
      password: input.superAdmin.password,
    };
    const employee = await createEmployee(employeeForm);

    await createEmployeeRole({
      employee_id: employee.id,
      role_id: role.id,
      assigned_date: new Date().toISOString().slice(0, 10),
      active: true,
    });

    // Real Supabase Auth login from day one — skip the legacy plaintext
    // path entirely for a brand-new employee (see authService.ts: an
    // employee with no auth_user_id falls back to plaintext comparison).
    const { data: authData, error: authError } = await supabase.functions.invoke("provision-employee-auth", {
      body: {
        employeeDbId: employee.id,
        companyCode: input.company.company_code,
        employeeCode: input.superAdmin.employee_code,
        password: input.superAdmin.password,
      },
    });
    if (authError) throw new Error(`Login provisioning failed: ${authError.message}`);
    if (authData?.success === false) throw new Error(`Login provisioning failed: ${authData.error ?? "unknown error"}`);

    if (input.license) {
      await saveNewCompanyLicense({
        company_id: company.id,
        plan_id: input.license.plan_id,
        start_date: input.license.start_date,
        end_date: input.license.end_date,
        billing_cycle: input.license.billing_cycle,
        grace_period_days: input.license.grace_period_days,
        auto_renew: input.license.auto_renew,
        is_complimentary: input.license.is_complimentary,
      }).catch((err) => {
        throw new Error(`Company and Super Admin login were created, but the license failed: ${err instanceof Error ? err.message : String(err)}. Assign it from Company Licenses instead.`);
      });
    }

    return { company, employee };
  } catch (err) {
    throw new Error(
      `${err instanceof Error ? err.message : String(err)} — the company "${company.company_name}" (code ${company.company_code}) was already created; finish the remaining setup manually from Branches/Departments/Roles/Employees, or delete it and retry.`
    );
  }
}
