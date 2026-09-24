// src/modules/induction/InductionManagement.tsx
//
// Admin management for the Induction module — deliberately modeled on
// RealEstateProjectManagement.tsx (flat Days instead of Projects, Page/Test
// sections, drag-and-drop reorder). Test sections auto-create their own
// private, per-section assessment+questions (never picked from the shared,
// company-wide Assessment pool used by Courses) — plus CSV bulk import and
// a downloadable sample CSV for fast question entry.

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
import {
  loadAssessments, createAssessment as createAssessmentSvc,
  saveAssessment as saveAssessmentSettings, removeAssessment as removeAssessmentSvc,
} from '../../services/assessment/assessmentService';
import {
  loadQuestions, loadOptionsByQuestion, createQuestion as createQuestionSvc,
  saveQuestion as saveQuestionSvc, removeQuestion as removeQuestionSvc,
} from '../../services/question/questionService';
import { employeeService } from '../../services/employee/employeeService';
import { branchService } from '../../services/branch/branchService';
import { getCurrentUser } from '../../services/auth/session';
import { loadCompany } from '../../services/company/companyService';
import RichTextEditor from '../../components/shared/RichTextEditor';
import ImageEditModal from '../../components/shared/ImageEditModal';
import type { WatermarkConfig, ContentProtectionPatch } from '../../components/shared/ContentWatermark';
import { protectionPatchFromCompany, DEFAULT_WATERMARK } from '../../components/shared/ContentWatermark';
import { uploadImage } from '../../services/contentEditor/contentEditorService';
import type { InductionDay, InductionDaySection, InductionSectionType, InductionAssignment, InductionFaqItem } from '../../types/induction';
import { defaultAssessmentForm } from '../../types/assessment';
import type { Question, QuestionWithOptionsForm } from '../../types/question';
import { defaultQuestionForm } from '../../types/question';
import type { Employee } from '../../types/employee';
import type { Branch } from '../../types/branch';
import type { Company } from '../../types/company';

const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

async function uploadInlineImage(file: File): Promise<string> {
  const { url } = await uploadImage(file);
  return url;
}

// ── CSV bulk import/export for Induction Test questions — 4-option MCQ only,
// matching the simple in-line question builder below (native, no dependency,
// same technique as AssessmentManagement's CSV import). ──────────────────────
const TEST_CSV_HEADER = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'marks'];

function parseTestCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
}

function csvToTestQuestionForms(text: string, assessmentId: string, startOrder: number): QuestionWithOptionsForm[] {
  const rows = parseTestCsv(text);
  if (rows.length === 0) return [];
  const dataRows = rows[0][0]?.toLowerCase() === 'question_text' ? rows.slice(1) : rows;
  return dataRows.map((row, i) => {
    const [questionText, optA, optB, optC, optD, correctRaw, marksRaw] = row;
    const optionTexts = [optA, optB, optC, optD].filter((t): t is string => !!t && t.trim().length > 0);
    const correctLetter = (correctRaw ?? 'A').trim().toUpperCase();
    const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
    const options = optionTexts.map((text, idx) => ({ option_text: text, is_correct: idx === (correctIndex >= 0 ? correctIndex : 0), display_order: idx + 1 }));
    return {
      ...defaultQuestionForm,
      assessment_id: assessmentId,
      question_code: `IND-${Date.now().toString(36).toUpperCase()}-${i}`,
      question_text: questionText ?? '',
      marks: Number(marksRaw) > 0 ? Number(marksRaw) : 1,
      display_order: startOrder + i,
      options: options.length >= 2 ? options : defaultQuestionForm.options,
    };
  }).filter((q) => q.question_text.trim().length > 0);
}

