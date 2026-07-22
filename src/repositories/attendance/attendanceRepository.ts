// src/repositories/attendance/attendanceRepository.ts
//
// Repository layer — Supabase ONLY. One row per employee per date;
// check-then-insert/update pattern (same as role_permissions,
// course_visibility) since no unique constraint is assumed.

import { supabase } from '../../lib/supabase';
import type { Attendance, AttendanceForm } from '../../types/attendance';

export async function getAttendanceByDate(companyId: string, date: string): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('company_id', companyId)
    .eq('attendance_date', date);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAttendanceForEmployee(employeeId: string): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .order('attendance_date', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAttendanceForEmployeeOnDate(employeeId: string, date: string): Promise<Attendance | null> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('attendance_date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function upsertAttendance(form: AttendanceForm): Promise<Attendance> {
  const existing = await getAttendanceForEmployeeOnDate(form.employee_id, form.attendance_date);

  // Postgres timestamptz columns reject '' outright (they need a real
  // timestamp or null) — convert any empty check-in/out time to null
  // right here, once, so every caller can keep using '' as their
  // "no value yet" placeholder without needing to know this detail.
  const safeForm = {
    ...form,
    check_in_time: form.check_in_time || null,
    check_out_time: form.check_out_time || null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from('attendance')
      .update(safeForm)
      .eq('id', existing.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
    return { ...existing, ...form };
  }

  const { data, error } = await supabase.from('attendance').insert(safeForm).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  return { id: '', created_at: '', updated_at: '', ...form };
}