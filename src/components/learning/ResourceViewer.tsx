// src/components/learning/ResourceViewer.tsx

import { useEffect, useState } from 'react';
import {
  loadResource,
  loadLessonResources,
} from '../../services/resourceViewer/resourceViewerService';
import type { ResourceViewerItem } from '../../types/resourceViewer';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ResourceViewerProps {
  resourceId:  string;
  lessonId:    string;
  onBack?:     () => void;
  onComplete?: (resourceId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4 sm:p-6">
      <div className="h-8 w-2/3 rounded-xl bg-slate-100" />
      <div className="h-4 w-1/4 rounded bg-slate-100" />
      <div className="mt-4 h-64 rounded-2xl bg-slate-100 sm:h-96" />
      <div className="h-12 rounded-xl bg-slate-100" />
    </div>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load resource</p>
      <p className="mt-1">{message}</p>
      {onBack && (
        <button
          onClick={onBack}
          className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium transition hover:bg-red-100"
        >
          ← Back
        </button>
      )}
    </div>
  );
}

function EmptyState({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5m-4.5 3h4.5m-6-9h9a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 17.25 21.75h-9A2.25 2.25 0 0 1 6 19.5V6a2.25 2.25 0 0 1 2.25-2.25Z" />
      </svg>
      <p className="font-medium">No resource is available to display.</p>
      {onBack && (
        <button
          onClick={onBack}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          ← Back
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type badge
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  video:         'Video',
  pdf:           'PDF',
  image:         'Image',
  audio:         'Audio',
  external_url:  'Link',
  download:      'File',
};

const TYPE_COLOUR: Record<string, string> = {
  video:        'text-blue-600    bg-blue-50',
  pdf:          'text-red-600     bg-red-50',
  image:        'text-violet-600  bg-violet-50',
  audio:        'text-emerald-600 bg-emerald-50',
  external_url: 'text-sky-600     bg-sky-50',
  download:     'text-amber-600   bg-amber-50',
};

// ─────────────────────────────────────────────────────────────────────────────
// Content renderers
// ─────────────────────────────────────────────────────────────────────────────

function EmbedFallback({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-sm text-slate-400">
      {message}
    </div>
  );
}

function VideoPlayer({ url, title }: { url: string; title: string }) {
  if (!url) return <EmbedFallback message="No video URL provided." />;

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

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-md">
      <video key={url} className="max-h-[480px] w-full" controls src={url}>
        Your browser does not support video playback.
      </video>
    </div>
  );
}

function PdfViewer({ url }: { url: string }) {
  if (!url) return <EmbedFallback message="No PDF URL provided." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <iframe className="h-[420px] w-full sm:h-[600px]" src={url} title="PDF Viewer" />
    </div>
  );
}

function ImageViewer({ url, title }: { url: string; title: string }) {
  if (!url) return <EmbedFallback message="No image URL provided." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-center shadow-sm">
      <img src={url} alt={title} className="mx-auto max-h-[560px] w-auto object-contain p-4" />
    </div>
  );
}

function AudioPlayer({ url, title }: { url: string; title: string }) {
  if (!url) return <EmbedFallback message="No audio URL provided." />;

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9v10.5a3 3 0 1 1-1.5-2.598M9 9V6.75A2.25 2.25 0 0 1 11.25 4.5H15a2.25 2.25 0 0 1 2.25 2.25V9m-8.25 0h8.25m-8.25 0H6.75A2.25 2.25 0 0 0 4.5 11.25v6a2.25 2.25 0 0 0 2.25 2.25H9m8.25-9.5V15a2.25 2.25 0 0 1-2.25 2.25H15" />
        </svg>
      </span>
      <p className="font-medium text-slate-700">{title}</p>
      <audio key={url} className="w-full max-w-md" controls src={url}>
        Your browser does not support audio playback.
      </audio>
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
        <p className="mt-1 max-w-sm break-all text-sm text-slate-500">{url}</p>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Open Link
        </a>
      )}
    </div>
  );
}

