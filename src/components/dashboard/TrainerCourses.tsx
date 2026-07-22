// src/components/dashboard/TrainerCourses.tsx
//
// Real "My Courses" — every course a Trainer teaches, with real
// module/lesson counts, batch status breakdown, and average
// completion across students.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadTrainerCourses } from '../../services/trainerWorkspace/trainerCoursesService';
import type { TrainerCourseRow } from '../../services/trainerWorkspace/trainerCoursesService';

function StatChip({ label, value, className }: { label: string; value: number | string; className: string }) {
  return (
    <div className={`rounded-xl px-3 py-2 text-center ${className}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
    </div>
  );
}

function TrainerCourses() {
  const user = getCurrentUser();
  const [courses, setCourses] = useState<TrainerCourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    loadTrainerCourses(user.id)
      .then(setCourses)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load courses.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">My Courses</h2>
        <p className="mt-0.5 text-sm text-slate-500">Every course you teach, with content size and student progress.</p>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          No courses assigned to you yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {courses.map((c) => (
            <div key={c.courseId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-3 text-base font-bold text-slate-800">{c.courseName}</p>

              <div className="mb-4 grid grid-cols-4 gap-2">
                <StatChip label="Modules" value={c.moduleCount} className="bg-indigo-50 text-indigo-700" />
                <StatChip label="Lessons" value={c.lessonCount} className="bg-violet-50 text-violet-700" />
                <StatChip label="Batches" value={c.totalBatches} className="bg-amber-50 text-amber-700" />
                <StatChip label="Students" value={c.totalStudents} className="bg-emerald-50 text-emerald-700" />
              </div>

              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{c.ongoingBatches} Ongoing</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{c.completedBatches} Completed</span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{c.plannedBatches} Planned</span>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">Average Completion</span>
                  <span className="font-semibold text-slate-700">{c.averageCompletion}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${c.averageCompletion}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TrainerCourses;
