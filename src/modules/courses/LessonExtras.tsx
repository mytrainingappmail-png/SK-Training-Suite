// "Add to this lesson": a FAQ and / or a test that belong to ONE lesson of a course (My Courses editor), so the
// employee reads (or watches), then starts the test on the same lesson - no separate test lesson needed.
//
// The test is an ordinary assessment hooked to the lesson (assessments.lesson_id), with its questions in
// question_bank / question_options, exactly like the course's final test, so results, certificates and reports
// understand it. The FAQ and the "must pass" switch live on the lesson itself.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import * as repo from '../../repositories/simpleCourse/simpleCourseRepository';
import type { SimpleLesson } from '../../repositories/simpleCourse/simpleCourseRepository';
import { createAssessment, saveAssessment, removeAssessment } from '../../services/assessment/assessmentService';
import { loadQuestionsWithOptions } from '../../services/question/questionService';
import { getCurrentUser } from '../../services/auth/session';
import { defaultAssessmentForm } from '../../types/assessment';
import type { Question } from '../../types/question';
import { htmlToText } from '../../utils/htmlToText';
import FaqItemsEditor from '../../components/shared/FaqItemsEditor';
import TestQuestionsEditor from '../../components/shared/TestQuestionsEditor';

const INPUT = 'w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/40';
const BTN = 'rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50';

interface Faq { question: string; answer: string }
type TestSettings = { passing_percentage: number; duration_minutes: number; shuffle_questions: boolean; shuffle_options: boolean; must_pass: boolean };
const DEFAULT_SETTINGS: TestSettings = { passing_percentage: 70, duration_minutes: 15, shuffle_questions: true, shuffle_options: true, must_pass: false };

