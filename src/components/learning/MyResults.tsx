// src/components/learning/MyResults.tsx
//
// Professional Training App Results Center — Dashboard + Detail page,
// self-contained in this one file.
//
// Reuses only existing, unmodified services:
//   assessmentResultService.loadResults() — assessment_results (this
//                                            employee's rows filtered
//                                            client-side)
//   assessmentService.loadAssessments()   — assessment_title/code and the
//                                            lesson_id used to resolve
//                                            Course (assessment -> lesson ->
//                                            module -> course, the same
//                                            existing chain reused
//                                            elsewhere in this app)
//   lessonBuilderService.loadLessons()    — module_id
//   moduleService.loadModules()           — course_id
//   courseService.loadCourses()           — course_name
//   myAssessmentService.loadMyAssessments() — attempt/attempts-allowed
//                                              counts, for the Retake gate
//   session.getCurrentUser()              — current employee
//
// No repository, service, or database changes. Attempt Number is derived
// honestly from the ordinal position of this employee's own results for
// the same assessment (real timestamps, not fabricated). Time Taken and
// per-question review detail have no safe, side-effect-free existing
// service exposing them for a submitted attempt, so those sections are
// gracefully hidden rather than faked.

import { useEffect, useMemo, useState } from 'react';
import { loadResults }        from '../../services/assessmentResult/assessmentResultService';
import { loadAssessments }    from '../../services/assessment/assessmentService';
import { loadLessons }        from '../../services/lessonBuilder/lessonBuilderService';
import { loadModules }        from '../../services/module/moduleService';
import { loadCourses }        from '../../services/course/courseService';
import { loadMyAssessments }  from '../../services/myAssessment/myAssessmentService';
import { getCurrentUser }     from '../../services/auth/session';
import SectionHeroBanner from './SectionHeroBanner';

import type { AssessmentResult } from '../../types/assessmentResult';
import type { Assessment }       from '../../types/assessment';
import type { Lesson }           from '../../types/lessonBuilder';
import type { Module }           from '../../types/module';
import type { Course }           from '../../types/course';
import type { MyAssessment }     from '../../types/myAssessment';

// ─────────────────────────────────────────────────────────────────────────────
// View model
// ─────────────────────────────────────────────────────────────────────────────

