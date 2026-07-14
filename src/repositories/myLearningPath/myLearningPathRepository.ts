// src/repositories/myLearningPath/myLearningPathRepository.ts
//
// Supabase queries only — zero business logic.
// Nested relations typed as Array (Supabase JS always returns arrays for
// to-many joins and may return a single object or array for to-one joins
// depending on FK direction), normalised to single objects before returning.

import { supabase } from '../../lib/supabase';
import type { MyLearningPath, MyLearningPathStatus } from '../../types/myLearningPath';

// ── Private Supabase-shaped interfaces ───────────────────────────────────────

interface SBLearningPath {
  id:                  string;
  path_code:           string;
  path_name:           string;
  description:         string;
  thumbnail_url:       string;
  estimated_duration:  number;
  difficulty_level:    string;
}

interface SBEnrollmentRow {
  id:                string;
  learning_path_id:  string;
  end_date:          string;
  learning_paths:    SBLearningPath | SBLearningPath[] | null;
}

interface SBProgressRow {
  learning_path_id:    string;
  completed_courses:   number;
  total_courses:       number;
  progress_percentage: number;
  status:              string;
}

interface SBPathCourseRow {
  learning_path_id: string;
}

// ── Normalise helpers ─────────────────────────────────────────────────────────

function unwrap<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapStatus(status: string | undefined): MyLearningPathStatus {
  if (status === 'in_progress') return 'in_progress';
  if (status === 'completed')   return 'completed';
  return 'not_started';
}

// ── Public repository functions ───────────────────────────────────────────────

export async function getMyLearningPaths(employeeId: string): Promise<MyLearningPath[]> {
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from('learning_path_enrollments')
    .select(
      `id,
       learning_path_id,
       end_date,
       learning_paths (
         id,
         path_code,
         path_name,
         description,
         thumbnail_url,
         estimated_duration,
         difficulty_level
       )`
    )
    .eq('employee_id', employeeId)
    .eq('enrollment_type', 'employee')
    .eq('active', true)
    .order('enrolled_date', { ascending: false });

  if (enrollmentError) {
    console.error('[myLearningPathRepository] getMyLearningPaths (enrollments):', enrollmentError);
    throw new Error(enrollmentError.message);
  }

  const enrollments = (enrollmentData as unknown as SBEnrollmentRow[]) ?? [];
  if (enrollments.length === 0) return [];

  const pathIds = Array.from(
    new Set(enrollments.map((row) => row.learning_path_id).filter(Boolean))
  );

  const [progressResult, courseResult] = await Promise.all([
    supabase
      .from('learning_path_progress')
      .select('learning_path_id, completed_courses, total_courses, progress_percentage, status')
      .eq('employee_id', employeeId)
      .in('learning_path_id', pathIds),
    supabase
      .from('learning_path_courses')
      .select('learning_path_id')
      .eq('active', true)
      .in('learning_path_id', pathIds),
  ]);

  if (progressResult.error) {
    console.error('[myLearningPathRepository] getMyLearningPaths (progress):', progressResult.error);
    throw new Error(progressResult.error.message);
  }
  if (courseResult.error) {
    console.error('[myLearningPathRepository] getMyLearningPaths (courses):', courseResult.error);
    throw new Error(courseResult.error.message);
  }

  const progressRows = (progressResult.data as SBProgressRow[])   ?? [];
  const courseRows   = (courseResult.data   as SBPathCourseRow[]) ?? [];

  const progressByPath = new Map<string, SBProgressRow>();
  progressRows.forEach((p) => progressByPath.set(p.learning_path_id, p));

  const courseCountByPath = new Map<string, number>();
  courseRows.forEach((c) => {
    courseCountByPath.set(c.learning_path_id, (courseCountByPath.get(c.learning_path_id) ?? 0) + 1);
  });

  return enrollments
    .map((row): MyLearningPath | null => {
      const path = unwrap(row.learning_paths);
      if (!path) return null;

      const progress    = progressByPath.get(row.learning_path_id) ?? null;
      const totalCourses = progress?.total_courses ?? courseCountByPath.get(row.learning_path_id) ?? 0;

      return {
        enrollmentId:       row.id,
        learningPathId:     row.learning_path_id,
        pathCode:           path.path_code       ?? '',
        pathName:           path.path_name       ?? 'Untitled Path',
        description:        path.description     ?? '',
        thumbnailUrl:       path.thumbnail_url   ?? '',
        difficultyLevel:    path.difficulty_level ?? 'beginner',
        estimatedDuration:  path.estimated_duration ?? 0,
        totalCourses,
        completedCourses:   progress?.completed_courses   ?? 0,
        progressPercentage: progress?.progress_percentage ?? 0,
        status:             mapStatus(progress?.status),
        dueDate:            row.end_date ?? '',
      };
    })
    .filter((item): item is MyLearningPath => item !== null);
}
