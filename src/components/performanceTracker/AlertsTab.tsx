// src/components/performanceTracker/AlertsTab.tsx
//
// Manager view — who's missing today's submissions, who's been below
// minimum criteria over the last 7 days, and a one-click way to assign
// that person a course straight from the flag (this is the one thing a
// generic HR performance tracker can't do, but a training platform can).

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import {
  loadCommitmentsForDate, loadReportsForDate, loadReportsForRange, todayStr, sendReminder,
} from '../../services/performanceTracker/performanceTrackerService';
import { loadCourses } from '../../services/course/courseService';
import { createEnrollment } from '../../services/enrollment/enrollmentService';
import { notifyCourseAssigned } from '../../services/notification/notificationService';
import { fmtDate } from '../../utils/performanceTrackerUtils';
import type { Employee } from '../../types/employee';
import type { Course } from '../../types/course';
import type { PtSettings, PtCommitment, PtReport } from '../../types/performanceTracker';
import { Card, Badge, LoadingBlock, Modal, employeeName } from './ptUi';
import { IconBell, IconSpinner, IconAlert } from './ptIcons';

function AssignTrainingModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const user = getCurrentUser();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseId, setCourseId] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    loadCourses().then((cs) => { setCourses(cs); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleAssign() {
    if (!courseId || !user?.companyId || !user.id) return;
    setSaving(true);
    setErr('');
    try {
      const due = new Date();
      due.setDate(due.getDate() + 14);
      const dueIso = due.toISOString();
      await createEnrollment({
        company_id: user.companyId,
        branch_id: employee.branch_id || null,
        employee_id: employee.id,
        course_id: courseId,
        learning_path_id: null,
        assignment_type: 'MANUAL',
        enrollment_type: 'COURSE',
        status: 'PENDING',
        assigned_by: null,
        assigned_at: new Date().toISOString(),
        start_date: null,
        due_date: dueIso,
        completed_at: null,
        expiry_date: null,
        completion_percentage: 0,
        certificate_id: null,
        remarks: 'Assigned from Performance Tracker — flagged below minimum criteria.',
        is_active: true,
      } as unknown as Parameters<typeof createEnrollment>[0]);
      const course = courses.find((c) => c.id === courseId);
      await notifyCourseAssigned(
        user.companyId, user.id, `${user.firstName} ${user.lastName}`.trim(),
        courseId, course?.course_name ?? 'a course', [employee.id], dueIso
      ).catch(() => {});
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to assign course.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Assign Training — ${employeeName(employee)}`}>
      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">Course assigned — {employeeName(employee)} has been notified, due in 14 days.</p>
          <button onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Close</button>
        </div>
      ) : loading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">Pick a course to assign — due in 14 days.</p>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40">
            <option value="">— Select a course —</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name}</option>)}
          </select>
          {courses.length === 0 && <p className="text-xs text-slate-600">No courses found in this company's catalog.</p>}
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={handleAssign} disabled={!courseId || saving} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving && <IconSpinner className="h-3 w-3" />}Assign
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function AlertsTab({ employees, settings }: { employees: Employee[]; settings: PtSettings }) {
  const user = getCurrentUser();
  const today = todayStr();
  const [loading, setLoading] = useState(true);
  const [commitments, setCommitments] = useState<PtCommitment[]>([]);
  const [todayReports, setTodayReports] = useState<PtReport[]>([]);
  const [weekReports, setWeekReports] = useState<PtReport[]>([]);
  const [sending, setSending] = useState<'morning' | 'evening' | null>(null);
  const [sendingOne, setSendingOne] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<Employee | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    setLoading(true);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    Promise.all([
      loadCommitmentsForDate(user.companyId, today),
      loadReportsForDate(user.companyId, today),
      loadReportsForRange(user.companyId, fmtDate(weekAgo), today),
    ]).then(([c, tr, wr]) => { if (!cancelled) { setCommitments(c); setTodayReports(tr); setWeekReports(wr); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.companyId, today]);

  if (loading) return <LoadingBlock />;

  const active = employees.filter((e) => e.active);
  const missingMorning = active.filter((e) => !commitments.some((c) => c.employee_id === e.id));
  const missingEvening = active.filter((e) => !todayReports.some((r) => r.employee_id === e.id));

  const lowPerformers = active.filter((e) => {
    const reps = weekReports.filter((r) => r.employee_id === e.id);
    if (reps.length === 0) return false;
    const missCount = reps.filter((r) => r.min_criteria_met === false).length;
    return missCount / reps.length >= 0.5;
  });

  async function handleSend(kind: 'morning' | 'evening') {
    if (!user?.id || !user.companyId) return;
    const ids = (kind === 'morning' ? missingMorning : missingEvening).map((e) => e.id);
    if (ids.length === 0) return;
    setSending(kind);
    setMsg(null);
    try {
      const n = await sendReminder(user.companyId, user.id, `${user.firstName} ${user.lastName}`.trim(), ids, kind, settings);
      setMsg(`Reminder sent to ${n} employee(s).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to send.');
    } finally {
      setSending(null);
    }
  }

  async function handleSendOne(employee: Employee, kind: 'morning' | 'evening') {
    if (!user?.id || !user.companyId) return;
    setSendingOne(employee.id);
    setMsg(null);
    try {
      await sendReminder(user.companyId, user.id, `${user.firstName} ${user.lastName}`.trim(), [employee.id], kind, settings);
      setMsg(`Reminder sent to ${employeeName(employee)}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to send.');
    } finally {
      setSendingOne(null);
    }
  }

  return (
    <div className="space-y-4">
      {msg && <p className="text-xs text-slate-600">{msg}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Missing Morning Commitment</span>
            <button onClick={() => handleSend('morning')} disabled={sending !== null || missingMorning.length === 0} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
              {sending === 'morning' ? <IconSpinner className="h-3 w-3" /> : <IconBell className="h-3 w-3" />}
              Remind All
            </button>
          </div>
          <div className="max-h-80 space-y-1.5 overflow-y-auto p-3">
            {missingMorning.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span>{employeeName(e)}</span>
                <button
                  onClick={() => handleSendOne(e, 'morning')}
                  disabled={sendingOne !== null}
                  title="Remind this employee only"
                  className="flex flex-shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {sendingOne === e.id ? <IconSpinner className="h-3 w-3" /> : <IconBell className="h-3 w-3" />}
                  Remind
                </button>
              </div>
            ))}
            {missingMorning.length === 0 && <p className="py-8 text-center text-xs text-slate-600">Everyone's submitted today.</p>}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Missing Evening Report</span>
            <button onClick={() => handleSend('evening')} disabled={sending !== null || missingEvening.length === 0} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
              {sending === 'evening' ? <IconSpinner className="h-3 w-3" /> : <IconBell className="h-3 w-3" />}
              Remind All
            </button>
          </div>
          <div className="max-h-80 space-y-1.5 overflow-y-auto p-3">
            {missingEvening.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span>{employeeName(e)}</span>
                <button
                  onClick={() => handleSendOne(e, 'evening')}
                  disabled={sendingOne !== null}
                  title="Remind this employee only"
                  className="flex flex-shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {sendingOne === e.id ? <IconSpinner className="h-3 w-3" /> : <IconBell className="h-3 w-3" />}
                  Remind
                </button>
              </div>
            ))}
            {missingEvening.length === 0 && <p className="py-8 text-center text-xs text-slate-600">Everyone's submitted today.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          <IconAlert className="h-4 w-4 text-rose-500" />Below Minimum Criteria — Last 7 Days
        </div>
        <div className="p-2">
          {lowPerformers.map((e) => {
            const reps = weekReports.filter((r) => r.employee_id === e.id);
            const missCount = reps.filter((r) => r.min_criteria_met === false).length;
            return (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span className="text-sm font-medium text-slate-800">{employeeName(e)}</span>
                <div className="flex items-center gap-2">
                  <Badge tone="rejected">{missCount} of {reps.length} days below criteria</Badge>
                  <button onClick={() => setAssignTarget(e)} className="text-xs font-semibold text-emerald-700 hover:underline">Assign Training</button>
                </div>
              </div>
            );
          })}
          {lowPerformers.length === 0 && <p className="py-8 text-center text-xs text-slate-600">No one is flagged for the last 7 days.</p>}
        </div>
      </Card>

      <p className="text-xs text-slate-600">
        Minimum criteria: {[
          settings.f2f_enabled && `${settings.min_f2f}+ F2F`,
          settings.sv_enabled && `${settings.min_sv}+ site visits`,
          settings.revisit_enabled && `${settings.min_revisit}+ revisits`,
          settings.calls_enabled && `${settings.min_calls}+ calls`,
          settings.conn_enabled && `${settings.min_conn}+ connected`,
          settings.talk_enabled && `${settings.min_talk}+ min talk time`,
        ].filter(Boolean).join(', ') || 'none set — every metric is turned off in Settings'}.
      </p>

      {assignTarget && <AssignTrainingModal employee={assignTarget} onClose={() => setAssignTarget(null)} />}
    </div>
  );
}
