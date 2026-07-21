// src/pages/Training.tsx
//
// Was 100% hardcoded/static — replaced with real data from the same
// services CourseBuilder/CourseManagement already use. "+ Create Course"
// now navigates to the real Course Builder in the Admin console instead
// of doing nothing.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadCourses } from '../services/course/courseService';
import { loadEnrollments } from '../services/enrollment/enrollmentService';
import { getCurrentUser } from '../services/auth/session';
import { ROUTES } from '../constants/routes';
import type { Course } from '../types/course';

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load courses</p>
      <p className="mt-1">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium transition hover:bg-red-100">
        Try Again
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292v-14.25" />
      </svg>
      <p className="font-medium">No courses yet</p>
      <p className="text-sm">Create your first course to get started.</p>
    </div>
  );
}

function levelLabel(level: Course['level']): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function Training() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [learnerCounts, setLearnerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCourses(), loadEnrollments()])
      .then(([courseRows, enrollmentRows]) => {
        const user = getCurrentUser();
        const visibleCourses = user?.companyId
          ? courseRows.filter((c) => c.company_id === user.companyId)
          : courseRows;

        const counts: Record<string, number> = {};
        enrollmentRows.forEach((e) => {
          counts[e.course_id] = (counts[e.course_id] ?? 0) + 1;
        });

        setCourses(visibleCourses);
        setLearnerCounts(counts);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load courses.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm">

      <div className="mb-8 flex items-center justify-between">

        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Training Management
          </h1>

          <p className="mt-2 text-slate-500">
            Create, organize and manage learning programs.
          </p>
        </div>

        <button
          onClick={() => navigate(ROUTES.ADMIN, { state: { tab: 'course' } })}
          className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold transition hover:bg-yellow-400"
        >
          + Create Course
        </button>

      </div>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAll} />
      ) : courses.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">

          {courses.map((course) => (

            <button
              key={course.id}
              type="button"
              onClick={() => navigate(ROUTES.ADMIN, { state: { tab: 'course-builder', courseId: course.id } })}
              className="rounded-2xl border p-6 text-left transition hover:border-yellow-400 hover:shadow-lg"
            >

              <h2 className="text-xl font-bold">
                {course.course_name}
              </h2>

              <p className="mt-2 text-slate-500">
                {levelLabel(course.level)}
              </p>

              <div className="mt-6 space-y-2 text-sm">

                <div className="flex justify-between">
                  <span>Learners</span>
                  <strong>{learnerCounts[course.id] ?? 0}</strong>
                </div>

                <div className="flex justify-between">
                  <span>Duration</span>
                  <strong>{course.duration_days} Days</strong>
                </div>

                <div className="flex justify-between">
                  <span>Status</span>

                  <strong
                    className={
                      course.active
                        ? "text-green-600"
                        : "text-orange-500"
                    }
                  >
                    {course.active ? "Active" : "Draft"}
                  </strong>

                </div>

              </div>

            </button>

          ))}

        </div>
      )}

    </div>
  );
}

export default Training;