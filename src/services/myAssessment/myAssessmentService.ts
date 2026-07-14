// src/services/myAssessment/myAssessmentService.ts
// Business logic only — no Supabase imports.

import { getMyAssessments } from '../../repositories/myAssessment/myAssessmentRepository';
import type { MyAssessment } from '../../types/myAssessment';

export async function loadMyAssessments(employeeId: string): Promise<MyAssessment[]> {
  if (!employeeId) throw new Error('Employee ID is required.');
  return await getMyAssessments(employeeId);
}
