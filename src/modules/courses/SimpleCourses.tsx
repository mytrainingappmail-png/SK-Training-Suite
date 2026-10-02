// src/modules/courses/SimpleCourses.tsx
//
// "My Courses" — making a course in one place:
//   1. New course → type a name (nothing else is asked; code, level, category are filled in).
//   2. Add chapters, and inside them videos, reading pages and files.
//   3. Choose who can see it, press Publish.
// It works on the same data as the older Course screens, so nothing is duplicated or migrated.

import { useCallback, useEffect, useMemo, useState } from 'react';

import SectionHeroBanner from '../../components/learning/SectionHeroBanner';
import RichTextEditor from '../../components/shared/RichTextEditor';
import { useAuthorization } from '../../hooks/useAuthorization';
import { getMyCompanyId } from '../../services/company/currentCompanyContext';
import { loadCompany } from '../../services/company/companyService';
import { loadTemplates } from '../../services/certificateTemplate/certificateTemplateService';
import FinalTestCard from './FinalTestCard';
import CoursePreview from './CoursePreview';
import { protectionPatchFromCompany } from '../../components/shared/ContentWatermark';
import { uploadDocument, uploadImage, uploadVideo } from '../../services/contentEditor/contentEditorService';
import * as repo from '../../repositories/simpleCourse/simpleCourseRepository';
import type { AssignableEmployee, CourseAssignment, CourseProtection, SimpleCourse, SimpleLesson, SimpleLessonType, SimpleModule } from '../../repositories/simpleCourse/simpleCourseRepository';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400';
const BTN = 'rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50';

const TYPE_LABEL: Record<string, string> = { video: 'Video', text: 'Reading', document: 'File' };
const TYPE_ICON: Record<string, string> = { video: '🎬', text: '📄', document: '📎' };

