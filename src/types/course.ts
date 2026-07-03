/* =====================================================
   SK ENTERPRISE LMS
   COURSE TYPES
   ===================================================== */

// Course difficulty level — matches the level column in the courses table.
export type CourseLevel =
  | "beginner"
  | "intermediate"
  | "advanced";

// Matches every column in the courses table exactly.
export interface Course {

  id: string;

  company_id: string;

  category_id: string;

  course_code: string;

  course_name: string;

  short_description: string;

  full_description: string;

  // URL or storage path to the course thumbnail image.
  thumbnail: string;

  level: CourseLevel;

  duration_days: number;

  duration_hours: number;

  // Minimum score required to pass (0–100).
  passing_percentage: number;

  certificate_enabled: boolean;

  active: boolean;

  // ID of the user who created the course.
  created_by: string;

  created_at: string;

  updated_at: string;

}

// Form type used for create and update operations.
// Omits server-generated fields.
export type CourseForm = Omit<
  Course,
  "id" | "created_at" | "updated_at"
>;

// Default values for initialising an empty CourseForm.
export const defaultCourseForm: CourseForm = {
  company_id: "",
  category_id: "",
  course_code: "",
  course_name: "",
  short_description: "",
  full_description: "",
  thumbnail: "",
  level: "beginner",
  duration_days: 0,
  duration_hours: 0,
  passing_percentage: 50,
  certificate_enabled: false,
  active: true,
  created_by: "",
};
