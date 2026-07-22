// src/types/courseVisibility.ts
//
// Controls which employees (by designation) can see a course. A course
// with NO rows here is visible to everyone — this keeps every existing
// course working exactly as before; visibility restriction is opt-in
// per course. Table: course_visibility.

export interface CourseVisibility {
  id: string;
  course_id: string;
  designation_id: string;
  created_at: string;
}

export type CourseVisibilityForm = Omit<CourseVisibility, 'id' | 'created_at'>;
