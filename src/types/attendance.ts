// src/types/attendance.ts
//
// Real attendance tracking. One row per employee per calendar date.
// Table: attendance.

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'on_leave';

export interface Attendance {
  id: string;
  employee_id: string;
  company_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in_time: string;
  check_out_time: string;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_within_geofence: boolean | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_within_geofence: boolean | null;
  marked_by: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export type AttendanceForm = Omit<Attendance, 'id' | 'created_at' | 'updated_at'>;

export const defaultAttendanceForm: AttendanceForm = {
  employee_id: '',
  company_id: '',
  attendance_date: '',
  status: 'present',
  check_in_time: '',
  check_out_time: '',
  check_in_latitude: null,
  check_in_longitude: null,
  check_in_within_geofence: null,
  check_out_latitude: null,
  check_out_longitude: null,
  check_out_within_geofence: null,
  marked_by: '',
  remarks: '',
};

export const ATTENDANCE_STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'on_leave', label: 'On Leave' },
];

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  attendancePercentage: number;
}

export function computeAttendanceSummary(records: Attendance[]): AttendanceSummary {
  const totalDays = records.length;
  const presentDays = records.filter((r) => r.status === 'present').length;
  const absentDays = records.filter((r) => r.status === 'absent').length;
  const halfDays = records.filter((r) => r.status === 'half_day').length;
  const leaveDays = records.filter((r) => r.status === 'on_leave').length;
  const attendancePercentage = totalDays > 0
    ? Math.round(((presentDays + halfDays * 0.5) / totalDays) * 100)
    : 0;

  return { totalDays, presentDays, absentDays, halfDays, leaveDays, attendancePercentage };
}
