// src/modules/induction/InductionManagement.tsx
//
// Admin management for the Induction module — deliberately modeled on
// RealEstateProjectManagement.tsx (flat Days instead of Projects, Page/Test
// sections, drag-and-drop reorder). Test sections link to an EXISTING
// Assessment (picked from a dropdown) rather than embedding a duplicate
// question-builder — Assessments are already managed centrally elsewhere
// in Admin, so Induction just reuses that.

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  loadDays, saveDay, editDay, removeDay, reorderDays,
  loadSectionsForDay, saveSection, editSection, removeSection,
  loadAssignments, assignEmployee, markAssignmentComplete, reactivateAssignment, removeAssignment,
} from '../../services/induction/inductionService';
import { loadAssessments } from '../../services/assessment/assessmentService';
import { employeeService } from '../../services/employee/employeeService';
import { getCurrentUser } from '../../services/auth/session';
import RichTextEditor from '../../components/shared/RichTextEditor';
import { uploadImage } from '../../services/contentEditor/contentEditorService';
import type { InductionDay, InductionDaySection, InductionSectionType, InductionAssignment } from '../../types/induction';
import type { Assessment } from '../../types/assessment';
import type { Employee } from '../../types/employee';

const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

async function uploadInlineImage(file: File): Promise<string> {
  const { url } = await uploadImage(file);
  return url;
}

