// src/services/assessmentPlayer/autoGradingService.ts
//
// Real automatic grading — computes actual marks from the employee's
// real saved answers vs each question's real correct option(s), then
// writes the final score back onto the attempt AND creates the real
// AssessmentResult row automatically. This is the piece that was
// missing: previously an admin had to enter every result by hand.
//
// Objective questions (with options) are graded automatically.
// Free-text questions (short/long answer, no options) cannot be
// auto-graded reliably — they're left at 0 marks for an admin to
// review and adjust manually in Assessment Results.

import {
  getAttemptById,
  getAnswersForAttempt,
  getQuestionsWithOptions,
  getAssessmentById,
  updateAnswerGrading,
  updateAttemptScore,
} from '../../repositories/assessmentPlayer/autoGradingRepository';
import { createResult } from '../assessmentResult/assessmentResultService';
import type { AssessmentAttempt } from '../../types/assessmentPlayer';

function computeGrade(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

export interface FinalizeResultOutcome {
  attempt: AssessmentAttempt;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  grade: string;
}

/**
 * Call this right after submitAssessment() succeeds. Grades every
 * objective answer for the attempt, aggregates the real score, writes
 * it back onto the attempt, and creates the matching AssessmentResult
 * automatically — no admin step required.
 */
export async function finalizeAssessmentResult(attemptId: string): Promise<FinalizeResultOutcome> {
  const attempt = await getAttemptById(attemptId);
  const [answers, questions, assessment] = await Promise.all([
    getAnswersForAttempt(attemptId),
    getQuestionsWithOptions(attempt.assessment_id),
    getAssessmentById(attempt.assessment_id),
  ]);

  const questionById = new Map(questions.map((q) => [q.id, q]));

  let obtainedMarks = 0;
  let totalMarks = 0;

  for (const question of questions) {
    totalMarks += question.marks;
  }

  for (const answer of answers) {
    const question = questionById.get(answer.question_id);
    if (!question) continue;

    // Free-text question — no options to auto-grade against. Leave
    // for manual review; award nothing automatically.
    if (question.options.length === 0) {
      await updateAnswerGrading(answer.id, false, 0);
      continue;
    }

    const correctOptionIds = new Set(question.options.filter((o) => o.is_correct).map((o) => o.id));
    const selected = new Set(answer.selected_option_ids);

    const isExactMatch =
      selected.size === correctOptionIds.size &&
      Array.from(selected).every((id) => correctOptionIds.has(id));

    let marksAwarded = 0;
    let isCorrect = false;

    if (answer.is_skipped || selected.size === 0) {
      marksAwarded = 0;
      isCorrect = false;
    } else if (isExactMatch) {
      marksAwarded = question.marks;
      isCorrect = true;
    } else {
      marksAwarded = -question.negative_marks;
      isCorrect = false;
    }

    await updateAnswerGrading(answer.id, isCorrect, marksAwarded);
    obtainedMarks += marksAwarded;
  }

  obtainedMarks = Math.max(0, obtainedMarks);
  const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;
  const passed = percentage >= assessment.passing_percentage;
  const grade = computeGrade(percentage);

  await updateAttemptScore(attemptId, {
    obtained_marks: obtainedMarks,
    total_marks: totalMarks,
    percentage,
    score: obtainedMarks,
    passed,
  });

  await createResult({
    attempt_id: attemptId,
    assessment_id: attempt.assessment_id,
    employee_id: attempt.employee_id,
    total_marks: totalMarks,
    obtained_marks: obtainedMarks,
    percentage,
    passed,
    grade,
    rank: 1,
    certificate_generated: false,
    evaluated_at: new Date().toISOString(),
    published: true,
    remarks: 'Auto-graded on submission.',
  });

  return {
    attempt: { ...attempt, obtained_marks: obtainedMarks, total_marks: totalMarks, percentage, passed, score: obtainedMarks },
    obtainedMarks,
    totalMarks,
    percentage,
    passed,
    grade,
  };
}