function testQuestionsToCsv(questions: Question[], optionsByQuestion: Record<string, { option_text: string; is_correct: boolean }[]>): string {
  const lines = questions.map((q) => {
    const opts = optionsByQuestion[q.id] ?? [];
    const correctIndex = opts.findIndex((o) => o.is_correct);
    return [
      `"${q.question_text.replace(/"/g, '""')}"`,
      opts[0]?.option_text ?? '', opts[1]?.option_text ?? '', opts[2]?.option_text ?? '', opts[3]?.option_text ?? '',
      correctIndex >= 0 ? 'ABCD'[correctIndex] : 'A',
      String(q.marks),
    ].join(',');
  });
  return [TEST_CSV_HEADER.join(','), ...lines].join('\n');
}

function sampleTestCsv(): string {
  return [
    TEST_CSV_HEADER.join(','),
    ['"What is RERA?"', 'A real estate law', 'A tax slab', 'A bank scheme', 'A loan type', 'A', '1'].join(','),
    ['"Carpet area excludes"', 'Walls', 'Balcony', 'Kitchen', 'Bedroom', 'B', '1'].join(','),
  ].join('\n');
}

// ── CSV bulk import/export for FAQ sections — 2 columns (question, answer). ──
const FAQ_CSV_HEADER = ['question', 'answer'];

function csvToFaqItems(text: string): InductionFaqItem[] {
  const rows = parseTestCsv(text);
  if (rows.length === 0) return [];
  const dataRows = rows[0][0]?.toLowerCase() === 'question' ? rows.slice(1) : rows;
  return dataRows
    .map((row) => ({ question: row[0] ?? '', answer: row[1] ?? '' }))
    .filter((item) => item.question.trim().length > 0);
}

function faqItemsToCsv(items: InductionFaqItem[]): string {
  const lines = items.map((item) => [
    `"${item.question.replace(/"/g, '""')}"`,
    `"${item.answer.replace(/"/g, '""')}"`,
  ].join(','));
  return [FAQ_CSV_HEADER.join(','), ...lines].join('\n');
}

function sampleFaqCsv(): string {
  return [
    FAQ_CSV_HEADER.join(','),
    ['"What is RERA?"', '"Real Estate Regulatory Authority — the law governing real estate sales in India."'].join(','),
    ['"What is carpet area?"', '"The usable floor area inside a unit\'s walls, excluding common areas."'].join(','),
  ].join('\n');
}

