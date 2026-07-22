// src/services/security/migrationService.ts
//
// Final phase of the login security migration. Finds every real
// employee who does NOT yet have a real Supabase Auth account
// (auth_user_id is null) and provisions one for them, using their
// EXISTING password — so nothing changes for the employee: same
// company code, same employee ID, same password. Only what happens
// behind the scenes changes.

import { supabase } from '../../lib/supabase';

export interface UnmigratedEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  company_code: string;
  password: string;
}

export async function loadUnmigratedEmployees(): Promise<UnmigratedEmployee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_code, first_name, last_name, password, company_id, companies(company_code)')
    .is('auth_user_id', null)
    .eq('active', true);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row: Record<string, unknown>) => !!row.password)
    .map((row: Record<string, unknown>) => ({
      id: row.id as string,
      employee_code: row.employee_code as string,
      first_name: (row.first_name as string | null) ?? '',
      last_name: (row.last_name as string | null) ?? '',
      company_code: (row.companies as { company_code: string } | null)?.company_code ?? '',
      password: row.password as string,
    }));
}

export interface MigrationOutcome {
  employeeId: string;
  employeeCode: string;
  success: boolean;
  error?: string;
}

async function migrateOne(employee: UnmigratedEmployee): Promise<MigrationOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke('provision-employee-auth', {
      body: {
        employeeDbId: employee.id,
        companyCode: employee.company_code,
        employeeCode: employee.employee_code,
        password: employee.password,
      },
    });

    if (error) throw new Error(error.message);
    if (data?.success === false) throw new Error(data.error ?? 'Unknown error from provisioning function.');

    return { employeeId: employee.id, employeeCode: employee.employee_code, success: true };
  } catch (err) {
    return {
      employeeId: employee.id,
      employeeCode: employee.employee_code,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Migrates every un-migrated employee, one at a time (never in
 * parallel — avoids overwhelming the Edge Function and makes progress
 * reporting straightforward). Calls onProgress after each employee so
 * the UI can show live progress.
 */
export async function migrateAllEmployees(
  employees: UnmigratedEmployee[],
  onProgress?: (completed: number, total: number, latest: MigrationOutcome) => void
): Promise<MigrationOutcome[]> {
  const outcomes: MigrationOutcome[] = [];

  for (let i = 0; i < employees.length; i++) {
    const outcome = await migrateOne(employees[i]);
    outcomes.push(outcome);
    onProgress?.(i + 1, employees.length, outcome);
  }

  return outcomes;
}
