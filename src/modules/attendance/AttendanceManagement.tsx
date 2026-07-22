// src/modules/attendance/AttendanceManagement.tsx
//
// Admin marks attendance for a chosen date — real employee roster,
// real per-employee status buttons, bulk save. Not yet wired into
// sidebar/routes beyond the Admin tab this is added to.

import { useEffect, useState } from 'react';
import { loadDailyAttendance, bulkMarkAttendance } from '../../services/attendance/attendanceService';
import { loadCompanies } from '../../services/company/companyService';
import { ATTENDANCE_STATUS_OPTIONS } from '../../types/attendance';
import type { AttendanceStatus } from '../../types/attendance';
import type { DailyAttendanceRow } from '../../services/attendance/attendanceService';
import type { Company } from '../../types/company';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-600 text-white',
  absent: 'bg-red-600 text-white',
  half_day: 'bg-amber-500 text-white',
  on_leave: 'bg-slate-500 text-white',
};
const STATUS_STYLES_INACTIVE = 'bg-slate-100 text-slate-500 hover:bg-slate-200';

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function AttendanceManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<DailyAttendanceRow[]>([]);
  const [pendingStatus, setPendingStatus] = useState<Record<string, AttendanceStatus>>({});

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  useEffect(() => {
    setLoadingCompanies(true);
    loadCompanies()
      .then((rows) => {
        setCompanies(rows);
        if (rows.length > 0) setSelectedCompanyId(rows[0].id);
      })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load companies.'))
      .finally(() => setLoadingCompanies(false));
  }, []);

  function fetchDaily() {
    if (!selectedCompanyId || !date) return;
    setLoadingRows(true);
    loadDailyAttendance(selectedCompanyId, date)
      .then((data) => {
        setRows(data);
        const initial: Record<string, AttendanceStatus> = {};
        data.forEach((row) => { initial[row.employee.id] = row.record?.status ?? 'present'; });
        setPendingStatus(initial);
      })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load attendance.'))
      .finally(() => setLoadingRows(false));
  }

  useEffect(() => {
    fetchDaily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, date]);

  function setStatus(employeeId: string, status: AttendanceStatus) {
    setPendingStatus((prev) => ({ ...prev, [employeeId]: status }));
  }

  function markAllAs(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    rows.forEach((row) => { next[row.employee.id] = status; });
    setPendingStatus(next);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const changes = rows.map((row) => ({
        employeeId: row.employee.id,
        companyId: selectedCompanyId,
        status: pendingStatus[row.employee.id] ?? 'present',
      }));
      await bulkMarkAttendance(date, changes);
      showToast('Attendance saved');
      fetchDaily();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingCompanies) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Attendance</h2>
          <p className="text-sm text-slate-500">Mark attendance for a company, on a given date.</p>
        </div>
        <PrimaryButton onClick={handleSave} disabled={saving || rows.length === 0}>
          {saving ? <IconSpinner className="h-3.5 w-3.5" /> : null} Save Attendance
        </PrimaryButton>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Company</label>
          <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className={INPUT_CLS}>
            {companies.map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Mark all as:</span>
          {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => markAllAs(opt.value)} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${STATUS_STYLES_INACTIVE}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {loadingRows ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState message="No active employees found for this company." />
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
          {rows.map((row) => (
            <div key={row.employee.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{row.employee.first_name} {row.employee.last_name}</p>
                <p className="font-mono text-xs text-slate-400">{row.employee.employee_code}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(row.employee.id, opt.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      pendingStatus[row.employee.id] === opt.value ? STATUS_STYLES[opt.value] : STATUS_STYLES_INACTIVE
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default AttendanceManagement;
