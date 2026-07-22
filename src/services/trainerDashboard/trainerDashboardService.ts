// src/services/trainerDashboard/trainerDashboardService.ts
//
// Real, personalized data for a Trainer's own dashboard — their
// assigned training batches, the courses those batches run, and real
// enrollment counts for those courses. Reuses existing, unmodified
// services throughout (trainerAssignmentService, courseService,
// enrollmentService, trainingBatchService).

import { loadTrainerAssignments } from '../trainerAssignment/trainerAssignmentService';
import { loadTrainingBatches } from '../trainingBatch/trainingBatchService';
import { loadCourses } from '../course/courseService';
import { loadEnrollments } from '../enrollment/enrollmentService';

export interface TrainerBatchRow {
  batchId: string;
  batchName: string;
  courseName: string;
  startDate: string;
  endDate: string;
  enrolledCount: number;
}

export interface TrainerDashboardData {
  activeBatchCount: number;
  courseCount: number;
  totalStudents: number;
  batches: TrainerBatchRow[];
}

export async function loadTrainerDashboard(trainerId: string): Promise<TrainerDashboardData> {
  const [assignments, batches, courses, enrollments] = await Promise.all([
    loadTrainerAssignments(),
    loadTrainingBatches(),
    loadCourses(),
    loadEnrollments(),
  ]);

  const myActiveAssignments = assignments.filter((a) => a.trainer_id === trainerId && a.is_active);
  const myBatchIds = new Set(myActiveAssignments.map((a) => a.batch_id));
  const myBatches = batches.filter((b) => myBatchIds.has(b.id));

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const enrollmentCountByCourseId = new Map<string, number>();
  enrollments.forEach((e) => {
    enrollmentCountByCourseId.set(e.course_id, (enrollmentCountByCourseId.get(e.course_id) ?? 0) + 1);
  });

  const rows: TrainerBatchRow[] = myBatches.map((batch) => {
    const course = courseById.get(batch.course_id);
    return {
      batchId: batch.id,
      batchName: batch.batch_name,
      courseName: course?.course_name ?? 'Unknown Course',
      startDate: batch.start_date,
      endDate: batch.end_date,
      enrolledCount: enrollmentCountByCourseId.get(batch.course_id) ?? 0,
    };
  });

  const uniqueCourseIds = new Set(myBatches.map((b) => b.course_id));
  const totalStudents = rows.reduce((sum, r) => sum + r.enrolledCount, 0);

  return {
    activeBatchCount: myBatches.length,
    courseCount: uniqueCourseIds.size,
    totalStudents,
    batches: rows,
  };
}
