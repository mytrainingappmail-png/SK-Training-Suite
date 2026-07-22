// src/components/learning/MyLearningPaths.tsx

import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useEffect, useMemo, useState } from 'react';
import { loadMyLearningPaths } from '../../services/myLearningPath/myLearningPathService';
import { getCurrentUser }      from '../../services/auth/session';
import type { MyLearningPath, MyLearningPathStatus } from '../../types/myLearningPath';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface MyLearningPathsProps {
  onOpenPath?: (learningPathId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty badge
// ─────────────────────────────────────────────────────────────────────────────

const DIFFICULTY_STYLES: Record<string, string> = {
  beginner:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  intermediate: 'bg-amber-50   text-amber-700   ring-1 ring-amber-200',
  advanced:     'bg-red-50     text-red-700     ring-1 ring-red-200',
};

function DifficultyBadge({ level }: { level: string }) {
  const style = DIFFICULTY_STYLES[level] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {level || 'Beginner'}
    </span>
  );
}

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
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load learning paths</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
      <p className="font-medium">
        {search
          ? `No learning paths match "${search}".`
          : 'No learning paths assigned yet. Your administrator will assign a path shortly.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Learning path card
// ─────────────────────────────────────────────────────────────────────────────

interface PathCardProps {
  path:   MyLearningPath;
  onOpen: (learningPathId: string) => void;
}

const STATUS_ACTION_LABEL: Record<MyLearningPathStatus, string> = {
  not_started: 'Start Learning',
  in_progress: 'Continue Learning',
  completed:   'Review Path',
};

function PathCard({ path, onOpen }: PathCardProps) {
  const isCompleted = path.status === 'completed';

  return (
    <div className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">

      {isCompleted && (
        <span className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Completed
        </span>
      )}

      {/* Thumbnail */}
      <div className="mb-4 h-28 w-full overflow-hidden rounded-xl bg-slate-100">
        {path.thumbnailUrl ? (
          <img src={path.thumbnailUrl} alt={path.pathName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443" />
            </svg>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-800">{path.pathName}</p>
          {path.pathCode && (
            <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
              {path.pathCode}
            </span>
          )}
        </div>
        <DifficultyBadge level={path.difficultyLevel} />
      </div>

      {/* Description */}
      {path.description && (
        <p className="mb-3 line-clamp-2 text-sm text-slate-500">{path.description}</p>
      )}

      {/* Progress */}
      <div className="mb-3">
        <ProgressBar value={path.progressPercentage} />
      </div>

      {/* Meta */}
      <div className="mb-4 grid grid-cols-2 gap-y-2 text-xs text-slate-500">
        <div>
          <p className="text-slate-400">Estimated Duration</p>
          <p className="font-medium text-slate-700">
            {path.estimatedDuration > 0 ? `${path.estimatedDuration} hrs` : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Courses</p>
          <p className="font-medium text-slate-700">
            {path.completedCourses} / {path.totalCourses}
          </p>
        </div>
        {path.dueDate && (
          <div>
            <p className="text-slate-400">Due Date</p>
            <p className="font-medium text-slate-700">
              {new Date(path.dueDate).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Action */}
      <div className="mt-auto pt-2">
        <button
          onClick={() => onOpen(path.learningPathId)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          {STATUS_ACTION_LABEL[path.status]}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MyLearningPaths
// ─────────────────────────────────────────────────────────────────────────────

function MyLearningPaths({ onOpenPath }: MyLearningPathsProps) {
  const user = getCurrentUser();
const navigate = useNavigate();
  const [paths,   setPaths]   = useState<MyLearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    loadMyLearningPaths(user.id)
      .then(setPaths)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load learning paths.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return paths;
    return paths.filter(
      (p) =>
        p.pathName.toLowerCase().includes(kw) ||
        p.pathCode.toLowerCase().includes(kw)
    );
  }, [search, paths]);

  function handleOpen(learningPathId: string) {
    if (onOpenPath) {
      onOpenPath(learningPathId);
    } else {
      navigate(ROUTES.MY_COURSES);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Learning Paths</h2>
          <p className="mt-1 text-slate-500">All learning paths assigned to you.</p>
        </div>
      </div>

      <div className="mb-6">
        <input
          className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          placeholder="Search by path name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <ErrorState message={error} />}

      {loading && <Skeleton />}

      {!loading && !error && filtered.length === 0 && <EmptyState search={search} />}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((path) => (
            <PathCard key={path.enrollmentId} path={path} onOpen={handleOpen} />
          ))}
        </div>
      )}

    </div>
  );
}

export default MyLearningPaths;
