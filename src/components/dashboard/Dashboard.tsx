// src/components/dashboard/Dashboard.tsx
//
// Professional Training App Dashboard — self-contained, reusing only
// existing, unmodified services:
//   dashboardService.loadDashboard()      — summary counts, recent
//                                           (in-progress) courses, upcoming
//                                           assessment assignments
//   myCourseService.loadMyCourses()       — durationHours (Learning Hours)
//                                           and completedAt (Latest
//                                           Completion achievement)
//   assessmentResultService.loadResults() — Average Score / Highest Score,
//                                           filtered client-side to this
//                                           employee (same technique as
//                                           MyResults.tsx)
//   myCertificateService.loadMyCertificates() — Latest Certificate
//   lessonBuilderService.loadLessons() +
//   resourceService.loadResources()       — Pending Assignments, using the
//                                           same submission-marker
//                                           technique already established
//                                           for MyAssignments.tsx
//   session.getCurrentUser()              — current employee
//
// No repository, service, or database changes. Recent Activity is built
// from real timestamped events (certificates issued, assessments
// evaluated) rather than a fabricated activity log, which doesn't exist
// anywhere in the reachable backend.

import { useEffect, useMemo, useState } from 'react';
import { loadDashboard }      from '../../services/employee/dashboardService';
import { loadMyCourses }      from '../../services/myCourses/myCourseService';
import { loadResults }        from '../../services/assessmentResult/assessmentResultService';
import { loadMyCertificates } from '../../services/myCertificate/myCertificateService';
import { loadLessons }        from '../../services/lessonBuilder/lessonBuilderService';
import { loadResources }      from '../../services/resource/resourceService';
import { getCurrentUser }     from '../../services/auth/session';

import type { EmployeeDashboard } from '../../types/dashboard';
import type { MyCourse }          from '../../types/myCourse';
import type { AssessmentResult }  from '../../types/assessmentResult';
import type { MyCertificate }     from '../../types/myCertificate';

