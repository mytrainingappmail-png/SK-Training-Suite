// src/components/learning/MyAttendance.tsx
//
// Employee-facing attendance: real Check In / Check Out buttons (today
// only), attendance summary (present/absent/half-day/leave %), and
// full real history. Not yet wired into sidebar/routes.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import {
  loadTodayAttendanceForEmployee,
  checkIn,
  checkOut,
  loadAttendanceHistoryForEmployee,
  loadAttendanceSummaryForEmployee,
} from '../../services/attendance/attendanceService';
import SectionHeroBanner from './SectionHeroBanner';
import type { Attendance, AttendanceSummary, AttendanceStatus } from '../../types/attendance';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

/**
 * Real browser GPS location. Resolves null (not an error) when the
 * browser doesn't support geolocation at all — check-in still proceeds
 * unrestricted in that case rather than blocking the employee outright.
 */
function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(`Could not get your location: ${err.message}. Please allow location access and try again.`)),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-700',
  half_day: 'bg-amber-50 text-amber-700',
  on_leave: 'bg-slate-100 text-slate-600',
};
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  on_leave: 'On Leave',
};

function SummaryCard({ label, value, className }: { label: string; value: string | number; className: string }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function MyAttendance() {
  const user = getCurrentUser();
  const [today, setToday] = useState<Attendance | null>(null);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([
      loadTodayAttendanceForEmployee(user.id),
      loadAttendanceHistoryForEmployee(user.id),
      loadAttendanceSummaryForEmployee(user.id),
    ])
      .then(([todayRow, historyRows, summaryData]) => {
        setToday(todayRow);
        setHistory(historyRows);
        setSummary(summaryData);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load attendance.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckIn() {
    if (!user?.id || !user.companyId) return;
    setActing(true);
    try {
      const coords = await getCurrentLocation();
      await checkIn(user.id, user.companyId, coords);
      showToast('Checked in');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to check in.');
    } finally {
      setActing(false);
    }
  }

  async function handleCheckOut() {
    if (!user?.id || !user.companyId) return;
    setActing(true);
    try {
      const coords = await getCurrentLocation();
      await checkOut(user.id, user.companyId, coords);
      showToast('Checked out');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to check out.');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        title="My Attendance"
        subtitle="Check in and out, and track your attendance history."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex-1">
            <p className="text-sm text-slate-600">
              {today?.check_in_time ? `Checked in at ${new Date(today.check_in_time).toLocaleTimeString()}` : "You haven't checked in today."}
            </p>
            {today?.check_out_time && (
              <p className="text-sm text-slate-600">Checked out at {new Date(today.check_out_time).toLocaleTimeString()}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCheckIn}
              disabled={acting || !!today?.check_in_time}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {acting ? <IconSpinner className="h-3.5 w-3.5" /> : 'Check In'}
            </button>
            <button
              onClick={handleCheckOut}
              disabled={acting || !today?.check_in_time || !!today?.check_out_time}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {acting ? <IconSpinner className="h-3.5 w-3.5" /> : 'Check Out'}
            </button>
          </div>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <SummaryCard label="Attendance %" value={`${summary.attendancePercentage}%`} className="border-indigo-100" />
          <SummaryCard label="Present" value={summary.presentDays} className="border-emerald-100" />
          <SummaryCard label="Absent" value={summary.absentDays} className="border-red-100" />
          <SummaryCard label="Half Day" value={summary.halfDays} className="border-amber-100" />
          <SummaryCard label="Leave" value={summary.leaveDays} className="border-slate-200" />
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-800">History</h3>
        </div>
        {history.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No attendance records yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
                <p className="text-sm font-medium text-slate-700">{new Date(record.attendance_date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[record.status]}`}>
                  {STATUS_LABELS[record.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default MyAttendance;
