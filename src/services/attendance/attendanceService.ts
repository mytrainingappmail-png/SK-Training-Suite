// src/services/attendance/attendanceService.ts
//
// Business logic — validation + orchestration. Delegates all Supabase
// access to attendanceRepository.ts. Reuses the real employeeService
// for the employee roster (never invents employees).
//
// Check-in/out now optionally enforce a real GPS geofence (see
// geofenceService) — an employee's actual device location is checked
// against their allowed attendance location(s) (per their
// attendance_location_scope: all configured company locations, or
// only their specifically-linked ones) before a check-in is accepted.
// A company with no locations configured is never restricted — this
// is fully opt-in.

import {
  getAttendanceByDate,
  getAttendanceForEmployee,
  getAttendanceForEmployeeOnDate,
  upsertAttendance,
} from '../../repositories/attendance/attendanceRepository';
import { employeeService } from '../employee/employeeService';
import { getCurrentUser } from '../auth/session';
import { checkEmployeeWithinGeofence } from '../geofence/geofenceService';

import type { Attendance, AttendanceStatus } from '../../types/attendance';
import { computeAttendanceSummary } from '../../types/attendance';
import type { AttendanceSummary } from '../../types/attendance';
import type { Employee } from '../../types/employee';

export interface DailyAttendanceRow {
  employee: Employee;
  record: Attendance | null;
}

export async function loadDailyAttendance(companyId: string, date: string): Promise<DailyAttendanceRow[]> {
  const [employees, records] = await Promise.all([
    employeeService.getAll(),
    getAttendanceByDate(companyId, date),
  ]);

  const recordByEmployeeId = new Map(records.map((r) => [r.employee_id, r]));
  return employees
    .filter((e) => e.company_id === companyId && e.active)
    .map((employee) => ({
      employee,
      record: recordByEmployeeId.get(employee.id) ?? null,
    }));
}

function validateAttendanceStatus(status: AttendanceStatus): void {
  const valid: AttendanceStatus[] = ['present', 'absent', 'half_day', 'on_leave'];
  if (!valid.includes(status)) throw new Error('Invalid attendance status.');
}

export async function markAttendance(
  employeeId: string,
  companyId: string,
  date: string,
  status: AttendanceStatus,
  remarks = ''
): Promise<Attendance> {
  if (!employeeId) throw new Error('Employee is required.');
  if (!date) throw new Error('Date is required.');
  validateAttendanceStatus(status);

  const user = getCurrentUser();
  return upsertAttendance({
    employee_id: employeeId,
    company_id: companyId,
    attendance_date: date,
    status,
    check_in_time: '',
    check_out_time: '',
    check_in_latitude: null,
    check_in_longitude: null,
    check_in_within_geofence: null,
    check_out_latitude: null,
    check_out_longitude: null,
    check_out_within_geofence: null,
    marked_by: user?.employeeId ?? 'admin',
    remarks,
  });
}

export interface BulkMarkChange {
  employeeId: string;
  companyId: string;
  status: AttendanceStatus;
}

export async function bulkMarkAttendance(date: string, changes: BulkMarkChange[]): Promise<void> {
  for (const change of changes) {
    await markAttendance(change.employeeId, change.companyId, date, change.status);
  }
}

// ── Employee self-service: check-in / check-out ─────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadTodayAttendanceForEmployee(employeeId: string): Promise<Attendance | null> {
  return getAttendanceForEmployeeOnDate(employeeId, todayDateString());
}

export interface GeoCoords {
  latitude: number;
  longitude: number;
}

export async function checkIn(
  employeeId: string,
  companyId: string,
  coords: GeoCoords | null
): Promise<Attendance> {
  if (!employeeId) throw new Error('No active session.');
  const existing = await getAttendanceForEmployeeOnDate(employeeId, todayDateString());
  if (existing && existing.check_in_time) {
    throw new Error('You have already checked in today.');
  }

  let withinGeofence: boolean | null = null;
  if (coords) {
    const employees = await employeeService.getAll();
    const employee = employees.find((e) => e.id === employeeId);
    const check = await checkEmployeeWithinGeofence(
      employeeId,
      companyId,
      employee?.attendance_location_scope ?? 'all',
      coords.latitude,
      coords.longitude
    );
    if (!check.withinFence) {
      throw new Error(`Check-in blocked: ${check.message}`);
    }
    withinGeofence = check.withinFence;
  }

  return upsertAttendance({
    employee_id: employeeId,
    company_id: companyId,
    attendance_date: todayDateString(),
    status: 'present',
    check_in_time: new Date().toISOString(),
    check_out_time: existing?.check_out_time ?? '',
    check_in_latitude: coords?.latitude ?? null,
    check_in_longitude: coords?.longitude ?? null,
    check_in_within_geofence: withinGeofence,
    check_out_latitude: existing?.check_out_latitude ?? null,
    check_out_longitude: existing?.check_out_longitude ?? null,
    check_out_within_geofence: existing?.check_out_within_geofence ?? null,
    marked_by: employeeId,
    remarks: existing?.remarks ?? '',
  });
}

export async function checkOut(
  employeeId: string,
  companyId: string,
  coords: GeoCoords | null
): Promise<Attendance> {
  if (!employeeId) throw new Error('No active session.');
  const existing = await getAttendanceForEmployeeOnDate(employeeId, todayDateString());
  if (!existing || !existing.check_in_time) {
    throw new Error('You need to check in before checking out.');
  }
  if (existing.check_out_time) {
    throw new Error('You have already checked out today.');
  }

  let withinGeofence: boolean | null = null;
  if (coords) {
    const employees = await employeeService.getAll();
    const employee = employees.find((e) => e.id === employeeId);
    const check = await checkEmployeeWithinGeofence(
      employeeId,
      companyId,
      employee?.attendance_location_scope ?? 'all',
      coords.latitude,
      coords.longitude
    );
    if (!check.withinFence) {
      throw new Error(`Check-out blocked: ${check.message}`);
    }
    withinGeofence = check.withinFence;
  }

  return upsertAttendance({
    employee_id: employeeId,
    company_id: companyId,
    attendance_date: todayDateString(),
    status: existing.status,
    check_in_time: existing.check_in_time,
    check_out_time: new Date().toISOString(),
    check_in_latitude: existing.check_in_latitude,
    check_in_longitude: existing.check_in_longitude,
    check_in_within_geofence: existing.check_in_within_geofence,
    check_out_latitude: coords?.latitude ?? null,
    check_out_longitude: coords?.longitude ?? null,
    check_out_within_geofence: withinGeofence,
    marked_by: employeeId,
    remarks: existing.remarks,
  });
}

// ── Employee's own history + summary ─────────────────────────────────────────

export async function loadAttendanceHistoryForEmployee(employeeId: string): Promise<Attendance[]> {
  return getAttendanceForEmployee(employeeId);
}

export async function loadAttendanceSummaryForEmployee(employeeId: string): Promise<AttendanceSummary> {
  const records = await getAttendanceForEmployee(employeeId);
  return computeAttendanceSummary(records);
}
