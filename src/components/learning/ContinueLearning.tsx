// src/components/learning/ContinueLearning.tsx

import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useEffect, useMemo, useState } from 'react';
import { loadContinueLearning } from '../../services/continueLearning/continueLearningService';
import { getCurrentUser }       from '../../services/auth/session';
import type { ContinueLearningItem } from '../../types/continueLearning';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ContinueLearningProps {
  onContinue?: (item: ContinueLearningItem) => void;
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
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load continue learning</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
      <p className="font-medium">
        {search
          ? `No courses in progress match "${search}".`
          : 'Nothing to resume yet. Start a course to see it here.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Continue learning card
// ─────────────────────────────────────────────────────────────────────────────

interface ContinueCardProps {
  item:       ContinueLearningItem;
  onContinue: (item: ContinueLearningItem) => void;
}

function ContinueCard({ item, onContinue }: ContinueCardProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">

      {/* Thumbnail */}
      <div className="mb-4 h-32 w-full overflow-hidden rounded-xl bg-slate-100">
        {item.courseThumbnail ? (
          <img
            src={item.courseThumbnail}
            alt={item.courseName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mb-2 min-w-0">
        <p className="truncate text-base font-semibold text-slate-800">{item.courseName}</p>
        {item.courseCode && (
          <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
            {item.courseCode}
          </span>
        )}
      </div>

      {/* Resume point */}
      {item.resumeLesson && (
        <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Resume Lesson
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-700">
            {item.resumeLesson.lessonTitle}
          </p>
          {item.resumeLesson.resource && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Resource: {item.resumeLesson.resource.resourceTitle}
            </p>
          )}
        </div>
      )}

      {/* Progress */}
      <div className="mb-3">
        <ProgressBar value={item.completionPercentage} />
      </div>

      {/* Meta */}
      <div className="mb-4 grid grid-cols-2 gap-y-2 text-xs text-slate-500">
        <div>
          <p className="text-slate-400">Remaining Lessons</p>
          <p className="font-medium text-slate-700">{item.remainingLessons}</p>
        </div>
        <div>
          <p className="text-slate-400">Time Remaining</p>
          <p className="font-medium text-slate-700">
            {item.estimatedMinutesRemaining > 0
              ? `${item.estimatedMinutesRemaining} min`
              : '—'}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-slate-400">Last Accessed</p>
          <p className="font-medium text-slate-700">
            {item.lastAccessedDate
              ? new Date(item.lastAccessedDate).toLocaleString()
              : '—'}
          </p>
        </div>
      </div>

      {/* Action */}
      <div className="mt-auto pt-2">
        <button
          onClick={() => onContinue(item)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Continue
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ContinueLearning
// ─────────────────────────────────────────────────────────────────────────────

function ContinueLearning({ onContinue }: ContinueLearningProps) {
  const user = getCurrentUser();

  const [items,   setItems]   = useState<ContinueLearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    loadContinueLearning(user.id)
      .then(setItems)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load continue learning.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(
      (i) =>
        i.courseName.toLowerCase().includes(kw) ||
        i.courseCode.toLowerCase().includes(kw)
    );
  }, [search, items]);

  function handleContinue(item: ContinueLearningItem) {
    if (onContinue) {
      onContinue(item);
    } else {
      navigate(ROUTES.COURSE_PLAYER.replace(':courseId', item.enrollmentId));
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Continue Learning</h2>
          <p className="mt-1 text-slate-500">Pick up right where you left off.</p>
        </div>
      </div>

      <div className="mb-6">
        <input
          className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          placeholder="Search by course name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <ErrorState message={error} />}

      {loading && <Skeleton />}

      {!loading && !error && filtered.length === 0 && <EmptyState search={search} />}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <ContinueCard key={item.enrollmentId} item={item} onContinue={handleContinue} />
          ))}
        </div>
      )}

    </div>
  );
}

export default ContinueLearning;
