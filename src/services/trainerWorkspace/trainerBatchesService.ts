// src/services/trainerWorkspace/trainerBatchesService.ts
//
// Real, detailed "My Batches" view — every batch a Trainer is
// assigned to, with real status, dates, real student counts, and real
// average completion per batch.

import { loadTrainerAssignments } from '../trainerAssignment/trainerAssignmentService';
import { loadTrainingBatches } from '../trainingBatch/trainingBatchService';
import { loadCourses } from '../course/courseService';
import { loadEnrollments } from '../enrollment/enrollmentService';
import type { BatchStatus } from '../../types/trainingBatch';

export interface TrainerBatchDetail {
  batchId: string;
  batchCode: string;
  batchName: string;
  courseName: string;
  status: BatchStatus;
  startDate: string;
  endDate: string;
  capacity: number;
  enrolledStudents: number;
  averageCompletion: number;
}

export async function loadTrainerBatchDetails(trainerId: string): Promise<TrainerBatchDetail[]> {
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

  return myBatches.map((batch) => {
    const courseEnrollments = enrollments.filter((e) => e.course_id === batch.course_id);
    const averageCompletion = courseEnrollments.length > 0
      ? Math.round(courseEnrollments.reduce((sum, e) => sum + (e.completion_percentage ?? 0), 0) / courseEnrollments.length)
      : 0;

    return {
      batchId: batch.id,
      batchCode: batch.batch_code,
      batchName: batch.batch_name,
      courseName: courseById.get(batch.course_id)?.course_name ?? 'Unknown Course',
      status: batch.status,
      startDate: batch.start_date,
      endDate: batch.end_date,
      capacity: batch.capacity,
      enrolledStudents: courseEnrollments.length,
      averageCompletion,
    };
  });
}
