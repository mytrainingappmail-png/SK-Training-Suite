// src/components/learning/VideoLibrary.tsx
//
// "Videos" sidebar section — now reads from the dedicated Video
// Library (Admin-managed Subjects + videos), not from course lessons.
// Grouped by Subject, searchable, plays inline for YouTube/uploaded
// files, and links out for Instagram.

import { useEffect, useState } from 'react';
import { loadSubjects, loadVideos } from '../../services/videoLibraryContent/videoLibraryContentService';
import SectionHeroBanner from './SectionHeroBanner';
import type { VideoSubject, LibraryVideo } from '../../types/videoLibraryContent';

function IconPlay({ className = 'h-10 w-10' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m9.75 3.104 8.155 4.552a1.5 1.5 0 0 1 0 2.688L9.75 14.896A1.5 1.5 0 0 1 7.5 13.552V4.448a1.5 1.5 0 0 1 2.25-1.344Z" /><circle cx="12" cy="12" r="10" /></svg>);
}
function IconVideoCamera({ className = 'h-8 w-8' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>);
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />)}
    </div>
  );
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function VideoLibrary() {
  const [subjects, setSubjects] = useState<VideoSubject[]>([]);
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [activeVideo, setActiveVideo] = useState<LibraryVideo | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([loadSubjects(), loadVideos()])
      .then(([s, v]) => { setSubjects(s); setVideos(v.filter((x) => x.active)); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load videos.'))
      .finally(() => setLoading(false));
  }, []);

  const searchTerm = search.trim().toLowerCase();
  const filtered = videos.filter((v) => {
    const matchesSubject = selectedSubjectId === 'all' || v.subject_id === selectedSubjectId;
    const matchesSearch = !searchTerm || v.title.toLowerCase().includes(searchTerm) || v.description.toLowerCase().includes(searchTerm);
    return matchesSubject && matchesSearch;
  });

  function handleOpen(video: LibraryVideo) {
    if (video.source_type === 'instagram') {
      window.open(video.video_url, '_blank', 'noopener,noreferrer');
      return;
    }
    setActiveVideo(video);
  }

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        title="Videos"
        subtitle="Browse videos by subject."
        statLabel="Videos"
        statValue={videos.length}
      />

    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          className="min-w-[220px] flex-1 rounded-xl border p-3"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700"
        >
          <option value="all">All Subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>
      )}

      {loading && <Skeleton />}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
          {search ? `No videos match "${search}".` : 'No videos available yet.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((video) => (
            <button
              key={video.id}
              onClick={() => handleOpen(video)}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 text-left transition hover:shadow-lg"
            >
              <div className="relative aspect-video w-full bg-slate-900">
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt={video.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-600"><IconVideoCamera /></div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                  <IconPlay className="h-12 w-12 text-white" />
                </div>
              </div>
              <div className="p-4">
                <p className="truncate font-semibold text-slate-800">{video.title}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{subjects.find((s) => s.id === video.subject_id)?.subject_name ?? ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {activeVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setActiveVideo(null)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">{activeVideo.title}</p>
              <button onClick={() => setActiveVideo(null)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="aspect-video w-full">
              {activeVideo.source_type === 'youtube' && extractYoutubeId(activeVideo.video_url) ? (
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${extractYoutubeId(activeVideo.video_url)}?autoplay=1`}
                  title={activeVideo.title}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <video controls autoPlay className="h-full w-full" src={activeVideo.video_url} />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}

export default VideoLibrary;
