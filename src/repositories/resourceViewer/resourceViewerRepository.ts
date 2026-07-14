// src/repositories/resourceViewer/resourceViewerRepository.ts
//
// Supabase queries only — zero business logic.
// Nested relations typed as Array (Supabase JS always returns arrays for
// to-many joins and may return a single object or array for to-one joins
// depending on FK direction), normalised to single objects before returning.

import { supabase } from '../../lib/supabase';
import type {
  ResourceViewerItem,
  ResourceViewerLesson,
  ResourceViewerType,
} from '../../types/resourceViewer';

// ── Private Supabase-shaped interfaces ───────────────────────────────────────

interface SBLesson {
  id:           string;
  lesson_title: string;
  module_id:    string;
}

interface SBResourceRow {
  id:             string;
  lesson_id:      string;
  resource_title: string;
  resource_type:  string;
  file_url:       string;
  description:    string;
  display_order:  number;
  downloadable:   boolean;
  lessons:        SBLesson | SBLesson[] | null;
}

const SELECT_QUERY = `
  id,
  lesson_id,
  resource_title,
  resource_type,
  file_url,
  description,
  display_order,
  downloadable,
  lessons (
    id,
    lesson_title,
    module_id
  )
`;

// ── Normalise helpers ─────────────────────────────────────────────────────────

function mapResourceType(type: string): ResourceViewerType {
  switch (type) {
    case 'video':
    case 'youtube':
      return 'video';
    case 'pdf':
      return 'pdf';
    case 'image':
      return 'image';
    case 'audio':
      return 'audio';
    case 'external_url':
      return 'external_url';
    default:
      return 'download';
  }
}

function normaliseLesson(
  lessons: SBLesson | SBLesson[] | null
): ResourceViewerLesson | undefined {
  const row = Array.isArray(lessons) ? lessons[0] : lessons;
  if (!row) return undefined;

  return {
    id:          row.id,
    lessonTitle: row.lesson_title ?? '',
    moduleId:    row.module_id   ?? '',
  };
}

function normaliseResource(row: SBResourceRow): ResourceViewerItem {
  return {
    id:            row.id,
    lessonId:      row.lesson_id      ?? '',
    resourceTitle: row.resource_title ?? '',
    resourceType:  mapResourceType(row.resource_type ?? 'other'),
    fileUrl:       row.file_url       ?? '',
    description:   row.description    ?? '',
    displayOrder:  row.display_order  ?? 1,
    downloadable:  row.downloadable   ?? false,
    lesson:        normaliseLesson(row.lessons),
  };
}

// ── Public repository functions ───────────────────────────────────────────────

export async function getResourceById(resourceId: string): Promise<ResourceViewerItem> {
  const { data, error } = await supabase
    .from('learning_resources')
    .select(SELECT_QUERY)
    .eq('id', resourceId)
    .single();

  if (error) {
    console.error('[resourceViewerRepository] getResourceById:', error);
    throw new Error(error.message);
  }
  if (!data) throw new Error('Resource not found.');

  return normaliseResource(data as unknown as SBResourceRow);
}

export async function getResourcesByLesson(
  lessonId: string
): Promise<ResourceViewerItem[]> {
  const { data, error } = await supabase
    .from('learning_resources')
    .select(SELECT_QUERY)
    .eq('lesson_id', lessonId)
    .eq('active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[resourceViewerRepository] getResourcesByLesson:', error);
    throw new Error(error.message);
  }

  return (data as unknown as SBResourceRow[] ?? []).map(normaliseResource);
}