// ─────────────────────────────────────────────────────────────────────────────
// Props — optional navigation callbacks (no routing changes made here)
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardProps {
  onContinueLearning?: (enrollmentId: string) => void;
  onViewCourses?:      () => void;
  onViewAssessments?:  () => void;
  onViewAssignments?:  () => void;
  onViewCertificates?: () => void;
  onViewResults?:      () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load dashboard</p>
      <p className="mt-1">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium transition hover:bg-red-100"
      >
        Try Again
      </button>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent, icon }: { label: string; value: string | number; accent: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Learning Progress — pure CSS/Tailwind donut + per-course bars
// ─────────────────────────────────────────────────────────────────────────────

function ProgressDonut({ percent }: { percent: number }) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="relative flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#eab308 ${pct * 3.6}deg, #e2e8f0 0deg)` }}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
        <p className="text-2xl font-bold text-slate-800">{pct}%</p>
        <p className="text-[11px] text-slate-400">Complete</p>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const colour = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-rose-400';
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-500 ${colour}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function LearningProgressCard({ overallPct, courses }: { overallPct: number; courses: MyCourse[] }) {
  const active = courses.filter((c) => c.status !== 'CANCELLED').slice(0, 5);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Learning Progress</h3>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <ProgressDonut percent={overallPct} />
        <div className="w-full flex-1 space-y-3">
          {active.length === 0 ? (
            <EmptySection message="No course progress yet." />
          ) : (
            active.map((c) => (
              <div key={c.enrollmentId} className="flex items-center gap-3">
                <p className="w-32 flex-shrink-0 truncate text-xs font-medium text-slate-600">{c.courseName}</p>
                <ProgressBar value={c.completionPercentage} />
                <span className="w-10 flex-shrink-0 text-right text-xs font-semibold text-slate-500">
                  {c.completionPercentage}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Continue Learning
// ─────────────────────────────────────────────────────────────────────────────

function ContinueLearningCard({ course, onContinue }: { course: MyCourse | null; onContinue: () => void }) {
  if (!course) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Continue Learning</h3>
        <EmptySection message="No course in progress. Start a course to see it here." />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Continue Learning</h3>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {course.thumbnail ? (
          <img src={course.thumbnail} alt={course.courseName} className="h-20 w-32 flex-shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292v-14.25" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800">{course.courseName}</p>
          <div className="mt-2 flex items-center gap-2">
            <ProgressBar value={course.completionPercentage} />
            <span className="text-xs font-semibold text-slate-500">{course.completionPercentage}%</span>
          </div>
        </div>
        <button
          onClick={onContinue}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-yellow-400 active:scale-95"
        >
          Resume
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Activity — built from real timestamped events only
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityEvent {
  id:      string;
  label:   string;
  detail:  string;
  date:    string;
  icon:    'certificate' | 'assessment';
}

function buildActivity(certificates: MyCertificate[], results: AssessmentResult[]): ActivityEvent[] {
  const certEvents: ActivityEvent[] = certificates
    .filter((c) => c.status !== 'pending' && c.issueDate)
    .map((c) => ({
      id:     `cert-${c.id}`,
      label:  'Certificate Issued',
      detail: c.certificateTitle,
      date:   c.issueDate,
      icon:   'certificate',
    }));

  const resultEvents: ActivityEvent[] = results
    .filter((r) => r.evaluated_at)
    .map((r) => ({
      id:     `result-${r.id}`,
      label:  r.passed ? 'Assessment Passed' : 'Assessment Attempted',
      detail: `Scored ${r.percentage.toFixed(1)}%`,
      date:   r.evaluated_at,
      icon:   'assessment',
    }));

  return [...certEvents, ...resultEvents]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
}

function ActivityIcon({ type }: { type: ActivityEvent['icon'] }) {
  if (type === 'certificate') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function RecentActivityCard({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Recent Activity</h3>
      {events.length === 0 ? (
        <EmptySection message="No recent activity yet." />
      ) : (
        <ol className="space-y-4 border-l border-slate-100 pl-4">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] flex h-5 w-5 items-center justify-center rounded-full bg-yellow-50 text-yellow-600 ring-4 ring-white">
                <ActivityIcon type={e.icon} />
              </span>
              <p className="text-sm font-semibold text-slate-800">{e.label}</p>
              <p className="text-xs text-slate-500">{e.detail}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(e.date)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming
// ─────────────────────────────────────────────────────────────────────────────

function UpcomingCard({
  upcomingAssessments, pendingAssignmentTitles,
}: {
  upcomingAssessments: EmployeeDashboard['upcomingAssessments'];
  pendingAssignmentTitles: string[];
}) {
  const hasAny = upcomingAssessments.length > 0 || pendingAssignmentTitles.length > 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Upcoming</h3>
      {!hasAny ? (
        <EmptySection message="Nothing pending right now." />
      ) : (
        <div className="space-y-4">
          {pendingAssignmentTitles.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500">Pending Assignments</p>
              <ul className="space-y-1.5">
                {pendingAssignmentTitles.slice(0, 5).map((title) => (
                  <li key={title} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />
                    <span className="truncate">{title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {upcomingAssessments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500">Pending Assessments</p>
              <ul className="space-y-1.5">
                {upcomingAssessments.slice(0, 5).map((a) => (
                  <li key={a.assignmentId} className="flex items-center justify-between gap-2 text-sm text-slate-700">
                    <span className="flex items-center gap-2 truncate">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
                      <span className="truncate">{a.assessmentTitle}</span>
                    </span>
                    {a.endDate && <span className="flex-shrink-0 text-xs text-slate-400">{formatDate(a.endDate)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Achievements
// ─────────────────────────────────────────────────────────────────────────────

function AchievementsCard({
  latestCertificate, highestScore, latestCompletion,
}: {
  latestCertificate: MyCertificate | null;
  highestScore:      number | null;
  latestCompletion:  MyCourse | null;
}) {
  const hasAny = latestCertificate || highestScore !== null || latestCompletion;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Achievements</h3>
      {!hasAny ? (
        <EmptySection message="Keep learning to unlock achievements." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {latestCertificate && (
            <div className="rounded-xl bg-yellow-50 p-4">
              <p className="text-xs font-semibold text-yellow-700">Latest Certificate</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-800">{latestCertificate.certificateTitle}</p>
              <p className="text-xs text-slate-500">{formatDate(latestCertificate.issueDate)}</p>
            </div>
          )}
          {highestScore !== null && (
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-700">Highest Score</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{highestScore.toFixed(1)}%</p>
            </div>
          )}
          {latestCompletion && (
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs font-semibold text-blue-700">Latest Completion</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-800">{latestCompletion.courseName}</p>
              <p className="text-xs text-slate-500">{formatDate(latestCompletion.completedAt)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Actions
// ─────────────────────────────────────────────────────────────────────────────

function QuickActions({
  onContinueLearning, onViewCourses, onViewAssessments, onViewAssignments, onViewCertificates, onViewResults,
}: DashboardProps) {
  const actions = [
    { label: 'Continue Learning', onClick: onContinueLearning ? () => onContinueLearning('') : undefined },
    { label: 'My Courses',        onClick: onViewCourses },
    { label: 'My Assessments',    onClick: onViewAssessments },
    { label: 'My Assignments',    onClick: onViewAssignments },
    { label: 'Certificates',      onClick: onViewCertificates },
    { label: 'Results',           onClick: onViewResults },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            disabled={!a.onClick}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard({
  onContinueLearning, onViewCourses, onViewAssessments, onViewAssignments, onViewCertificates, onViewResults,
}: DashboardProps) {
  const user = getCurrentUser();

  const [dashboard,    setDashboard]    = useState<EmployeeDashboard | null>(null);
  const [courses,      setCourses]      = useState<MyCourse[]>([]);
  const [results,      setResults]      = useState<AssessmentResult[]>([]);
  const [certificates, setCertificates] = useState<MyCertificate[]>([]);
  const [pendingAssignmentTitles, setPendingAssignmentTitles] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  function fetchAll() {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    Promise.all([
      loadDashboard(user.id),
      loadMyCourses(user.id),
      loadResults(),
      loadMyCertificates(user.id),
      loadLessons(),
      loadResources(),
    ])
      .then(([dashboardData, courseRows, resultRows, certRows, lessonRows, resourceRows]) => {
        setDashboard(dashboardData);
        setCourses(courseRows);
        setResults(resultRows.filter((r) => r.employee_id === user.id));
        setCertificates(certRows);

        const assignmentLessons = lessonRows.filter((l) => l.lesson_type === 'assignment' && l.active);
        const pending = assignmentLessons
          .filter((l) => {
            const hasSubmission = resourceRows.some(
              (r) => r.lesson_id === l.id && r.description === `submission:${user.id}`
            );
            return !hasSubmission;
          })
          .map((l) => l.lesson_title || 'Untitled Assignment');
        setPendingAssignmentTitles(pending);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const learningHours = useMemo(
    () => courses.reduce((sum, c) => sum + (c.status === 'COMPLETED' ? c.durationHours : 0), 0),
    [courses]
  );

  const averageScore = useMemo(
    () => (results.length > 0 ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length : null),
    [results]
  );

  const highestScore = useMemo(
    () => (results.length > 0 ? Math.max(...results.map((r) => r.percentage)) : null),
    [results]
  );

  const latestCertificate = useMemo(() => {
    const issued = certificates.filter((c) => c.status !== 'pending' && c.issueDate);
    if (issued.length === 0) return null;
    return [...issued].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())[0];
  }, [certificates]);

  const latestCompletion = useMemo(() => {
    const completed = courses.filter((c) => c.completedAt);
    if (completed.length === 0) return null;
    return [...completed].sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];
  }, [courses]);

  const activityEvents = useMemo(() => buildActivity(certificates, results), [certificates, results]);

  const resumeCourse = useMemo(() => {
    const inProgress = courses.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'PENDING');
    if (inProgress.length === 0) return null;
    return [...inProgress].sort((a, b) => b.completionPercentage - a.completionPercentage)[0];
  }, [courses]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;
  if (!dashboard) return null;

  const { summary, upcomingAssessments } = dashboard;

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="Courses Assigned" value={summary.assignedCourses} accent="border-slate-200"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292v-14.25" /></svg>}
        />
        <SummaryCard
          label="Courses Completed" value={summary.completedCourses} accent="border-emerald-200"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
        />
        <SummaryCard
          label="Certificates Earned" value={summary.certificatesEarned} accent="border-yellow-200"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>}
        />
        <SummaryCard
          label="Pending Assignments" value={pendingAssignmentTitles.length} accent="border-purple-200"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
        />
        <SummaryCard
          label="Pending Assessments" value={summary.upcomingAssessments} accent="border-blue-200"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
        />
        <SummaryCard
          label="Learning Hours" value={`${learningHours}h`} accent="border-slate-200"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
        />
        {averageScore !== null && (
          <SummaryCard
            label="Average Score" value={`${averageScore.toFixed(1)}%`} accent="border-emerald-200"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
          />
        )}
        <SummaryCard
          label="Completion %" value={`${summary.overallProgressPct}%`} accent="border-yellow-200"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
        />
      </div>

      {/* LEARNING PROGRESS + CONTINUE LEARNING */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LearningProgressCard overallPct={summary.overallProgressPct} courses={courses} />
          <ContinueLearningCard
            course={resumeCourse}
            onContinue={() => onContinueLearning?.(resumeCourse?.enrollmentId ?? '')}
          />
        </div>
        <RecentActivityCard events={activityEvents} />
      </div>

      {/* UPCOMING + ACHIEVEMENTS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingCard upcomingAssessments={upcomingAssessments} pendingAssignmentTitles={pendingAssignmentTitles} />
        <AchievementsCard
          latestCertificate={latestCertificate}
          highestScore={highestScore}
          latestCompletion={latestCompletion}
        />
      </div>

      {/* QUICK ACTIONS */}
      <QuickActions
        onContinueLearning={onContinueLearning}
        onViewCourses={onViewCourses}
        onViewAssessments={onViewAssessments}
        onViewAssignments={onViewAssignments}
        onViewCertificates={onViewCertificates}
        onViewResults={onViewResults}
      />
    </div>
  );
}

export default Dashboard;
