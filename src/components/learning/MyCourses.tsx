import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadMyCourses }       from '../../services/myCourses/myCourseService';
import { getCurrentUser }      from '../../services/auth/session';
import { loadVisibleCoursesForEmployee } from '../../services/courseVisibility/courseVisibilityService';
import { loadCompany } from '../../services/company/companyService';
import { ROUTES } from '../../constants/routes';
import SectionHeroBanner from './SectionHeroBanner';
import ThumbnailCard from '../shared/ThumbnailCard';
import CardPagination from '../shared/CardPagination';
import type { MyCourse, MyCourseStatus } from '../../types/myCourse';

const DEFAULT_CARDS_PER_PAGE = 12;

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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />)}
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
  const [cardsPerPage, setCardsPerPage] = useState(DEFAULT_CARDS_PER_PAGE);
  const [page, setPage] = useState(0);

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

    loadCompany()
      .then((c) => setCardsPerPage(c?.cards_per_page || DEFAULT_CARDS_PER_PAGE))
      .catch(() => setCardsPerPage(DEFAULT_CARDS_PER_PAGE));
  }, [user?.id]);

  useEffect(() => {
    const kw = search.trim().toLowerCase();
    setPage(0);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / cardsPerPage));
  const pagedCourses = filtered.slice(page * cardsPerPage, (page + 1) * cardsPerPage);

  function openCourse(course: MyCourse) {
    navigate(ROUTES.COURSE_PLAYER.replace(':courseId', course.enrollmentId));
  }

  const completedCount = courses.filter((c) => c.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        title="My Courses"
        subtitle="All courses assigned to you."
        statLabel="Completed"
        statValue={`${completedCount}/${courses.length}`}
      />

    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

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
        <>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pagedCourses.map((course) => (
            <ThumbnailCard
              key={course.enrollmentId}
              title={course.courseName}
              subtitle={[course.courseCode, course.categoryName].filter(Boolean).join(' · ')}
              thumbnailUrl={course.thumbnail}
              cornerTag={<StatusBadge status={course.status} />}
              disabled={course.status === 'CANCELLED' || course.status === 'EXPIRED'}
              onClick={() => openCourse(course)}
            >
              <ProgressBar value={course.completionPercentage} />
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {(course.durationDays > 0 || course.durationHours > 0) && (
                  <span>
                    {course.durationDays > 0 && `${course.durationDays}d `}
                    {course.durationHours > 0 && `${course.durationHours}h`}
                  </span>
                )}
                {course.dueDate && <span>Due: {new Date(course.dueDate).toLocaleDateString()}</span>}
              </div>
            </ThumbnailCard>
          ))}
        </div>
        <CardPagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

    </div>
    </div>
  );
}

export default MyCourses;