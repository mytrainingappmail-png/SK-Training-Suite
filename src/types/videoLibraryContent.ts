// src/types/videoLibraryContent.ts
//
// A genuinely separate, Admin-controlled Video Library — distinct from
// the course-lesson videos already in Course Builder. Every video here
// is standalone: a Subject (category), a title, a real source
// (YouTube link, Instagram link, or a directly uploaded file), a
// thumbnail, and a manual drag-and-drop order within its Subject.

export type VideoSourceType = 'youtube' | 'instagram' | 'upload';

export interface VideoSubject {
  id: string;
  company_id: string;
  subject_name: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type VideoSubjectForm = Omit<VideoSubject, 'id' | 'created_at' | 'updated_at'>;

export interface LibraryVideo {
  id: string;
  company_id: string;
  subject_id: string;
  title: string;
  description: string;
  source_type: VideoSourceType;
  video_url: string;
  thumbnail_url: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type LibraryVideoForm = Omit<LibraryVideo, 'id' | 'created_at' | 'updated_at'>;

export const defaultLibraryVideoForm: LibraryVideoForm = {
  company_id: '',
  subject_id: '',
  title: '',
  description: '',
  source_type: 'youtube',
  video_url: '',
  thumbnail_url: '',
  display_order: 0,
  active: true,
};