function IconGrip({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}
function IconArrowUp({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
    </svg>
  );
}
function IconArrowDown({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function SortableDayRow({
  id,
  children,
}: {
  id: string;
  children: (opts: { dragHandleProps: { attributes: ReturnType<typeof useSortable>['attributes']; listeners: ReturnType<typeof useSortable>['listeners'] }; isDragging: boolean }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { attributes, listeners }, isDragging })}
    </div>
  );
}

function ReorderDaysModal({
  days,
  saving,
  onReorder,
  onClose,
}: {
  days: InductionDay[];
  saving: boolean;
  onReorder: (ordered: InductionDay[]) => void;
  onClose: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ordered = [...days].sort((a, b) => a.display_order - b.display_order);

  function moveDay(dayId: string, direction: 'up' | 'down') {
    const index = ordered.findIndex((d) => d.id === dayId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    onReorder(arrayMove(ordered, index, targetIndex));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = ordered.findIndex((d) => d.id === active.id);
    const toIndex = ordered.findIndex((d) => d.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    onReorder(arrayMove(ordered, fromIndex, toIndex));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10" role="dialog" aria-modal="true" aria-labelledby="reorder-days-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="reorder-days-title" className="text-lg font-semibold text-slate-800">Reorder Days</h2>
            <p className="text-sm text-slate-500">Drag a day, or use the arrows, to change the order employees go through them.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[65vh] space-y-1.5 overflow-y-auto p-6">
          {ordered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No days yet.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={ordered.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                {ordered.map((day, i) => (
                  <SortableDayRow key={day.id} id={day.id}>
                    {({ dragHandleProps, isDragging }) => (
                      <div className={`flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 ${isDragging ? 'z-10 shadow-lg ring-1 ring-yellow-400/50' : ''}`}>
                        <button {...dragHandleProps.attributes} {...dragHandleProps.listeners} aria-label="Drag to reorder" title="Drag to reorder" disabled={saving} className="cursor-grab touch-none text-slate-400 transition hover:text-slate-600 active:cursor-grabbing disabled:opacity-40">
                          <IconGrip />
                        </button>
                        <div className="flex flex-col">
                          <button onClick={() => moveDay(day.id, 'up')} disabled={saving || i === 0} aria-label="Move up" className="text-slate-400 transition hover:text-yellow-600 disabled:opacity-30">
                            <IconArrowUp className="h-3 w-3" />
                          </button>
                          <button onClick={() => moveDay(day.id, 'down')} disabled={saving || i === ordered.length - 1} aria-label="Move down" className="text-slate-400 transition hover:text-yellow-600 disabled:opacity-30">
                            <IconArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">Day {i + 1}: {day.title}</p>
                        </div>
                      </div>
                    )}
                  </SortableDayRow>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Done</button>
        </div>
      </div>
    </div>
  );
}

function InductionManagement() {
  const user = getCurrentUser();
  const [days, setDays] = useState<InductionDay[]>([]);
  const [assignments, setAssignments] = useState<InductionAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; description: string; active: boolean }>({ title: '', description: '', active: true });
  const [savingDay, setSavingDay] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

  const [sections, setSections] = useState<InductionDaySection[]>([]);
  const [sectionDraft, setSectionDraft] = useState<{ section_type: InductionSectionType; title: string; page_content: string; assessment_id: string | null } | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState(false);

  const [pickEmployeeId, setPickEmployeeId] = useState('');
  const [assigning, setAssigning] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    Promise.all([loadDays(), loadAssignments(), employeeService.getAll(), loadAssessments()])
      .then(([d, a, e, asm]) => { setDays(d); setAssignments(a); setEmployees(e); setAssessments(asm); })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, []);

  function fetchSections(dayId: string) {
    loadSectionsForDay(dayId)
      .then(setSections)
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load sections.'));
  }

  async function handleReorderDays(ordered: InductionDay[]) {
    setReordering(true);
    setDays(ordered);
    try {
      await reorderDays(ordered);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to reorder days.');
      fetchAll();
    } finally {
      setReordering(false);
    }
  }

  function startNewDay() {
    setEditingDayId('new');
    setDraft({ title: '', description: '', active: true });
    setSections([]);
  }

  function startEditDay(day: InductionDay) {
    setEditingDayId(day.id);
    setDraft({ title: day.title, description: day.description, active: day.active });
    fetchSections(day.id);
  }

  async function handleSaveDay() {
    if (!user?.companyId) return;
    setSavingDay(true);
    try {
      if (editingDayId === 'new') {
        const created = await saveDay({ company_id: user.companyId, title: draft.title, description: draft.description, display_order: days.length, active: draft.active });
        showToast('Day added.');
        setEditingDayId(created.id);
        fetchSections(created.id);
      } else if (editingDayId) {
        await editDay(editingDayId, { title: draft.title, description: draft.description, active: draft.active });
        showToast('Day saved.');
      }
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save day.');
    } finally {
      setSavingDay(false);
    }
  }

  async function handleDeleteDay(id: string) {
    try {
      await removeDay(id);
      showToast('Day deleted.');
      if (editingDayId === id) setEditingDayId(null);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete day.');
    }
  }

  function startNewSection() {
    setEditingSectionId('new');
    setSectionDraft({ section_type: 'page', title: '', page_content: '', assessment_id: null });
  }

  function startEditSection(s: InductionDaySection) {
    setEditingSectionId(s.id);
    setSectionDraft({ section_type: s.section_type, title: s.title, page_content: s.page_content, assessment_id: s.assessment_id });
  }

  async function handleSaveSection() {
    if (!sectionDraft || !editingDayId || editingDayId === 'new' || !user?.companyId) return;
    setSavingSection(true);
    try {
      if (editingSectionId === 'new') {
        await saveSection({
          company_id: user.companyId, day_id: editingDayId,
          section_type: sectionDraft.section_type, title: sectionDraft.title,
          page_content: sectionDraft.page_content, assessment_id: sectionDraft.assessment_id,
          display_order: sections.length,
        });
      } else if (editingSectionId) {
        await editSection(editingSectionId, {
          section_type: sectionDraft.section_type, title: sectionDraft.title,
          page_content: sectionDraft.page_content, assessment_id: sectionDraft.assessment_id,
        });
      }
      setEditingSectionId(null);
      setSectionDraft(null);
      fetchSections(editingDayId);
      showToast('Section saved.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save section.');
    } finally {
      setSavingSection(false);
    }
  }

  async function handleDeleteSection(id: string) {
    if (!editingDayId || editingDayId === 'new') return;
    try {
      await removeSection(id);
      fetchSections(editingDayId);
      showToast('Section deleted.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete section.');
    }
  }

  const unassignedEmployees = employees.filter((e) => !assignments.some((a) => a.employee_id === e.id && a.status === 'active'));

  async function handleAssign() {
    if (!pickEmployeeId || !user?.companyId) return;
    setAssigning(true);
    try {
      await assignEmployee(user.companyId, pickEmployeeId);
      setPickEmployeeId('');
      showToast('Employee assigned to Induction.');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleMarkComplete(id: string) {
    try {
      await markAssignmentComplete(id);
      showToast('Marked complete — Induction tab will disappear for them.');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update.');
    }
  }

  async function handleReactivate(id: string) {
    try {
      await reactivateAssignment(id);
      showToast('Reactivated.');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update.');
    }
  }

  async function handleRemoveAssignment(id: string) {
    try {
      await removeAssignment(id);
      showToast('Removed.');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove.');
    }
  }

  function employeeName(id: string): string {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}`.trim() : 'Unknown employee';
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;

  if (editingDayId) {
    return (
      <div className="space-y-6">
        <button onClick={() => { setEditingDayId(null); setSectionDraft(null); setEditingSectionId(null); }} className="text-sm font-semibold text-indigo-600 hover:underline">
          ← Back to Days
        </button>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{editingDayId === 'new' ? 'New Day' : 'Edit Day'}</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
              <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="e.g. Company Overview & Culture" className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Description (optional)</label>
              <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={2} className={INPUT_CLS} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
              Active (visible to employees)
            </label>
          </div>

          {editingDayId !== 'new' && (
            <div className="mt-6">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Sections — add a Page (training material) or a Test, in the order employees go through them
              </label>
              <div className="mb-3 space-y-2">
                {sections.length === 0 && <p className="text-xs text-slate-400">No sections yet — add one below.</p>}
                {sections.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.section_type === 'test' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {s.section_type === 'test' ? 'Test' : 'Page'}
                      </span>
                      <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEditSection(s)} className="text-xs font-semibold text-indigo-600 hover:underline">Edit</button>
                      <button onClick={() => handleDeleteSection(s.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                    </div>
                  </div>
                ))}
              </div>

              {sectionDraft ? (
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
                      <input value={sectionDraft.title} onChange={(e) => setSectionDraft((d) => d && { ...d, title: e.target.value })} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Type</label>
                      <select value={sectionDraft.section_type} onChange={(e) => setSectionDraft((d) => d && { ...d, section_type: e.target.value as InductionSectionType })} className={INPUT_CLS}>
                        <option value="page">Page (training material)</option>
                        <option value="test">Test</option>
                      </select>
                    </div>
                  </div>

                  {sectionDraft.section_type === 'page' && (
                    <RichTextEditor
                      value={sectionDraft.page_content}
                      onChange={(html) => setSectionDraft((d) => d && { ...d, page_content: html })}
                      onImageUpload={uploadInlineImage}
                      minHeight={220}
                      resetKey={editingSectionId ?? 'new'}
                    />
                  )}

                  {sectionDraft.section_type === 'test' && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Assessment</label>
                      <select value={sectionDraft.assessment_id ?? ''} onChange={(e) => setSectionDraft((d) => d && { ...d, assessment_id: e.target.value || null })} className={INPUT_CLS}>
                        <option value="">— Select an assessment —</option>
                        {assessments.map((a) => <option key={a.id} value={a.id}>{a.assessment_title}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-400">
                        Assessments (with their questions) are created in Admin → Assessments — pick one here to attach it to this Day's test.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => { setEditingSectionId(null); setSectionDraft(null); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSaveSection} disabled={savingSection} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                      {savingSection ? 'Saving…' : 'Save Section'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={startNewSection} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">+ Add Section</button>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setEditingDayId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveDay} disabled={savingDay} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {savingDay ? 'Saving…' : 'Save Day'}
            </button>
          </div>
        </div>

        {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Induction</h2>
        <p className="mt-1 text-sm text-slate-500">A simple, day-by-day onboarding program for new employees — each Day unlocks the next once its test is passed.</p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-700">Employees in Induction</p>
        <div className="mb-4 flex gap-2">
          <select value={pickEmployeeId} onChange={(e) => setPickEmployeeId(e.target.value)} className={`${INPUT_CLS} flex-1`}>
            <option value="">— Select an employee —</option>
            {unassignedEmployees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
          </select>
          <button onClick={handleAssign} disabled={!pickEmployeeId || assigning} className="flex-shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {assigning ? 'Assigning…' : 'Assign'}
          </button>
        </div>
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-400">No one assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {a.status === 'active' ? 'In Induction' : 'Completed'}
                  </span>
                  <p className="text-sm font-semibold text-slate-800">{employeeName(a.employee_id)}</p>
                </div>
                <div className="flex gap-2">
                  {a.status === 'active' ? (
                    <button onClick={() => handleMarkComplete(a.id)} className="text-xs font-semibold text-emerald-600 hover:underline">Mark Complete</button>
                  ) : (
                    <button onClick={() => handleReactivate(a.id)} className="text-xs font-semibold text-indigo-600 hover:underline">Reactivate</button>
                  )}
                  <button onClick={() => handleRemoveAssignment(a.id)} className="text-xs font-semibold text-red-500 hover:underline">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">All Days</p>
          <div className="flex gap-2">
            <button onClick={() => setReorderOpen(true)} disabled={days.length < 2} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
              Reorder Days
            </button>
            <button onClick={startNewDay} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">+ New Day</button>
          </div>
        </div>
        <div className="space-y-2">
          {days.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No days yet — add one above.</p>
          ) : (
            [...days].sort((a, b) => a.display_order - b.display_order).map((d, i) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Day {i + 1}: {d.title}</p>
                  {!d.active && <span className="text-[11px] font-semibold text-slate-400">Inactive</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEditDay(d)} className="text-xs font-semibold text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => handleDeleteDay(d.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {reorderOpen && (
        <ReorderDaysModal days={days} saving={reordering} onReorder={handleReorderDays} onClose={() => setReorderOpen(false)} />
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  );
}

export default InductionManagement;
