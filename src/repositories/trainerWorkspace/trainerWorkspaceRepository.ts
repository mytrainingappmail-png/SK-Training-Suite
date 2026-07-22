// src/repositories/trainerWorkspace/trainerWorkspaceRepository.ts
//
// NEW, separate repository for the Trainer's own workspace features
// (My Students, Grading Queue) — deliberately not touching the
// existing assessmentPlayerRepository.ts or autoGradingRepository.ts.
// Reuses the same shared Supabase client.

import { supabase } from '../../lib/supabase';
import type { AssessmentAttempt, AssessmentAnswer, PlayerQuestion } from '../../types/assessmentPlayer';

export async function getAttemptsForEmployees(employeeIds: string[]): Promise<AssessmentAttempt[]> {
  if (employeeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('*')
    .in('employee_id', employeeIds)
    .in('status', ['submitted', 'completed']);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSubjectiveAnswersForAttempts(attemptIds: string[]): Promise<AssessmentAnswer[]> {
  if (attemptIds.length === 0) return [];
  const { data, error } = await supabase
    .from('assessment_answers')
    .select('*')
    .in('attempt_id', attemptIds)
    .eq('trainer_reviewed', false);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getQuestionsByIds(questionIds: string[]): Promise<PlayerQuestion[]> {
  if (questionIds.length === 0) return [];
  const { data: questions, error: qError } = await supabase
    .from('question_bank')
    .select('*')
    .in('id', questionIds);
  if (qError) throw new Error(qError.message);

  const { data: options, error: oError } = await supabase
    .from('question_options')
    .select('*')
    .in('question_id', questionIds);
  if (oError) throw new Error(oError.message);

  return (questions ?? []).map((q) => ({
    ...q,
    options: (options ?? []).filter((o) => o.question_id === q.id),
  }));
}

export async function reviewAnswer(answerId: string, marksAwarded: number): Promise<void> {
  const { error } = await supabase
    .from('assessment_answers')
    .update({ marks_awarded: marksAwarded, is_correct: marksAwarded > 0, trainer_reviewed: true })
    .eq('id', answerId);
  if (error) throw new Error(error.message);
}

export async function getAttemptById(attemptId: string): Promise<AssessmentAttempt> {
  const { data, error } = await supabase.from('assessment_attempts').select('*').eq('id', attemptId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAllAnswersForAttempt(attemptId: string): Promise<AssessmentAnswer[]> {
  const { data, error } = await supabase.from('assessment_answers').select('*').eq('attempt_id', attemptId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAssessmentById(assessmentId: string): Promise<{ passing_percentage: number }> {
  const { data, error } = await supabase.from('assessments').select('passing_percentage').eq('id', assessmentId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAttemptTotals(attemptId: string, updates: { obtained_marks: number; percentage: number; passed: boolean; score: number }): Promise<void> {
  const { error } = await supabase.from('assessment_attempts').update(updates).eq('id', attemptId);
  if (error) throw new Error(error.message);
}

export async function updateResultForAttempt(attemptId: string, updates: { obtained_marks: number; percentage: number; passed: boolean; grade: string }): Promise<void> {
  const { error } = await supabase.from('assessment_results').update(updates).eq('attempt_id', attemptId);
  if (error) throw new Error(error.message);
}