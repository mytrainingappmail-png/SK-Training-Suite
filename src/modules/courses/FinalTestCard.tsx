// "Final test" card of the simple My Courses screen: an optional multiple-choice test at the very
// end of a course, with an optional certificate for everyone who passes.

import { useEffect, useState } from 'react';

import * as testRepo from '../../repositories/simpleCourse/finalTestRepository';
import type { FinalTest, TestQuestion } from '../../repositories/simpleCourse/finalTestRepository';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400';
const BTN = 'rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50';
const SLOTS = 4;

function blankQuestion(): TestQuestion {
  return { text: '', options: Array.from({ length: SLOTS }, () => ({ text: '', correct: false })) };
}

function padded(q: TestQuestion): TestQuestion {
  const options = [...q.options];
  while (options.length < SLOTS) options.push({ text: '', correct: false });
  return { ...q, options };
}

export default function FinalTestCard({ courseId, courseName, companyId, canEdit, hasChapter, certificateReady }: {
  courseId: string; courseName: string; companyId: string | null; canEdit: boolean; hasChapter: boolean;
  /** False when the company has no certificate design yet — we then say so instead of promising a certificate. */
  certificateReady: boolean;
}) {
  const [test, setTest] = useState<FinalTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('Final test');
  const [passPct, setPassPct] = useState('60');
  const [certificate, setCertificate] = useState(true);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    testRepo.getFinalTest(courseId)
      .then((t) => { if (!cancelled) setTest(t); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the test.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  function startEditing(t: FinalTest | null) {
    setError('');
    setTitle(t?.title ?? (courseName.trim() || 'Final test'));
    setPassPct(String(t?.passPct ?? 60));
    setCertificate(t ? t.certificate : true);
    setQuestions(t && t.questions.length > 0 ? t.questions.map(padded) : [blankQuestion()]);
    setEditing(true);
  }

  function updateQuestion(i: number, patch: Partial<TestQuestion>) {
    setQuestions((qs) => qs.map((q, qi) => (qi === i ? { ...q, ...patch } : q)));
  }

  function updateOption(qi: number, oi: number, patch: { text?: string; correct?: boolean }) {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== qi) return q;
      return {
        ...q,
        options: q.options.map((o, j) => {
          if (patch.correct) return j === oi ? { ...o, correct: true } : { ...o, correct: false };
          return j === oi ? { ...o, ...patch } : o;
        }),
      };
    }));
  }

  async function save() {
    if (!companyId) return;
    setBusy(true);
    setError('');
    try {
      const saved = await testRepo.saveFinalTest(companyId, courseId, { title, passPct: Number(passPct), certificate, questions }, test);
      setTest(saved);
      setEditing(false);
      setNotice('Test saved.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the test.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!test) return;
    const warn = test.attempts > 0
      ? `Employees have already started this test (${test.attempts} time${test.attempts === 1 ? '' : 's'}). Removing it also removes their results. Remove anyway?`
      : 'Remove the final test from this course?';
    if (!confirm(warn)) return;
    setBusy(true);
    setError('');
    try {
      await testRepo.deleteFinalTest(test);
      setTest(null);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the test.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Final test <span className="font-normal text-slate-400">(optional)</span></h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {test
              ? `${test.questions.length} question${test.questions.length === 1 ? '' : 's'} · pass mark ${test.passPct}% · ${test.certificate ? 'certificate for those who pass' : 'no certificate'}`
              : 'End the course with a short test. Employees who pass can get a certificate automatically.'}
          </p>
        </div>
        {!editing && canEdit && (
          test ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => startEditing(test)} className={`${BTN} border border-slate-300 text-slate-700 hover:bg-slate-50`}>Edit test</button>
              <button type="button" disabled={busy} onClick={() => void remove()} className={`${BTN} text-red-600 hover:bg-red-50`}>Remove</button>
            </div>
          ) : (
            <button type="button" disabled={!hasChapter} onClick={() => startEditing(null)} className={`${BTN} bg-slate-900 text-white hover:bg-slate-700`}>+ Add a final test</button>
          )
        )}
      </div>

      {notice && <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {editing && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="block text-xs font-semibold text-slate-600">
              Test name <span className="font-normal text-slate-400">(printed on the certificate)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${INPUT} mt-1`} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Pass mark (%)
              <input type="number" min={1} max={100} value={passPct} onChange={(e) => setPassPct(e.target.value)} className={`${INPUT} mt-1`} />
            </label>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={certificate} onChange={(e) => setCertificate(e.target.checked)} />
            <span>
              Give a certificate to everyone who passes
              {!certificateReady && <span className="block text-xs text-amber-600">Your company has no certificate design yet — ask your administrator to add one under Certificates.</span>}
            </span>
          </label>

          <div className="space-y-4">
            {questions.map((q, qi) => (
              <div key={q.id ?? qi} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-xs font-bold text-slate-400">Q{qi + 1}</span>
                  <textarea
                    value={q.text} rows={2} onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                    className={INPUT} placeholder="Type the question"
                  />
                  {questions.length > 1 && (
                    <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))} className="mt-1 rounded px-2 py-1 text-red-500 hover:bg-red-50" title="Remove question">🗑</button>
                  )}
                </div>
                <div className="mt-3 space-y-2 pl-6">
                  {q.options.map((o, oi) => (
                    <label key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${qi}`} checked={o.correct} onChange={() => updateOption(qi, oi, { correct: true })} title="Mark as the correct answer" />
                      <input
                        value={o.text} onChange={(e) => updateOption(qi, oi, { text: e.target.value })}
                        className={INPUT} placeholder={`Answer ${oi + 1}${oi < 2 ? '' : ' (optional)'}`}
                      />
                    </label>
                  ))}
                  <p className="text-xs text-slate-400">Tick the circle next to the correct answer.</p>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}
              className={`${BTN} w-full border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50`}>
              + Add question
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy} onClick={() => void save()} className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-500`}>
              {busy ? 'Saving…' : 'Save test'}
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)} className={`${BTN} text-slate-600 hover:bg-slate-100`}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
