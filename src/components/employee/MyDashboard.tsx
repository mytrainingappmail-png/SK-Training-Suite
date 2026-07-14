// src/components/employee/MyDashboard.tsx
//
// Verified imports:
//   react                              — useEffect, useState
//   ../../services/employee/dashboardService → loadDashboard (new file)
//   ../../services/auth/session        → getCurrentUser (exists)
//   ../../types/dashboard              → EmployeeDashboard (new file)

import { useEffect, useState } from 'react';

import { loadDashboard }  from '../../services/employee/dashboardService';
import { getCurrentUser } from '../../services/auth/session';

import type { EmployeeDashboard } from '../../types/dashboard';

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar (inline — no external dependency)
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const colour =
    pct >= 75 ? 'bg-emerald-500' :
    pct >= 40 ? 'bg-yellow-400'  :
    'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-500 ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-slate-600">{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label:      string;
  value:      number;
  suffix?:    string;
  accent:     string; // Tailwind border-colour class
  icon:       React.ReactNode;
}

function SummaryCard({ label, value, suffix, accent, icon }: SummaryCardProps) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${accent}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-800">
        {value.toLocaleString()}
        {suffix && <span className="ml-1 text-xl font-normal text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'COMPLETED'   ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
    status === 'IN_PROGRESS' ? 'bg-blue-50    text-blue-700    ring-blue-200'    :
    status === 'PENDING'     ? 'bg-amber-50   text-amber-700   ring-amber-200'   :
    status === 'active'      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
    status === 'scheduled'   ? 'bg-violet-50  text-violet-700  ring-violet-200'  :
    'bg-slate-100 text-slate-600 ring-slate-200';

  const label = status.replace('_', ' ');

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG — no library)
// ─────────────────────────────────────────────────────────────────────────────

const Icons = {
  book: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  check: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  clock: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  path: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  ),
  award: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
    </svg>
  ),
  clipboard: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
    </svg>
  ),
  progress: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-28 rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-slate-100" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function MyDashboard() {
  const user = getCurrentUser();

  const [data,    setData]    = useState<EmployeeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setError('No active session. Please log in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    loadDashboard(user.id)
      .then(setData)
      .catch((err: unknown) => {
        console.error('[MyDashboard]', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load dashboard. Please try again.'
        );
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const fullName =
    user ? `${user.firstName} ${user.lastName}`.trim() || user.employeeId : 'Employee';

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <div>
          <p className="font-semibold">Failed to load dashboard</p>
          <p className="mt-0.5 text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // ── Empty state (new employee — no data yet) ─────────────────────────────
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          {Icons.book}
        </div>
        <h3 className="text-base font-semibold text-slate-800">No learning data yet</h3>
        <p className="mt-1 text-sm text-slate-500">Your courses and progress will appear here once assigned.</p>
      </div>
    );
  }

  const { summary, recentCourses, upcomingAssessments } = data;

  return (
    <div className="space-y-6">

      {/* ── Welcome banner ──────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6 text-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}
      >
        <div>
          <p className="text-sm text-slate-400">Welcome back</p>
          <h1 className="mt-0.5 text-2xl font-bold">{fullName}</h1>
          <p className="mt-1 text-sm text-slate-300">
            {summary.pendingCourses > 0
              ? `You have ${summary.pendingCourses} pending course${summary.pendingCourses > 1 ? 's' : ''} — keep going!`
              : summary.assignedCourses === 0
              ? 'No courses assigned yet. Check back soon.'
              : 'Great work — all your courses are on track!'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Overall Progress</p>
          <p className="text-4xl font-bold" style={{ color: '#D4AF37' }}>
            {summary.overallProgressPct}%
          </p>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <SummaryCard
          label="Assigned Courses"
          value={summary.assignedCourses}
          accent="border-blue-100"
          icon={Icons.book}
        />
        <SummaryCard
          label="Completed"
          value={summary.completedCourses}
          accent="border-emerald-100"
          icon={Icons.check}
        />
        <SummaryCard
          label="Pending"
          value={summary.pendingCourses}
          accent="border-amber-100"
          icon={Icons.clock}
        />
        <SummaryCard
          label="Learning Paths"
          value={summary.learningPaths}
          accent="border-violet-100"
          icon={Icons.path}
        />
        <SummaryCard
          label="Certificates"
          value={summary.certificatesEarned}
          accent="border-yellow-100"
          icon={Icons.award}
        />
        <SummaryCard
          label="Upcoming Tests"
          value={summary.upcomingAssessments}
          accent="border-rose-100"
          icon={Icons.clipboard}
        />
        <SummaryCard
          label="Overall Progress"
          value={summary.overallProgressPct}
          suffix="%"
          accent="border-cyan-100"
          icon={Icons.progress}
        />
      </div>

      {/* ── Continue Learning ───────────────────────────────────────────────── */}
      {recentCourses.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Continue Learning</h2>
              <p className="text-sm text-slate-500">Pick up where you left off.</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {recentCourses.map((course) => (
              <div
                key={course.enrollmentId}
                className="flex flex-wrap items-center gap-4 px-6 py-4 transition hover:bg-slate-50/60"
              >
                {/* Course icon */}
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  {Icons.book}
                </div>

                {/* Course info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-800">{course.courseName}</p>
                    {course.courseCode && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                        {course.courseCode}
                      </span>
                    )}
                    <StatusBadge status={course.status} />
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={course.completionPercentage} />
                  </div>
                  {course.dueDate && (
                    <p className="mt-1 text-xs text-slate-400">
                      Due: {new Date(course.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Continue button */}
                <button
                  className="flex-shrink-0 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
                  onClick={() => {
                    // Navigation to course player will be wired when Course Player is built
                    console.info('[MyDashboard] Continue course:', course.courseId);
                  }}
                >
                  {course.completionPercentage > 0 ? 'Continue' : 'Start'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty: no courses assigned yet ─────────────────────────────────── */}
      {recentCourses.length === 0 && summary.assignedCourses === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            {Icons.book}
          </div>
          <p className="font-semibold text-slate-700">No courses assigned yet</p>
          <p className="mt-1 text-sm text-slate-500">Your administrator will assign courses to you shortly.</p>
        </div>
      )}

      {/* ── Upcoming Assessments ────────────────────────────────────────────── */}
      {upcomingAssessments.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-bold text-slate-800">Upcoming Assessments</h2>
            <p className="text-sm text-slate-500">Tests scheduled for you.</p>
          </div>

          <div className="divide-y divide-slate-100">
            {upcomingAssessments.map((assessment) => (
              <div
                key={assessment.assignmentId}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition hover:bg-slate-50/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-400">
                    {Icons.clipboard}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{assessment.assessmentTitle}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      {assessment.assessmentCode && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                          {assessment.assessmentCode}
                        </span>
                      )}
                      <StatusBadge status={assessment.status} />
                      {assessment.endDate && (
                        <span className="text-xs text-slate-400">
                          Due: {new Date(assessment.endDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  className="flex-shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                  onClick={() => {
                    // Navigation to Assessment Player will be wired when built
                    console.info('[MyDashboard] Start assessment:', assessment.assessmentId);
                  }}
                >
                  Take Test
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
