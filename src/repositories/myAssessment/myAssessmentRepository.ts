// src/repositories/myAssessment/myAssessmentRepository.ts
//
// Supabase queries only — zero business logic.
// Nested relations typed as Array (Supabase JS always returns arrays for
// to-many joins and may return a single object or array for to-one joins
// depending on FK direction), normalised to single objects before returning.

import { supabase } from '../../lib/supabase';
import type { MyAssessment, MyAssessmentStatus } from '../../types/myAssessment';

// ── Private Supabase-shaped interfaces ───────────────────────────────────────

interface SBAssessment {
  id:                  string;
  assessment_code:     string;
  assessment_title:    string;
  assessment_type:     string;
  duration_minutes:    number;
  passing_percentage:  number;
  maximum_attempts:    number;
}

interface SBAssignmentRow {
  id:                string;
  assessment_id:      string;
  end_date:           string;
  maximum_attempts:   number;
  assignment_status:  string;
  active:             boolean;
  assessments:        SBAssessment | SBAssessment[] | null;
}

interface SBQuestionMarksRow {
  assessment_id: string;
  marks:         number;
}

interface SBAttemptRow {
  id:            string;
  assessment_id: string;
  status:        string;
  started_at:    string;
  completed_at:  string | null;
  submitted_at:  string | null;
}

interface SBResultRow {
  id:            string;
  assessment_id: string;
  percentage:    number;
  passed:        boolean;
  evaluated_at:  string;
  published:     boolean;
}

// ── Normalise helpers ─────────────────────────────────────────────────────────

function normaliseAssessment(
  assessments: SBAssessment | SBAssessment[] | null
): SBAssessment | null {
  const row = Array.isArray(assessments) ? assessments[0] : assessments;
  return row ?? null;
}

function deriveStatus(attempts: SBAttemptRow[]): MyAssessmentStatus {
  if (attempts.length === 0) return 'not_started';
  if (attempts.some((a) => a.status === 'in_progress')) return 'in_progress';
  return 'completed';
}

function latestAttempt(attempts: SBAttemptRow[]): SBAttemptRow | null {
  if (attempts.length === 0) return null;
  return [...attempts].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )[0];
}

function latestResult(results: SBResultRow[]): SBResultRow | null {
  if (results.length === 0) return null;
  return [...results].sort(
    (a, b) => new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime()
  )[0];
}

// ── Public repository functions ───────────────────────────────────────────────

export async function getMyAssessments(employeeId: string): Promise<MyAssessment[]> {
  const { data: assignmentData, error: assignmentError } = await supabase
    .from('assessment_assignments')
    .select(
      `id,
       assessment_id,
       end_date,
       maximum_attempts,
       assignment_status,
       active,
       assessments (
         id,
         assessment_code,
         assessment_title,
         assessment_type,
         duration_minutes,
         passing_percentage,
         maximum_attempts
       )`
    )
    .eq('employee_id', employeeId)
    .eq('assignment_type', 'employee')
    .eq('active', true)
    .order('end_date', { ascending: true });

  if (assignmentError) {
    console.error('[myAssessmentRepository] getMyAssessments (assignments):', assignmentError);
    throw new Error(assignmentError.message);
  }

  const assignments = (assignmentData as unknown as SBAssignmentRow[]) ?? [];
  if (assignments.length === 0) return [];

  const assessmentIds = Array.from(
    new Set(assignments.map((row) => row.assessment_id).filter(Boolean))
  );

  const [marksResult, attemptResult, resultResult] = await Promise.all([
    supabase
      .from('question_bank')
      .select('assessment_id, marks')
      .in('assessment_id', assessmentIds),
    supabase
      .from('assessment_attempts')
      .select('id, assessment_id, status, started_at, completed_at, submitted_at')
      .eq('employee_id', employeeId)
      .in('assessment_id', assessmentIds),
    supabase
      .from('assessment_results')
      .select('id, assessment_id, percentage, passed, evaluated_at, published')
      .eq('employee_id', employeeId)
      .in('assessment_id', assessmentIds),
  ]);

  if (marksResult.error) {
    console.error('[myAssessmentRepository] getMyAssessments (marks):', marksResult.error);
    throw new Error(marksResult.error.message);
  }
  if (attemptResult.error) {
    console.error('[myAssessmentRepository] getMyAssessments (attempts):', attemptResult.error);
    throw new Error(attemptResult.error.message);
  }
  if (resultResult.error) {
    console.error('[myAssessmentRepository] getMyAssessments (results):', resultResult.error);
    throw new Error(resultResult.error.message);
  }

  const marksRows   = (marksResult.data   as SBQuestionMarksRow[]) ?? [];
  const attemptRows = (attemptResult.data as SBAttemptRow[])       ?? [];
  const resultRows  = (resultResult.data  as SBResultRow[])        ?? [];

  const totalMarksByAssessment = new Map<string, number>();
  marksRows.forEach((q) => {
    totalMarksByAssessment.set(
      q.assessment_id,
      (totalMarksByAssessment.get(q.assessment_id) ?? 0) + (q.marks ?? 0)
    );
  });

  const attemptsByAssessment = new Map<string, SBAttemptRow[]>();
  attemptRows.forEach((a) => {
    const list = attemptsByAssessment.get(a.assessment_id) ?? [];
    list.push(a);
    attemptsByAssessment.set(a.assessment_id, list);
  });

  const resultsByAssessment = new Map<string, SBResultRow[]>();
  resultRows.forEach((r) => {
    const list = resultsByAssessment.get(r.assessment_id) ?? [];
    list.push(r);
    resultsByAssessment.set(r.assessment_id, list);
  });

  return assignments
    .map((row): MyAssessment | null => {
      const assessment = normaliseAssessment(row.assessments);
      if (!assessment) return null;

      const attempts     = attemptsByAssessment.get(row.assessment_id) ?? [];
      const results       = resultsByAssessment.get(row.assessment_id) ?? [];
      const lastAttempt   = latestAttempt(attempts);
      const bestResult    = latestResult(results);
      const totalMarks    = totalMarksByAssessment.get(row.assessment_id) ?? 0;
      const passingMarks  = Math.round(
        (totalMarks * (assessment.passing_percentage ?? 0)) / 100
      );

      return {
        assignmentId:    row.id,
        assessmentId:    row.assessment_id,
        assessmentTitle: assessment.assessment_title ?? 'Untitled Assessment',
        assessmentCode:  assessment.assessment_code   ?? '',
        assessmentType:  assessment.assessment_type   ?? 'quiz',
        durationMinutes: assessment.duration_minutes  ?? 0,
        totalMarks,
        passingMarks,
        dueDate:         row.end_date ?? '',
        status:          deriveStatus(attempts),
        attemptCount:    attempts.length,
        maximumAttempts: row.maximum_attempts || assessment.maximum_attempts || 1,
        lastAttemptDate:
          lastAttempt?.completed_at ?? lastAttempt?.submitted_at ?? lastAttempt?.started_at ?? null,
        resultId:   bestResult?.id         ?? null,
        percentage: bestResult?.percentage ?? null,
        passed:     bestResult?.passed     ?? null,
      };
    })
    .filter((item): item is MyAssessment => item !== null);
}
