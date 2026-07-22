// src/services/trainerWorkspace/trainerCoursesService.ts
//
// Real "My Courses" view for a Trainer — every course they teach
// (across all their batches), with real module/lesson counts, real
// batch counts (split by status), and real average completion.

import { loadTrainerAssignments } from '../trainerAssignment/trainerAssignmentService';
import { loadTrainingBatches } from '../trainingBatch/trainingBatchService';
import { loadCourses } from '../course/courseService';
import { loadModules } from '../module/moduleService';
import { loadLessons } from '../lessonBuilder/lessonBuilderService';
import { loadEnrollments } from '../enrollment/enrollmentService';

export interface TrainerCourseRow {
  courseId: string;
  courseName: string;
  moduleCount: number;
  lessonCount: number;
  totalBatches: number;
  ongoingBatches: number;
  completedBatches: number;
  plannedBatches: number;
  totalStudents: number;
  averageCompletion: number;
}

export async function loadTrainerCourses(trainerId: string): Promise<TrainerCourseRow[]> {
  const [assignments, batches, courses, modules, lessons, enrollments] = await Promise.all([
    loadTrainerAssignments(),
    loadTrainingBatches(),
    loadCourses(),
    loadModules(),
    loadLessons(),
    loadEnrollments(),
  ]);

  const myActiveAssignments = assignments.filter((a) => a.trainer_id === trainerId && a.is_active);
  const myBatchIds = new Set(myActiveAssignments.map((a) => a.batch_id));
  const myBatches = batches.filter((b) => myBatchIds.has(b.id));

  const courseIds = Array.from(new Set(myBatches.map((b) => b.course_id).filter(Boolean)));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return courseIds.map((courseId) => {
    const course = courseById.get(courseId);
    const courseModules = modules.filter((m) => m.course_id === courseId);
    const courseModuleIds = new Set(courseModules.map((m) => m.id));
    const courseLessons = lessons.filter((l) => courseModuleIds.has(l.module_id));

    const courseBatches = myBatches.filter((b) => b.course_id === courseId);
    const ongoingBatches = courseBatches.filter((b) => b.status === 'ONGOING').length;
    const completedBatches = courseBatches.filter((b) => b.status === 'COMPLETED').length;
    const plannedBatches = courseBatches.filter((b) => b.status === 'PLANNED').length;

    const courseEnrollments = enrollments.filter((e) => e.course_id === courseId);
    const averageCompletion = courseEnrollments.length > 0
      ? Math.round(courseEnrollments.reduce((sum, e) => sum + (e.completion_percentage ?? 0), 0) / courseEnrollments.length)
      : 0;

    return {
      courseId,
      courseName: course?.course_name ?? 'Unknown Course',
      moduleCount: courseModules.length,
      lessonCount: courseLessons.length,
      totalBatches: courseBatches.length,
      ongoingBatches,
      completedBatches,
      plannedBatches,
      totalStudents: courseEnrollments.length,
      averageCompletion,
    };
  });
}
