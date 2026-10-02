// "Preview" of a course the way an employee meets it: chapters and lessons in order, each lesson
// shown as the employee sees it (video player, reading page with the owner's watermark / copy
// protection, downloadable file, the final test). For the owner/admin. Nothing is saved or recorded.

import { useEffect, useMemo, useState } from 'react';
import PreviewModal from '../../components/shared/PreviewModal';
import ContentWatermark, { noCopyProps } from '../../components/shared/ContentWatermark';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import * as repo from '../../repositories/simpleCourse/simpleCourseRepository';
import { getFinalTest } from '../../repositories/simpleCourse/finalTestRepository';
import type { SimpleLesson, SimpleModule } from '../../repositories/simpleCourse/simpleCourseRepository';
import type { FinalTest } from '../../repositories/simpleCourse/finalTestRepository';

type CourseInfo = Awaited<ReturnType<typeof repo.getCourse>>;

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const ICON: Record<string, string> = { video: '🎬', text: '📄', document: '📎' };

export default function CoursePreview({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [outline, setOutline] = useState<SimpleModule[]>([]);
  const [test, setTest] = useState<FinalTest | null>(null);
  const [selected, setSelected] = useState<string | 'test' | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([repo.getCourse(courseId), repo.getOutline(courseId), getFinalTest(courseId).catch(() => null)])
      .then(([c, o, t]) => {
        setCourse(c);
        setOutline(o);
        setTest(t);
        setSelected(o.flatMap((m) => m.lessons)[0]?.id ?? (t ? 'test' : null));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this course.'));
  }, [courseId]);

  const lesson: SimpleLesson | null = useMemo(
    () => outline.flatMap((m) => m.lessons).find((l) => l.id === selected) ?? null,
    [outline, selected],
  );

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  }

  const embed = lesson?.lesson_type === 'video' && lesson.video_url ? youtubeId(lesson.video_url) : null;
  const file = lesson?.resources[0];

  return (
    <PreviewModal title={course?.course_name ?? 'Course'} onClose={onClose}>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!course && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {course && (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* chapters and lessons */}
          <aside className="space-y-3 lg:sticky lg:top-0 lg:h-fit">
            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <h2 className="text-lg font-bold">{course.course_name}</h2>
              {course.short_description && <p className="mt-1 text-xs text-white/70">{course.short_description}</p>}
              {!course.active && <p className="mt-2 inline-block rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Draft — employees cannot see it yet</p>}
            </div>
            {outline.map((m, mi) => (
              <div key={m.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{/^Chapter \d+$/i.test(m.module_name.trim()) ? m.module_name : `Chapter ${mi + 1} · ${m.module_name}`}</p>
                {m.lessons.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">No lessons yet.</p>}
                {m.lessons.map((l) => (
                  <button
                    key={l.id} type="button" onClick={() => setSelected(l.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${selected === l.id ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    <span>{ICON[l.lesson_type] ?? '📄'}</span><span className="min-w-0 flex-1 truncate">{l.lesson_title}</span>
                  </button>
                ))}
              </div>
            ))}
            {test && (
              <button
                type="button" onClick={() => setSelected('test')}
                className={`flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm shadow-sm ring-1 ${selected === 'test' ? 'bg-amber-50 font-semibold text-amber-800 ring-amber-300' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}
              >
                <span>📝</span><span className="min-w-0 flex-1 truncate">Final test</span>
              </button>
            )}
          </aside>

          {/* the selected lesson */}
          <section className="min-h-[320px] rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {selected === 'test' && test && (
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-slate-900">{test.title}</h3>
                <p className="text-sm text-slate-600">{test.questions.length} question{test.questions.length === 1 ? '' : 's'} · pass mark {test.passPct}%{test.certificate ? ' · certificate for those who pass' : ''}</p>
                <button type="button" onClick={() => showToast('Preview: the employee takes the test here. Nothing is recorded.')} className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-yellow-400">Launch Quiz</button>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
                  {test.questions.map((q, i) => (
                    <li key={q.id ?? i}>
                      <p className="font-medium">{q.text}</p>
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {q.options.map((o, oi) => (<li key={o.id ?? oi} className={o.correct ? 'font-semibold text-emerald-700' : 'text-slate-500'}>{o.correct ? '✓ ' : '○ '}{o.text}</li>))}
                      </ul>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-slate-400">(The ✓ marks the correct answer — only you see this in the preview.)</p>
              </div>
            )}

            {lesson && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{lesson.lesson_title}</h3>
                  <p className="text-xs text-slate-500">{lesson.lesson_type === 'video' ? 'Video' : lesson.lesson_type === 'text' ? 'Reading' : 'File'} · {lesson.duration_minutes ?? 5} min</p>
                </div>

                {lesson.lesson_type === 'video' && (
                  lesson.video_url ? (
                    <div className="overflow-hidden rounded-2xl bg-black">
                      {embed ? (
                        <iframe title={lesson.lesson_title} className="aspect-video w-full" src={`https://www.youtube.com/embed/${embed}`} allowFullScreen />
                      ) : (
                        <video key={lesson.id} className="max-h-[420px] w-full" controls src={lesson.video_url} />
                      )}
                    </div>
                  ) : <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">No video added yet.</p>
                )}

                {lesson.lesson_type === 'text' && (
                  (lesson.content ?? '').trim() ? (
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <ContentWatermark config={{ enabled: !!course.watermark_enabled, text: course.watermark_text ?? '', orientation: course.watermark_orientation ?? 'diagonal', opacity: course.watermark_opacity ?? 8 }} />
                      <div className="prose prose-slate relative max-w-none p-6 text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.content ?? '') }} {...noCopyProps(!!course.no_copy)} />
                    </div>
                  ) : <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">This reading page is empty.</p>
                )}

                {lesson.lesson_type === 'document' && (
                  file ? (
                    <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-yellow-400">
                      ⬇ {file.resource_title || 'Download file'}
                    </a>
                  ) : <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">No file added yet.</p>
                )}
              </div>
            )}

            {!lesson && selected !== 'test' && <p className="text-sm text-slate-400">This course has no lessons yet.</p>}
          </section>
        </div>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </PreviewModal>
  );
}
