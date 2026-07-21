// src/repositories/geofence/geofenceRepository.ts
//
// Repository layer — Supabase ONLY.
// Tables: attendance_locations, employee_attendance_locations.
// The old branch_geofences table is left untouched (unused going
// forward, existing data was migrated forward by the create migration).

import { supabase } from '../../lib/supabase';
import type {
  AttendanceLocation,
  AttendanceLocationForm,
  AttendanceLocationScope,
  EmployeeAttendanceLocation,
} from '../../types/geofence';

// ── Locations ──────────────────────────────────────────────────────────────────

export async function getLocationsForCompany(companyId: string): Promise<AttendanceLocation[]> {
  const { data, error } = await supabase
    .from('attendance_locations')
    .select('*')
    .eq('company_id', companyId)
    .order('location_name', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createLocation(form: AttendanceLocationForm): Promise<AttendanceLocation> {
  const { data, error } = await supabase.from('attendance_locations').insert(form).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLocation(id: string, form: Partial<AttendanceLocationForm>): Promise<AttendanceLocation> {
  const { data, error } = await supabase.from('attendance_locations').update(form).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeLocation(id: string): Promise<void> {
  const { error } = await supabase.from('attendance_locations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Employee scope + assignments ──────────────────────────────────────────────

export async function getEmployeeLocationLinks(employeeId: string): Promise<EmployeeAttendanceLocation[]> {
  const { data, error } = await supabase
    .from('employee_attendance_locations')
    .select('*')
    .eq('employee_id', employeeId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllEmployeeLocationLinks(): Promise<EmployeeAttendanceLocation[]> {
  const { data, error } = await supabase.from('employee_attendance_locations').select('*');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Replaces all of an employee's specific-location links with the given set (atomic delete + re-insert). */
export async function setEmployeeLocationLinks(employeeId: string, locationIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('employee_attendance_locations')
    .delete()
    .eq('employee_id', employeeId);
  if (deleteError) throw new Error(deleteError.message);

  if (locationIds.length === 0) return;

  const { error: insertError } = await supabase
    .from('employee_attendance_locations')
    .insert(locationIds.map((locationId) => ({ employee_id: employeeId, location_id: locationId })));
  if (insertError) throw new Error(insertError.message);
}

/**
 * Direct, narrow column update on `employees` — deliberately bypasses
 * employeeService.update()'s full-form validation (required company/
 * branch/department/etc.), since this is a single geofence-domain
 * field, not a general employee-record edit.
 */
export async function setEmployeeAttendanceScope(employeeId: string, scope: AttendanceLocationScope): Promise<void> {
  const { error } = await supabase
    .from('employees')
    .update({ attendance_location_scope: scope })
    .eq('id', employeeId);
  if (error) throw new Error(error.message);
}
