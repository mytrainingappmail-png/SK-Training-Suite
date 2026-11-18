// "Copy to Course" (from an Induction Day) and "Copy to Induction" (from a Course Module) - one window for both.
// The copy remembers its original so it can be updated from either side later; deleting one never deletes the other.
// Cards / lessons that have no place on the other side are not copied, and the window lists exactly which ones.

import { useEffect, useState } from 'react';
import { loadCourses } from '../../services/course/courseService';
import { copyDayToCourseModule, copyModuleToInductionDay, skippedLabel } from '../../services/induction/inductionCourseCopyService';
import type { CopyResult } from '../../services/induction/inductionCourseCopyService';

interface CourseOption { id: string; course_code: string; course_name: string }

export default function CopyDayModuleModal({ mode, sourceId, sourceName, dark = false, onClose, onCopied }: {
  /** 'day-to-course': an Induction Day becomes a Module of a Course. 'module-to-day': a Module becomes an Induction Day. */
  mode: 'day-to-course' | 'module-to-day';
  sourceId: string;
  sourceName: string;
  dark?: boolean;
  onClose: () => void;
  /** Called after a successful copy (so the list behind can refresh). */
  onCopied?: () => void;
}) {
  const toCourse = mode === 'day-to-course';
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CopyResult | null>(null);

  useEffect(() => {
    if (!toCourse) return;
    loadCourses()
      .then((cs) => setCourses((cs as unknown as CourseOption[]).map((c) => ({ id: c.id, course_code: c.course_code, course_name: c.course_name }))))
      .catch(() => setError('The courses could not be loaded.'));
  }, [toCourse]);

  // closing after a successful copy refreshes the list behind (done here so the result stays on screen until then)
  function close() {
    if (result) onCopied?.();
    onClose();
  }

  async function run() {
    setError('');
    if (toCourse && !courseId) { setError('Choose the course first.'); return; }
    setBusy(true);
    try {
      const r = toCourse ? await copyDayToCourseModule(sourceId, courseId) : await copyModuleToInductionDay(sourceId);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The copy could not be made.');
    } finally {
      setBusy(false);
    }
  }

  const card = dark ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900';
  const sub = dark ? 'text-slate-400' : 'text-slate-600';
  const field = dark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-900';
  const cancel = dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50';
  const courseName = courses.find((c) => c.id === courseId)?.course_name ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={!busy ? close : undefined} />
      <div className={`relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-2xl ${card}`}>
        {result ? (
          <>
            <h3 className="mb-1 text-lg font-bold">✓ Copied</h3>
            <p className={`mb-3 text-sm ${sub}`}>
              {toCourse
                ? <>“{sourceName}” is now a Module{courseName ? <> of the course <b>{courseName}</b></> : null}, with {result.copied} item{result.copied === 1 ? '' : 's'}.</>
                : <>“{sourceName}” is now an Induction Day, with {result.copied} card{result.copied === 1 ? '' : 's'}.</>}
              {' '}It remembers its original, so you can update it later from either side.
            </p>
            {result.skipped.length > 0 && (
              <div className={`mb-3 rounded-xl border p-3 text-xs ${dark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                <p className="mb-1 font-semibold">Not copied (there is no place for it on the other side):</p>
                <ul className="list-disc pl-4">
                  {result.skipped.map((s, i) => <li key={i}>{skippedLabel(s)}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={close} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Done</button>
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-1 text-lg font-bold">{toCourse ? '📚 Copy to a Course' : '📋 Copy to Induction'}</h3>
            <p className={`mb-4 text-sm ${sub}`}>
              {toCourse
                ? <>Make <b>{sourceName}</b> a Module of a Course: page cards become text lessons and test cards become quiz lessons (with their questions).</>
                : <>Make <b>{sourceName}</b> an Induction Day: text lessons become page cards and quiz lessons become test cards (with their questions).</>}
              {' '}Your original stays as it is, and deleting one later never deletes the other.
            </p>
            {toCourse && (
              <>
                <label className={`mb-1 block text-xs font-semibold ${sub}`}>Which course?</label>
                <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setError(''); }} disabled={busy} className={`mb-3 w-full rounded-lg border px-3 py-2 text-sm ${field}`}>
                  <option value="">Choose a course…</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.course_code ? `${c.course_code} · ` : ''}{c.course_name}</option>)}
                </select>
              </>
            )}
            {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={onClose} disabled={busy} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${cancel}`}>Cancel</button>
              <button onClick={() => void run()} disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? 'Copying…' : 'Make the copy'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
