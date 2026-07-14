// src/components/learning/MyProgress.tsx

import { useEffect, useMemo, useState } from 'react';
import { loadMyProgress } from '../../services/myProgress/myProgressService';
import { getCurrentUser } from '../../services/auth/session';
import type { MyProgress as MyProgressData } from '../../types/myProgress';

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct    = Math.min(100, Math.max(0, value));
  const colour = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-semibold text-slate-600">{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label:   string;
  value:   string | number;
  accent:  string;
  icon:    React.ReactNode;
}

function SummaryCard({ label, value, accent, icon }: SummaryCardProps) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${accent}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load progress</p>
      <p className="mt-1">{message}</p>
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
// Main MyProgress
// ─────────────────────────────────────────────────────────────────────────────

function MyProgress() {
  const user = getCurrentUser();

  const [progress, setProgress] = useState<MyProgressData | null>(null);
  const [loading,   setLoading] = useState(true);
  const [error,     setError]   = useState('');
  const [search,    setSearch]  = useState('');

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    loadMyProgress(user.id)
      .then(setProgress)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load progress.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const kw = search.trim().toLowerCase();

  const filteredCourses = useMemo(() => {
    if (!progress) return [];
    if (!kw) return progress.courses;
    return progress.courses.filter(
      (c) =>
        c.courseName.toLowerCase().includes(kw) ||
        c.courseCode.toLowerCase().includes(kw)
    );
  }, [progress, kw]);

  const filteredPaths = useMemo(() => {
    if (!progress) return [];
    if (!kw) return progress.learningPaths;
    return progress.learningPaths.filter(
      (p) =>
        p.pathName.toLowerCase().includes(kw) ||
        p.pathCode.toLowerCase().includes(kw)
    );
  }, [progress, kw]);

  const filteredAssessments = useMemo(() => {
    if (!progress) return [];
    if (!kw) return progress.assessments;
    return progress.assessments.filter(
      (a) =>
        a.assessmentTitle.toLowerCase().includes(kw) ||
        a.assessmentCode.toLowerCase().includes(kw)
    );
  }, [progress, kw]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
        <Skeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
        <ErrorState message={error} />
      </div>
    );
  }

  if (!progress) return null;

  const { summary } = progress;
  const hasAnyData =
    summary.totalCourses > 0 ||
    summary.totalLearningPaths > 0 ||
    summary.totalAssessmentAttempts > 0;

  return (
    <div className="space-y-6">

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">My Progress</h2>
            <p className="mt-1 text-slate-500">
              Your overall learning progress across courses, paths and assessments.
            </p>
          </div>
          {summary.lastActivityDate && (
            <p className="text-sm text-slate-400">
              Last activity: {new Date(summary.lastActivityDate).toLocaleString()}
            </p>
          )}
        </div>

        {!hasAnyData ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            <p className="font-medium">
              No progress data yet. Start a course, learning path or assessment to see your progress here.
            </p>
          </div>
        ) : (
          <>
            {/* Overall summary cards */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Overall Course Progress"
                value={`${summary.overallCourseProgressPct}%`}
                accent="border-slate-200"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                }
              />
              <SummaryCard
                label="Courses Completed"
                value={`${summary.coursesCompleted} / ${summary.totalCourses}`}
                accent="border-emerald-200"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                }
              />
              <SummaryCard
                label="Courses In Progress"
                value={summary.coursesInProgress}
                accent="border-blue-200"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                }
              />
              <SummaryCard
                label="Assessments Passed"
                value={`${summary.assessmentsPassed} / ${summary.totalAssessmentAttempts}`}
                accent="border-amber-200"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                }
              />
            </div>

            {/* Assessment average score strip */}
            <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Average Assessment Score
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {summary.averageAssessmentScore}%
                  </p>
                </div>
                <div className="max-w-xs flex-1">
                  <ProgressBar value={summary.averageAssessmentScore} />
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="mb-6">
              <input
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
                placeholder="Search courses, learning paths or assessments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Courses breakdown */}
            <div className="mb-8">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Course Progress ({filteredCourses.length})
              </h3>
              {filteredCourses.length === 0 ? (
                <EmptySection
                  message={kw ? `No courses match "${search}".` : 'No course enrollments yet.'}
                />
              ) : (
                <div className="space-y-3">
                  {filteredCourses.map((c) => (
                    <div
                      key={c.enrollmentId}
                      className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-slate-800">{c.courseName}</p>
                          {c.courseCode && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                              {c.courseCode}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 max-w-sm">
                          <ProgressBar value={c.completionPercentage} />
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right text-xs text-slate-400">
                        <p className="capitalize">{c.status.replace('_', ' ').toLowerCase()}</p>
                        {c.lastActivityDate && (
                          <p className="mt-1">
                            {new Date(c.lastActivityDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Learning path breakdown */}
            <div className="mb-8">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Learning Path Progress ({filteredPaths.length})
              </h3>
              {filteredPaths.length === 0 ? (
                <EmptySection
                  message={kw ? `No learning paths match "${search}".` : 'No learning path progress yet.'}
                />
              ) : (
                <div className="space-y-3">
                  {filteredPaths.map((p) => (
                    <div
                      key={p.progressId}
                      className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-slate-800">{p.pathName}</p>
                          {p.pathCode && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                              {p.pathCode}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 max-w-sm">
                          <ProgressBar value={p.progressPercentage} />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {p.completedCourses} / {p.totalCourses} courses completed
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right text-xs text-slate-400">
                        <p className="capitalize">{p.status.replace('_', ' ')}</p>
                        {p.lastActivityDate && (
                          <p className="mt-1">
                            {new Date(p.lastActivityDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assessment breakdown */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Assessment Attempts ({filteredAssessments.length})
              </h3>
              {filteredAssessments.length === 0 ? (
                <EmptySection
                  message={kw ? `No assessments match "${search}".` : 'No assessment attempts yet.'}
                />
              ) : (
                <div className="space-y-3">
                  {filteredAssessments.map((a) => (
                    <div
                      key={a.attemptId}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-slate-800">{a.assessmentTitle}</p>
                          {a.assessmentCode && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                              {a.assessmentCode}
                            </span>
                          )}
                        </div>
                        {a.attemptDate && (
                          <p className="mt-1 text-xs text-slate-400">
                            {new Date(a.attemptDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          a.passed
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                        }`}
                      >
                        {a.percentage.toFixed(1)}% — {a.passed ? 'Passed' : 'Not Passed'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MyProgress;
