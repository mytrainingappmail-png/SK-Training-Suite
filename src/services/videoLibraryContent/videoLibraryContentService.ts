// src/services/videoLibraryContent/videoLibraryContentService.ts
//
// Business logic — validation + orchestration, plus real YouTube
// thumbnail extraction (same technique already used in
// videoLibraryService.ts for course-lesson videos).

import {
  getSubjects, createSubject, deleteSubject,
  getVideos, createVideo, updateVideo, deleteVideo,
  uploadVideoFile, uploadVideoThumbnail,
} from '../../repositories/videoLibraryContent/videoLibraryContentRepository';
import type {
  VideoSubject, VideoSubjectForm,
  LibraryVideo, LibraryVideoForm, VideoSourceType,
} from '../../types/videoLibraryContent';

export async function loadSubjects(): Promise<VideoSubject[]> {
  return getSubjects();
}

export async function saveSubject(form: VideoSubjectForm): Promise<VideoSubject> {
  if (!form.subject_name.trim()) throw new Error('Subject name is required.');
  return createSubject(form);
}

export async function removeSubject(id: string): Promise<void> {
  await deleteSubject(id);
}

export async function loadVideos(): Promise<LibraryVideo[]> {
  return getVideos();
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function youtubeThumbnailFor(url: string): string {
  const id = extractYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

function validateVideoForm(form: LibraryVideoForm): void {
  if (!form.title.trim()) throw new Error('Title is required.');
  if (!form.subject_id) throw new Error('Subject is required.');
  if (!form.video_url.trim()) throw new Error('A video link or uploaded file is required.');
}

export async function saveVideo(form: LibraryVideoForm): Promise<LibraryVideo> {
  validateVideoForm(form);
  // Auto-derive a thumbnail for YouTube links if none was set manually.
  const thumbnail = form.thumbnail_url || (form.source_type === 'youtube' ? youtubeThumbnailFor(form.video_url) : '');
  return createVideo({ ...form, thumbnail_url: thumbnail });
}

export async function editVideo(id: string, form: Partial<LibraryVideoForm>): Promise<LibraryVideo> {
  if (!id) throw new Error('Invalid video ID.');
  return updateVideo(id, form);
}

export async function removeVideo(id: string): Promise<void> {
  await deleteVideo(id);
}

export async function reorderVideos(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await updateVideo(orderedIds[i], { display_order: i });
  }
}

export async function uploadRealVideoFile(file: File): Promise<string> {
  return uploadVideoFile(file);
}

export async function uploadRealThumbnail(file: File): Promise<string> {
  return uploadVideoThumbnail(file);
}

export function isValidSourceType(value: string): value is VideoSourceType {
  return value === 'youtube' || value === 'instagram' || value === 'upload';
}