function resourceTypeFor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  if (ext === 'zip') return 'zip';
  return 'other';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SimpleCourses() {
  const { can, PERMISSIONS } = useAuthorization();
  const canCreate = can(PERMISSIONS.CREATE_COURSE);
  const canEdit = can(PERMISSIONS.EDIT_COURSE);
  const canDelete = can(PERMISSIONS.DELETE_COURSE);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [courses, setCourses] = useState<SimpleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const cid = await getMyCompanyId();
      setCompanyId(cid);
      setCourses(cid ? await repo.listCourses(cid) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createNew() {
    if (!companyId) return;
    if (!newName.trim()) { setError('Give the course a name first.'); return; }
    setBusy(true);
    setError('');
    try {
      // A new course starts with the company's own content-protection defaults (same as the older Course screen).
      const company = await loadCompany().catch(() => null);
      const id = await repo.createCourse(companyId, newName, newDesc, company ? protectionPatchFromCompany(company) : {});
      setCreating(false);
      setNewName('');
      setNewDesc('');
      await load();
      setOpenId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the course.');
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? courses.filter((c) => c.course_name.toLowerCase().includes(q)) : courses;
  }, [courses, search]);

  if (openId) {
    return <CourseEditor courseId={openId} companyId={companyId} canEdit={canEdit} canDelete={canDelete} onBack={() => { setOpenId(null); void load(); }} />;
  }

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        eyebrow="Courses"
        title="My Courses"
        subtitle="Create a course, add your videos and reading, publish, then give it to your team."
        statLabel="Courses"
        statValue={courses.length}
      />

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses…" className={`${INPUT} max-w-xs`} />
        {canCreate && !creating && (
          <button type="button" onClick={() => setCreating(true)} className={`${BTN} ml-auto bg-slate-900 text-white hover:bg-slate-700`}>
            + New course
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-bold text-slate-800">What is the course called?</h3>
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Sales Basics" className={`${INPUT} mt-3`}
            onKeyDown={(e) => { if (e.key === 'Enter') void createNew(); }} />
          <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} placeholder="One line about it (optional)" className={`${INPUT} mt-2`} />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void createNew()} disabled={busy} className={`${BTN} bg-slate-900 text-white hover:bg-slate-700`}>
              {busy ? 'Creating…' : 'Create and start adding content'}
            </button>
            <button type="button" onClick={() => { setCreating(false); setError(''); }} className={`${BTN} border border-slate-200 text-slate-700 hover:bg-slate-50`}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-base font-semibold text-slate-800">{courses.length === 0 ? 'No courses yet' : 'No course matches your search'}</p>
          {courses.length === 0 && canCreate && <p className="mt-1 text-sm text-slate-500">Press “+ New course” — you only need a name to begin.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <button key={c.id} type="button" onClick={() => setOpenId(c.id)}
              className="rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400">
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-bold text-slate-900">{c.course_name}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {c.active ? 'Published' : 'Draft'}
                </span>
              </div>
              {c.short_description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.short_description}</p>}
              <p className="mt-3 text-xs text-slate-500">{c.chapters} chapter{c.chapters === 1 ? '' : 's'} · {c.lessons} lesson{c.lessons === 1 ? '' : 's'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CourseEditor({ courseId, companyId, canEdit, canDelete, onBack }: {
  courseId: string; companyId: string | null; canEdit: boolean; canDelete: boolean; onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(false);
  const [outline, setOutline] = useState<SimpleModule[]>([]);
  const [people, setPeople] = useState<AssignableEmployee[]>([]);
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [search, setSearch] = useState('');
  // Brand watermark / copy-block: only the platform owner's own account sees these controls.
  const [isOwner, setIsOwner] = useState(false);
  const [certificateReady, setCertificateReady] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [protection, setProtection] = useState<CourseProtection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 2200); };
  const guard = async (fn: () => Promise<void>, ok?: string) => {
    setError('');
    try { await fn(); if (ok) flash(ok); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
  };

  const refreshOutline = useCallback(async () => { setOutline(await repo.getOutline(courseId)); }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [course, mods, emps, assigned] = await Promise.all([
          repo.getCourse(courseId), repo.getOutline(courseId),
          companyId ? repo.listEmployees(companyId) : Promise.resolve([] as AssignableEmployee[]),
          repo.getAssignments(courseId),
        ]);
        if (cancelled) return;
        setName(course.course_name);
        setDescription(course.short_description ?? '');
        setActive(course.active);
        setProtection({
          watermark_enabled: course.watermark_enabled, watermark_text: course.watermark_text,
          watermark_orientation: course.watermark_orientation, watermark_opacity: course.watermark_opacity, no_copy: course.no_copy,
        });
        loadCompany().then((c) => { if (!cancelled) setIsOwner(c?.is_platform_operator ?? false); }).catch(() => undefined);
        loadTemplates().then((t) => { if (!cancelled) setCertificateReady(t.length > 0); }).catch(() => undefined);
        setOutline(mods);
        setPeople(emps);
        setAssignments(assigned);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open this course.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId, companyId]);

  const lessonCount = outline.reduce((n, m) => n + m.lessons.length, 0);

  async function togglePublish() {
    if (!active && lessonCount === 0) { setError('Add at least one lesson before publishing.'); return; }
    setBusy(true);
    await guard(async () => {
      await repo.updateCourse(courseId, { active: !active });
      setActive(!active);
    }, !active ? 'Published — now give it to the people who should take it.' : 'Unpublished — employees no longer see it.');
    setBusy(false);
  }

  function changeProtection(patch: Partial<CourseProtection>, saveNow = true) {
    if (!protection) return;
    setProtection({ ...protection, ...patch });
    if (saveNow) void guard(() => repo.updateCourse(courseId, patch), 'Saved');
  }

  async function assign(list: AssignableEmployee[]) {
    if (!companyId || list.length === 0) return;
    await guard(async () => {
      const added = await repo.assignEmployees(companyId, courseId, list);
      setAssignments(await repo.getAssignments(courseId));
      flash(added === 0 ? 'They already have this course.' : `Given to ${added} employee${added === 1 ? '' : 's'}.`);
    });
  }

  async function takeAway(employeeId: string) {
    await guard(async () => {
      await repo.unassignEmployee(courseId, employeeId);
      setAssignments(await repo.getAssignments(courseId));
    }, 'Removed');
  }

  async function removeCourse() {
    const enrolled = await repo.enrolledCount(courseId);
    const warn = enrolled > 0
      ? `${enrolled} employee(s) are enrolled in this course. Deleting it ALSO deletes their progress. Delete anyway?`
      : 'Delete this course and everything in it? This cannot be undone.';
    if (!confirm(warn)) return;
    await guard(async () => { await repo.deleteCourse(courseId); onBack(); });
  }

  async function moveChapter(index: number, dir: -1 | 1) {
    const other = outline[index + dir];
    const me = outline[index];
    if (!other) return;
    await guard(async () => {
      await Promise.all([repo.updateModule(me.id, { module_order: index + dir + 1 }), repo.updateModule(other.id, { module_order: index + 1 })]);
      await refreshOutline();
    });
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-600 hover:text-slate-900">← All courses</button>
        <button type="button" onClick={() => setPreviewOpen(true)} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">👁 Preview as employee</button>
      </div>
      {previewOpen && <CoursePreview courseId={courseId} onClose={() => setPreviewOpen(false)} />}

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>}

      {/* Name + publish */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[240px] flex-1 space-y-2">
            <input
              value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)}
              onBlur={() => { if (name.trim()) void guard(() => repo.updateCourse(courseId, { course_name: name.trim() }), 'Saved'); }}
              className={`${INPUT} text-lg font-bold`} placeholder="Course name"
            />
            <textarea
              value={description} disabled={!canEdit} rows={2} onChange={(e) => setDescription(e.target.value)}
              onBlur={() => void guard(() => repo.updateCourse(courseId, { short_description: description.trim() }), 'Saved')}
              className={INPUT} placeholder="A line about this course (optional)"
            />
          </div>
          <div className="text-right">
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {active ? 'Published' : 'Draft — not visible to employees'}
            </span>
            {canEdit && (
              <button type="button" onClick={() => void togglePublish()} disabled={busy}
                className={`${BTN} mt-3 block w-full ${active ? 'border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}>
                {active ? 'Unpublish' : 'Publish'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Protect the content — owner only. Shown on reading pages (never on video); travels with every copy you send to a customer. */}
      {isOwner && protection && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox" className="mt-1" disabled={!canEdit} checked={protection.watermark_enabled}
              onChange={(e) => changeProtection({ watermark_enabled: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-bold text-slate-800">Protect this course with my watermark</span>
              <span className="block text-xs text-slate-500">Your name across every reading page. It stays on the copies customers receive, and they cannot remove it.</span>
            </span>
          </label>
          {protection.watermark_enabled && (
            <div className="mt-4 space-y-3 pl-7">
              <input
                value={protection.watermark_text ?? ''} disabled={!canEdit} className={INPUT} placeholder="Watermark text, e.g. your brand name"
                onChange={(e) => changeProtection({ watermark_text: e.target.value }, false)}
                onBlur={() => changeProtection({ watermark_text: (protection.watermark_text ?? '').trim() })}
              />
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-1">
                  {(['horizontal', 'diagonal', 'vertical'] as const).map((o) => (
                    <button
                      key={o} type="button" disabled={!canEdit} onClick={() => changeProtection({ watermark_orientation: o })}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${protection.watermark_orientation === o ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >{o}</button>
                  ))}
                </div>
                <div className="flex flex-1 items-center gap-2 text-xs text-slate-500">
                  Light
                  <input
                    type="range" min={3} max={40} className="flex-1" disabled={!canEdit} value={protection.watermark_opacity}
                    onChange={(e) => changeProtection({ watermark_opacity: Number(e.target.value) }, false)}
                    onMouseUp={() => changeProtection({ watermark_opacity: protection.watermark_opacity })}
                    onTouchEnd={() => changeProtection({ watermark_opacity: protection.watermark_opacity })}
                    onKeyUp={() => changeProtection({ watermark_opacity: protection.watermark_opacity })}
                  />
                  Dark
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" disabled={!canEdit} checked={protection.no_copy} onChange={(e) => changeProtection({ no_copy: e.target.checked })} />
                Do not allow copying or right-click on reading pages
              </label>
            </div>
          )}
        </div>
      )}

      {/* Who takes it */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Who should take this course?</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {assignments.length === 0
                ? 'Nobody yet — employees see the course only after you give it to them.'
                : `${assignments.length} of ${people.length} employees have this course.`}
            </p>
          </div>
          {canEdit && people.length > 0 && (
            <button type="button" onClick={() => void assign(people)} className={`${BTN} bg-slate-900 text-white hover:bg-slate-700`}>
              Give to everyone
            </button>
          )}
        </div>
        {people.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No employees found. Add employees first.</p>
        ) : (
          <>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${INPUT} mt-3`} placeholder="Or find a person to give it to…" />
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {people
                .filter((p) => `${p.first_name} ${p.last_name ?? ''} ${p.employee_code}`.toLowerCase().includes(search.trim().toLowerCase()))
                .map((p) => {
                  const a = assignments.find((x) => x.employee_id === p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span>{p.first_name} {p.last_name ?? ''} <span className="text-xs text-slate-400">· {p.employee_code}</span></span>
                      {a ? (
                        <span className="flex items-center gap-3 text-xs">
                          <span className="font-semibold text-emerald-700">✓ Has this course</span>
                          {canEdit && a.status === 'PENDING' && (
                            <button type="button" onClick={() => void takeAway(p.id)} className="text-red-600 hover:underline">Remove</button>
                          )}
                        </span>
                      ) : canEdit ? (
                        <button type="button" onClick={() => void assign([p])} className="text-xs font-semibold text-slate-700 hover:underline">Give course</button>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>

      {/* Chapters */}
      <div className="space-y-4">
        {outline.map((m, mi) => (
          <ChapterCard
            key={m.id} module={m} index={mi} total={outline.length} canEdit={canEdit}
            onMove={(dir) => void moveChapter(mi, dir)}
            onRename={(n) => guard(() => repo.updateModule(m.id, { module_name: n.trim() || m.module_name }), 'Saved')}
            onDelete={async () => {
              if (!confirm(`Delete the chapter “${m.module_name}” and its ${m.lessons.length} lesson(s)?`)) return;
              await guard(async () => { await repo.deleteModule(m.id); await refreshOutline(); });
            }}
            guard={guard} refresh={refreshOutline}
          />
        ))}
        {canEdit && (
          <button type="button" onClick={() => void guard(async () => { await repo.addModule(courseId, `Chapter ${outline.length + 1}`, outline.length + 1); await refreshOutline(); })}
            className={`${BTN} w-full border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50`}>
            + Add chapter
          </button>
        )}
      </div>

      <FinalTestCard courseId={courseId} courseName={name} companyId={companyId} canEdit={canEdit} hasChapter={outline.length > 0} certificateReady={certificateReady} />

      {canDelete && (
        <div className="pt-4 text-right">
          <button type="button" onClick={() => void removeCourse()} className="text-xs font-semibold text-red-600 hover:underline">Delete this course</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ChapterCard({ module: m, index, total, canEdit, onMove, onRename, onDelete, guard, refresh }: {
  module: SimpleModule; index: number; total: number; canEdit: boolean;
  onMove: (dir: -1 | 1) => void; onRename: (name: string) => Promise<void>; onDelete: () => Promise<void>;
  guard: (fn: () => Promise<void>, ok?: string) => Promise<void>; refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState(m.module_name);
  const [openLesson, setOpenLesson] = useState<string | null>(null);

  useEffect(() => { setTitle(m.module_name); }, [m.module_name]);

  async function add(type: SimpleLessonType) {
    await guard(async () => {
      const id = await repo.addLesson(m.id, type, '', m.lessons.length + 1);
      await refresh();
      setOpenLesson(id);
    });
  }

  async function moveLesson(i: number, dir: -1 | 1) {
    const me = m.lessons[i];
    const other = m.lessons[i + dir];
    if (!other) return;
    await guard(async () => {
      await Promise.all([repo.updateLesson(me.id, { display_order: i + dir + 1 }), repo.updateLesson(other.id, { display_order: i + 1 })]);
      await refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Chapter {index + 1}</span>
        <input value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} onBlur={() => { if (title !== m.module_name) void onRename(title); }}
          className="min-w-[180px] flex-1 rounded-lg border border-transparent px-2 py-1 text-base font-semibold text-slate-900 hover:border-slate-200 focus:border-slate-300 focus:outline-none" />
        {canEdit && (
          <div className="flex items-center gap-1 text-slate-500">
            <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" title="Move up">↑</button>
            <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" title="Move down">↓</button>
            <button type="button" onClick={() => void onDelete()} className="rounded px-2 py-1 text-red-500 hover:bg-red-50" title="Delete chapter">🗑</button>
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {m.lessons.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">No lessons yet — add a video, a reading page or a file below.</p>}
        {m.lessons.map((l, li) => (
          <LessonRow
            key={l.id} lesson={l} index={li} total={m.lessons.length} canEdit={canEdit}
            open={openLesson === l.id} onToggle={() => setOpenLesson(openLesson === l.id ? null : l.id)}
            onMove={(dir) => void moveLesson(li, dir)} guard={guard} refresh={refresh}
          />
        ))}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          <span className="text-xs font-semibold text-slate-500">Add:</span>
          <button type="button" onClick={() => void add('video')} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">🎬 Video</button>
          <button type="button" onClick={() => void add('text')} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">📄 Reading page</button>
          <button type="button" onClick={() => void add('document')} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">📎 File (PDF, slides…)</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function LessonRow({ lesson, index, total, canEdit, open, onToggle, onMove, guard, refresh }: {
  lesson: SimpleLesson; index: number; total: number; canEdit: boolean; open: boolean;
  onToggle: () => void; onMove: (dir: -1 | 1) => void;
  guard: (fn: () => Promise<void>, ok?: string) => Promise<void>; refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState(lesson.lesson_title);
  const [content, setContent] = useState(lesson.content ?? '');
  const [link, setLink] = useState(lesson.video_url ?? '');
  const [minutes, setMinutes] = useState(String(lesson.duration_minutes ?? 5));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(lesson.lesson_title); setContent(lesson.content ?? ''); setLink(lesson.video_url ?? ''); setMinutes(String(lesson.duration_minutes ?? 5));
  }, [lesson.id, lesson.lesson_title, lesson.content, lesson.video_url, lesson.duration_minutes]);

  const file = lesson.resources[0];

  async function save() {
    setSaving(true);
    await guard(async () => {
      const patch: Record<string, unknown> = { lesson_title: title.trim() || 'Untitled lesson', duration_minutes: Math.max(1, Number(minutes) || 5) };
      if (lesson.lesson_type === 'text') patch.content = content;
      if (lesson.lesson_type === 'video') patch.video_url = link.trim();
      await repo.updateLesson(lesson.id, patch);
      await refresh();
    }, 'Saved');
    setSaving(false);
  }

  // A lesson still called "New lesson" (or empty) is named after its file; a title the person typed is kept.
  const titleFor = (f: File) => {
    const typed = title.trim();
    return typed && typed !== 'New lesson' ? typed : f.name.replace(/\.[^.]+$/, '');
  };

  async function uploadVideoFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    await guard(async () => {
      const r = await uploadVideo(f);
      setLink(r.url);
      await repo.updateLesson(lesson.id, { video_url: r.url, lesson_title: titleFor(f) });
      await refresh();
    }, 'Video uploaded');
    setUploading(false);
  }

  async function uploadFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    await guard(async () => {
      const r = await uploadDocument(f);
      await repo.setLessonFile(lesson.id, r.url, r.fileName || f.name, resourceTypeFor(f.name));
      await repo.updateLesson(lesson.id, { lesson_title: titleFor(f) });
      await refresh();
    }, 'File uploaded');
    setUploading(false);
  }

  async function remove() {
    if (!confirm(`Delete the lesson “${lesson.lesson_title}”?`)) return;
    await guard(async () => { await repo.deleteLesson(lesson.id); await refresh(); });
  }

  const incomplete =
    (lesson.lesson_type === 'video' && !lesson.video_url) ||
    (lesson.lesson_type === 'document' && !file) ||
    (lesson.lesson_type === 'text' && !(lesson.content ?? '').trim());

  return (
    <div>
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="text-lg">{TYPE_ICON[lesson.lesson_type] ?? '📄'}</span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-slate-800">{lesson.lesson_title}</span>
          <span className="text-xs text-slate-500">
            {TYPE_LABEL[lesson.lesson_type] ?? lesson.lesson_type}
            {incomplete && <span className="ml-2 font-semibold text-amber-600">· needs content</span>}
          </span>
        </button>
        {canEdit && (
          <div className="flex items-center gap-1 text-slate-500">
            <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" title="Move up">↑</button>
            <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" title="Move down">↓</button>
            <button type="button" onClick={onToggle} className="rounded px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">{open ? 'Close' : 'Edit'}</button>
            <button type="button" onClick={() => void remove()} className="rounded px-2 py-1 text-red-500 hover:bg-red-50" title="Delete lesson">🗑</button>
          </div>
        )}
      </div>

      {open && canEdit && (
        <div className="space-y-3 bg-slate-50 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="text-xs font-semibold text-slate-500">Lesson title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${INPUT} mt-1`} placeholder="e.g. Welcome" />
            </label>
            <label className="text-xs font-semibold text-slate-500">Minutes
              <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${INPUT} mt-1`} />
            </label>
          </div>

          {lesson.lesson_type === 'video' && (
            <div className="space-y-2">
              {link && (
                <p className="truncate text-xs text-emerald-700">✓ Video added: {link}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className={`${BTN} cursor-pointer bg-slate-900 text-white hover:bg-slate-700 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                  {uploading ? 'Uploading…' : link ? 'Replace video' : 'Upload video'}
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => { void uploadVideoFile(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <span className="text-xs text-slate-500">or paste a YouTube / video link:</span>
              </div>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className={INPUT} />
            </div>
          )}

          {lesson.lesson_type === 'text' && (
            <RichTextEditor
              value={content}
              onChange={setContent}
              onImageUpload={async (f: File) => (await uploadImage(f)).url}
              resetKey={lesson.id}
              minHeight={220}
            />
          )}

          {lesson.lesson_type === 'document' && (
            <div className="space-y-2">
              {file ? (
                <p className="text-sm text-slate-700">📎 <a href={file.file_url} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:underline">{file.resource_title}</a></p>
              ) : (
                <p className="text-sm text-slate-500">No file yet.</p>
              )}
              <label className={`${BTN} inline-block cursor-pointer bg-slate-900 text-white hover:bg-slate-700 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                {uploading ? 'Uploading…' : file ? 'Replace file' : 'Upload file'}
                <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" className="hidden" onChange={(e) => { void uploadFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <p className="text-xs text-slate-400">PDF, Word, PowerPoint, Excel or ZIP.</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onToggle} className={`${BTN} border border-slate-200 text-slate-700 hover:bg-white`}>Close</button>
            <button type="button" onClick={() => void save()} disabled={saving || uploading} className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-500`}>
              {saving ? 'Saving…' : 'Save lesson'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
