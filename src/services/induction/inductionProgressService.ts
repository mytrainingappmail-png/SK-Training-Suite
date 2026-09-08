// Thin wrapper around the already-existing, general-purpose
// assessment-results lookup (also used by CoursePlayer's
// test_compulsory_after_module gate) — no new pass/fail tracking needed,
// Induction just reuses it.

import { getPassedAssessmentIds } from '../../repositories/coursePlayer/coursePlayerRepository';

export async function getPassedTestIds(employeeId: string, assessmentIds: string[]): Promise<Set<string>> {
  return getPassedAssessmentIds(employeeId, assessmentIds);
}
