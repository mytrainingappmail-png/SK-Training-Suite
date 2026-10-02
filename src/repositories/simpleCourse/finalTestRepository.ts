// The optional "Final test" of a course, for the simple My Courses screen.
//
// The test is an ordinary assessment (the same one the older screens, the course player and the
// reports already understand), hooked to a lesson of type "quiz" that sits at the very end of the
// course. Questions live in question_bank / question_options.

import { supabase } from "../../lib/supabase";

export interface TestOption { id?: string; text: string; correct: boolean }
export interface TestQuestion { id?: string; text: string; options: TestOption[] }
export interface FinalTest {
  assessmentId: string;
  lessonId: string;
  title: string;
  passPct: number;
  certificate: boolean;
  /** How many times anyone has started this test. */
  attempts: number;
  questions: TestQuestion[];
}
export interface FinalTestInput {
  title: string;
  passPct: number;
  certificate: boolean;
  questions: TestQuestion[];
}

function fail(label: string, error: { message: string }): never {
  console.error(`[finalTestRepository] ${label}:`, error);
  throw new Error(error.message);
}

function randomCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function getFinalTest(courseId: string): Promise<FinalTest | null> {
  const { data: modules, error: mError } = await supabase.from("modules").select("id").eq("course_id", courseId);
  if (mError) fail("getFinalTest (chapters)", mError);
  const moduleIds = (modules ?? []).map((m) => m.id);
  if (moduleIds.length === 0) return null;

  const { data: lessons, error: lError } = await supabase.from("lessons").select("id").in("module_id", moduleIds).eq("lesson_type", "quiz").limit(1);
  if (lError) fail("getFinalTest (lesson)", lError);
  const lesson = lessons?.[0];
  if (!lesson) return null;

  const { data: assessment, error: aError } = await supabase
    .from("assessments")
    .select("id, assessment_title, passing_percentage, certificate_enabled")
    .eq("lesson_id", lesson.id)
    .maybeSingle();
  if (aError) fail("getFinalTest (test)", aError);
  if (!assessment) return null;

  const { data: questions, error: qError } = await supabase
    .from("question_bank")
    .select("id, question_text, display_order")
    .eq("assessment_id", assessment.id)
    .order("display_order", { ascending: true });
  if (qError) fail("getFinalTest (questions)", qError);

  const qIds = (questions ?? []).map((q) => q.id);
  const { data: options, error: oError } = qIds.length
    ? await supabase
        .from("question_options")
        .select("id, question_id, option_text, is_correct, display_order")
        .in("question_id", qIds)
        .order("display_order", { ascending: true })
    : { data: [] as { id: string; question_id: string; option_text: string; is_correct: boolean }[], error: null };
  if (oError) fail("getFinalTest (answers)", oError);

  const { count } = await supabase.from("assessment_attempts").select("id", { count: "exact", head: true }).eq("assessment_id", assessment.id);

  return {
    assessmentId: assessment.id,
    lessonId: lesson.id,
    title: assessment.assessment_title,
    passPct: assessment.passing_percentage ?? 50,
    certificate: !!assessment.certificate_enabled,
    attempts: count ?? 0,
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      text: q.question_text,
      options: (options ?? []).filter((o) => o.question_id === q.id).map((o) => ({ id: o.id, text: o.option_text, correct: !!o.is_correct })),
    })),
  };
}

function validateTest(input: FinalTestInput): void {
  if (!input.title.trim()) throw new Error("Give the test a name.");
  if (!(input.passPct >= 1 && input.passPct <= 100)) throw new Error("The pass mark must be between 1 and 100.");
  if (input.questions.length === 0) throw new Error("Add at least one question.");
  input.questions.forEach((q, i) => {
    const filled = q.options.filter((o) => o.text.trim());
    if (!q.text.trim()) throw new Error(`Question ${i + 1} has no text.`);
    if (filled.length < 2) throw new Error(`Question ${i + 1} needs at least two answers.`);
    if (filled.filter((o) => o.correct).length !== 1) throw new Error(`Question ${i + 1}: mark exactly one answer as correct.`);
  });
}

