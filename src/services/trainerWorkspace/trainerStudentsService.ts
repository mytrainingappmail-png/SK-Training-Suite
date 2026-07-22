// src/services/trainerWorkspace/trainerStudentsService.ts
//
// Real roster of every student across a trainer's assigned batches,
// with real per-student course progress. Reuses existing,
// unmodified services throughout.

import { loadTrainerAssignments } from '../trainerAssignment/trainerAssignmentService';
import { loadTrainingBatches } from '../trainingBatch/trainingBatchService';
import { loadCourses } from '../course/courseService';
import { loadEnrollments } from '../enrollment/enrollmentService';
import { employeeService } from '../employee/employeeService';

export interface TrainerStudentRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  courseName: string;
  completionPercentage: number;
  status: string;
}

export async function loadTrainerStudents(trainerId: string): Promise<TrainerStudentRow[]> {
  const [assignments, batches, courses, enrollments, employees] = await Promise.all([
    loadTrainerAssignments(),
    loadTrainingBatches(),
    loadCourses(),
    loadEnrollments(),
    employeeService.getAll(),
  ]);

  const myActiveAssignments = assignments.filter((a) => a.trainer_id === trainerId && a.is_active);
  const myBatchIds = new Set(myActiveAssignments.map((a) => a.batch_id));
  const myBatches = batches.filter((b) => myBatchIds.has(b.id));
  const myCourseIds = new Set(myBatches.map((b) => b.course_id));

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  return enrollments
    .filter((e) => myCourseIds.has(e.course_id))
    .map((e) => {
      const employee = employeeById.get(e.employee_id);
      const course = courseById.get(e.course_id);
      return {
        employeeId: e.employee_id,
        employeeName: employee ? `${employee.first_name} ${employee.last_name}`.trim() : 'Unknown',
        employeeCode: employee?.employee_code ?? '',
        courseName: course?.course_name ?? 'Unknown Course',
        completionPercentage: e.completion_percentage ?? 0,
        status: e.status ?? 'enrolled',
      };
    });
}