function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  const [company, setCompany] = useState<Company | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState(false);

  // Induction's own dedicated Test builder — each Test section auto-creates
  // its own private assessment+questions (never picked from the shared,
  // company-wide Assessment pool), same pattern as Real Estate Project
  // Test sections. Plus CSV bulk import/export for questions.
  const DEFAULT_TEST_SETTINGS = { passing_percentage: 70, duration_minutes: 15, shuffle_questions: true, shuffle_options: true };
  const [testSettingsDraft, setTestSettingsDraft] = useState(DEFAULT_TEST_SETTINGS);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [testQuestionOptions, setTestQuestionOptions] = useState<Record<string, { option_text: string; is_correct: boolean }[]>>({});
  const [questionDraft, setQuestionDraft] = useState<QuestionWithOptionsForm | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | 'new' | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const faqCsvInputRef = useRef<HTMLInputElement>(null);

  const [pickEmployeeId, setPickEmployeeId] = useState('');
  const [assigning, setAssigning] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    Promise.all([loadDays(), loadAssignments(), employeeService.getAll(), branchService.getAll(), loadCompany()])
      .then(([d, a, e, br, co]) => { setDays(d); setAssignments(a); setEmployees(e); setBranches(br); setCompany(co); setIsOperator(co?.is_platform_operator ?? false); })
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

  async function fetchTestData(assessmentId: string) {
    try {
      const [allAssessments, allQuestions] = await Promise.all([loadAssessments(), loadQuestions()]);
      const a = allAssessments.find((x) => x.id === assessmentId);
      if (a) {
        setTestSettingsDraft({
          passing_percentage: a.passing_percentage,
          duration_minutes: a.duration_minutes,
          shuffle_questions: a.shuffle_questions,
          shuffle_options: a.shuffle_options,
        });
      }
      const qs = allQuestions.filter((q) => q.assessment_id === assessmentId).sort((x, y) => x.display_order - y.display_order);
      setTestQuestions(qs);
      const entries = await Promise.all(qs.map(async (q) => [q.id, await loadOptionsByQuestion(q.id)] as const));
      setTestQuestionOptions(Object.fromEntries(entries));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load test.');
    }
  }

  function resetTestState() {
    setTestSettingsDraft(DEFAULT_TEST_SETTINGS);
    setTestQuestions([]);
    setTestQuestionOptions({});
    setQuestionDraft(null);
    setEditingQuestionId(null);
  }

  function startNewSection() {
    setEditingSectionId('new');
    const defaults = company ? protectionPatchFromCompany(company) : { watermark_enabled: false, watermark_text: '', watermark_orientation: DEFAULT_WATERMARK.orientation, watermark_opacity: DEFAULT_WATERMARK.opacity, no_copy: false };
    setSectionDraft({ section_type: 'page', title: '', page_content: '', assessment_id: null, faq_items: [], ...defaults });
    resetTestState();
  }

  // Content-protection fields save immediately as they're toggled (no need
  // to also hit "Save Section") — only for a section that already exists,
  // since a brand-new draft has no row to update yet.
  function persistProtectionIfExisting(patch: ContentProtectionPatch) {
    if (editingSectionId && editingSectionId !== 'new') {
      editSection(editingSectionId, patch).catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to save protection settings.'));
    }
  }

  function startEditSection(s: InductionDaySection) {
    setEditingSectionId(s.id);
    setSectionDraft({
      section_type: s.section_type, title: s.title, page_content: s.page_content, assessment_id: s.assessment_id, faq_items: s.faq_items,
      watermark_enabled: s.watermark_enabled, watermark_text: s.watermark_text, watermark_orientation: s.watermark_orientation, watermark_opacity: s.watermark_opacity, no_copy: s.no_copy,
    });
    resetTestState();
    if (s.section_type === 'test' && s.assessment_id) {
      fetchTestData(s.assessment_id);
    }
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
  async function handleImportFaqCsv(file: File) {
    try {
      const text = await file.text();
      const items = csvToFaqItems(text);
      if (items.length === 0) {
        showToast('No valid rows found in that CSV.');
        return;
      }
      setSectionDraft((d) => (d ? { ...d, faq_items: [...d.faq_items, ...items] } : d));
      showToast(`Added ${items.length} question(s) — click Save Section to store them.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import CSV.');
    }
  }
  function handleExportFaqCsv() {
    if (!sectionDraft || sectionDraft.faq_items.length === 0) return;
    downloadTextFile(faqItemsToCsv(sectionDraft.faq_items), `${sectionDraft.title || 'induction-faq'}.csv`, 'text/csv');
  }
  function handleDownloadFaqSampleCsv() {
    downloadTextFile(sampleFaqCsv(), 'induction-faq-sample.csv', 'text/csv');
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
      let assessmentId = sectionDraft.assessment_id;
      if (sectionDraft.section_type === 'test') {
        if (!sectionDraft.title.trim()) throw new Error('Give the test a subject line first.');
        // Every Induction Test gets its own private assessment — auto-created
        // here, never picked from the shared company-wide Assessment pool —
        // so it can't be edited/deleted from Admin → Assessments by mistake.
        // Title is prefixed so every Induction Day's test groups together in
        // Assessment Results as practice tests, distinct from the final exam
        // (that one's run in Live Quiz) — each Day still keeps its OWN
        // assessment underneath, so per-Day pass-gating is unaffected.
        const testTitle = `Induction Practice Test — ${sectionDraft.title}`;
        const settingsPayload = {
          assessment_title: testTitle,
          description: testTitle,
          passing_percentage: testSettingsDraft.passing_percentage,
          duration_minutes: testSettingsDraft.duration_minutes,
          shuffle_questions: testSettingsDraft.shuffle_questions,
          shuffle_options: testSettingsDraft.shuffle_options,
        };
        if (assessmentId) {
          await saveAssessmentSettings(assessmentId, settingsPayload);
        } else {
          const created = await createAssessmentSvc({
            ...defaultAssessmentForm,
            lesson_id: null,
            company_id: user.companyId,
            assessment_code: `induction-test-${Date.now().toString(36)}`,
            assessment_type: 'quiz',
            auto_submit: true,
            ...settingsPayload,
          });
          assessmentId = created.id;
        }
      }
      if (editingSectionId === 'new') {
        await saveSection({
          company_id: user.companyId, day_id: editingDayId,
          section_type: sectionDraft.section_type, title: sectionDraft.title,
          page_content: sectionDraft.page_content, assessment_id: assessmentId,
          faq_items: sectionDraft.faq_items,
          display_order: sections.length,
          ...protection,
        });
      } else if (editingSectionId) {
        await editSection(editingSectionId, {
          section_type: sectionDraft.section_type, title: sectionDraft.title,
          page_content: sectionDraft.page_content, assessment_id: assessmentId,
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
      const s = sections.find((x) => x.id === id);
      await removeSection(id);
      if (s?.section_type === 'test' && s.assessment_id) {
        try { await removeAssessmentSvc(s.assessment_id); } catch { /* best-effort cleanup */ }
      }
      fetchSections(editingDayId);
      showToast('Section deleted.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete section.');
    }
  }

  function startNewQuestion() {
    const assessmentId = sectionDraft?.assessment_id;
    if (!assessmentId) return;
    setEditingQuestionId('new');
    setQuestionDraft({
      ...defaultQuestionForm,
      assessment_id: assessmentId,
      question_code: `q-${Date.now().toString(36)}`,
      display_order: testQuestions.length + 1,
      marks: 1,
      options: [
        { option_text: '', is_correct: true, display_order: 1 },
        { option_text: '', is_correct: false, display_order: 2 },
        { option_text: '', is_correct: false, display_order: 3 },
        { option_text: '', is_correct: false, display_order: 4 },
      ],
    });
  }

  function startEditQuestion(q: Question) {
    const opts = testQuestionOptions[q.id] ?? [];
    setEditingQuestionId(q.id);
    setQuestionDraft({
      ...defaultQuestionForm,
      assessment_id: q.assessment_id,
      question_code: q.question_code,
      question_text: q.question_text,
      marks: q.marks,
      display_order: q.display_order,
      options: opts.length ? opts.map((o, i) => ({ option_text: o.option_text, is_correct: o.is_correct, display_order: i + 1 })) : defaultQuestionForm.options,
    });
  }

  async function handleSaveQuestion() {
    if (!questionDraft) return;
    setSavingQuestion(true);
    try {
      if (editingQuestionId === 'new') {
        await createQuestionSvc(questionDraft);
      } else if (editingQuestionId) {
        await saveQuestionSvc(editingQuestionId, questionDraft);
      }
      const assessmentId = questionDraft.assessment_id;
      setEditingQuestionId(null);
      setQuestionDraft(null);
      await fetchTestData(assessmentId);
      showToast('Question saved.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save question.');
    } finally {
      setSavingQuestion(false);
    }
  }

  async function handleDeleteQuestion(id: string, assessmentId: string) {
    try {
      await removeQuestionSvc(id);
      await fetchTestData(assessmentId);
      showToast('Question deleted.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete question.');
    }
  }

  function setCorrectOption(index: number) {
    setQuestionDraft((d) => d && { ...d, options: d.options.map((o, i) => ({ ...o, is_correct: i === index })) });
  }
  function updateOptionText(index: number, text: string) {
    setQuestionDraft((d) => d && { ...d, options: d.options.map((o, i) => (i === index ? { ...o, option_text: text } : o)) });
  }

  async function handleImportCsv(file: File) {
    const assessmentId = sectionDraft?.assessment_id;
    if (!assessmentId) return;
    setImportingCsv(true);
    try {
      const text = await file.text();
      const forms = csvToTestQuestionForms(text, assessmentId, testQuestions.length + 1);
      if (forms.length === 0) {
        showToast('No valid rows found in that CSV.');
        return;
      }
      for (const form of forms) {
        await createQuestionSvc(form);
      }
      await fetchTestData(assessmentId);
      showToast(`Imported ${forms.length} question(s).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import CSV.');
    } finally {
      setImportingCsv(false);
    }
  }

  function handleExportCsv() {
    if (testQuestions.length === 0) return;
    downloadTextFile(testQuestionsToCsv(testQuestions, testQuestionOptions), `${sectionDraft?.title || 'induction-test'}-questions.csv`, 'text/csv');
  }

  function handleDownloadSampleCsv() {
    downloadTextFile(sampleTestCsv(), 'induction-test-sample.csv', 'text/csv');
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
                        onWatermarkChange: (w: WatermarkConfig) => {
                          setSectionDraft((d) => d && { ...d, watermark_enabled: w.enabled, watermark_text: w.text, watermark_orientation: w.orientation, watermark_opacity: w.opacity });
                          persistProtectionIfExisting({ watermark_enabled: w.enabled, watermark_text: w.text, watermark_orientation: w.orientation, watermark_opacity: w.opacity, no_copy: sectionDraft.no_copy });
                        },
                        noCopy: sectionDraft.no_copy,
                        onNoCopyChange: (v: boolean) => {
                          setSectionDraft((d) => d && { ...d, no_copy: v });
                          persistProtectionIfExisting({ watermark_enabled: sectionDraft.watermark_enabled, watermark_text: sectionDraft.watermark_text, watermark_orientation: sectionDraft.watermark_orientation, watermark_opacity: sectionDraft.watermark_opacity, no_copy: v });
                        },
                      } : {})}
                    />
                  )}

                  {sectionDraft.section_type === 'test' && (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="mb-3 text-xs font-semibold text-slate-500">Test Settings — a private test just for this Day, not shared with any other section</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Pass %</label>
                            <input
                              type="number" min={1} max={100}
                              value={testSettingsDraft.passing_percentage}
                              onChange={(e) => setTestSettingsDraft((d) => ({ ...d, passing_percentage: Number(e.target.value) }))}
                              className={INPUT_CLS}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-slate-500">Timer (minutes)</label>
                            <input
                              type="number" min={1} max={600}
                              value={testSettingsDraft.duration_minutes}
                              onChange={(e) => setTestSettingsDraft((d) => ({ ...d, duration_minutes: Number(e.target.value) }))}
                              className={INPUT_CLS}
                            />
                          </div>
                          <label className="mt-5 flex items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={testSettingsDraft.shuffle_questions}
                              onChange={(e) => setTestSettingsDraft((d) => ({ ...d, shuffle_questions: e.target.checked }))}
                            />
                            Shuffle Questions
                          </label>
                          <label className="mt-5 flex items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={testSettingsDraft.shuffle_options}
                              onChange={(e) => setTestSettingsDraft((d) => ({ ...d, shuffle_options: e.target.checked }))}
                            />
                            Shuffle Options
                          </label>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          Employees get {testSettingsDraft.duration_minutes} minute(s) and need {testSettingsDraft.passing_percentage}% to pass. Score shows up in Results and Reports automatically. Save this section once to store these settings.
                        </p>
                      </div>

                      {sectionDraft.assessment_id ? (
                        <div>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-500">Questions ({testQuestions.length})</p>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={handleDownloadSampleCsv} className="text-xs font-semibold text-slate-500 hover:underline">Download Sample CSV</button>
                              <button type="button" onClick={() => csvInputRef.current?.click()} disabled={importingCsv} className="text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50">
                                {importingCsv ? 'Importing…' : 'Bulk Upload CSV'}
                              </button>
                              {testQuestions.length > 0 && (
                                <button type="button" onClick={handleExportCsv} className="text-xs font-semibold text-slate-500 hover:underline">Export CSV</button>
                              )}
                            </div>
                            <input
                              ref={csvInputRef}
                              type="file"
                              accept=".csv"
                              className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleImportCsv(f); }}
                            />
                          </div>
                          <div className="mb-3 space-y-2">
                            {testQuestions.length === 0 && (
                              <p className="text-xs text-slate-400">No questions yet — add one below, or bulk upload a CSV (columns: question_text, option_a-d, correct_option [A-D], marks).</p>
                            )}
                            {testQuestions.map((q) => {
                              const opts = testQuestionOptions[q.id] ?? [];
                              const correct = opts.find((o) => o.is_correct);
                              return (
                                <div key={q.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-800">{q.question_text}</p>
                                    <p className="text-xs text-slate-400">{q.marks} mark(s) · Correct: {correct?.option_text ?? '—'}</p>
                                  </div>
                                  <div className="flex flex-shrink-0 gap-2">
                                    <button onClick={() => startEditQuestion(q)} className="text-xs font-semibold text-indigo-600 hover:underline">Edit</button>
                                    <button onClick={() => handleDeleteQuestion(q.id, q.assessment_id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {questionDraft ? (
                            <div className="rounded-xl border border-slate-200 p-4">
                              <label className="mb-1 block text-xs font-semibold text-slate-500">Question</label>
                              <textarea
                                value={questionDraft.question_text}
                                onChange={(e) => setQuestionDraft((d) => d && { ...d, question_text: e.target.value })}
                                placeholder="Question"
                                rows={2}
                                className={`${INPUT_CLS} mb-3`}
                              />
                              <label className="mb-1 block text-xs font-semibold text-slate-500">Options — mark the correct one</label>
                              <div className="space-y-2">
                                {questionDraft.options.map((opt, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setCorrectOption(i)}
                                      title="Mark as correct"
                                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                                        opt.is_correct ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                      }`}
                                    >
                                      {String.fromCharCode(65 + i)}
                                    </button>
                                    <input
                                      value={opt.option_text}
                                      onChange={(e) => updateOptionText(i, e.target.value)}
                                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                      className={INPUT_CLS}
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <label className="text-xs font-semibold text-slate-500">Marks for this question</label>
                                <input
                                  type="number" min={1}
                                  value={questionDraft.marks}
                                  onChange={(e) => setQuestionDraft((d) => d && { ...d, marks: Number(e.target.value) })}
                                  className="w-20 rounded-lg bg-slate-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                                />
                              </div>
                              <div className="mt-4 flex justify-end gap-2">
                                <button onClick={() => { setEditingQuestionId(null); setQuestionDraft(null); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                  Cancel
                                </button>
                                <button
                                  onClick={handleSaveQuestion}
                                  disabled={savingQuestion}
                                  className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  {savingQuestion ? 'Saving…' : 'Save Question'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={startNewQuestion} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                              + Add Question
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Save this section once (below) to unlock adding questions.</p>
                      )}
                    </div>
                  )}

                  {sectionDraft.section_type === 'faq' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-500">Questions ({sectionDraft.faq_items.length})</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={handleDownloadFaqSampleCsv} className="text-xs font-semibold text-slate-500 hover:underline">Download Sample CSV</button>
                          <button type="button" onClick={() => faqCsvInputRef.current?.click()} className="text-xs font-semibold text-indigo-600 hover:underline">Bulk Upload CSV</button>
                          {sectionDraft.faq_items.length > 0 && (
                            <button type="button" onClick={handleExportFaqCsv} className="text-xs font-semibold text-slate-500 hover:underline">Export CSV</button>
                          )}
                        </div>
                        <input
                          ref={faqCsvInputRef}
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleImportFaqCsv(f); }}
                        />
                      </div>
                      {sectionDraft.faq_items.length === 0 && <p className="text-xs text-slate-400">No questions yet — add one below, or bulk upload a CSV (columns: question, answer).</p>}
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
