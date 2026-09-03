// src/components/learning/LearningPathDetail.tsx
//
// Shows the courses inside one Learning Path as a video-library-style
// card grid — the click-through target that was previously missing
// (clicking a path card used to just redirect to My Courses). Courses
// the employee is already enrolled in open straight into the course
// player; courses not yet individually assigned show as locked.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadMyCourses } from '../../services/myCourses/myCourseService';
import { loadLearningPathCourses } from '../../services/learningPathCourse/learningPathCourseService';
import { loadCourses } from '../../services/course/courseService';
import { getCurrentUser } from '../../services/auth/session';
import { ROUTES } from '../../constants/routes';
import ThumbnailCard from '../shared/ThumbnailCard';
import type { MyCourse } from '../../types/myCourse';
import type { Course } from '../../types/course';

interface LearningPathDetailProps {
  learningPathId: string;
  pathName: string;
  onBack: () => void;
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />)}
    </div>
  );
}

interface PathCourseRow {
  courseId: string;
  sequenceNo: number;
  unlockPrevious: boolean;
  course: Course | null;
  enrollment: MyCourse | null;
}

function LockedPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
      Locked
    </span>
  );
}

function LearningPathDetail({ learningPathId, pathName, onBack }: LearningPathDetailProps) {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const [rows, setRows] = useState<PathCourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([loadLearningPathCourses(), loadCourses(), loadMyCourses(user.id)])
      .then(([pathCourses, courses, myCourses]) => {
        const courseById = new Map(courses.map((c) => [c.id, c]));
        const enrollmentByCourseId = new Map(myCourses.map((m) => [m.courseId, m]));
        const list = pathCourses
          .filter((pc) => pc.learning_path_id === learningPathId && pc.active)
          .sort((a, b) => a.sequence_no - b.sequence_no)
          .map((pc) => ({
            courseId: pc.course_id,
            sequenceNo: pc.sequence_no,
            unlockPrevious: pc.unlock_previous,
            course: courseById.get(pc.course_id) ?? null,
            enrollment: enrollmentByCourseId.get(pc.course_id) ?? null,
          }));
        setRows(list);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load path courses.'))
      .finally(() => setLoading(false));
  }, [learningPathId, user?.id]);

  function isPathLocked(row: PathCourseRow): boolean {
    if (!row.unlockPrevious) return false;
    const idx = rows.findIndex((r) => r.courseId === row.courseId);
    if (idx <= 0) return false;
    const prev = rows[idx - 1];
    return prev.enrollment?.status !== 'COMPLETED';
  }

  function openCourse(row: PathCourseRow) {
    if (!row.enrollment || isPathLocked(row)) return;
    navigate(ROUTES.COURSE_PLAYER.replace(':courseId', row.enrollment.enrollmentId));
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Learning Paths
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-800">{pathName}</h2>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}
        {loading && <Skeleton />}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
            No courses have been added to this learning path yet.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const locked = isPathLocked(row);
              return (
                <ThumbnailCard
                  key={row.courseId}
                  title={row.course?.course_name ?? 'Untitled Course'}
                  subtitle={
                    locked
                      ? 'Complete the previous course to unlock'
                      : row.enrollment
                        ? `${row.enrollment.completionPercentage}% complete`
                        : 'Not assigned to you yet'
                  }
                  thumbnailUrl={row.course?.thumbnail ?? row.enrollment?.thumbnail}
                  cornerTag={<span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[11px] font-bold text-white">{row.sequenceNo}</span>}
                  badge={locked ? <LockedPill /> : undefined}
                  disabled={!row.enrollment || locked}
                  onClick={() => openCourse(row)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default LearningPathDetail;
