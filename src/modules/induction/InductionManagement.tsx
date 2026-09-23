// src/modules/induction/InductionManagement.tsx
//
// Admin management for the Induction module — deliberately modeled on
// RealEstateProjectManagement.tsx (flat Days instead of Projects, Page/Test
// sections, drag-and-drop reorder). Test sections link to an EXISTING
// Assessment (picked from a dropdown) rather than embedding a duplicate
// question-builder — Assessments are already managed centrally elsewhere
// in Admin, so Induction just reuses that.

import { useEffect, useRef, useState } from 'react';
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
  loadSectionsForDay, saveSection, editSection, removeSection, reorderSections,
  loadAssignments, assignEmployee, markAssignmentComplete, reactivateAssignment, removeAssignment,
  cloneDayToBranch,
} from '../../services/induction/inductionService';
import { loadAssessments } from '../../services/assessment/assessmentService';
import { employeeService } from '../../services/employee/employeeService';
import { branchService } from '../../services/branch/branchService';
import { getCurrentUser } from '../../services/auth/session';
import { loadCompany } from '../../services/company/companyService';
import RichTextEditor from '../../components/shared/RichTextEditor';
import ImageEditModal from '../../components/shared/ImageEditModal';
import type { WatermarkConfig } from '../../components/shared/ContentWatermark';
import { uploadImage } from '../../services/contentEditor/contentEditorService';
import type { InductionDay, InductionDaySection, InductionSectionType, InductionAssignment, InductionFaqItem } from '../../types/induction';
import type { Assessment } from '../../types/assessment';
import type { Employee } from '../../types/employee';
import type { Branch } from '../../types/branch';

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
function IconSpinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [cloneTargets, setCloneTargets] = useState<Record<string, string>>({});
  const [cloningDayId, setCloningDayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; description: string; thumbnail_url: string | null; active: boolean }>({ title: '', description: '', thumbnail_url: null, active: true });
  const [savingDay, setSavingDay] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [pendingThumbFile, setPendingThumbFile] = useState<File | null>(null);

  const [sections, setSections] = useState<InductionDaySection[]>([]);
  const [sectionDraft, setSectionDraft] = useState<{ section_type: InductionSectionType; title: string; page_content: string; assessment_id: string | null; faq_items: InductionFaqItem[]; watermark_enabled: boolean; watermark_text: string | null; watermark_orientation: 'horizontal' | 'vertical' | 'diagonal'; watermark_opacity: number; no_copy: boolean } | null>(null);
  const [isOperator, setIsOperator] = useState(false);
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
    Promise.all([loadDays(), loadAssignments(), employeeService.getAll(), loadAssessments(), branchService.getAll(), loadCompany()])
      .then(([d, a, e, asm, br, company]) => { setDays(d); setAssignments(a); setEmployees(e); setAssessments(asm); setBranches(br); setIsOperator(company?.is_platform_operator ?? false); })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  function branchName(id: string | null): string {
    if (!id) return 'Shared (all branches)';
    return branches.find((b) => b.id === id)?.branch_name ?? 'Unknown branch';
  }

  async function handleCloneDay(dayId: string) {
    const targetBranchId = cloneTargets[dayId];
    if (!targetBranchId || !user?.companyId) return;
    setCloningDayId(dayId);
    try {
      await cloneDayToBranch(dayId, targetBranchId, user.companyId);
      showToast(`Cloned to ${branchName(targetBranchId)} — edit the copy to customize it.`);
      setCloneTargets((prev) => ({ ...prev, [dayId]: '' }));
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clone.');
    } finally {
      setCloningDayId(null);
    }
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
    setDraft({ title: '', description: '', thumbnail_url: null, active: true });
    setSections([]);
  }

  function startEditDay(day: InductionDay) {
    setEditingDayId(day.id);
    setDraft({ title: day.title, description: day.description, thumbnail_url: day.thumbnail_url, active: day.active });
    fetchSections(day.id);
  }

  function handleThumbnailFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Opens the resize/frame editor first — never uploads the raw picked file as-is.
    setPendingThumbFile(file);
  }

  async function handleThumbnailEdited(file: File) {
    setPendingThumbFile(null);
    setUploadingThumb(true);
    try {
      const url = await uploadInlineImage(file);
      setDraft((d) => ({ ...d, thumbnail_url: url }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload thumbnail.');
    } finally {
      setUploadingThumb(false);
    }
  }

  async function handleSaveDay() {
    if (!user?.companyId) return;
    setSavingDay(true);
    try {
      if (editingDayId === 'new') {
        const created = await saveDay({ company_id: user.companyId, title: draft.title, description: draft.description, thumbnail_url: draft.thumbnail_url, display_order: days.length, active: draft.active, branch_id: null, source_id: null });
        showToast('Day added.');
        setEditingDayId(created.id);
        fetchSections(created.id);
      } else if (editingDayId) {
        await editDay(editingDayId, { title: draft.title, description: draft.description, thumbnail_url: draft.thumbnail_url, active: draft.active });
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
    setSectionDraft({ section_type: 'page', title: '', page_content: '', assessment_id: null, faq_items: [], watermark_enabled: false, watermark_text: '', watermark_orientation: 'diagonal', watermark_opacity: 12, no_copy: false });
  }

  function startEditSection(s: InductionDaySection) {
    setEditingSectionId(s.id);
    setSectionDraft({
      section_type: s.section_type, title: s.title, page_content: s.page_content, assessment_id: s.assessment_id, faq_items: s.faq_items,
      watermark_enabled: s.watermark_enabled, watermark_text: s.watermark_text, watermark_orientation: s.watermark_orientation, watermark_opacity: s.watermark_opacity, no_copy: s.no_copy,
    });
  }

  function updateFaqItem(index: number, field: keyof InductionFaqItem, value: string) {
    setSectionDraft((d) => {
      if (!d) return d;
      const items = [...d.faq_items];
      items[index] = { ...items[index], [field]: value };
      return { ...d, faq_items: items };
    });
  }
  function addFaqItem() {
    setSectionDraft((d) => (d ? { ...d, faq_items: [...d.faq_items, { question: '', answer: '' }] } : d));
  }
  function removeFaqItem(index: number) {
    setSectionDraft((d) => (d ? { ...d, faq_items: d.faq_items.filter((_, i) => i !== index) } : d));
  }

  async function handleSaveSection() {
    if (!sectionDraft || !editingDayId || editingDayId === 'new' || !user?.companyId) return;
    setSavingSection(true);
    try {
      const protection = {
        watermark_enabled: sectionDraft.watermark_enabled, watermark_text: sectionDraft.watermark_text,
        watermark_orientation: sectionDraft.watermark_orientation, watermark_opacity: sectionDraft.watermark_opacity,
        no_copy: sectionDraft.no_copy,
      };
      if (editingSectionId === 'new') {
        await saveSection({
          company_id: user.companyId, day_id: editingDayId,
          section_type: sectionDraft.section_type, title: sectionDraft.title,
          page_content: sectionDraft.page_content, assessment_id: sectionDraft.assessment_id,
          faq_items: sectionDraft.faq_items,
          display_order: sections.length,
          ...protection,
        });
      } else if (editingSectionId) {
        await editSection(editingSectionId, {
          section_type: sectionDraft.section_type, title: sectionDraft.title,
          page_content: sectionDraft.page_content, assessment_id: sectionDraft.assessment_id,
          faq_items: sectionDraft.faq_items,
          ...protection,
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

  async function handleMoveSection(id: string, direction: 'up' | 'down') {
    const index = sections.findIndex((s) => s.id === id);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= sections.length) return;

    const reordered = [...sections];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    setSections(reordered);

    try {
      await reorderSections(reordered.map((s) => s.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reorder sections.');
      if (editingDayId && editingDayId !== 'new') fetchSections(editingDayId);
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
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Thumbnail — shown on this Day's card</label>
              <div className="flex items-center gap-3">
                {draft.thumbnail_url && <img src={draft.thumbnail_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                <input ref={thumbInputRef} type="file" accept="image/*" onChange={handleThumbnailFileChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={uploadingThumb}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingThumb ? <IconSpinner /> : null}
                  {uploadingThumb ? 'Uploading…' : draft.thumbnail_url ? 'Replace Image' : 'Upload Image'}
                </button>
              </div>
              {pendingThumbFile && (
                <ImageEditModal
                  file={pendingThumbFile}
                  frames={['rectangle', 'rounded', 'square']}
                  defaultFrame="rounded"
                  title="Resize & Frame Thumbnail"
                  onCancel={() => setPendingThumbFile(null)}
                  onConfirm={handleThumbnailEdited}
                />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
              Active (visible to employees)
            </label>
          </div>

          {editingDayId !== 'new' && (
            <div className="mt-6">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Sections — add a Page, a Test, or an FAQ, in the order employees go through them
              </label>
              <div className="mb-3 space-y-2">
                {sections.length === 0 && <p className="text-xs text-slate-400">No sections yet — add one below.</p>}
                {sections.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleMoveSection(s.id, 'up')}
                          disabled={i === 0}
                          aria-label="Move up"
                          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMoveSection(s.id, 'down')}
                          disabled={i === sections.length - 1}
                          aria-label="Move down"
                          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        s.section_type === 'test' ? 'bg-amber-50 text-amber-700' : s.section_type === 'faq' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {s.section_type === 'test' ? 'Test' : s.section_type === 'faq' ? 'FAQ' : 'Page'}
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
                        <option value="faq">FAQ</option>
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
                      {...(isOperator ? {
                        watermark: { enabled: sectionDraft.watermark_enabled, text: sectionDraft.watermark_text, orientation: sectionDraft.watermark_orientation, opacity: sectionDraft.watermark_opacity } as WatermarkConfig,
                        onWatermarkChange: (w: WatermarkConfig) => setSectionDraft((d) => d && { ...d, watermark_enabled: w.enabled, watermark_text: w.text, watermark_orientation: w.orientation, watermark_opacity: w.opacity }),
                        noCopy: sectionDraft.no_copy,
                        onNoCopyChange: (v: boolean) => setSectionDraft((d) => d && { ...d, no_copy: v }),
                      } : {})}
                    />
                  )}

                  {sectionDraft.section_type === 'test' && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Assessment</label>
                      <select value={sectionDraft.assessment_id ?? ''} onChange={(e) => setSectionDraft((d) => d && { ...d, assessment_id: e.target.value || null })} className={INPUT_CLS}>
                        <option value="">— Select an assessment —</option>
                        {assessments.map((a) => <option key={a.id} value={a.id}>{a.assessment_title} ({a.maximum_attempts} attempt{a.maximum_attempts === 1 ? '' : 's'} allowed)</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-400">
                        Assessments (with their questions, passing score, and how many attempts an employee gets) are created in Admin → Assessments — pick one here to attach it to this Day's test. The next Day unlocks once this test is passed.
                      </p>
                    </div>
                  )}

                  {sectionDraft.section_type === 'faq' && (
                    <div className="space-y-3">
                      {sectionDraft.faq_items.length === 0 && <p className="text-xs text-slate-400">No questions yet — add one below.</p>}
                      {sectionDraft.faq_items.map((item, i) => (
                        <div key={i} className="rounded-xl border border-slate-100 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">Question {i + 1}</span>
                            <button onClick={() => removeFaqItem(i)} className="text-xs font-semibold text-red-500 hover:underline">Remove</button>
                          </div>
                          <input
                            value={item.question}
                            onChange={(e) => updateFaqItem(i, 'question', e.target.value)}
                            placeholder="Question"
                            className={`${INPUT_CLS} mb-2`}
                          />
                          <textarea
                            value={item.answer}
                            onChange={(e) => updateFaqItem(i, 'answer', e.target.value)}
                            placeholder="Answer"
                            rows={2}
                            className={INPUT_CLS}
                          />
                        </div>
                      ))}
                      <button onClick={addFaqItem} className="text-xs font-semibold text-indigo-600 hover:underline">+ Add Question</button>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">All Days</p>
          <div className="flex flex-wrap gap-2">
            {branches.length > 1 && (
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={`${INPUT_CLS} w-auto`}>
                <option value="all">All branches</option>
                <option value="generic">Shared only</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name} only</option>)}
              </select>
            )}
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
            [...days]
              .sort((a, b) => a.display_order - b.display_order)
              .filter((d) => branchFilter === 'all' || (branchFilter === 'generic' ? !d.branch_id : d.branch_id === branchFilter))
              .map((d, i) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  {d.thumbnail_url ? (
                    <img src={d.thumbnail_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-slate-100" />
                  )}
                  <div>
                  <p className="text-sm font-semibold text-slate-800">Day {i + 1}: {d.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.branch_id ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                      {branchName(d.branch_id)}
                    </span>
                    {!d.active && <span className="text-[11px] font-semibold text-slate-400">Inactive</span>}
                  </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {branches.length > 1 && !d.branch_id && (
                    <>
                      <select
                        value={cloneTargets[d.id] ?? ''}
                        onChange={(e) => setCloneTargets((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="">Clone to branch…</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                      </select>
                      <button
                        onClick={() => handleCloneDay(d.id)}
                        disabled={!cloneTargets[d.id] || cloningDayId === d.id}
                        className="text-xs font-semibold text-violet-600 hover:underline disabled:opacity-40"
                      >
                        {cloningDayId === d.id ? 'Cloning…' : 'Clone'}
                      </button>
                    </>
                  )}
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
