// src/components/learning/CoursePlayer.tsx
//
// Professional Training App Learning Workspace. Reuses the existing
// coursePlayerService (loadCoursePlayer / completeLesson) and session
// service exactly as before — no repository, service, database, or
// authentication changes. All new capabilities (resume point, module
// completion, YouTube embedding, download button, assignment/quiz launch)
// are computed client-side from the data this service already returns.

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadCoursePlayer, completeLesson } from '../../services/coursePlayer/coursePlayerService';
import { getCurrentUser }                   from '../../services/auth/session';
import type {
  CoursePlayerData,
  CoursePlayerModule,
  CoursePlayerLesson,
  CoursePlayerResource,
} from '../../types/coursePlayer';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface CoursePlayerProps {
  enrollmentId:        string;
  onBack?:             () => void;
  onLaunchAssignment?: (lesson: CoursePlayerLesson) => void;
  onLaunchQuiz?:       (lesson: CoursePlayerLesson) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct    = Math.min(100, Math.max(0, value));
  const colour = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all duration-500 ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-bold text-slate-700">{pct}%</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-10 w-2/3 rounded-xl bg-slate-100" />
      <div className="h-4 w-1/3 rounded bg-slate-100" />
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-12 rounded-xl bg-slate-100" />)}
        </div>
        <div className="col-span-2 h-64 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function youtubeEmbedId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lesson type icon
// ─────────────────────────────────────────────────────────────────────────────

function LessonIcon({ type }: { type: string }) {
  if (type === 'video') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
    );
  }
  if (type === 'document' || type === 'text') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    );
  }
  if (type === 'scorm') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource renderer
// ─────────────────────────────────────────────────────────────────────────────

