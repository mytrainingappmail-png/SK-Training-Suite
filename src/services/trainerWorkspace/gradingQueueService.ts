// src/services/trainerWorkspace/gradingQueueService.ts
//
// Real manual-grading queue for subjective (short/long answer)
// questions — these can never be auto-graded reliably (no single
// "correct option" to compare against), so they've been silently
// sitting at 0 marks since auto-grading was introduced. This closes
// that real gap: a trainer sees every pending subjective answer from
// their own students, awards real marks, and the attempt +
// AssessmentResult are both recomputed immediately.

import {
  getAttemptsForEmployees,
  getSubjectiveAnswersForAttempts,
  getQuestionsByIds,
  reviewAnswer,
  getAttemptById,
  getAllAnswersForAttempt,
  getAssessmentById,
  updateAttemptTotals,
  updateResultForAttempt,
} from '../../repositories/trainerWorkspace/trainerWorkspaceRepository';
import { loadTrainerStudents } from './trainerStudentsService';

export interface GradingQueueItem {
  answerId: string;
  attemptId: string;
  employeeId: string;
  employeeName: string;
  questionText: string;
  answerText: string;
  maxMarks: number;
}

function computeGrade(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

export async function loadGradingQueue(trainerId: string): Promise<GradingQueueItem[]> {
  const students = await loadTrainerStudents(trainerId);
  const employeeIds = Array.from(new Set(students.map((s) => s.employeeId)));
  const employeeNameById = new Map(students.map((s) => [s.employeeId, s.employeeName]));

  const attempts = await getAttemptsForEmployees(employeeIds);
  const attemptIds = attempts.map((a) => a.id);
  const answers = await getSubjectiveAnswersForAttempts(attemptIds);

  const questionIds = Array.from(new Set(answers.map((a) => a.question_id)));
  const questions = await getQuestionsByIds(questionIds);
  const questionById = new Map(questions.map((q) => [q.id, q]));

  const attemptById = new Map(attempts.map((a) => [a.id, a]));

  return answers
    .filter((a) => {
      const question = questionById.get(a.question_id);
      return question && (question.question_type === 'short_answer' || question.question_type === 'long_answer');
    })
    .map((a) => {
      const question = questionById.get(a.question_id)!;
      const attempt = attemptById.get(a.attempt_id);
      return {
        answerId: a.id,
        attemptId: a.attempt_id,
        employeeId: attempt?.employee_id ?? '',
        employeeName: employeeNameById.get(attempt?.employee_id ?? '') ?? 'Unknown',
        questionText: question.question_text,
        answerText: a.answer_text,
        maxMarks: question.marks,
      };
    });
}

/**
 * Awards marks for one subjective answer, then recomputes the whole
 * attempt's totals and the matching AssessmentResult — so the
 * student's real, final score reflects the trainer's review
 * immediately, not just this one answer in isolation.
 */
export async function reviewAndRescoreAttempt(answerId: string, marksAwarded: number, attemptId: string): Promise<void> {
  await reviewAnswer(answerId, marksAwarded);

  const [attempt, allAnswers] = await Promise.all([
    getAttemptById(attemptId),
    getAllAnswersForAttempt(attemptId),
  ]);

  const obtainedMarks = Math.max(0, allAnswers.reduce((sum, a) => sum + a.marks_awarded, 0));
  const totalMarks = attempt.total_marks;
  const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;

  const assessment = await getAssessmentById(attempt.assessment_id);
  const passed = percentage >= assessment.passing_percentage;
  const grade = computeGrade(percentage);

  await updateAttemptTotals(attemptId, { obtained_marks: obtainedMarks, percentage, passed, score: obtainedMarks });
  await updateResultForAttempt(attemptId, { obtained_marks: obtainedMarks, percentage, passed, grade });
}
