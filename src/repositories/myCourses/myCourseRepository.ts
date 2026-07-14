import { supabase } from '../../lib/supabase';
import type { MyCourse, MyCourseStatus } from '../../types/myCourse';

interface SupabaseEnrollmentRow {
  id:                    string;
  course_id:             string;
  status:                string;
  completion_percentage: number;
  due_date:              string;
  completed_at:          string | null;
  created_at:            string;
  courses: Array<{
    course_code:    string;
    course_name:    string;
    thumbnail:      string;
    duration_days:  number;
    duration_hours: number;
    course_categories: Array<{
      category_name: string;
    }> | null;
  }> | null;
}

function normalise(row: SupabaseEnrollmentRow): MyCourse {
  const course   = row.courses?.[0]               ?? null;
  const category = course?.course_categories?.[0] ?? null;

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
