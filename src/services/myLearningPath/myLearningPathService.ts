// src/services/myLearningPath/myLearningPathService.ts
// Business logic only — no Supabase imports.

import { getMyLearningPaths } from '../../repositories/myLearningPath/myLearningPathRepository';
import type { MyLearningPath } from '../../types/myLearningPath';

export async function loadMyLearningPaths(employeeId: string): Promise<MyLearningPath[]> {
  if (!employeeId) throw new Error('Employee ID is required.');
  return await getMyLearningPaths(employeeId);
}
