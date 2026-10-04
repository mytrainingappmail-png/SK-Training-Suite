// src/modules/realEstateProject/RealEstateProjectManagement.tsx
//
// Real, dedicated management for browsable Project content — fully
// separate from Course (no pass %, no duration, no certificate). Real
// thumbnail upload, real brochure (PDF) upload, and a lightweight
// formatting toolbar for the description — everything an Admin needs
// to add a new project without ever touching code.

import ProjectPreview from './ProjectPreview';
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
  loadProjects, saveProject, editProject, removeProject, reorderProjects, copyProjectIndependent,
  loadAllBrochures, addBrochure, addBrochureLink, removeBrochure,
  uploadThumbnail, uploadInlineImage,
  loadSectionsForProject, saveSection, editSection, removeSection, reorderSections,
  cloneProjectToBranch,
} from '../../services/realEstateProject/realEstateProjectService';
import { branchService } from '../../services/branch/branchService';
import type { Branch } from '../../types/branch';
import {
  loadAssessments, createAssessment as createAssessmentSvc,
  saveAssessment as saveAssessmentSettings, removeAssessment as removeAssessmentSvc,
} from '../../services/assessment/assessmentService';
import {
  loadQuestionsWithOptions,
} from '../../services/question/questionService';
import { getCurrentUser } from '../../services/auth/session';
import { loadCompany } from '../../services/company/companyService';
import type { WatermarkConfig, ContentProtectionPatch } from '../../components/shared/ContentWatermark';
import TestQuestionsEditor from '../../components/shared/TestQuestionsEditor';
import FaqItemsEditor from '../../components/shared/FaqItemsEditor';
import { protectionPatchFromCompany } from '../../components/shared/ContentWatermark';
import RichTextEditor from '../../components/shared/RichTextEditor';
import type { RealEstateProject, RealEstateProjectBrochure } from '../../types/realEstateProject';
import type { RealEstateProjectSection, RealEstateProjectSectionForm } from '../../types/realEstateProjectSection';
import { defaultProjectSectionForm } from '../../types/realEstateProjectSection';
import type { Company } from '../../types/company';
import { defaultAssessmentForm } from '../../types/assessment';
import type { Question, QuestionOption } from '../../types/question';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

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

// Drag handle starts the drag (not the whole row), so an ordinary click on
// the row never accidentally triggers a drag — same pattern as Course
// Management's reorder modal.
function SortableProjectRow({
  id,
  children,
}: {
  id: string;
  children: (opts: { dragHandleProps: { attributes: ReturnType<typeof useSortable>['attributes']; listeners: ReturnType<typeof useSortable>['listeners'] }; isDragging: boolean }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { attributes, listeners }, isDragging })}
    </div>
  );
}

