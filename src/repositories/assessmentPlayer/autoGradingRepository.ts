// src/repositories/assessmentPlayer/autoGradingRepository.ts
//
// NEW, separate repository — deliberately not touching the existing
// assessmentPlayerRepository.ts. Reuses the same shared Supabase client.
// Reads/writes only the specific columns needed to auto-grade a
// submitted attempt: assessment_answers (is_correct, marks_awarded)
// and assessment_attempts (score, percentage, passed, obtained_marks,
// total_marks).

import { supabase } from '../../lib/supabase';
import type { AssessmentAttempt, AssessmentAnswer, PlayerQuestion } from '../../types/assessmentPlayer';
import type { Assessment } from '../../types/assessment';

export async function getAttemptById(attemptId: string): Promise<AssessmentAttempt> {
  const { data, error } = await supabase.from('assessment_attempts').select('*').eq('id', attemptId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAnswersForAttempt(attemptId: string): Promise<AssessmentAnswer[]> {
  const { data, error } = await supabase.from('assessment_answers').select('*').eq('attempt_id', attemptId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getQuestionsWithOptions(assessmentId: string): Promise<PlayerQuestion[]> {
  const { data: questions, error: qError } = await supabase
    .from('question_bank')
    .select('*')
    .eq('assessment_id', assessmentId);
  if (qError) throw new Error(qError.message);

  const { data: options, error: oError } = await supabase
    .from('question_options')
    .select('*')
    .in('question_id', (questions ?? []).map((q) => q.id));
  if (oError) throw new Error(oError.message);

  return (questions ?? []).map((q) => ({
    ...q,
    options: (options ?? []).filter((o) => o.question_id === q.id),
  }));
}

export async function getAssessmentById(assessmentId: string): Promise<Assessment> {
  const { data, error } = await supabase.from('assessments').select('*').eq('id', assessmentId).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAnswerGrading(answerId: string, isCorrect: boolean, marksAwarded: number): Promise<void> {
  const { error } = await supabase
    .from('assessment_answers')
    .update({ is_correct: isCorrect, marks_awarded: marksAwarded })
    .eq('id', answerId);
  if (error) throw new Error(error.message);
}

export interface AttemptScoreUpdate {
  obtained_marks: number;
  total_marks: number;
  percentage: number;
  score: number;
  passed: boolean;
}

export async function updateAttemptScore(attemptId: string, scores: AttemptScoreUpdate): Promise<void> {
  const { error } = await supabase.from('assessment_attempts').update(scores).eq('id', attemptId);
  if (error) throw new Error(error.message);
}