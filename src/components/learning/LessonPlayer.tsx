// src/components/learning/LessonPlayer.tsx

import { useEffect, useState } from 'react';
import { loadLesson, loadModuleLessons } from '../../services/lessonPlayer/lessonPlayerService';
import type {
  LessonPlayerLesson,
  LessonPlayerResource,
} from '../../types/lessonPlayer';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface LessonPlayerProps {
  lessonId:     string;
  moduleId:     string;
  onBack?:      () => void;
  onComplete?:  (lessonId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-2/3 rounded-xl bg-slate-100" />
      <div className="h-4 w-1/4 rounded bg-slate-100" />
      <div className="mt-4 h-64 rounded-2xl bg-slate-100" />
      <div className="space-y-2">
        <div className="h-12 rounded-xl bg-slate-100" />
        <div className="h-12 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource row
// ─────────────────────────────────────────────────────────────────────────────

const RESOURCE_LABEL: Record<string, string> = {
  pdf:   'PDF',
  video: 'Video',
  image: 'Image',
  zip:   'Archive',
  other: 'File',
};

const RESOURCE_COLOUR: Record<string, string> = {
  pdf:   'text-red-600   bg-red-50',
  video: 'text-blue-600  bg-blue-50',
  image: 'text-violet-600 bg-violet-50',
  zip:   'text-amber-600 bg-amber-50',
  other: 'text-slate-600 bg-slate-100',
};

function ResourceRow({ resource }: { resource: LessonPlayerResource }) {
  const colour = RESOURCE_COLOUR[resource.resourceType] ?? RESOURCE_COLOUR.other;
  const label  = RESOURCE_LABEL[resource.resourceType]  ?? 'File';

  return (
    <a
      href={resource.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
    >
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${colour}`}>
        {label}
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
// Content renderers
// ─────────────────────────────────────────────────────────────────────────────

function VideoPlayer({ url, title }: { url: string; title: string }) {
  if (!url) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-slate-400">
        No video URL provided.
      </div>
    );
  }

  // YouTube / Vimeo — embed via iframe
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);

  if (youtubeMatch) {
    return (
      <div className="overflow-hidden rounded-2xl bg-black shadow-md">
        <iframe
          className="aspect-video w-full"
          src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (vimeoMatch) {
    return (
      <div className="overflow-hidden rounded-2xl bg-black shadow-md">
        <iframe
          className="aspect-video w-full"
          src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // Native video file
  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-md">
      <video key={url} className="w-full max-h-[480px]" controls src={url}>
        Your browser does not support video playback.
      </video>
    </div>
  );
}

function PdfViewer({ url }: { url: string }) {
  if (!url) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-slate-400">
        No PDF URL provided.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <iframe
        className="h-[600px] w-full"
        src={url}
        title="PDF Viewer"
      />
    </div>
  );
}

function ImageViewer({ url, title }: { url: string; title: string }) {
  if (!url) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-slate-400">
        No image URL provided.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-center shadow-sm">
      <img src={url} alt={title} className="mx-auto max-h-[560px] w-auto object-contain p-4" />
    </div>
  );
}

function LinkViewer({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center">
      <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
      <div>
        <p className="font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-sm text-slate-500 break-all max-w-sm">{url}</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
      >
        Open Link
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main LessonPlayer
// ─────────────────────────────────────────────────────────────────────────────

function LessonPlayer({ lessonId, moduleId, onBack, onComplete }: LessonPlayerProps) {
  const [lesson,      setLesson]     = useState<LessonPlayerLesson | null>(null);
  const [siblings,    setSiblings]   = useState<LessonPlayerLesson[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');
  const [completed,   setCompleted]  = useState(false);

  const currentIndex = siblings.findIndex((l) => l.id === lessonId);
  const prevLesson   = currentIndex > 0                  ? siblings[currentIndex - 1] : null;
  const nextLesson   = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  useEffect(() => {
    setLoading(true);
    setError('');
    setCompleted(false);

    Promise.all([
      loadLesson(lessonId),
      loadModuleLessons(moduleId),
    ])
      .then(([l, all]) => {
        setLesson(l);
        setSiblings(all);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load lesson.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [lessonId, moduleId]);

  function handleMarkComplete() {
    setCompleted(true);
    if (onComplete) onComplete(lessonId);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <Skeleton />;

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">Failed to load lesson</p>
        <p className="mt-1">{error}</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium hover:bg-red-100 transition"
          >
            ← Back
          </button>
        )}
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (!lesson) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="mt-0.5 flex-shrink-0 rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
              aria-label="Back"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{lesson.lessonTitle}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="capitalize">{lesson.lessonType}</span>
              {lesson.durationMinutes > 0 && (
                <>
                  <span>·</span>
                  <span>{lesson.durationMinutes} min</span>
                </>
              )}
              {siblings.length > 1 && currentIndex >= 0 && (
                <>
                  <span>·</span>
                  <span>Lesson {currentIndex + 1} of {siblings.length}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        {siblings.length > 1 && currentIndex >= 0 && (
          <div className="flex flex-shrink-0 items-center gap-1">
            {siblings.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 w-6 rounded-full transition-all ${
                  i < currentIndex
                    ? 'bg-emerald-400'
                    : i === currentIndex
                    ? 'bg-yellow-400'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Lesson content ──────────────────────────────────────────────────── */}

      {lesson.lessonType === 'video' && (
        <VideoPlayer url={lesson.videoUrl} title={lesson.lessonTitle} />
      )}

      {lesson.lessonType === 'document' && lesson.resources.length > 0 && (
        <PdfViewer url={lesson.resources.find((r) => r.resourceType === 'pdf')?.fileUrl ?? ''} />
      )}

      {lesson.lessonType === 'text' && lesson.content && (
        <div
          className="prose prose-slate max-w-none rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700"
          dangerouslySetInnerHTML={{ __html: lesson.content }}
        />
      )}

      {(lesson.lessonType === 'scorm' || lesson.lessonType === 'quiz') && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
          <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
          </svg>
          <p className="font-medium">This lesson opens in the assessment player.</p>
        </div>
      )}

      {/* ── Resources ────────────────────────────────────────────────────────── */}
      {lesson.resources.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Resources ({lesson.resources.length})
          </h2>

          {/* Inline image viewer for image resources */}
          {lesson.resources
            .filter((r) => r.resourceType === 'image')
            .map((r) => (
              <div key={r.id} className="mb-4">
                <ImageViewer url={r.fileUrl} title={r.resourceTitle} />
              </div>
            ))}

          {/* Inline link viewer for "other" with no file extension hint */}
          {lesson.resources
            .filter((r) => r.resourceType === 'other')
            .map((r) => (
              <div key={r.id} className="mb-4">
                <LinkViewer url={r.fileUrl} title={r.resourceTitle} />
              </div>
            ))}

          {/* Downloadable resource list */}
          <div className="space-y-2">
            {lesson.resources
              .filter((r) => r.resourceType !== 'image' && r.resourceType !== 'other')
              .map((r) => (
                <ResourceRow key={r.id} resource={r} />
              ))}
          </div>
        </div>
      )}

      {/* ── Completion banner ─────────────────────────────────────────────────── */}
      {completed && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
          <svg className="h-6 w-6 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="font-semibold">Lesson marked as complete!</p>
        </div>
      )}

      {/* ── Navigation footer ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">

        <button
          disabled={!prevLesson}
          onClick={() => {
            if (prevLesson && onBack) onBack();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Previous
        </button>

        <div className="flex items-center gap-3">
          {!completed && (
            <button
              onClick={handleMarkComplete}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Mark Complete
            </button>
          )}

          <button
            disabled={!nextLesson}
            onClick={() => {
              if (nextLesson && onComplete) onComplete(nextLesson.id);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
          >
            Next
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

      </div>

    </div>
  );
}

export default LessonPlayer;