// No category grouping here (unlike Course reorder) — Projects is
// deliberately a flat list (see the file-top comment in projectsService.ts).
function ReorderProjectsModal({
  projects,
  saving,
  onReorder,
  onClose,
}: {
  projects: RealEstateProject[];
  saving: boolean;
  onReorder: (ordered: RealEstateProject[]) => void;
  onClose: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ordered = [...projects].sort((a, b) => a.display_order - b.display_order);

  function moveProject(projectId: string, direction: 'up' | 'down') {
    const index = ordered.findIndex((p) => p.id === projectId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    onReorder(arrayMove(ordered, index, targetIndex));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = ordered.findIndex((p) => p.id === active.id);
    const toIndex = ordered.findIndex((p) => p.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    onReorder(arrayMove(ordered, fromIndex, toIndex));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-projects-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="reorder-projects-title" className="text-lg font-semibold text-slate-800">Reorder Projects</h2>
            <p className="text-sm text-slate-500">Drag a project, or use the arrows, to change the order shown to employees.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[65vh] space-y-1.5 overflow-y-auto p-6">
          {ordered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No projects yet.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={ordered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {ordered.map((project, i) => (
                  <SortableProjectRow key={project.id} id={project.id}>
                    {({ dragHandleProps, isDragging }) => (
                      <div
                        className={`flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 ${
                          isDragging ? 'z-10 shadow-lg ring-1 ring-yellow-400/50' : ''
                        }`}
                      >
                        <button
                          {...dragHandleProps.attributes}
                          {...dragHandleProps.listeners}
                          aria-label="Drag to reorder"
                          title="Drag to reorder"
                          disabled={saving}
                          className="cursor-grab touch-none text-slate-400 transition hover:text-slate-600 active:cursor-grabbing disabled:opacity-40"
                        >
                          <IconGrip />
                        </button>
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveProject(project.id, 'up')}
                            disabled={saving || i === 0}
                            aria-label="Move up"
                            className="text-slate-400 transition hover:text-yellow-600 disabled:opacity-30"
                          >
                            <IconArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => moveProject(project.id, 'down')}
                            disabled={saving || i === ordered.length - 1}
                            aria-label="Move down"
                            className="text-slate-400 transition hover:text-yellow-600 disabled:opacity-30"
                          >
                            <IconArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                        {project.thumbnail_url ? (
                          <img src={project.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-slate-100" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{project.project_name}</p>
                        </div>
                      </div>
                    )}
                  </SortableProjectRow>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Used inside an Induction "Focused projects" card: the screen then lists / creates / edits ONLY the projects that
 * belong to that card (they are separate from the main Projects section — editing or deleting them never touches it).
 */
export interface ProjectManagerScope {
  inductionSectionId: string;
  /** The card's projects (in order) whenever they change, so the card can remember them. */
  onChanged?: (orderedIds: string[]) => void;
  /** What the card already remembers, so nothing is re-saved needlessly. */
  initialIds?: string[];
}

function RealEstateProjectManagement({ scope }: { scope?: ProjectManagerScope } = {}) {
  const user = getCurrentUser();
  const lastNotified = useRef((scope?.initialIds ?? []).join(','));
  const [pickOpen, setPickOpen] = useState(false);
  const [mainProjects, setMainProjects] = useState<RealEstateProject[] | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  // 'Preview' of a project exactly as an employee sees it (nothing saved).
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<RealEstateProject[]>([]);
  const [brochures, setBrochures] = useState<RealEstateProjectBrochure[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [cloneTargets, setCloneTargets] = useState<Record<string, string>>({});
  const [cloningProjectId, setCloningProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ project_name: string; category_id: string | null; short_description: string; full_description: string; thumbnail_url: string }>(
    { project_name: '', category_id: null, short_description: '', full_description: '', thumbnail_url: '' }
  );
  const [savingProject, setSavingProject] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

  const [brochureTitleDraft, setBrochureTitleDraft] = useState('');
  const [brochureLinkDraft, setBrochureLinkDraft] = useState('');
  const [brochureMode, setBrochureMode] = useState<'upload' | 'link'>('link');
  const [uploadingBrochure, setUploadingBrochure] = useState(false);
  const [pdfUploadEnabled, setPdfUploadEnabled] = useState(false);
  const [isOperator, setIsOperator] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);

  const [sections, setSections] = useState<RealEstateProjectSection[]>([]);
  const [sectionDraft, setSectionDraft] = useState<RealEstateProjectSectionForm | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);

  const DEFAULT_TEST_SETTINGS = { passing_percentage: 70, duration_minutes: 15, shuffle_questions: true, shuffle_options: true };
  const [testSettingsDraft, setTestSettingsDraft] = useState(DEFAULT_TEST_SETTINGS);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [testQuestionOptions, setTestQuestionOptions] = useState<Record<string, QuestionOption[]>>({});

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const brochureInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    Promise.all([loadProjects(scope ? { inductionSectionId: scope.inductionSectionId } : undefined), loadAllBrochures(), branchService.getAll(), loadCompany()])
      .then(([p, b, br, co]) => {
        setProjects(p);
        if (scope?.onChanged) {
          const ids = p.map((x) => x.id);
          const key = ids.join(',');
          if (key !== lastNotified.current) { lastNotified.current = key; scope.onChanged(ids); }
        }
        setBrochures(b);
        setBranches(br);
        setPdfUploadEnabled(co?.brochure_pdf_upload_enabled ?? false);
        setIsOperator(co?.is_platform_operator ?? false);
        setCompany(co);
      })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  function branchName(id: string | null): string {
    if (!id) return 'Shared (all branches)';
    return branches.find((b) => b.id === id)?.branch_name ?? 'Unknown branch';
  }

  async function handleCloneProject(projectId: string) {
    const targetBranchId = cloneTargets[projectId];
    if (!targetBranchId || !user?.companyId) return;
    setCloningProjectId(projectId);
    try {
      await cloneProjectToBranch(projectId, targetBranchId, user.companyId);
      showToast(`Cloned to ${branchName(targetBranchId)} — edit the copy to customize it.`);
      setCloneTargets((prev) => ({ ...prev, [projectId]: '' }));
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clone.');
    } finally {
      setCloningProjectId(null);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleReorderProjects(ordered: RealEstateProject[]) {
    setReordering(true);
    setProjects(ordered);
    try {
      await reorderProjects(ordered);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to reorder projects.');
      fetchAll();
    } finally {
      setReordering(false);
    }
  }

  function fetchSections(projectId: string) {
    loadSectionsForProject(projectId)
      .then(setSections)
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load sections.'));
  }

  /** Reload just the questions (keeps whatever is typed in the test settings). */
  async function reloadTestQuestions(assessmentId: string) {
    try {
      const { questions: qs, optionsByQuestion } = await loadQuestionsWithOptions(assessmentId);
      setTestQuestionOptions(optionsByQuestion);
      setTestQuestions(qs);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load questions.');
    }
  }

  async function fetchTestData(assessmentId: string) {
    try {
      const [allAssessments, loaded] = await Promise.all([loadAssessments(), loadQuestionsWithOptions(assessmentId)]);
      const a = allAssessments.find((x) => x.id === assessmentId);
      if (a) {
        setTestSettingsDraft({
          passing_percentage: a.passing_percentage,
          duration_minutes: a.duration_minutes,
          shuffle_questions: a.shuffle_questions,
          shuffle_options: a.shuffle_options,
        });
      }
      setTestQuestions(loaded.questions);
      setTestQuestionOptions(loaded.optionsByQuestion);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load test.');
    }
  }

  function resetTestState() {
    setTestSettingsDraft(DEFAULT_TEST_SETTINGS);
    setTestQuestions([]);
    setTestQuestionOptions({});
  }

  function startNewProject() {
    setEditingProjectId('new');
    setDraft({ project_name: '', category_id: null, short_description: '', full_description: '', thumbnail_url: '' });
    setSections([]);
    setSectionDraft(null);
  }

  function startEditProject(p: RealEstateProject) {
    setEditingProjectId(p.id);
    setDraft({
      project_name: p.project_name,
      category_id: p.category_id,
      short_description: p.short_description,
      full_description: p.full_description,
      thumbnail_url: p.thumbnail_url,
    });
    setSectionDraft(null);
    fetchSections(p.id);
  }

  async function handleThumbnailFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const url = await uploadThumbnail(file, editingProjectId ?? 'new');
      setDraft((d) => ({ ...d, thumbnail_url: url }));
      showToast('Thumbnail uploaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload thumbnail.');
    } finally {
      setUploadingThumb(false);
    }
  }

  async function handleSaveProject() {
    if (!user?.companyId) return;
    setSavingProject(true);
    try {
      if (editingProjectId === 'new') {
        await saveProject({ ...draft, company_id: user.companyId, active: true, display_order: projects.length, branch_id: null, source_id: null, induction_section_id: scope?.inductionSectionId ?? null });
      } else if (editingProjectId) {
        await editProject(editingProjectId, draft);
      }
      setEditingProjectId(null);
      fetchAll();
      showToast('Project saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save project.');
    } finally {
      setSavingProject(false);
    }
  }

  async function openPicker() {
    setPickOpen(true);
    setMainProjects(null);   // always reload: a project may have just been copied to the main section
    try { setMainProjects(await loadProjects()); } catch (err) { showToast(err instanceof Error ? err.message : 'Could not load your projects.'); }
  }

  /** Main Projects -> this card: an independent copy (pages, tests, brochures included). */
  async function handleCopyIntoCard(projectId: string) {
    if (!scope) return;
    setCopyingId(projectId);
    try {
      await copyProjectIndependent(projectId, scope.inductionSectionId);
      showToast('Copied into this card — it is separate from your Projects section, edit it freely.');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not copy the project.');
    } finally {
      setCopyingId(null);
    }
  }

  /** This card -> main Projects: an independent copy, so the work is done once. */
  async function handleCopyToMain(projectId: string) {
    setCopyingId(projectId);
    try {
      await copyProjectIndependent(projectId, null);
      showToast('Copied to your Projects section — it is a separate project there now.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not copy the project.');
    } finally {
      setCopyingId(null);
    }
  }

  async function handleDeleteProject(id: string) {
    if (scope && !window.confirm('Delete this project from the card? Your Projects section is not affected.')) return;
    try {
      await removeProject(id);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete project.');
    }
  }

  async function handleBrochureFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingProjectId || editingProjectId === 'new') {
      showToast('Save the project first, then add brochures.');
      return;
    }
    setUploadingBrochure(true);
    try {
      await addBrochure(editingProjectId, brochureTitleDraft || file.name, file);
      setBrochureTitleDraft('');
      fetchAll();
      showToast('Brochure uploaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload brochure.');
    } finally {
      setUploadingBrochure(false);
    }
  }

  async function handleAddBrochureLink() {
    if (!editingProjectId || editingProjectId === 'new') {
      showToast('Save the project first, then add brochures.');
      return;
    }
    if (!brochureLinkDraft.trim()) {
      showToast('Paste a link first.');
      return;
    }
    setUploadingBrochure(true);
    try {
      await addBrochureLink(editingProjectId, brochureTitleDraft || 'Brochure', brochureLinkDraft.trim());
      setBrochureTitleDraft('');
      setBrochureLinkDraft('');
      fetchAll();
      showToast('Brochure link added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add brochure link.');
    } finally {
      setUploadingBrochure(false);
    }
  }

  const projectBrochures = brochures.filter((b) => b.project_id === editingProjectId);

  function startNewSection() {
    if (!editingProjectId || editingProjectId === 'new' || !user?.companyId) return;
    setEditingSectionId('new');
    const defaults = company ? protectionPatchFromCompany(company) : {};
    setSectionDraft({ ...defaultProjectSectionForm, ...defaults, company_id: user.companyId, project_id: editingProjectId, display_order: sections.length });
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

  function startEditSection(s: RealEstateProjectSection) {
    setEditingSectionId(s.id);
    setSectionDraft({
      company_id: s.company_id,
      project_id: s.project_id,
      section_type: s.section_type,
      title: s.title,
      display_order: s.display_order,
      page_content: s.page_content,
      assessment_id: s.assessment_id,
      faq_items: s.faq_items,
      watermark_enabled: s.watermark_enabled,
      watermark_text: s.watermark_text,
      watermark_orientation: s.watermark_orientation,
      watermark_opacity: s.watermark_opacity,
      no_copy: s.no_copy,
    });
    resetTestState();
    if (s.section_type === 'test' && s.assessment_id) {
      fetchTestData(s.assessment_id);
    }
  }

  async function handleSaveSection() {
    if (!sectionDraft) return;
    setSavingSection(true);
    try {
      let payload = sectionDraft;
      if (sectionDraft.section_type === 'test') {
        if (!sectionDraft.title.trim()) throw new Error('Give the test a subject line first.');
        const settingsPayload = {
          assessment_title: sectionDraft.title,
          description: sectionDraft.title,
          passing_percentage: testSettingsDraft.passing_percentage,
          duration_minutes: testSettingsDraft.duration_minutes,
          shuffle_questions: testSettingsDraft.shuffle_questions,
          shuffle_options: testSettingsDraft.shuffle_options,
        };
        let assessmentId = sectionDraft.assessment_id;
        if (assessmentId) {
          await saveAssessmentSettings(assessmentId, settingsPayload);
        } else {
          const created = await createAssessmentSvc({
            ...defaultAssessmentForm,
            lesson_id: null,
            company_id: user?.companyId ?? null,
            assessment_code: `proj-test-${Date.now().toString(36)}`,
            assessment_type: 'quiz',
            auto_submit: true,
            ...settingsPayload,
          });
          assessmentId = created.id;
        }
        payload = { ...sectionDraft, assessment_id: assessmentId };
      }
      let savedId = editingSectionId;
      if (editingSectionId === 'new') {
        const created = await saveSection(payload);
        savedId = created.id;
      } else if (editingSectionId) {
        await editSection(editingSectionId, payload);
      }

      // A Test section stays open right after saving — settings alone create
      // an (empty) assessment, so closing here would force the admin to
      // re-open the section just to see the "Add Question" UI.
      if (sectionDraft.section_type === 'test' && savedId) {
        setEditingSectionId(savedId);
        setSectionDraft(payload);
        showToast('Test settings saved — now add your questions below.');
      } else {
        setEditingSectionId(null);
        setSectionDraft(null);
        showToast('Section saved');
      }
      if (editingProjectId && editingProjectId !== 'new') fetchSections(editingProjectId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save section.');
    } finally {
      setSavingSection(false);
    }
  }

  async function handleDeleteSection(id: string) {
    try {
      const s = sections.find((x) => x.id === id);
      await removeSection(id);
      if (s?.section_type === 'test' && s.assessment_id) {
        try { await removeAssessmentSvc(s.assessment_id); } catch { /* best-effort cleanup */ }
      }
      if (editingProjectId && editingProjectId !== 'new') fetchSections(editingProjectId);
      showToast('Section deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete section.');
    }
  }

  async function handleSectionDrop(targetId: string) {
    if (!draggedSectionId || draggedSectionId === targetId || !editingProjectId || editingProjectId === 'new') return;
    const ids = sections.map((s) => s.id);
    const fromIdx = ids.indexOf(draggedSectionId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...ids];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedSectionId);
    setDraggedSectionId(null);
    await reorderSections(reordered);
    fetchSections(editingProjectId);
  }

  async function moveSection(sectionId: string, direction: 'up' | 'down') {
    if (!editingProjectId || editingProjectId === 'new') return;
    const ids = sections.map((s) => s.id);
    const idx = ids.indexOf(sectionId);
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapWith < 0 || swapWith >= ids.length) return;
    const reordered = [...ids];
    [reordered[idx], reordered[swapWith]] = [reordered[swapWith], reordered[idx]];
    await reorderSections(reordered);
    fetchSections(editingProjectId);
  }




  function sectionTypeLabel(t: string): string {
    if (t === 'page') return 'Page';
    if (t === 'test') return 'Test';
    return 'FAQ';
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  if (editingProjectId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setEditingProjectId(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
            ← Back to Projects
          </button>
          {editingProjectId !== 'new' && (
            <button onClick={() => setPreviewProjectId(editingProjectId)} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">👁 Preview as employee</button>
          )}
        </div>
        {previewProjectId && <ProjectPreview projectId={previewProjectId} onClose={() => setPreviewProjectId(null)} />}

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{editingProjectId === 'new' ? 'New Project' : 'Edit Project'}</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Project Name</label>
              <input value={draft.project_name} onChange={(e) => setDraft((d) => ({ ...d, project_name: e.target.value }))} className={INPUT_CLS} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Short Description (shown on the card)</label>
              <input value={draft.short_description} onChange={(e) => setDraft((d) => ({ ...d, short_description: e.target.value }))} className={INPUT_CLS} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Full Description</label>
              <RichTextEditor
                value={draft.full_description}
                onChange={(v) => setDraft((d) => ({ ...d, full_description: v }))}
                onImageUpload={uploadInlineImage}
                minHeight={320}
                resetKey={editingProjectId ?? 'new'}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Thumbnail</label>
              <div className="flex items-center gap-3">
                {draft.thumbnail_url && (
                  <img src={draft.thumbnail_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                )}
                <input ref={thumbInputRef} type="file" accept="image/*" onChange={handleThumbnailFileChange} className="hidden" />
                <button
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={uploadingThumb}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingThumb ? <IconSpinner className="h-3.5 w-3.5" /> : draft.thumbnail_url ? 'Replace Image' : 'Upload Image'}
                </button>
              </div>
            </div>

            {editingProjectId !== 'new' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Brochures</label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {projectBrochures.map((b) => (
                    <span key={b.id} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs">
                      {b.title}
                      <button onClick={() => removeBrochure(b.id).then(fetchAll)} className="text-red-500 hover:text-red-700">✕</button>
                    </span>
                  ))}
                </div>

                <div className="mb-2 flex flex-wrap gap-2">
                  {pdfUploadEnabled && (
                    <button
                      type="button"
                      onClick={() => setBrochureMode('upload')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        brochureMode === 'upload' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Upload PDF
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setBrochureMode('link')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      brochureMode === 'link' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Paste Link (Google Drive, etc.)
                  </button>
                </div>
                <p className="mb-2 text-[11px] text-slate-400">
                  💡 A Google Drive link is free — an uploaded PDF stays in storage forever and counts toward your plan's limit. Prefer the link when you can.
                  {!pdfUploadEnabled && ' PDF upload is currently turned off for your company (Admin → Company → Storage).'}
                </p>

                <input
                  value={brochureTitleDraft}
                  onChange={(e) => setBrochureTitleDraft(e.target.value)}
                  placeholder="Brochure title..."
                  className={`${INPUT_CLS} mb-2`}
                />

                {brochureMode === 'upload' && pdfUploadEnabled ? (
                  <div className="flex gap-2">
                    <input ref={brochureInputRef} type="file" accept="application/pdf" onChange={handleBrochureFileChange} className="hidden" />
                    <button
                      onClick={() => brochureInputRef.current?.click()}
                      disabled={uploadingBrochure}
                      className="flex-shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {uploadingBrochure ? <IconSpinner className="h-3.5 w-3.5" /> : 'Upload PDF'}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={brochureLinkDraft}
                      onChange={(e) => setBrochureLinkDraft(e.target.value)}
                      placeholder="Paste Google Drive (or any) link here..."
                      className={INPUT_CLS}
                    />
                    <button
                      onClick={handleAddBrochureLink}
                      disabled={uploadingBrochure}
                      className="flex-shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {uploadingBrochure ? <IconSpinner className="h-3.5 w-3.5" /> : 'Add Link'}
                    </button>
                  </div>
                )}

                <p className="mt-1 text-xs text-slate-400">
                  For a Google Drive link, make sure sharing is set to "Anyone with the link" so employees can open it.
                </p>
              </div>
            )}

            {editingProjectId !== 'new' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Sections — add a Page, a Test, or an FAQ, in the order employees should go through them
                </label>

                <div className="mb-3 space-y-2">
                  {sections.length === 0 && (
                    <p className="text-xs text-slate-400">No sections yet — add one below.</p>
                  )}
                  {sections.length > 1 && <p className="text-xs text-slate-400">Drag, or use the arrows, to change the order shown to employees.</p>}
                  {sections.map((s, i) => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={() => setDraggedSectionId(s.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleSectionDrop(s.id)}
                      className={`flex cursor-grab items-center justify-between gap-3 rounded-xl border bg-white p-3 transition active:cursor-grabbing ${
                        draggedSectionId === s.id ? 'border-indigo-300 opacity-50' : 'border-slate-100'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <IconGrip className="h-4 w-4 flex-shrink-0 text-slate-300" />
                        <div className="flex flex-shrink-0 flex-col gap-0.5">
                          <button onClick={() => moveSection(s.id, 'up')} disabled={i === 0}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30" title="Move up">
                            <IconArrowUp className="h-3 w-3" />
                          </button>
                          <button onClick={() => moveSection(s.id, 'down')} disabled={i === sections.length - 1}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30" title="Move down">
                            <IconArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                        <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          s.section_type === 'test' ? 'bg-amber-50 text-amber-700' : s.section_type === 'faq' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {sectionTypeLabel(s.section_type)}
                        </span>
                        <p className="truncate text-sm font-semibold text-slate-800">{s.title}</p>
                      </div>
                      <div className="flex flex-shrink-0 gap-2">
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
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Subject Line</label>
                        <input
                          value={sectionDraft.title}
                          onChange={(e) => setSectionDraft((d) => d && { ...d, title: e.target.value })}
                          placeholder="e.g. Master Plan Overview"
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Type</label>
                        <select
                          value={sectionDraft.section_type}
                          onChange={(e) => setSectionDraft((d) => d && { ...d, section_type: e.target.value as 'page' | 'test' | 'faq' })}
                          className={INPUT_CLS}
                        >
                          <option value="page">Page</option>
                          <option value="test">Test</option>
                          <option value="faq">FAQ</option>
                        </select>
                      </div>
                    </div>

                    {sectionDraft.section_type === 'page' && (
                      <RichTextEditor
                        value={sectionDraft.page_content}
                        onChange={(v) => setSectionDraft((d) => d && { ...d, page_content: v })}
                        onImageUpload={uploadInlineImage}
                        minHeight={220}
                        resetKey={editingSectionId ?? 'new-section'}
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
                          <p className="mb-3 text-xs font-semibold text-slate-500">Test Settings</p>
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
                            Employees get {testSettingsDraft.duration_minutes} minute(s) and need {testSettingsDraft.passing_percentage}% to pass. This test's score shows up in Results and Reports automatically.
                          </p>
                        </div>

                        {sectionDraft.assessment_id ? (
                          <div>
                            <p className="mb-2 text-xs font-semibold text-slate-500">Questions ({testQuestions.length})</p>
                          <TestQuestionsEditor
                            assessmentId={sectionDraft.assessment_id}
                            questions={testQuestions}
                            optionsByQuestion={testQuestionOptions}
                            onSaved={() => reloadTestQuestions(sectionDraft.assessment_id!)}
                            showToast={showToast}
                          />
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Save this section once (below) to unlock adding questions.</p>
                        )}
                      </div>
                    )}

                    {sectionDraft.section_type === 'faq' && (
                      <div className="space-y-3">
                      <FaqItemsEditor
                        items={sectionDraft.faq_items}
                        onChange={(next) => setSectionDraft((d) => (d ? { ...d, faq_items: next } : d))}
                        footer={(
                          <>
                            <button type="button" onClick={() => { setEditingSectionId(null); setSectionDraft(null); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                            <button type="button" onClick={handleSaveSection} disabled={savingSection} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                              {savingSection ? 'Saving…' : 'Save Section'}
                            </button>
                          </>
                        )}
                      />
                      </div>
                    )}

                    {sectionDraft.section_type !== 'faq' && (
                      <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => { setEditingSectionId(null); setSectionDraft(null); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveSection}
                          disabled={savingSection}
                          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {savingSection ? 'Saving…' : 'Save Section'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={startNewSection} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    + Add Section
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setEditingProjectId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleSaveProject}
              disabled={savingProject}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingProject ? 'Saving…' : 'Save Project'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {previewProjectId && <ProjectPreview projectId={previewProjectId} onClose={() => setPreviewProjectId(null)} />}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{scope ? 'Projects in this card' : 'Projects'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {scope
            ? 'These projects belong only to this induction card. Adding, editing or deleting them never changes your main Projects section — use the copy buttons to move a project between the two.'
            : 'Browsable reference material — no test, no duration, no certificate. Read anytime.'}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">{scope ? 'Card projects' : 'All Projects'}</p>
          <div className="flex flex-wrap gap-2">
            {!scope && branches.length > 1 && (
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={`${INPUT_CLS} w-auto`}>
                <option value="all">All branches</option>
                <option value="generic">Shared only</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name} only</option>)}
              </select>
            )}
            <button
              onClick={() => setReorderOpen(true)}
              disabled={projects.length < 2}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Reorder Projects
            </button>
            {scope && (
              <button onClick={openPicker} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                Copy from Projects section
              </button>
            )}
            <button onClick={startNewProject} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              + New Project
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {projects.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">{scope ? 'No projects in this card yet — add a new one, or copy one from your Projects section.' : 'No projects yet — add one above.'}</p>
          ) : (
            projects
              .filter((p) => branchFilter === 'all' || (branchFilter === 'generic' ? !p.branch_id : p.branch_id === branchFilter))
              .map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-100" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.project_name}</p>
                    {!scope && (
                      <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.branch_id ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                        {branchName(p.branch_id)}
                      </span>
                    )}
                    {scope && !p.active && <span className="text-[11px] font-semibold text-amber-600">Inactive</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!scope && branches.length > 1 && !p.branch_id && (
                    <>
                      <select
                        value={cloneTargets[p.id] ?? ''}
                        onChange={(e) => setCloneTargets((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="">Clone to branch…</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                      </select>
                      <button
                        onClick={() => handleCloneProject(p.id)}
                        disabled={!cloneTargets[p.id] || cloningProjectId === p.id}
                        className="text-xs font-semibold text-violet-600 hover:underline disabled:opacity-40"
                      >
                        {cloningProjectId === p.id ? 'Cloning…' : 'Clone'}
                      </button>
                    </>
                  )}
                  <button onClick={() => setPreviewProjectId(p.id)} className="text-xs font-semibold text-emerald-700 hover:underline">👁 Preview</button>
                  {scope && (
                    <button onClick={() => handleCopyToMain(p.id)} disabled={copyingId === p.id} className="text-xs font-semibold text-violet-600 hover:underline disabled:opacity-40">
                      {copyingId === p.id ? 'Copying…' : 'Copy to Projects section'}
                    </button>
                  )}
                  <button onClick={() => startEditProject(p)} className="text-xs font-semibold text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => handleDeleteProject(p.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {scope && pickOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setPickOpen(false)} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Copy from your Projects section</h3>
            <p className="mb-3 text-xs text-slate-500">Each one is copied in full (pages, tests, brochures) as a separate project in this card.</p>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {!mainProjects && <p className="text-sm text-slate-400">Loading…</p>}
              {mainProjects && mainProjects.length === 0 && <p className="text-sm text-slate-400">Your Projects section has no projects yet.</p>}
              {(mainProjects ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {m.thumbnail_url ? <img src={m.thumbnail_url} alt="" className="h-10 w-12 flex-shrink-0 rounded-lg object-cover" /> : <div className="h-10 w-12 flex-shrink-0 rounded-lg bg-slate-100" />}
                    <p className="truncate text-sm font-semibold text-slate-800">{m.project_name}</p>
                  </div>
                  <button onClick={() => handleCopyIntoCard(m.id)} disabled={copyingId === m.id} className="flex-shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {copyingId === m.id ? 'Copying…' : 'Copy here'}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setPickOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Done</button>
            </div>
          </div>
        </div>
      )}

      {reorderOpen && (
        <ReorderProjectsModal
          projects={projects}
          saving={reordering}
          onReorder={handleReorderProjects}
          onClose={() => setReorderOpen(false)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default RealEstateProjectManagement;
