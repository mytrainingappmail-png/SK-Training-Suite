// src/modules/videoLibraryContent/VideoLibraryManagement.tsx
//
// Real, dedicated Video Library management — Subjects (categories),
// videos with a real source (YouTube link, Instagram link, or an
// actually-uploaded file), real thumbnail (auto for YouTube, uploadable
// for others), delete, and drag-and-drop reordering within a subject.

import { useEffect, useRef, useState } from 'react';
import {
  loadSubjects, saveSubject, removeSubject,
  loadVideos, saveVideo, removeVideo, reorderVideos,
  uploadRealVideoFile, uploadRealThumbnail, youtubeThumbnailFor,
} from '../../services/videoLibraryContent/videoLibraryContentService';
import { getCurrentUser } from '../../services/auth/session';
import type { VideoSubject, LibraryVideo, VideoSourceType } from '../../types/videoLibraryContent';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconDrag({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" /></svg>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

const SOURCE_LABELS: Record<VideoSourceType, string> = { youtube: 'YouTube', instagram: 'Instagram', upload: 'Uploaded File' };

function extractYoutubeIdLocal(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

function VideoLibraryManagement() {
  const user = getCurrentUser();
  const [subjects, setSubjects] = useState<VideoSubject[]>([]);
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [newSubjectName, setNewSubjectName] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    title: '', description: '', subject_id: '', source_type: 'youtube' as VideoSourceType, video_url: '', thumbnail_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<LibraryVideo | null>(null);

  const videoFileRef = useRef<HTMLInputElement>(null);
  const thumbFileRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    Promise.all([loadSubjects(), loadVideos()])
      .then(([s, v]) => { setSubjects(s); setVideos(v); })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleAddSubject() {
    if (!newSubjectName.trim() || !user?.companyId) return;
    try {
      await saveSubject({ company_id: user.companyId, subject_name: newSubjectName.trim(), display_order: subjects.length, active: true });
      setNewSubjectName('');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add subject.');
    }
  }

  async function handleDeleteSubject(id: string) {
    try {
      await removeSubject(id);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete subject.');
    }
  }

  function openNewVideoForm() {
    setDraft({ title: '', description: '', subject_id: subjects[0]?.id ?? '', source_type: 'youtube', video_url: '', thumbnail_url: '' });
    setShowForm(true);
  }

  async function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const url = await uploadRealVideoFile(file);
      setDraft((d) => ({ ...d, video_url: url }));
      showToast('Video uploaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload video.');
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleThumbFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const url = await uploadRealThumbnail(file);
      setDraft((d) => ({ ...d, thumbnail_url: url }));
      showToast('Thumbnail uploaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload thumbnail.');
    } finally {
      setUploadingThumb(false);
    }
  }

  async function handleSaveVideo() {
    if (!user?.companyId) return;
    setSaving(true);
    try {
      await saveVideo({
        company_id: user.companyId,
        subject_id: draft.subject_id,
        title: draft.title,
        description: draft.description,
        source_type: draft.source_type,
        video_url: draft.video_url,
        thumbnail_url: draft.thumbnail_url,
        display_order: videos.length,
        active: true,
      });
      setShowForm(false);
      fetchAll();
      showToast('Video added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save video.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVideo(id: string) {
    try {
      await removeVideo(id);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete video.');
    }
  }

  async function handleDrop(targetId: string, subjectVideos: LibraryVideo[]) {
    if (!draggedId || draggedId === targetId) return;
    const ids = subjectVideos.map((v) => v.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...ids];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedId);
    setDraggedId(null);
    await reorderVideos(reordered);
    fetchAll();
  }

  /** Guaranteed-reliable reordering, regardless of any browser-specific
   * drag-and-drop quirks — moves one video up or down by exactly one
   * position within its current (possibly filtered) list. */
  async function moveVideo(videoId: string, direction: 'up' | 'down', subjectVideos: LibraryVideo[]) {
    const ids = subjectVideos.map((v) => v.id);
    const idx = ids.indexOf(videoId);
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapWith < 0 || swapWith >= ids.length) return;
    const reordered = [...ids];
    [reordered[idx], reordered[swapWith]] = [reordered[swapWith], reordered[idx]];
    await reorderVideos(reordered);
    fetchAll();
  }

  const previewThumb = draft.source_type === 'youtube' && draft.video_url
    ? (draft.thumbnail_url || youtubeThumbnailFor(draft.video_url))
    : draft.thumbnail_url;

  const filteredVideos = selectedSubjectId === 'all' ? videos : videos.filter((v) => v.subject_id === selectedSubjectId);

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Video Library</h2>
        <p className="mt-1 text-sm text-slate-500">Organize videos by subject — YouTube, Instagram, or a directly uploaded file.</p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-700">Subjects</p>
        <div className="mb-3 flex gap-2">
          <input value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="New subject name..." className={INPUT_CLS} />
          <button onClick={handleAddSubject} className="flex-shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Add</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
              {s.subject_name}
              <button onClick={() => handleDeleteSubject(s.id)} className="text-red-500 hover:text-red-700">✕</button>
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-700">Videos</p>
            <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} className={`${INPUT_CLS} w-56`}>
              <option value="all">All Subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>
          </div>
          <button onClick={openNewVideoForm} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            + Add Video
          </button>
        </div>

        {showForm && (
          <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
                <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className={INPUT_CLS} placeholder="Video title / subject line" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Description (optional)</label>
                <input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className={INPUT_CLS} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Subject</label>
                <select value={draft.subject_id} onChange={(e) => setDraft((d) => ({ ...d, subject_id: e.target.value }))} className={INPUT_CLS}>
                  <option value="">— Select —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Source</label>
                <div className="flex gap-2">
                  {(['youtube', 'instagram', 'upload'] as VideoSourceType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setDraft((d) => ({ ...d, source_type: type, video_url: '' }))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        draft.source_type === type ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {SOURCE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {draft.source_type === 'upload' ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Video File</label>
                  <input ref={videoFileRef} type="file" accept="video/*" onChange={handleVideoFileChange} className="hidden" />
                  <button onClick={() => videoFileRef.current?.click()} disabled={uploadingVideo}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {uploadingVideo ? <IconSpinner className="h-3.5 w-3.5" /> : draft.video_url ? 'Replace Video File' : 'Upload Video File'}
                  </button>
                  {draft.video_url && <p className="mt-1 truncate text-xs text-emerald-600">✓ File uploaded</p>}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    {draft.source_type === 'youtube' ? 'YouTube Link' : 'Instagram Link'}
                  </label>
                  <input
                    value={draft.video_url}
                    onChange={(e) => setDraft((d) => ({ ...d, video_url: e.target.value }))}
                    placeholder={draft.source_type === 'youtube' ? 'https://youtu.be/...' : 'https://instagram.com/reel/...'}
                    className={INPUT_CLS}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Thumbnail</label>
                <div className="flex items-center gap-3">
                  {previewThumb && <img src={previewThumb} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                  <input ref={thumbFileRef} type="file" accept="image/*" onChange={handleThumbFileChange} className="hidden" />
                  <button onClick={() => thumbFileRef.current?.click()} disabled={uploadingThumb}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {uploadingThumb ? <IconSpinner className="h-3.5 w-3.5" /> : 'Upload Custom Thumbnail'}
                  </button>
                  {draft.source_type === 'youtube' && !draft.thumbnail_url && (
                    <span className="text-xs text-slate-400">Auto-filled from YouTube link if left blank</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveVideo} disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Video'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {filteredVideos.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No videos yet — add one above.</p>
          ) : (
            filteredVideos.map((v, i) => (
              <div
                key={v.id}
                draggable
                onDragStart={() => setDraggedId(v.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(v.id, filteredVideos)}
                className={`flex cursor-grab items-center gap-3 rounded-xl border p-3 transition active:cursor-grabbing ${
                  draggedId === v.id ? 'border-indigo-300 opacity-50' : 'border-slate-100'
                }`}
              >
                <IconDrag className="h-4 w-4 flex-shrink-0 text-slate-300" />

                <div className="flex flex-shrink-0 flex-col gap-0.5">
                  <button onClick={() => moveVideo(v.id, 'up', filteredVideos)} disabled={i === 0}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30" title="Move up">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>
                  </button>
                  <button onClick={() => moveVideo(v.id, 'down', filteredVideos)} disabled={i === filteredVideos.length - 1}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30" title="Move down">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                </div>

                <button onClick={() => setPreviewVideo(v)} className="flex flex-shrink-0 items-center justify-center" title="Click to preview">
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt="" className="h-10 w-16 rounded-lg object-cover transition hover:opacity-80" />
                  ) : (
                    <div className="flex h-10 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition hover:bg-slate-200">▶</div>
                  )}
                </button>

                <button onClick={() => setPreviewVideo(v)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-slate-800 hover:text-indigo-600">{v.title}</p>
                  <p className="text-xs text-slate-400">{subjects.find((s) => s.id === v.subject_id)?.subject_name ?? '—'} · {SOURCE_LABELS[v.source_type]}</p>
                </button>

                <button onClick={() => handleDeleteVideo(v.id)} className="flex-shrink-0 text-xs font-semibold text-red-500 hover:underline">Delete</button>
              </div>
            ))
          )}
        </div>
      </div>

      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewVideo(null)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">{previewVideo.title}</p>
              <button onClick={() => setPreviewVideo(null)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="aspect-video w-full">
              {previewVideo.source_type === 'youtube' ? (
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${extractYoutubeIdLocal(previewVideo.video_url)}?autoplay=1`}
                  title={previewVideo.title}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : previewVideo.source_type === 'upload' ? (
                <video controls autoPlay className="h-full w-full" src={previewVideo.video_url} />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-white">
                  Instagram links open in a new tab —{' '}
                  <a href={previewVideo.video_url} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                    open it here
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default VideoLibraryManagement;