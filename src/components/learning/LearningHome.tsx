// src/components/learning/LearningHome.tsx
//
// Verified imports:
//   react                                     — useEffect, useState
//   ../../services/learning/learningService   — loadLearningHome
//   ../../services/auth/session               — getCurrentUser
//   ../../services/courseVisibility/courseVisibilityService — loadVisibleCoursesForEmployee
//   ../../types/learning                      — LearningHome

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadLearningHome }    from '../../services/learning/learningService';
import { getCurrentUser }      from '../../services/auth/session';
import { loadVisibleCoursesForEmployee } from '../../services/courseVisibility/courseVisibilityService';
import { ROUTES } from '../../constants/routes';
import SectionHeroBanner from './SectionHeroBanner';
import EmployeeOfTheMonthCard from './EmployeeOfTheMonthCard';
import { MiniBarChart, MiniDonutChart } from '../shared/MiniCharts';
import type { LearningHome }   from '../../types/learning';

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct    = Math.min(100, Math.max(0, value));
  const colour = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-500 ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-slate-600">{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED:    'bg-emerald-50 text-emerald-700 ring-emerald-200',
    IN_PROGRESS:  'bg-blue-50    text-blue-700    ring-blue-200',
    PENDING:      'bg-amber-50   text-amber-700   ring-amber-200',
    CANCELLED:    'bg-slate-100  text-slate-500   ring-slate-200',
    completed:    'bg-emerald-50 text-emerald-700 ring-emerald-200',
    in_progress:  'bg-blue-50    text-blue-700    ring-blue-200',
    not_started:  'bg-slate-100  text-slate-500   ring-slate-200',
    active:       'bg-emerald-50 text-emerald-700 ring-emerald-200',
    scheduled:    'bg-violet-50  text-violet-700  ring-violet-200',
  };
  const cls = map[status] ?? 'bg-slate-100 text-slate-500 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function DifficultyBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    beginner:     'bg-emerald-50 text-emerald-700',
    intermediate: 'bg-amber-50   text-amber-700',
    advanced:     'bg-rose-50    text-rose-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[level] ?? 'bg-slate-100 text-slate-500'}`}>
      {level}
    </span>
  );
}

interface SummaryCardProps {
  label:  string;
  value:  number;
  suffix?: string;
  border: string;
  icon:   React.ReactNode;
}

function SummaryCard({ label, value, suffix, border, icon }: SummaryCardProps) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${border}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-800">
        {value}
        {suffix && <span className="ml-1 text-xl font-normal text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
}

