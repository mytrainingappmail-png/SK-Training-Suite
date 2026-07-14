// src/repositories/lessonPlayer/lessonPlayerRepository.ts
//
// Supabase queries only — zero business logic.
// Nested relations typed as Array (Supabase JS always returns arrays).
// Normalised to single objects before returning.

import { supabase } from '../../lib/supabase';
import type {
  LessonPlayerLesson,
  LessonPlayerResource,
  LessonPlayerType,
  LessonResourceType,
} from '../../types/lessonPlayer';

// ── Private Supabase-shaped interfaces ───────────────────────────────────────

interface SBResource {
  id:             string;
  resource_title: string;
  resource_type:  string;
  file_url:       string;
  description:    string;
  display_order:  number;
  downloadable:   boolean;
}

interface SBLessonRow {
  id:               string;
  module_id:        string;
  lesson_title:     string;
  lesson_type:      string;
  content:          string;
  video_url:        string;
  duration_minutes: number;
  display_order:    number;
  downloadable:     boolean;
  learning_resources: SBResource[] | null;
}

// ── Normalise helpers ─────────────────────────────────────────────────────────

function normaliseResource(r: SBResource): LessonPlayerResource {
  return {
    id:            r.id,
    resourceTitle: r.resource_title  ?? '',
    resourceType:  (r.resource_type  ?? 'other') as LessonResourceType,
    fileUrl:       r.file_url        ?? '',
    description:   r.description     ?? '',
    displayOrder:  r.display_order   ?? 1,
    downloadable:  r.downloadable    ?? false,
  };
}

function normaliseLesson(row: SBLessonRow): LessonPlayerLesson {
  return {
    id:              row.id,
    moduleId:        row.module_id        ?? '',
    lessonTitle:     row.lesson_title,
    lessonType:      (row.lesson_type     ?? 'text') as LessonPlayerType,
    content:         row.content          ?? '',
    videoUrl:        row.video_url        ?? '',
    durationMinutes: row.duration_minutes ?? 0,
    displayOrder:    row.display_order    ?? 1,
    downloadable:    row.downloadable     ?? false,
    resources: (row.learning_resources ?? [])
      .map(normaliseResource)
      .sort((a, b) => a.displayOrder - b.displayOrder),
  };
}

// ── Public repository functions ───────────────────────────────────────────────

export async function getLessonById(lessonId: string): Promise<LessonPlayerLesson> {
  const { data, error } = await supabase
    .from('lessons')
    .select(
      `id,
       module_id,
       lesson_title,
       lesson_type,
       content,
       video_url,
       duration_minutes,
       display_order,
       downloadable,
       learning_resources (
         id,
         resource_title,
         resource_type,
         file_url,
         description,
         display_order,
         downloadable
       )`
    )
    .eq('id', lessonId)
    .single();

  if (error) throw new Error(error.message);
  if (!data)  throw new Error('Lesson not found.');

  return normaliseLesson(data as unknown as SBLessonRow);
}

export async function getLessonsByModule(moduleId: string): Promise<LessonPlayerLesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select(
      `id,
       module_id,
       lesson_title,
       lesson_type,
       content,
       video_url,
       duration_minutes,
       display_order,
       downloadable,
       learning_resources (
         id,
         resource_title,
         resource_type,
         file_url,
         description,
         display_order,
         downloadable
       )`
    )
    .eq('module_id', moduleId)
    .eq('active', true)
    .order('display_order', { ascending: true });

  if (error) throw new Error(error.message);

  return (data as unknown as SBLessonRow[] ?? []).map(normaliseLesson);
}
