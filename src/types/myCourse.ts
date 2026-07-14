export type MyCourseStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface MyCourse {
  enrollmentId:         string;
  courseId:             string;
  courseCode:           string;
  courseName:           string;
  thumbnail:            string;
  categoryName:         string;
  durationDays:         number;
  durationHours:        number;
  status:               MyCourseStatus;
  completionPercentage: number;
  dueDate:              string;
  completedAt:          string | null;
  enrolledAt:           string;
}