interface MyResultItem {
  result:         AssessmentResult;
  assessmentTitle: string;
  assessmentCode:  string;
  courseName:      string | null;
  attemptNumber:   number;
  canRetake:       boolean;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function buildResultItems(
  results:      AssessmentResult[],
  assessments:  Assessment[],
  lessons:      Lesson[],
  modules:      Module[],
  courses:      Course[],
  myAssessments: MyAssessment[],
): MyResultItem[] {
  const attemptOrder = new Map<string, string[]>(); // assessment_id -> ordered result ids (by evaluated_at asc)
  const byAssessment = new Map<string, AssessmentResult[]>();
  results.forEach((r) => {
    const list = byAssessment.get(r.assessment_id) ?? [];
    list.push(r);
    byAssessment.set(r.assessment_id, list);
  });
  byAssessment.forEach((list, assessmentId) => {
    const ordered = [...list].sort((a, b) => new Date(a.evaluated_at).getTime() - new Date(b.evaluated_at).getTime());
    attemptOrder.set(assessmentId, ordered.map((r) => r.id));
  });

  return results.map((result) => {
    const assessment = assessments.find((a) => a.id === result.assessment_id) ?? null;
    const lesson = assessment ? lessons.find((l) => l.id === assessment.lesson_id) ?? null : null;
    const mod = lesson ? modules.find((m) => m.id === lesson.module_id) ?? null : null;
    const course = mod ? courses.find((c) => c.id === mod.course_id) ?? null : null;

    const order = attemptOrder.get(result.assessment_id) ?? [];
    const attemptNumber = Math.max(1, order.indexOf(result.id) + 1);

    const myAssessment = myAssessments.find((a) => a.assessmentId === result.assessment_id) ?? null;
    const canRetake = myAssessment ? myAssessment.attemptCount < myAssessment.maximumAttempts : false;

    return {
      result,
      assessmentTitle: assessment?.assessment_title ?? 'Assessment',
      assessmentCode:  assessment?.assessment_code  ?? '',
      courseName:      course?.course_name ?? null,
      attemptNumber,
      canRetake,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load results</p>
      <p className="mt-1">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium transition hover:bg-red-100"
      >
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
      <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
      </svg>
      <p className="font-medium">
        {search ? `No results match "${search}".` : 'No assessment results yet. Complete an assessment to see your results here.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics summary
// ─────────────────────────────────────────────────────────────────────────────

function AnalyticsSummary({ items }: { items: MyResultItem[] }) {
  if (items.length === 0) return null;

  const average = items.reduce((sum, i) => sum + i.result.percentage, 0) / items.length;
  const highest = Math.max(...items.map((i) => i.result.percentage));
  const passCount = items.filter((i) => i.result.passed).length;
  const passPercent = (passCount / items.length) * 100;

  const stats = [
    { label: 'Average Score', value: `${average.toFixed(1)}%` },
    { label: 'Highest Score', value: `${highest.toFixed(1)}%` },
    { label: 'Pass %', value: `${passPercent.toFixed(0)}%` },
    { label: 'Completed Assessments', value: `${items.length}` },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result card (dashboard)
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ item, onOpen }: { item: MyResultItem; onOpen: () => void }) {
  const { result } = item;
  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-800">{item.assessmentTitle}</p>
          {item.courseName && <p className="mt-0.5 truncate text-sm text-slate-500">{item.courseName}</p>}
        </div>
        <span
          className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            result.passed ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}
        >
          {result.passed ? 'Passed' : 'Failed'}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-y-2 text-xs text-slate-500">
        <div>
          <p className="text-slate-400">Attempt</p>
          <p className="font-medium text-slate-700">#{item.attemptNumber}</p>
        </div>
        <div>
          <p className="text-slate-400">Score</p>
          <p className="font-medium text-slate-700">{result.obtained_marks} / {result.total_marks}</p>
        </div>
        <div>
          <p className="text-slate-400">Percentage</p>
          <p className="font-medium text-slate-700">{result.percentage.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-slate-400">Submission Date</p>
          <p className="font-medium text-slate-700">{formatDate(result.evaluated_at)}</p>
        </div>
      </div>

      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-yellow-600">
        View Details
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail page
// ─────────────────────────────────────────────────────────────────────────────

function ResultDetail({
  item, onBack, onRetake,
}: {
  item:     MyResultItem;
  onBack:   () => void;
  onRetake?: (assessmentId: string) => void;
}) {
  const { result } = item;
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  }

  function handleDownload() {
    const lines = [
      `Assessment: ${item.assessmentTitle}`,
      item.assessmentCode ? `Code: ${item.assessmentCode}` : '',
      item.courseName ? `Course: ${item.courseName}` : '',
      `Attempt: #${item.attemptNumber}`,
      `Score: ${result.obtained_marks} / ${result.total_marks} (${result.percentage.toFixed(1)}%)`,
      `Result: ${result.passed ? 'Passed' : 'Failed'}`,
      result.grade ? `Grade: ${result.grade}` : '',
      result.rank > 0 ? `Rank: ${result.rank}` : '',
      `Submission Date: ${formatDate(result.evaluated_at)}`,
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.assessmentTitle.replace(/[^a-z0-9]+/gi, '_')}_result.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  function handleRetake() {
    if (onRetake) {
      onRetake(result.assessment_id);
    } else {
      showToast('Open My Assessments to retake this assessment.');
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to My Results
      </button>

      <div className="mb-8 border-b border-slate-100 pb-6">
        <h2 className="text-2xl font-bold text-slate-800">{item.assessmentTitle}</h2>
        <p className="mt-1 text-slate-500">{item.courseName ?? 'Assessment Summary'}</p>
      </div>

      <div
        className={`mb-8 flex flex-col items-center justify-center gap-2 rounded-2xl p-8 text-center ${
          result.passed ? 'bg-emerald-50' : 'bg-red-50'
        }`}
      >
        <p className={`text-5xl font-bold ${result.passed ? 'text-emerald-600' : 'text-red-600'}`}>
          {result.percentage.toFixed(1)}%
        </p>
        <p className={`text-lg font-semibold ${result.passed ? 'text-emerald-700' : 'text-red-700'}`}>
          {result.passed ? 'Passed' : 'Failed'}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{result.obtained_marks} / {result.total_marks}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Attempt</p>
          <p className="mt-1 text-xl font-bold text-slate-800">#{item.attemptNumber}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Grade</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{result.grade || '—'}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rank</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{result.rank > 0 ? `#${result.rank}` : '—'}</p>
        </div>
      </div>

      <p className="mb-8 text-center text-sm text-slate-400">
        Submitted {formatDate(result.evaluated_at)}
      </p>

      {result.remarks && (
        <div className="mb-8 rounded-2xl border border-slate-200 p-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Remarks</h3>
          <p className="text-sm text-slate-700">{result.remarks}</p>
        </div>
      )}

      {/* Question Review */}
      <div className="mb-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Question Review</h3>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="font-medium text-slate-500">Detailed question-by-question review isn't available for submitted attempts yet.</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Download Result
        </button>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Print
        </button>
        {item.canRetake && (
          <button
            onClick={handleRetake}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
          >
            Retake Assessment
          </button>
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

// ─────────────────────────────────────────────────────────────────────────────
// Main MyResults
// ─────────────────────────────────────────────────────────────────────────────

interface MyResultsProps {
  onRetake?: (assessmentId: string) => void;
}

type StatusFilter = 'all' | 'passed' | 'failed';
type SortOption   = 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc' | 'name_asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_desc',  label: 'Newest First' },
  { value: 'date_asc',   label: 'Oldest First' },
  { value: 'score_desc', label: 'Highest Score' },
  { value: 'score_asc',  label: 'Lowest Score' },
  { value: 'name_asc',   label: 'Assessment Name (A–Z)' },
];

function MyResults({ onRetake }: MyResultsProps) {
  const user = getCurrentUser();

  const [items,   setItems]   = useState<MyResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [search,       setSearch]       = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption,   setSortOption]   = useState<SortOption>('date_desc');
  const [activeResultId, setActiveResultId] = useState('');

  function fetchAll() {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([
      loadResults(),
      loadAssessments(),
      loadLessons(),
      loadModules(),
      loadCourses(),
      loadMyAssessments(user.id),
    ])
      .then(([resultRows, assessmentRows, lessonRows, moduleRows, courseRows, myAssessmentRows]) => {
        const mine = resultRows.filter((r) => r.employee_id === user.id);
        setItems(buildResultItems(mine, assessmentRows, lessonRows, moduleRows, courseRows, myAssessmentRows));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load results.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const courseOptions = useMemo(() => {
    const names = new Set(items.map((i) => i.courseName).filter((n): n is string => !!n));
    return Array.from(names);
  }, [items]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    let list = items.filter((item) => {
      const matchesSearch =
        !kw ||
        item.assessmentTitle.toLowerCase().includes(kw) ||
        item.assessmentCode.toLowerCase().includes(kw) ||
        (item.courseName ?? '').toLowerCase().includes(kw);
      const matchesCourse = courseFilter === 'all' || item.courseName === courseFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'passed' ? item.result.passed : !item.result.passed);
      return matchesSearch && matchesCourse && matchesStatus;
    });

    list = [...list].sort((a, b) => {
      if (sortOption === 'date_desc') return new Date(b.result.evaluated_at).getTime() - new Date(a.result.evaluated_at).getTime();
      if (sortOption === 'date_asc')  return new Date(a.result.evaluated_at).getTime() - new Date(b.result.evaluated_at).getTime();
      if (sortOption === 'score_desc') return b.result.percentage - a.result.percentage;
      if (sortOption === 'score_asc')  return a.result.percentage - b.result.percentage;
      return a.assessmentTitle.localeCompare(b.assessmentTitle);
    });

    return list;
  }, [items, search, courseFilter, statusFilter, sortOption]);

  const activeItem = items.find((i) => i.result.id === activeResultId) ?? null;

  if (activeItem) {
    return <ResultDetail item={activeItem} onBack={() => setActiveResultId('')} onRetake={onRetake} />;
  }

  const passCount = items.filter((i) => i.result.passed).length;

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        title="My Results"
        subtitle="Every assessment attempt you've completed."
        statLabel="Passed"
        statValue={`${passCount}/${items.length}`}
      />

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">

      {!loading && !error && <AnalyticsSummary items={items} />}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          className="min-w-[220px] flex-1 rounded-xl border border-slate-200 p-3 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          placeholder="Search by assessment or course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {courseOptions.length > 0 && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          >
            <option value="all">All Courses</option>
            {courseOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
        >
          <option value="all">All Statuses</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>

        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {error && <ErrorState message={error} onRetry={fetchAll} />}

      {loading && <Skeleton />}

      {!loading && !error && filtered.length === 0 && <EmptyState search={search} />}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <ResultCard key={item.result.id} item={item} onOpen={() => setActiveResultId(item.result.id)} />
          ))}
        </div>
      )}

    </div>
    </div>
  );
}

export default MyResults;