function ResourceItem({ resource }: { resource: CoursePlayerResource }) {
  const typeLabel: Record<string, string> = {
    pdf:   'PDF',
    video: 'Video',
    image: 'Image',
    zip:   'Archive',
    other: 'File',
  };

  const iconColour: Record<string, string> = {
    pdf:   'text-red-500',
    video: 'text-blue-500',
    image: 'text-violet-500',
    zip:   'text-amber-500',
    other: 'text-slate-500',
  };

  return (
    <a
      href={resource.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
    >
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold ${iconColour[resource.resourceType] ?? 'text-slate-500'}`}>
        {typeLabel[resource.resourceType] ?? 'FILE'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{resource.resourceTitle}</p>
        {resource.description && (
          <p className="truncate text-xs text-slate-500">{resource.description}</p>
        )}
      </div>
      {resource.downloadable && (
        <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      )}
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lesson content area
// ─────────────────────────────────────────────────────────────────────────────

function LessonContent({
  lesson, onLaunchAssignment, onLaunchQuiz,
}: {
  lesson: CoursePlayerLesson;
  onLaunchAssignment?: (lesson: CoursePlayerLesson) => void;
  onLaunchQuiz?:       (lesson: CoursePlayerLesson) => void;
}) {
  const primaryDownload = lesson.resources.find((r) => r.downloadable) ?? null;
  const embedId = lesson.lessonType === 'video' ? youtubeEmbedId(lesson.videoUrl) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">{lesson.lessonTitle}</h2>
        <p className="mt-1 text-sm text-slate-500 capitalize">{lesson.lessonType} · {lesson.durationMinutes} min</p>
      </div>

      {/* Video — embedded YouTube iframe or native player */}
      {lesson.lessonType === 'video' && lesson.videoUrl && (
        <div className="overflow-hidden rounded-2xl bg-black shadow-md">
          {embedId ? (
            <iframe
              key={lesson.id}
              className="aspect-video w-full"
              src={`https://www.youtube.com/embed/${embedId}`}
              title={lesson.lessonTitle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video key={lesson.id} className="h-auto w-full max-h-[420px]" controls src={lesson.videoUrl}>
              Your browser does not support video playback.
            </video>
          )}
        </div>
      )}

      {/* Text / Reading Material content */}
      {(lesson.lessonType === 'text' || lesson.lessonType === 'document') && lesson.content && (
        <div
          className="prose prose-slate max-w-none rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm leading-relaxed text-slate-700"
          dangerouslySetInnerHTML={{ __html: lesson.content }}
        />
      )}

      {/* Reading Material download button */}
      {lesson.lessonType === 'document' && primaryDownload && (
        <a
          href={primaryDownload.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-yellow-400 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {primaryDownload.resourceTitle || 'Download Reading Material'}
        </a>
      )}

      {/* Assignment launch (scorm lessons are used for assignment launch) */}
      {lesson.lessonType === 'scorm' && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-500">
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
          </svg>
          <p className="font-medium text-slate-700">This lesson is an assignment.</p>
          <button
            onClick={() => onLaunchAssignment?.(lesson)}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-yellow-400 active:scale-95"
          >
            Launch Assignment
          </button>
        </div>
      )}

      {/* Quiz launch */}
      {lesson.lessonType === 'quiz' && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-500">
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.008v.008H12v-.008Z" />
          </svg>
          <p className="font-medium text-slate-700">This lesson is a quiz.</p>
          <button
            onClick={() => onLaunchQuiz?.(lesson)}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-yellow-400 active:scale-95"
          >
            Launch Quiz
          </button>
        </div>
      )}

      {/* Resources */}
      {lesson.resources.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Resources</h3>
          <div className="space-y-2">
            {lesson.resources.map((r) => (
              <ResourceItem key={r.id} resource={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CoursePlayer
// ─────────────────────────────────────────────────────────────────────────────

function CoursePlayer({ enrollmentId, onBack, onLaunchAssignment, onLaunchQuiz }: CoursePlayerProps) {
  const user = getCurrentUser();

  const [data,          setData]          = useState<CoursePlayerData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [activeLesson,  setActiveLesson]  = useState<CoursePlayerLesson | null>(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [completing,    setCompleting]    = useState(false);
  const [localPct,      setLocalPct]      = useState(0);
  const [toast,         setToast]         = useState('');

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // flat ordered lesson list
  const allLessons: CoursePlayerLesson[] = data
    ? data.course.modules.flatMap((m) => m.lessons)
    : [];

  const currentIndex   = activeLesson ? allLessons.findIndex((l) => l.id === activeLesson.id) : -1;
  const hasPrev         = currentIndex > 0;
  const hasNext         = currentIndex < allLessons.length - 1;
  const completedCount  = allLessons.filter((l) => l.completed).length;

  // Resume Learning — first incomplete lesson in order, or the last lesson
  // if everything is already complete.
  const resumeLesson = useMemo(() => {
    if (allLessons.length === 0) return null;
    return allLessons.find((l) => !l.completed) ?? allLessons[allLessons.length - 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function moduleCompleted(mod: CoursePlayerModule): boolean {
    return mod.lessons.length > 0 && mod.lessons.every((l) => l.completed);
  }

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    loadCoursePlayer(enrollmentId, user.id)
      .then((d) => {
        setData(d);
        setLocalPct(d.enrollment.completionPercentage);
        // Resume Learning: jump straight to the first incomplete lesson.
        const flat = d.course.modules.flatMap((m) => m.lessons);
        const resume = flat.find((l) => !l.completed) ?? flat[0] ?? null;
        if (resume) setActiveLesson(resume);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load course.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [enrollmentId, user?.id]);

  function selectLesson(mod: CoursePlayerModule, lesson: CoursePlayerLesson) {
    void mod;
    setActiveLesson(lesson);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }

  function goPrev() {
    if (!hasPrev || !data) return;
    const prev = allLessons[currentIndex - 1];
    const mod  = data.course.modules.find((m) => m.lessons.some((l) => l.id === prev.id));
    if (mod) selectLesson(mod, prev);
  }

  function goNext() {
    if (!hasNext || !data) return;
    const next = allLessons[currentIndex + 1];
    const mod  = data.course.modules.find((m) => m.lessons.some((l) => l.id === next.id));
    if (mod) selectLesson(mod, next);
  }

  function handleContinueLearning() {
    if (!resumeLesson || !data) return;
    const mod = data.course.modules.find((m) => m.lessons.some((l) => l.id === resumeLesson.id));
    if (mod) selectLesson(mod, resumeLesson);
  }

  function handleLaunchAssignment(lesson: CoursePlayerLesson) {
    if (onLaunchAssignment) {
      onLaunchAssignment(lesson);
    } else {
      showToast('Assignment launch is handled by your training administrator.');
    }
  }

  function handleLaunchQuiz(lesson: CoursePlayerLesson) {
    if (onLaunchQuiz) {
      onLaunchQuiz(lesson);
    } else {
      showToast('Quiz launch is handled by your training administrator.');
    }
  }

  async function handleMarkComplete() {
    if (!activeLesson || !data || completing) return;
    setCompleting(true);
    try {
      const pct = await completeLesson(
        enrollmentId,
        activeLesson.id,
        allLessons.length,
        completedCount,
      );
      setLocalPct(pct);
      // mark lesson completed locally
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          course: {
            ...prev.course,
            modules: prev.course.modules.map((m) => ({
              ...m,
              lessons: m.lessons.map((l) =>
                l.id === activeLesson.id ? { ...l, completed: true } : l
              ),
            })),
          },
        };
      });
      showToast('Page marked complete');
      if (hasNext) goNext();
    } catch (err) {
      console.error(err);
      showToast('Failed to save progress');
    } finally {
      setCompleting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <Skeleton />;

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">Failed to load course</p>
        <p className="mt-1">{error}</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium hover:bg-red-100">
            ← Back
          </button>
        )}
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (!data) return null;

  const { course, enrollment } = data;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">

      {/* ── Course header ───────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 text-white shadow-md"
        style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)' }}
      >
        <div className="flex min-w-0 items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="flex-shrink-0 rounded-xl border border-white/20 p-2 transition hover:bg-white/10"
              aria-label="Back"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          {course.thumbnail && (
            <img src={course.thumbnail} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-tight">{course.courseName}</p>
            <p className="text-xs text-slate-400 capitalize">{course.level} · {course.durationHours}h</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {resumeLesson && activeLesson?.id !== resumeLesson.id && (
            <button
              onClick={handleContinueLearning}
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-yellow-400 active:scale-95"
            >
              Continue Learning
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
          <div className="w-40 sm:w-44">
            <ProgressBar value={localPct} />
          </div>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-xl border border-white/20 p-2 transition hover:bg-white/10"
            aria-label="Toggle sidebar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — module / lesson navigation tree */}
        {sidebarOpen && (
          <aside className="fixed inset-y-0 left-0 z-30 w-72 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:static lg:z-auto">
            <div className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Course Content
              </p>

              {course.modules.length === 0 ? (
                <p className="text-sm text-slate-400">No modules available.</p>
              ) : (
                <div className="space-y-4">
                  {course.modules.map((mod) => {
                    const isModuleComplete = moduleCompleted(mod);
                    return (
                      <div key={mod.id}>
                        {/* module header */}
                        <div className="mb-1.5 flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              isModuleComplete ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isModuleComplete ? (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            ) : (
                              mod.moduleOrder
                            )}
                          </span>
                          <p className="text-xs font-semibold leading-tight text-slate-700">{mod.moduleName}</p>
                          {isModuleComplete && (
                            <span className="ml-auto rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                              Completed
                            </span>
                          )}
                        </div>

                        {/* lessons */}
                        <div className="ml-7 space-y-0.5">
                          {mod.lessons.map((lesson) => {
                            const isActive = activeLesson?.id === lesson.id;
                            const isResume = resumeLesson?.id === lesson.id && !lesson.completed;
                            return (
                              <button
                                key={lesson.id}
                                onClick={() => selectLesson(mod, lesson)}
                                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                                  isActive
                                    ? 'bg-yellow-500 font-semibold text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span className={isActive ? 'text-slate-900' : 'text-slate-400'}>
                                  <LessonIcon type={lesson.lessonType} />
                                </span>
                                <span className="flex-1 truncate leading-tight">{lesson.lessonTitle}</span>
                                {isResume && !isActive && (
                                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-500" title="Resume here" />
                                )}
                                {lesson.completed && (
                                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

            {activeLesson ? (
              <>
                <LessonContent
                  lesson={activeLesson}
                  onLaunchAssignment={handleLaunchAssignment}
                  onLaunchQuiz={handleLaunchQuiz}
                />

                {/* navigation footer */}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
                  <button
                    onClick={goPrev}
                    disabled={!hasPrev}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    Previous
                  </button>

                  <div className="flex flex-wrap items-center gap-3">
                    {!activeLesson.completed && (
                      <button
                        onClick={handleMarkComplete}
                        disabled={completing}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        {completing ? 'Saving…' : 'Mark Page Complete'}
                      </button>
                    )}

                    <button
                      onClick={goNext}
                      disabled={!hasNext}
                      className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
                    >
                      {enrollment.status === 'COMPLETED' ? 'Review Next' : 'Next'}
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* course completion banner */}
                {localPct >= 100 && (
                  <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                    <svg className="h-6 w-6 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <div>
                      <p className="font-bold">Course Completed!</p>
                      <p className="text-sm">You have successfully completed <strong>{course.courseName}</strong>.</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400">
                <svg className="mb-4 h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
                <p className="font-medium">No lessons available for this course yet.</p>
              </div>
            )}
          </div>
        </main>

      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default CoursePlayer;
