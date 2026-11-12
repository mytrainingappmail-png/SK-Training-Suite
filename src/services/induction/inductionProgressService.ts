// Thin wrapper around the already-existing, general-purpose
// assessment-results lookup (also used by CoursePlayer's
// test_compulsory_after_module gate) — no new pass/fail tracking needed,
// Induction just reuses it.

import { getPassedAssessmentIds, getMustPassAssessmentIds } from '../../repositories/coursePlayer/coursePlayerRepository';

export async function getPassedTestIds(employeeId: string, assessmentIds: string[]): Promise<Set<string>> {
  return getPassedAssessmentIds(employeeId, assessmentIds);
}

/** Which of these tests the admin switched to "employees must pass this test". */
export async function getMustPassTestIds(assessmentIds: string[]): Promise<Set<string>> {
  return getMustPassAssessmentIds(assessmentIds);
}
