import { getMyCourses }  from '../../repositories/myCourses/myCourseRepository';
import type { MyCourse } from '../../types/myCourse';

export async function loadMyCourses(employeeId: string): Promise<MyCourse[]> {
  if (!employeeId) {
    throw new Error('Employee ID is required.');
  }

  return await getMyCourses(employeeId);
}
