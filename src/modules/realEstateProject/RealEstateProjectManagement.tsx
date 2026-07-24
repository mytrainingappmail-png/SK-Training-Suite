// src/modules/realEstateProject/RealEstateProjectManagement.tsx
//
// Real, dedicated management for browsable Project content — fully
// separate from Course (no pass %, no duration, no certificate). Real
// thumbnail upload, real brochure (PDF) upload, and a lightweight
// formatting toolbar for the description — everything an Admin needs
// to add a new project without ever touching code.

import { useEffect, useRef, useState } from 'react';
import {
  loadProjects, saveProject, editProject, removeProject,
  loadAllBrochures, addBrochure, addBrochureLink, removeBrochure,
  uploadThumbnail, uploadInlineImage,
  loadSectionsForProject, saveSection, editSection, removeSection,
} from '../../services/realEstateProject/realEstateProjectService';
import {
  loadAssessments, createAssessment as createAssessmentSvc,
  saveAssessment as saveAssessmentSettings, removeAssessment as removeAssessmentSvc,
} from '../../services/assessment/assessmentService';
import {
  loadQuestions, loadOptionsByQuestion, createQuestion as createQuestionSvc,
  saveQuestion as saveQuestionSvc, removeQuestion as removeQuestionSvc,
} from '../../services/question/questionService';
import { getCurrentUser } from '../../services/auth/session';
import RichTextEditor from '../../components/shared/RichTextEditor';
import type { RealEstateProject, RealEstateProjectBrochure } from '../../types/realEstateProject';
import type { RealEstateProjectSection, RealEstateProjectSectionForm, ProjectSectionFaqItem } from '../../types/realEstateProjectSection';
import { defaultProjectSectionForm } from '../../types/realEstateProjectSection';
import { defaultAssessmentForm } from '../../types/assessment';
import type { Question, QuestionOption, QuestionWithOptionsForm } from '../../types/question';
import { defaultQuestionForm } from '../../types/question';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function RealEstateProjectManagement() {
  const user = getCurrentUser();
  const [projects, setProjects] = useState<RealEstateProject[]>([]);
  const [brochures, setBrochures] = useState<RealEstateProjectBrochure[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ project_name: string; category_id: string | null; short_description: string; full_description: string; thumbnail_url: string }>(
    { project_name: '', category_id: null, short_description: '', full_description: '', thumbnail_url: '' }
  );
  const [savingProject, setSavingProject] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const [brochureTitleDraft, setBrochureTitleDraft] = useState('');
  const [brochureLinkDraft, setBrochureLinkDraft] = useState('');
  const [brochureMode, setBrochureMode] = useState<'upload' | 'link'>('upload');
  const [uploadingBrochure, setUploadingBrochure] = useState(false);

  const [sections, setSections] = useState<RealEstateProjectSection[]>([]);
  const [sectionDraft, setSectionDraft] = useState<RealEstateProjectSectionForm | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState(false);

  const DEFAULT_TEST_SETTINGS = { passing_percentage: 70, duration_minutes: 15, shuffle_questions: true, shuffle_options: true };
  const [testSettingsDraft, setTestSettingsDraft] = useState(DEFAULT_TEST_SETTINGS);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [testQuestionOptions, setTestQuestionOptions] = useState<Record<string, QuestionOption[]>>({});
  const [questionDraft, setQuestionDraft] = useState<QuestionWithOptionsForm | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | 'new' | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const brochureInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    Promise.all([loadProjects(), loadAllBrochures()])
      .then(([p, b]) => { setProjects(p); setBrochures(b); })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  function fetchSections(projectId: string) {
    loadSectionsForProject(projectId)
      .then(setSections)
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load sections.'));
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
        await saveProject({ ...draft, company_id: user.companyId, active: true, display_order: projects.length });
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

  async function handleDeleteProject(id: string) {
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
    setSectionDraft({ ...defaultProjectSectionForm, company_id: user.companyId, project_id: editingProjectId, display_order: sections.length });
    resetTestState();
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
      if (editingSectionId === 'new') {
        await saveSection(payload);
      } else if (editingSectionId) {
        await editSection(editingSectionId, payload);
      }
      setEditingSectionId(null);
      setSectionDraft(null);
      if (editingProjectId && editingProjectId !== 'new') fetchSections(editingProjectId);
      showToast('Section saved');
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
      assessment_id: q.assessment_id,
      question_code: q.question_code,
      question_text: q.question_text,
      question_type: 'mcq',
      difficulty_level: q.difficulty_level,
      marks: q.marks,
      negative_marks: q.negative_marks,
      time_limit_seconds: q.time_limit_seconds,
      explanation: q.explanation,
      hint: q.hint,
      display_order: q.display_order,
      mandatory: q.mandatory,
      randomize_options: q.randomize_options,
      attachment_url: q.attachment_url,
      image_url: q.image_url,
      active: q.active,
      options: opts.length ? opts.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct, display_order: o.display_order })) : defaultQuestionForm.options,
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
      showToast('Question saved');
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
      showToast('Question deleted');
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

  function updateFaqItem(index: number, field: keyof ProjectSectionFaqItem, value: string) {
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
        <button onClick={() => setEditingProjectId(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
          ← Back to Projects
        </button>

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

                <div className="mb-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBrochureMode('upload')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      brochureMode === 'upload' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Upload PDF
                  </button>
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

                <input
                  value={brochureTitleDraft}
                  onChange={(e) => setBrochureTitleDraft(e.target.value)}
                  placeholder="Brochure title..."
                  className={`${INPUT_CLS} mb-2`}
                />

                {brochureMode === 'upload' ? (
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
                  {sections.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          s.section_type === 'test' ? 'bg-amber-50 text-amber-700' : s.section_type === 'faq' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {sectionTypeLabel(s.section_type)}
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
                            <div className="mb-3 space-y-2">
                              {testQuestions.length === 0 && (
                                <p className="text-xs text-slate-400">No questions yet — add one below.</p>
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
                        {sectionDraft.faq_items.map((item, i) => (
                          <div key={i} className="rounded-lg bg-slate-50 p-3">
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
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Projects</h2>
        <p className="mt-1 text-sm text-slate-500">Browsable reference material — no test, no duration, no certificate. Read anytime.</p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">All Projects</p>
          <button onClick={startNewProject} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            + New Project
          </button>
        </div>
        <div className="space-y-2">
          {projects.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No projects yet — add one above.</p>
          ) : (
            projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-100" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.project_name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEditProject(p)} className="text-xs font-semibold text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => handleDeleteProject(p.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default RealEstateProjectManagement;