function SectionHeader({ title, subtitle, count }: { title: string; subtitle: string; count?: number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {count !== undefined && (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-slate-400">{message}</div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-32 rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1,2,3,4,5,6,7,8].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-slate-100" />
      <div className="h-56 rounded-2xl bg-slate-100" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG)
// ─────────────────────────────────────────────────────────────────────────────

const Ic = {
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
  clip: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
    </svg>
  ),
  progress: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
    </svg>
  ),
  certPlain: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
    </svg>
  ),
  arrow: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// LearningHome
// ─────────────────────────────────────────────────────────────────────────────

export default function LearningHome() {
  const user = getCurrentUser();
  const [data,    setData]    = useState<LearningHome | null>(null);
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

    // Real designation-based visibility, applied on top of whatever
    // loadLearningHome already returns — a course no longer allowed
    // for this employee's designation is removed here, and the
    // summary counts are recomputed so the numbers on screen always
    // match the list actually shown.
    Promise.all([loadLearningHome(user.id), loadVisibleCoursesForEmployee(user.id)])
      .then(([homeData, visibleCourses]) => {
        const visibleCourseIds = new Set(visibleCourses.map((c) => c.id));
        const restrictedCourses = homeData.courses.filter((c) => visibleCourseIds.has(c.courseId));

        const completedCourses = restrictedCourses.filter((c) => c.status === 'COMPLETED').length;
        const inProgressCourses = restrictedCourses.filter((c) => c.status === 'IN_PROGRESS').length;
        const totalCourses = restrictedCourses.length;
        const overallProgressPct = totalCourses > 0
          ? Math.round(restrictedCourses.reduce((sum, c) => sum + c.completionPercentage, 0) / totalCourses)
          : 0;

        setData({
          ...homeData,
          courses: restrictedCourses,
          summary: {
            ...homeData.summary,
            totalCourses,
            completedCourses,
            inProgressCourses,
            overallProgressPct,
          },
        });
      })
      .catch((err: unknown) => {
        console.error('[LearningHome]', err);
        setError(err instanceof Error ? err.message : 'Failed to load learning data.');
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <div>
          <p className="font-semibold">Could not load learning data</p>
          <p className="mt-0.5 text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, courses, paths, assessments, certificates } = data;
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Employee';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Continue learning: in-progress first, then pending, cap at 3
  const continueCourses = [...courses]
    .filter((c) => c.status !== 'COMPLETED' && c.status !== 'CANCELLED')
    .sort((a, b) => b.completionPercentage - a.completionPercentage)
    .slice(0, 3);

  return (
    <div className="space-y-6">

      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <SectionHeroBanner
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        title={`${greeting}, ${fullName} 👋`}
        subtitle={
          summary.inProgressCourses > 0
            ? `${summary.inProgressCourses} course${summary.inProgressCourses > 1 ? 's' : ''} in progress`
            : summary.totalCourses === 0
            ? 'No courses assigned yet'
            : 'All courses completed — great work!'
        }
        statLabel="Overall Progress"
        statValue={`${summary.overallProgressPct}%`}
      />

      <EmployeeOfTheMonthCard />

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <SummaryCard label="My Courses"      value={summary.totalCourses}       border="border-blue-100"   icon={Ic.book}     />
        <SummaryCard label="Completed"        value={summary.completedCourses}   border="border-emerald-100" icon={Ic.check}    />
        <SummaryCard label="In Progress"      value={summary.inProgressCourses}  border="border-amber-100"  icon={Ic.clock}    />
        <SummaryCard label="Learning Paths"   value={summary.totalPaths}         border="border-violet-100" icon={Ic.path}     />
        <SummaryCard label="Assessments"      value={summary.totalAssessments}   border="border-rose-100"   icon={Ic.clip}     />
        <SummaryCard label="Certificates"     value={summary.totalCertificates}  border="border-yellow-100" icon={Ic.award}    />
        <SummaryCard label="Paths Done"       value={summary.completedPaths}     border="border-cyan-100"   icon={Ic.progress} />
        <SummaryCard label="Overall" value={summary.overallProgressPct} suffix="%" border="border-slate-200" icon={Ic.progress} />
      </div>

      {/* ── Charts ────────────────────────────────────────────────────────────── */}
      {courses.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-slate-800">Course Completion</h3>
            <MiniBarChart
              data={courses.slice(0, 8).map((c) => ({ label: c.courseName, value: c.completionPercentage }))}
              color="#6366F1"
              maxValue={100}
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-slate-800">Course Status</h3>
            <MiniDonutChart data={[
              { label: 'Completed', value: courses.filter((c) => c.status === 'COMPLETED').length, color: '#10B981' },
              { label: 'In Progress', value: courses.filter((c) => c.status === 'IN_PROGRESS').length, color: '#3B82F6' },
              { label: 'Pending', value: courses.filter((c) => c.status !== 'COMPLETED' && c.status !== 'IN_PROGRESS').length, color: '#CBD5E1' },
            ]} />
          </div>
        </div>
      )}

      {/* ── Continue Learning ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title="Continue Learning"
          subtitle="Pick up where you left off."
          count={continueCourses.length}
        />

        {continueCourses.length === 0 ? (
          <EmptySection message={summary.totalCourses === 0 ? 'No courses assigned yet.' : 'All assigned courses completed!'} />
        ) : (
          <div className="divide-y divide-slate-100">
            {continueCourses.map((course) => (
              <div key={course.enrollmentId} className="flex flex-wrap items-center gap-4 px-6 py-4 transition hover:bg-slate-50/60">
                {/* Thumbnail / icon */}
                <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      {Ic.book}
                    </div>
                  )}
                </div>

                {/* Info */}
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
                      Due {new Date(course.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => console.info('[LearningHome] Continue:', course.courseId)}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
                >
                  {course.completionPercentage > 0 ? 'Continue' : 'Start'}
                  {Ic.arrow}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── My Courses (full list) ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader title="My Courses" subtitle="All assigned courses." count={courses.length} />

        {courses.length === 0 ? (
          <EmptySection message="No courses assigned yet. Your administrator will assign courses shortly." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Course', 'Code', 'Progress', 'Status', 'Due Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {courses.map((c) => (
                  <tr key={c.enrollmentId} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.courseName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.courseCode || '—'}</td>
                    <td className="w-40 px-4 py-3"><ProgressBar value={c.completionPercentage} /></td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.dueDate ? new Date(c.dueDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Learning Paths ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader title="Learning Paths" subtitle="Structured learning journeys." count={paths.length} />

        {paths.length === 0 ? (
          <EmptySection message="No learning paths enrolled yet." />
        ) : (
          <div className="divide-y divide-slate-100">
            {paths.map((p) => (
              <div key={p.progressId} className="flex flex-wrap items-center gap-4 px-6 py-4 transition hover:bg-slate-50/60">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-400">
                  {Ic.path}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800">{p.pathName}</p>
                    {p.pathCode && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                        {p.pathCode}
                      </span>
                    )}
                    <DifficultyBadge level={p.difficultyLevel} />
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={p.progressPercentage} />
                  </div>
                  {p.estimatedDuration > 0 && (
                    <p className="mt-1 text-xs text-slate-400">~{p.estimatedDuration}h estimated</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Assessments ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader title="Assessments" subtitle="Tests and evaluations assigned to you." count={assessments.length} />

        {assessments.length === 0 ? (
          <EmptySection message="No assessments assigned yet." />
        ) : (
          <div className="divide-y divide-slate-100">
            {assessments.map((a) => (
              <div key={a.assignmentId} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition hover:bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-400">
                    {Ic.clip}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{a.assessmentTitle}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      {a.assessmentCode && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                          {a.assessmentCode}
                        </span>
                      )}
                      <StatusBadge status={a.status} />
                      {a.endDate && (
                        <span className="text-xs text-slate-400">
                          Due {new Date(a.endDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  to={ROUTES.MY_ASSESSMENTS}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                >
                  Take Test {Ic.arrow}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Certificates ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader title="My Certificates" subtitle="Certificates you have earned." count={certificates.length} />

        {certificates.length === 0 ? (
          <EmptySection message="No certificates earned yet. Complete a course to earn your first certificate." />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="flex flex-col justify-between rounded-2xl border border-yellow-100 bg-gradient-to-br from-yellow-50 to-white p-5 shadow-sm"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600">
                  {Ic.award}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 leading-snug">{cert.certificateTitle}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{cert.certificateNo}</p>
                  {cert.issueDate && (
                    <p className="mt-1 text-xs text-slate-400">
                      Issued {new Date(cert.issueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Link
                  to={ROUTES.CERTIFICATE_VIEW.replace(':certificateId', cert.id)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-700 hover:underline"
                >
                  View Certificate {Ic.arrow}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}