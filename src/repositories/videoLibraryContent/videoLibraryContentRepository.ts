// src/repositories/videoLibraryContent/videoLibraryContentRepository.ts
//
// Repository layer — Supabase ONLY. Reuses the existing, real
// "course-content" storage bucket (already used elsewhere in the app)
// for uploaded video files and thumbnails — no new bucket needed.

import { supabase } from '../../lib/supabase';
import type {
  VideoSubject, VideoSubjectForm,
  LibraryVideo, LibraryVideoForm,
} from '../../types/videoLibraryContent';

// ── Subjects ──────────────────────────────────────────────────────────────────

export async function getSubjects(): Promise<VideoSubject[]> {
  const { data, error } = await supabase
    .from('video_subjects')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSubject(form: VideoSubjectForm): Promise<VideoSubject> {
  const { data, error } = await supabase.from('video_subjects').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase.from('video_subjects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Videos ────────────────────────────────────────────────────────────────────

export async function getVideos(): Promise<LibraryVideo[]> {
  const { data, error } = await supabase
    .from('library_videos')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createVideo(form: LibraryVideoForm): Promise<LibraryVideo> {
  const { data, error } = await supabase.from('library_videos').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateVideo(id: string, form: Partial<LibraryVideoForm>): Promise<LibraryVideo> {
  const { data, error } = await supabase.from('library_videos').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteVideo(id: string): Promise<void> {
  const { error } = await supabase.from('library_videos').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Real file upload (video files + thumbnails) ────────────────────────────────

export async function uploadVideoFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'mp4';
  const path = `videos/library/${Date.now()}-${Math.round(Math.random() * 10000)}.${ext}`;
  const { error } = await supabase.storage.from('course-content').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('course-content').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadVideoThumbnail(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `images/library-videos/${Date.now()}-${Math.round(Math.random() * 10000)}.${ext}`;
  const { error } = await supabase.storage.from('course-content').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('course-content').getPublicUrl(path);
  return data.publicUrl;
}
