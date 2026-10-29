// Loads what the topic report needs: each test's questions (with their topics) and every trainee's answers.
// The host already has access to all answers of their own company's sessions (live quiz: row security; exam: a trainer-only function).

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { getQuizWithQuestions } from "./quizRepository";
import type { QuizSessionResultRow } from "../../types/quiz";
import type { TopicAnswer, TopicQuestion, TopicSessionInput } from "../../services/quiz/quizTopicReport";

/** The database returns at most this many rows per request, so bigger answer lists are fetched page by page. */
const PAGE = 1000;

async function visibleQuestions(quizId: string): Promise<TopicQuestion[]> {
  const quiz = await getQuizWithQuestions(quizId);
  return (quiz?.questions ?? []).filter((q) => !q.is_hidden).map((q) => ({ id: q.id, topic: q.topic ?? null, marks: q.marks || 1 }));
}

/** Live quiz sessions: the ticked results (one row per trainee per session) in, one input per session out. */
export async function loadQuizTopicInputs(rows: QuizSessionResultRow[]): Promise<TopicSessionInput[]> {
  const bySession = new Map<string, QuizSessionResultRow[]>();
  for (const r of rows) bySession.set(r.session_id, [...(bySession.get(r.session_id) ?? []), r]);

  const questionCache = new Map<string, Promise<TopicQuestion[]>>();
  const inputs: TopicSessionInput[] = [];

  for (const [sessionId, list] of bySession) {
    const quizId = list[0].quiz_id;
    if (!questionCache.has(quizId)) questionCache.set(quizId, visibleQuestions(quizId));
    const questions = await questionCache.get(quizId)!;
    const marksOf = new Map(questions.map((q) => [q.id, q.marks]));

    const answers: TopicAnswer[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseQuiz
        .from("quiz_answers")
        .select("participant_id, question_id, is_correct")
        .eq("session_id", sessionId)
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[quizTopicRepository] loadQuizTopicInputs:", error);
        throw new Error(error.message);
      }
      for (const a of data ?? []) {
        answers.push({ participantId: a.participant_id, questionId: a.question_id, earned: a.is_correct ? marksOf.get(a.question_id) ?? 1 : 0 });
      }
      if ((data?.length ?? 0) < PAGE) break;
    }

    inputs.push({
      questions,
      participants: list.map((r) => ({ id: r.participant_id, name: r.display_name })),
      answers,
    });
  }
  return inputs;
}

/** One exam session: every candidate's answers (marks given where graded). */
export async function loadExamTopicInput(sessionId: string, quizId: string): Promise<TopicSessionInput> {
  const questions = await visibleQuestions(quizId);
  const marksOf = new Map(questions.map((q) => [q.id, q.marks]));
  const participants = new Map<string, string>();
  const answers: TopicAnswer[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseQuiz.rpc("get_exam_topic_answers", { p_session_id: sessionId }).range(from, from + PAGE - 1);
    if (error) {
      console.error("[quizTopicRepository] loadExamTopicInput:", error);
      throw new Error(error.message);
    }
    const rows = (data ?? []) as { participant_id: string; display_name: string; question_id: string | null; is_correct: boolean | null; marks_awarded: number | null }[];
    for (const r of rows) {
      participants.set(r.participant_id, r.display_name);
      if (!r.question_id) continue;
      const marks = marksOf.get(r.question_id) ?? 1;
      // marks the trainer gave win; else right / wrong; else not graded yet (a written answer waiting for a grader)
      const earned = r.marks_awarded !== null ? Number(r.marks_awarded) : r.is_correct === null ? null : r.is_correct ? marks : 0;
      answers.push({ participantId: r.participant_id, questionId: r.question_id, earned });
    }
    if (rows.length < PAGE) break;
  }

  return { questions, participants: [...participants].map(([id, name]) => ({ id, name })), answers };
}
