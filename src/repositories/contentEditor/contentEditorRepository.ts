// src/repositories/contentEditor/contentEditorRepository.ts
//
// Supabase access only — zero business logic.
// Operates on the existing `lessons` table (see types/lesson.ts),
// reading/writing only the `content` column.
//
// Media uploads: this project has no Supabase Auth session (see
// src/services/auth/session.ts — logins are custom, stored in
// localStorage), so browser-side requests run as the `anon` role and
// can never satisfy Storage RLS on `course-content`. Direct
// `supabase.storage.from(...).upload(...)` calls from here would always
// fail with "new row violates row-level security policy". Instead, the
// upload is delegated to the `upload-course-content` Edge Function,
// which performs the privileged write server-side using the
// service_role key and returns the public URL — this repository still
// remains the only layer that talks to Supabase (now via Functions
// instead of Storage directly).

import { supabase } from '../../lib/supabase';
import type { LessonContent, MediaUploadKind, MediaUploadResult } from '../../types/contentEditor';

const UPLOAD_FUNCTION = 'upload-course-content';

export async function getLessonContent(lessonId: string): Promise<LessonContent> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, lesson_title, content')
    .eq('id', lessonId)
    .single();

  if (error) {
    console.error('[contentEditorRepository] getLessonContent:', error);
    throw new Error(error.message);
  }

  return {
    lessonId:    data.id,
    lessonTitle: data.lesson_title ?? '',
    content:     data.content ?? '',
  };
}

export async function updateLessonContent(
  lessonId: string,
  content: string
): Promise<LessonContent> {
  const { data, error } = await supabase
    .from('lessons')
    .update({ content })
    .eq('id', lessonId)
    .select('id, lesson_title, content')
    .single();

  if (error) {
    console.error('[contentEditorRepository] updateLessonContent:', error);
    throw new Error(error.message);
  }

  return {
    lessonId:    data.id,
    lessonTitle: data.lesson_title ?? '',
    content:     data.content ?? '',
  };
}

export async function uploadContentMedia(
  kind: MediaUploadKind,
  file: File,
  employeeId: string
): Promise<MediaUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('kind', kind);

  const { data, error } = await supabase.functions.invoke<MediaUploadResult>(
    UPLOAD_FUNCTION,
    {
      body: formData,
      headers: { 'x-employee-id': employeeId },
    }
  );

  if (error) {
    console.error('[contentEditorRepository] uploadContentMedia:', error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Upload failed: no response from server.');
  }

  return data;
}
