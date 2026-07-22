import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadMyCourses }       from '../../services/myCourses/myCourseService';
import { getCurrentUser }      from '../../services/auth/session';
import { loadVisibleCoursesForEmployee } from '../../services/courseVisibility/courseVisibilityService';
import { ROUTES } from '../../constants/routes';
import type { MyCourse, MyCourseStatus } from '../../types/myCourse';

const STATUS_STYLES: Record<MyCourseStatus, string> = {
  COMPLETED:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  IN_PROGRESS: 'bg-blue-50    text-blue-700    ring-1 ring-blue-200',
  PENDING:     'bg-amber-50   text-amber-700   ring-1 ring-amber-200',
  EXPIRED:     'bg-red-50     text-red-700     ring-1 ring-red-200',
  CANCELLED:   'bg-slate-100  text-slate-500   ring-1 ring-slate-200',
};

function StatusBadge({ status }: { status: MyCourseStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

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
      <span className="w-8 text-right text-xs font-semibold text-slate-600">{pct}%</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

function MyCourses() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const [courses,  setCourses]  = useState<MyCourse[]>([]);
  const [filtered, setFiltered] = useState<MyCourse[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    // Real designation-based visibility, on top of the existing
    // enrollment-based list — a course that was assigned before its
    // visibility rules changed will no longer show here if it's no
    // longer allowed for this employee's designation.
    Promise.all([loadMyCourses(user.id), loadVisibleCoursesForEmployee(user.id)])
      .then(([data, visibleCourses]) => {
        const visibleCourseIds = new Set(visibleCourses.map((c) => c.id));
        const restricted = data.filter((c) => visibleCourseIds.has(c.courseId));
        setCourses(restricted);
        setFiltered(restricted);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load courses.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) {
      setFiltered(courses);
      return;
    }
    setFiltered(
      courses.filter(
        (c) =>
          c.courseName.toLowerCase().includes(kw)   ||
          c.courseCode.toLowerCase().includes(kw)   ||
          c.categoryName.toLowerCase().includes(kw)
      )
    );
  }, [search, courses]);

  function openCourse(course: MyCourse) {
    navigate(ROUTES.COURSE_PLAYER.replace(':courseId', course.enrollmentId));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Courses</h2>
          <p className="mt-1 text-slate-500">All courses assigned to you.</p>
        </div>
      </div>

      <div className="mb-6">
        <input
          className="w-full rounded-xl border p-3"
          placeholder="Search by course name, code or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {loading && <Skeleton />}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
          {search
            ? `No courses match "${search}".`
            : 'No courses assigned yet. Your administrator will assign courses shortly.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((course) => (
            <div
              key={course.enrollmentId}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50/60"
            >
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {course.thumbnail ? (
                  <img
                    src={course.thumbnail}
                    alt={course.courseName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-slate-800">{course.courseName}</p>
                  {course.courseCode && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                      {course.courseCode}
                    </span>
                  )}
                  {course.categoryName && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-600">
                      {course.categoryName}
                    </span>
                  )}
                  <StatusBadge status={course.status} />
                </div>

                <div className="mt-2 max-w-sm">
                  <ProgressBar value={course.completionPercentage} />
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  {(course.durationDays > 0 || course.durationHours > 0) && (
                    <span>
                      {course.durationDays > 0 && `${course.durationDays}d `}
                      {course.durationHours > 0 && `${course.durationHours}h`}
                    </span>
                  )}
                  {course.dueDate && (
                    <span>Due: {new Date(course.dueDate).toLocaleDateString()}</span>
                  )}
                  {course.completedAt && (
                    <span>Completed: {new Date(course.completedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <button
                className="flex-shrink-0 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={course.status === 'CANCELLED' || course.status === 'EXPIRED'}
                onClick={() => openCourse(course)}
              >
                {course.status === 'COMPLETED'
                  ? 'Review'
                  : course.completionPercentage > 0
                  ? 'Continue'
                  : 'Start'}
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default MyCourses;