// src/types/courseBuilder.ts
//
// Course Builder shares the canonical `courses` table row/form shapes with
// the rest of the app (types/course.ts states it "matches every column in
// the courses table exactly") — re-exported here rather than redefined, so
// there is a single source of truth for the DB shape.

import type { Course, CourseForm, CourseLevel } from './course';
import { defaultCourseForm } from './course';

export type { Course, CourseForm, CourseLevel };

// ── Publish state ─────────────────────────────────────────────────────────────
// The `courses` table has no dedicated status column, so Course Builder
// maps Draft / Published directly onto the existing `active` boolean:
// Draft = inactive, Published = active.

export type CourseBuilderStatus = 'draft' | 'published';

export function courseStatusFromActive(active: boolean): CourseBuilderStatus {
  return active ? 'published' : 'draft';
}

// ── Course Builder form ────────────────────────────────────────────────────────
// Every field inherited from CourseForm maps 1:1 to a real `courses` column.
// The three fields below are captured in the UI ahead of a future schema
// migration and are NOT sent to Supabase:
//   - tags            forward-compatible; no `tags` column yet
//   - subCategoryName forward-compatible; no sub-category column yet
//   - banner          large-preview-only; the persisted image is `thumbnail`

export interface CourseBuilderForm extends CourseForm {
  tags:            string[];
  subCategoryName: string;
  banner:          string;
}

export const defaultCourseBuilderForm: CourseBuilderForm = {
  ...defaultCourseForm,
  tags:            [],
  subCategoryName: '',
  banner:          '',
};

// ── Course Builder list item ───────────────────────────────────────────────────
// Adds display-only fields resolved client-side (category name, derived
// publish status) on top of the raw Course row.

export interface CourseBuilderListItem extends Course {
  categoryName: string;
  status:       CourseBuilderStatus;
}
