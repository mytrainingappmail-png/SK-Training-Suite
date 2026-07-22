// src/repositories/myCourses/myCourseRepository.ts
//
// FIX: enrollments -> courses, and courses -> course_categories, are
// both to-ONE relationships — PostgREST returns each as a single
// object, not an array. The old code did `row.courses?.[0]` and
// `course?.course_categories?.[0]`, both array-indexing a non-array,
// which silently returned undefined every time. This is the original
// source of the "Untitled Course" fallback text showing up in My
// Courses. Now handled via unwrap(), which works whether Supabase
// returns an object or a single-item array.

import { supabase } from '../../lib/supabase';
import type { MyCourse, MyCourseStatus } from '../../types/myCourse';

interface SBCourseCategory {
  category_name: string;
}

interface SBCourse {
  course_code:    string;
  course_name:    string;
  thumbnail:      string;
  duration_days:  number;
  duration_hours: number;
  course_categories: SBCourseCategory[] | SBCourseCategory | null;
}

interface SupabaseEnrollmentRow {
  id:                    string;
  course_id:             string;
  status:                string;
  completion_percentage: number;
  due_date:              string;
  completed_at:          string | null;
  created_at:            string;
  courses: SBCourse[] | SBCourse | null;
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalise(row: SupabaseEnrollmentRow): MyCourse {
  const course   = unwrap(row.courses);
  const category = unwrap(course?.course_categories);

  return {
    enrollmentId:         row.id,
    courseId:             row.course_id,
    courseCode:           course?.course_code    ?? '',
    courseName:           course?.course_name    ?? 'Untitled Course',
    thumbnail:            course?.thumbnail      ?? '',
    categoryName:         category?.category_name ?? '',
    durationDays:         course?.duration_days  ?? 0,
    durationHours:        course?.duration_hours ?? 0,
    status:               row.status             as MyCourseStatus,
    completionPercentage: row.completion_percentage ?? 0,
    dueDate:              row.due_date            ?? '',
    completedAt:          row.completed_at        ?? null,
    enrolledAt:           row.created_at          ?? '',
  };
}

export async function getMyCourses(employeeId: string): Promise<MyCourse[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      `id,
       course_id,
       status,
       completion_percentage,
       due_date,
       completed_at,
       created_at,
       courses (
         course_code,
         course_name,
         thumbnail,
         duration_days,
         duration_hours,
         course_categories ( category_name )
       )`
    )
    .eq('employee_id', employeeId)
    .eq('enrollment_type', 'COURSE')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as SupabaseEnrollmentRow[] ?? []).map(normalise);
}