/** Creates the test (and its lesson at the end of the course) or updates it. Returns the saved test. */
export async function saveFinalTest(companyId: string, courseId: string, input: FinalTestInput, existing: FinalTest | null): Promise<FinalTest> {
  validateTest(input);
  let assessmentId = existing?.assessmentId ?? "";

  if (!existing) {
    const { data: modules, error: mError } = await supabase
      .from("modules").select("id").eq("course_id", courseId).order("module_order", { ascending: false }).limit(1);
    if (mError) fail("saveFinalTest (chapters)", mError);
    const lastModule = modules?.[0];
    if (!lastModule) throw new Error("Add a chapter first.");

    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .insert({
        module_id: lastModule.id,
        lesson_title: input.title.trim(),
        lesson_type: "quiz",
        content: "",
        video_url: "",
        thumbnail: "",
        duration_minutes: 10,
        display_order: 1000,
        downloadable: false,
        active: true,
      })
      .select("id")
      .single();
    if (lessonError) fail("saveFinalTest (lesson)", lessonError);
    const lessonId = (lesson as { id: string }).id;

    const { data: created, error } = await supabase
      .from("assessments")
      .insert({
        company_id: companyId,
        lesson_id: lessonId,
        assessment_code: randomCode("TST"),
        assessment_title: input.title.trim(),
        assessment_type: "quiz",
        passing_percentage: input.passPct,
        maximum_attempts: 3,
        duration_minutes: 30,
        show_result_immediately: true,
        show_correct_answers: true,
        auto_submit: true,
        certificate_enabled: input.certificate,
        active: true,
      })
      .select("id")
      .single();
    if (error) {
      await supabase.from("lessons").delete().eq("id", lessonId);
      fail("saveFinalTest (create)", error);
    }
    assessmentId = (created as { id: string }).id;
  } else {
    const { error } = await supabase
      .from("assessments")
      .update({ assessment_title: input.title.trim(), passing_percentage: input.passPct, certificate_enabled: input.certificate })
      .eq("id", assessmentId);
    if (error) fail("saveFinalTest (update)", error);
    await supabase.from("lessons").update({ lesson_title: input.title.trim() }).eq("id", existing.lessonId);
  }

  // Questions: update in place, add new ones, remove the ones taken out.
  const keptQuestionIds: string[] = [];
  for (let qi = 0; qi < input.questions.length; qi++) {
    const q = input.questions[qi];
    let questionId = q.id ?? "";
    if (questionId) {
      const { error } = await supabase.from("question_bank").update({ question_text: q.text.trim(), display_order: qi + 1 }).eq("id", questionId);
      if (error) fail("saveFinalTest (question)", error);
    } else {
      const { data, error } = await supabase
        .from("question_bank")
        .insert({
          assessment_id: assessmentId,
          question_code: randomCode("q").toLowerCase(),
          question_text: q.text.trim(),
          question_type: "mcq",
          marks: 1,
          negative_marks: 0,
          display_order: qi + 1,
          active: true,
        })
        .select("id")
        .single();
      if (error) fail("saveFinalTest (new question)", error);
      questionId = (data as { id: string }).id;
    }
    keptQuestionIds.push(questionId);

    const filled = q.options.filter((o) => o.text.trim());
    const keptOptionIds: string[] = [];
    for (let oi = 0; oi < filled.length; oi++) {
      const o = filled[oi];
      if (o.id) {
        const { error } = await supabase.from("question_options").update({ option_text: o.text.trim(), is_correct: o.correct, display_order: oi + 1 }).eq("id", o.id);
        if (error) fail("saveFinalTest (answer)", error);
        keptOptionIds.push(o.id);
      } else {
        const { data, error } = await supabase
          .from("question_options")
          .insert({ question_id: questionId, option_text: o.text.trim(), is_correct: o.correct, display_order: oi + 1 })
          .select("id")
          .single();
        if (error) fail("saveFinalTest (new answer)", error);
        keptOptionIds.push((data as { id: string }).id);
      }
    }
    const { data: current } = await supabase.from("question_options").select("id").eq("question_id", questionId);
    const stale = (current ?? []).map((r) => r.id as string).filter((id) => !keptOptionIds.includes(id));
    if (stale.length > 0) await supabase.from("question_options").delete().in("id", stale);
  }

  const { data: allQuestions } = await supabase.from("question_bank").select("id").eq("assessment_id", assessmentId);
  const staleQuestions = (allQuestions ?? []).map((r) => r.id as string).filter((id) => !keptQuestionIds.includes(id));
  if (staleQuestions.length > 0) {
    const { error } = await supabase.from("question_bank").delete().in("id", staleQuestions);
    if (error) throw new Error("Some removed questions were already answered by employees, so they cannot be deleted. Edit them instead.");
  }

  const saved = await getFinalTest(courseId);
  if (!saved) throw new Error("The test was saved but could not be reopened. Please refresh.");
  return saved;
}

export async function deleteFinalTest(test: FinalTest): Promise<void> {
  const { error } = await supabase.from("lessons").delete().eq("id", test.lessonId);
  if (error) fail("deleteFinalTest", error);
}