export default function LessonExtras({ lesson, guard, refresh }: {
  lesson: SimpleLesson;
  guard: (fn: () => Promise<void>, ok?: string) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const user = getCurrentUser();
  const [faqOn, setFaqOn] = useState((lesson.faq_items ?? []).length > 0);
  const [faq, setFaq] = useState<Faq[]>(lesson.faq_items ?? []);
  const [testOn, setTestOn] = useState(!!lesson.assessment_id);
  const [required, setRequired] = useState(lesson.test_required !== false);
  const [assessmentId, setAssessmentId] = useState<string | null>(lesson.assessment_id);
  const [settings, setSettings] = useState<TestSettings>(DEFAULT_SETTINGS);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<Record<string, { option_text: string; is_correct: boolean }[]>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function say(m: string) { setNote(m); setTimeout(() => setNote(''), 3500); }

  // load the lesson's own test (settings + questions)
  const loadTest = useCallback(async (id: string) => {
    const { data } = await supabase.from('assessments').select('passing_percentage, duration_minutes, shuffle_questions, shuffle_options, must_pass').eq('id', id).maybeSingle();
    if (data) {
      setSettings({
        passing_percentage: data.passing_percentage ?? 70, duration_minutes: data.duration_minutes ?? 15,
        shuffle_questions: !!data.shuffle_questions, shuffle_options: !!data.shuffle_options, must_pass: !!data.must_pass,
      });
    }
    const loaded = await loadQuestionsWithOptions(id);
    setQuestions(loaded.questions);
    setOptions(loaded.optionsByQuestion);
  }, []);

  useEffect(() => {
    setFaqOn((lesson.faq_items ?? []).length > 0);
    setFaq(lesson.faq_items ?? []);
    setTestOn(!!lesson.assessment_id);
    setAssessmentId(lesson.assessment_id);
    setRequired(lesson.test_required !== false);
    if (lesson.assessment_id) void loadTest(lesson.assessment_id).catch((e) => say(e instanceof Error ? e.message : 'Could not load the test.'));
  }, [lesson.id, lesson.assessment_id, loadTest]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveFaq() {
    setBusy(true);
    await guard(async () => {
      const clean = faq.map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })).filter((f) => f.question);
      await repo.updateLesson(lesson.id, { faq_items: clean });
      setFaq(clean);
      await refresh();
    }, 'FAQ saved');
    setBusy(false);
  }

  async function removeFaq() {
    if (faq.length > 0 && !confirm('Remove the FAQ from this lesson? Its questions are deleted.')) return;
    setBusy(true);
    await guard(async () => { await repo.updateLesson(lesson.id, { faq_items: [] }); setFaq([]); setFaqOn(false); await refresh(); }, 'FAQ removed');
    setBusy(false);
  }

  async function saveTest() {
    if (!user?.companyId) return;
    setBusy(true);
    await guard(async () => {
      const title = `${lesson.lesson_title} — test`;
      const payload = { assessment_title: title, description: title, ...settings };
      let id = assessmentId;
      if (id) await saveAssessment(id, payload);
      else {
        const created = await createAssessment({
          ...defaultAssessmentForm, lesson_id: lesson.id, company_id: user.companyId,
          assessment_code: `lesson-test-${Date.now().toString(36)}`, assessment_type: 'quiz', auto_submit: true, ...payload,
        });
        id = created.id;
        setAssessmentId(id);
      }
      await repo.updateLesson(lesson.id, { test_required: required });
      await loadTest(id);
      await refresh();
    }, assessmentId ? 'Test settings saved' : 'Test created — now add its questions below');
    setBusy(false);
  }

  async function removeTest() {
    if (assessmentId && !confirm('Remove the test from this lesson? Its questions are deleted.')) return;
    setBusy(true);
    await guard(async () => {
      if (assessmentId) await removeAssessment(assessmentId);
      setAssessmentId(null); setTestOn(false); setQuestions([]); setOptions({});
      await refresh();
    }, 'Test removed');
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-xs font-bold text-amber-900">Add to this lesson</p>
      <p className="mb-3 mt-0.5 text-xs text-amber-800">A FAQ or test added here stays part of THIS lesson: the employee reads, then starts the test on the same lesson. No separate test lesson needed.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => (faqOn ? void removeFaq() : setFaqOn(true))} className={`${BTN} border py-1.5 text-xs ${faqOn ? 'border-violet-300 bg-violet-100 text-violet-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
          {faqOn ? '− Remove FAQ' : '+ Add FAQ'}
        </button>
        <button type="button" disabled={busy} onClick={() => (testOn ? void removeTest() : setTestOn(true))} className={`${BTN} border py-1.5 text-xs ${testOn ? 'border-amber-300 bg-amber-100 text-amber-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
          {testOn ? '− Remove test' : '+ Add test'}
        </button>
      </div>

      {faqOn && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold text-slate-600">FAQ questions ({faq.length})</p>
          <FaqItemsEditor items={faq} onChange={setFaq} footer={<button type="button" onClick={() => void saveFaq()} disabled={busy} className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-500`}>{busy ? 'Saving…' : 'Save FAQ'}</button>} />
        </div>
      )}

      {testOn && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="mb-3 text-xs font-semibold text-slate-500">Test on this lesson — the employee starts it right after reading, on the same lesson</p>
            <label className="mb-3 flex items-start gap-2 text-xs text-slate-700">
              <input type="checkbox" className="mt-0.5" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              <span><b>The employee must pass this test</b> to finish this lesson. Off = the test is there but optional.</span>
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="text-xs text-slate-500">Pass %
                <input type="number" min={1} max={100} value={settings.passing_percentage} onChange={(e) => setSettings((s) => ({ ...s, passing_percentage: Number(e.target.value) }))} className={`${INPUT} mt-1`} />
              </label>
              <label className="text-xs text-slate-500">Timer (minutes)
                <input type="number" min={1} max={600} value={settings.duration_minutes} onChange={(e) => setSettings((s) => ({ ...s, duration_minutes: Number(e.target.value) }))} className={`${INPUT} mt-1`} />
              </label>
              <label className="mt-5 flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={settings.shuffle_questions} onChange={(e) => setSettings((s) => ({ ...s, shuffle_questions: e.target.checked }))} /> Shuffle questions
              </label>
              <label className="mt-5 flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={settings.shuffle_options} onChange={(e) => setSettings((s) => ({ ...s, shuffle_options: e.target.checked }))} /> Shuffle options
              </label>
            </div>
            <label className="mt-3 flex items-start gap-2 text-xs text-slate-700">
              <input type="checkbox" className="mt-0.5" checked={settings.must_pass} onChange={(e) => setSettings((s) => ({ ...s, must_pass: e.target.checked }))} />
              <span><b>Show in Reports → Pending tests</b> until they pass. Off = optional there.</span>
            </label>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => void saveTest()} disabled={busy} className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-500`}>
                {busy ? 'Saving…' : assessmentId ? 'Save test settings' : 'Create test'}
              </button>
            </div>
          </div>

          {assessmentId ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500">Questions ({questions.length})</p>
              <TestQuestionsEditor
                assessmentId={assessmentId}
                questions={questions}
                optionsByQuestion={options}
                onSaved={() => loadTest(assessmentId)}
                showToast={say}
                aiSourceText={`${lesson.lesson_title}\n${htmlToText(lesson.content ?? '')}`}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-400">Press “Create test” once to unlock adding questions.</p>
          )}
        </div>
      )}
      {note && <p className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white">{note}</p>}
    </div>
  );
}