function DownloadCard({
  url,
  title,
  description,
}: {
  url: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      </span>
      <div>
        <p className="font-semibold text-slate-700">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      </div>
      {url && (
        <a
          href={url}
          download
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download File
        </a>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ResourceViewer
// ─────────────────────────────────────────────────────────────────────────────

function ResourceViewer({ resourceId, lessonId, onBack, onComplete }: ResourceViewerProps) {
  const [resources,    setResources]   = useState<ResourceViewerItem[]>([]);
  const [activeId,     setActiveId]    = useState(resourceId);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState('');
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setActiveId(resourceId);
  }, [resourceId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([loadResource(resourceId), loadLessonResources(lessonId)])
      .then(([single, list]) => {
        if (cancelled) return;
        setResources(list.length > 0 ? list : [single]);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load resource.');
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resourceId, lessonId]);

  const currentIndex = resources.findIndex((r) => r.id === activeId);
  const active        = currentIndex >= 0 ? resources[currentIndex] : resources[0] ?? null;
  const prevResource  = currentIndex > 0                        ? resources[currentIndex - 1] : null;
  const nextResource  = currentIndex >= 0 && currentIndex < resources.length - 1
    ? resources[currentIndex + 1]
    : null;
  const isCompleted = active ? completedIds.has(active.id) : false;

  function handleMarkComplete() {
    if (!active) return;
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.add(active.id);
      return next;
    });
    onComplete?.(active.id);
  }

  function handlePrev() {
    if (prevResource) setActiveId(prevResource.id);
  }

  function handleNext() {
    if (nextResource) setActiveId(nextResource.id);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <Skeleton />;

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) return <ErrorState message={error} onBack={onBack} />;

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (!active) return <EmptyState onBack={onBack} />;

  const typeColour = TYPE_COLOUR[active.resourceType] ?? TYPE_COLOUR.download;
  const typeLabel   = TYPE_LABEL[active.resourceType]  ?? 'File';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
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
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-800 sm:text-2xl">
              {active.resourceTitle}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${typeColour}`}>
                {typeLabel}
              </span>
              {active.lesson?.lessonTitle && (
                <>
                  <span>·</span>
                  <span className="truncate">{active.lesson.lessonTitle}</span>
                </>
              )}
              {resources.length > 1 && currentIndex >= 0 && (
                <>
                  <span>·</span>
                  <span>Resource {currentIndex + 1} of {resources.length}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {active.downloadable && active.fileUrl && (
            <a
              href={active.fileUrl}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download
            </a>
          )}
        </div>
      </div>

      {/* Description */}
      {active.description && (
        <p className="text-sm leading-relaxed text-slate-600">{active.description}</p>
      )}

      {/* ── Resource content ─────────────────────────────────────────────────── */}

      {active.resourceType === 'video' && (
        <VideoPlayer url={active.fileUrl} title={active.resourceTitle} />
      )}

      {active.resourceType === 'pdf' && <PdfViewer url={active.fileUrl} />}

      {active.resourceType === 'image' && (
        <ImageViewer url={active.fileUrl} title={active.resourceTitle} />
      )}

      {active.resourceType === 'audio' && (
        <AudioPlayer url={active.fileUrl} title={active.resourceTitle} />
      )}

      {active.resourceType === 'external_url' && (
        <LinkViewer url={active.fileUrl} title={active.resourceTitle} />
      )}

      {active.resourceType === 'download' && (
        <DownloadCard
          url={active.fileUrl}
          title={active.resourceTitle}
          description={active.description}
        />
      )}

      {/* ── Completion banner ─────────────────────────────────────────────────── */}
      {isCompleted && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
          <svg className="h-6 w-6 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="font-semibold">Resource marked as complete!</p>
        </div>
      )}

      {/* ── Navigation footer ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">

        <button
          disabled={!prevResource}
          onClick={handlePrev}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Previous
        </button>

        <div className="flex items-center gap-3">
          {!isCompleted && (
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
            disabled={!nextResource}
            onClick={handleNext}
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

export default ResourceViewer;
