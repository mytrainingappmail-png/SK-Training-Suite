// src/components/learning/MyCourses.tsx
//
// This used to be a clickable list of the employee's own enrolled
// courses — but that let anyone open a course directly, bypassing
// whatever sequencing a Learning Path assigned it through (see
// LearningPathDetail.tsx's unlock_previous gate). It's now a read-only
// catalog of every course the company offers (so an employee can see
// "what training exists here" at a glance), with a nudge toward the
// one real place training is actually launched from.

import { useEffect, useState } from 'react';
import { loadMyCourses }       from '../../services/myCourses/myCourseService';
import { getCurrentUser }      from '../../services/auth/session';
import { loadVisibleCoursesForEmployee } from '../../services/courseVisibility/courseVisibilityService';
import { loadCompany } from '../../services/company/companyService';
import SectionHeroBanner from './SectionHeroBanner';
import ThumbnailCard from '../shared/ThumbnailCard';
import CardPagination from '../shared/CardPagination';
import type { MyCourse } from '../../types/myCourse';
import type { Course, CourseLevel } from '../../types/course';

const DEFAULT_CARDS_PER_PAGE = 12;

const LEVEL_STYLES: Record<CourseLevel, string> = {
  beginner:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  intermediate: 'bg-amber-50   text-amber-700   ring-1 ring-amber-200',
  advanced:     'bg-red-50     text-red-700     ring-1 ring-red-200',
};

function LevelBadge({ level }: { level: CourseLevel }) {
  return (
    <span className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${LEVEL_STYLES[level] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>
      {level}
    </span>
  );
}

function AssignedBadge({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
      Assigned to you · {pct}%
    </span>
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

  const [courses,  setCourses]  = useState<Course[]>([]);
  const [myCourses, setMyCourses] = useState<MyCourse[]>([]);
  const [filtered, setFiltered] = useState<Course[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [cardsPerPage, setCardsPerPage] = useState(DEFAULT_CARDS_PER_PAGE);
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState('');

  function showToast() {
    setToast('Check your Learning Path for assigned courses, or contact your trainer.');
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    // The full company catalog, narrowed to what this employee's
    // designation is allowed to see — same visibility rule the rest of
    // the app already applies, just no longer filtered down to "only
    // what I'm enrolled in" (that's what My Learning Path is for now).
    Promise.all([loadVisibleCoursesForEmployee(user.id), loadMyCourses(user.id)])
      .then(([visibleCourses, myCourseData]) => {
        const active = visibleCourses.filter((c) => c.active);
        setCourses(active);
        setFiltered(active);
        setMyCourses(myCourseData);
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
          c.course_name.toLowerCase().includes(kw) ||
          c.course_code.toLowerCase().includes(kw)
      )
    );
  }, [search, courses]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / cardsPerPage));
  const pagedCourses = filtered.slice(page * cardsPerPage, (page + 1) * cardsPerPage);

  const myCourseByCourseId = new Map(myCourses.map((m) => [m.courseId, m]));
  const assignedCount = courses.filter((c) => myCourseByCourseId.has(c.id)).length;

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        title="Course Catalog"
        subtitle="Every course your company offers. Head to My Learning Path to actually start or continue one."
        statLabel="Assigned to you"
        statValue={`${assignedCount}/${courses.length}`}
      />

    <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-sm">

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700">
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
        This is a browsing list — open your assigned training from <strong className="font-semibold">My Learning Path</strong>.
      </div>

      <div className="mb-6 relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-400/20"
          placeholder="Search by course name or code..."
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
          {search ? `No courses match "${search}".` : 'No courses available yet.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pagedCourses.map((course) => {
            const mine = myCourseByCourseId.get(course.id);
            return (
              <ThumbnailCard
                key={course.id}
                title={course.course_name}
                subtitle={course.course_code}
                thumbnailUrl={course.thumbnail}
                cornerTag={<LevelBadge level={course.level} />}
                onClick={showToast}
              >
                {mine ? (
                  <AssignedBadge pct={mine.completionPercentage} />
                ) : (
                  <span className="text-xs text-slate-400">Not assigned to you</span>
                )}
              </ThumbnailCard>
            );
          })}
        </div>
        <CardPagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

    </div>

    {toast && (
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
        {toast}
      </div>
    )}
    </div>
  );
}

export default MyCourses;
