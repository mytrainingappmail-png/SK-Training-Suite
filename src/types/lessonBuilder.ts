// src/types/lessonBuilder.ts
//
// Lesson Builder shares the canonical `lessons` table row/form shapes with
// the rest of the app (see types/lesson.ts) — re-exported here rather than
// redefined, so there is a single source of truth for the DB shape.
//
// Scope: course-level lesson metadata only. Rich Text Editor, Word Toolbar,
// Resource Manager and Video/PDF/Image upload are out of scope and ship in
// the next sprint as a dedicated Content Authoring Editor.

import type { Lesson, LessonForm, LessonType } from './lesson';
import { defaultLessonForm } from './lesson';

export type { Lesson, LessonForm, LessonType };

// ── Publish state ─────────────────────────────────────────────────────────────
// The `lessons` table has no dedicated status column, so Lesson Builder maps
// Draft / Published directly onto the existing `active` boolean:
// Draft = inactive, Published = active.

export type LessonBuilderStatus = 'draft' | 'published';

export function lessonStatusFromActive(active: boolean): LessonBuilderStatus {
  return active ? 'published' : 'draft';
}

// ── Lesson Builder form ────────────────────────────────────────────────────────
// Every field inherited from LessonForm maps 1:1 to a real `lessons` column.
// `lessonCode` is captured in the UI ahead of a future schema migration and
// is intentionally NOT sent to Supabase — no `lesson_code` column exists yet.

export interface LessonBuilderForm extends LessonForm {
  lessonCode: string;
}

export const defaultLessonBuilderForm: LessonBuilderForm = {
  ...defaultLessonForm,
  lessonCode: '',
};

// ── Lesson Builder list item ───────────────────────────────────────────────────
// Adds display-only fields resolved client-side (module/course names,
// derived publish status) on top of the raw Lesson row.

export interface LessonBuilderListItem extends Lesson {
  moduleName: string;
  courseId:   string;
  courseName: string;
  status:     LessonBuilderStatus;
}
