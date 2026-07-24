// src/modules/realEstateProject/RealEstateProjectManagement.tsx
//
// Real, dedicated management for browsable Project content — fully
// separate from Course (no pass %, no duration, no certificate). Real
// thumbnail upload, real brochure (PDF) upload, and a lightweight
// formatting toolbar for the description — everything an Admin needs
// to add a new project without ever touching code.

import { useEffect, useRef, useState } from 'react';
import {
  loadCategories, saveCategory, removeCategory,
  loadProjects, saveProject, editProject, removeProject,
  loadAllBrochures, addBrochure, addBrochureLink, removeBrochure,
  uploadThumbnail, uploadInlineImage,
  loadSectionsForProject, saveSection, editSection, removeSection,
} from '../../services/realEstateProject/realEstateProjectService';
import { loadAssessments } from '../../services/assessment/assessmentService';
import { getCurrentUser } from '../../services/auth/session';
import RichTextEditor from '../../components/shared/RichTextEditor';
import type { RealEstateProjectCategory, RealEstateProject, RealEstateProjectBrochure } from '../../types/realEstateProject';
import type { RealEstateProjectSection, RealEstateProjectSectionForm, ProjectSectionFaqItem } from '../../types/realEstateProjectSection';
import { defaultProjectSectionForm } from '../../types/realEstateProjectSection';
import type { Assessment } from '../../types/assessment';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function RealEstateProjectManagement() {
  const user = getCurrentUser();
  const [categories, setCategories] = useState<RealEstateProjectCategory[]>([]);
  const [projects, setProjects] = useState<RealEstateProject[]>([]);
  const [brochures, setBrochures] = useState<RealEstateProjectBrochure[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ project_name: '', category_id: '', short_description: '', full_description: '', thumbnail_url: '' });
  const [savingProject, setSavingProject] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const [brochureTitleDraft, setBrochureTitleDraft] = useState('');
  const [brochureLinkDraft, setBrochureLinkDraft] = useState('');
  const [brochureMode, setBrochureMode] = useState<'upload' | 'link'>('upload');
  const [uploadingBrochure, setUploadingBrochure] = useState(false);

  const [sections, setSections] = useState<RealEstateProjectSection[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [sectionDraft, setSectionDraft] = useState<RealEstateProjectSectionForm | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState(false);

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const brochureInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    Promise.all([loadCategories(), loadProjects(), loadAllBrochures()])
      .then(([c, p, b]) => { setCategories(c); setProjects(p); setBrochures(b); })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    loadAssessments().then(setAssessments).catch(() => setAssessments([]));
  }, []);

  function fetchSections(projectId: string) {
    loadSectionsForProject(projectId)
      .then(setSections)
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load sections.'));
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim() || !user?.companyId) return;
    try {
      await saveCategory({ company_id: user.companyId, category_name: newCategoryName.trim(), description: '', active: true });
      setNewCategoryName('');
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add category.');
    }
  }

  async function handleDeleteCategory(id: string) {
    try {
      await removeCategory(id);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete category.');
    }
  }

  function startNewProject() {
    setEditingProjectId('new');
    setDraft({ project_name: '', category_id: categories[0]?.id ?? '', short_description: '', full_description: '', thumbnail_url: '' });
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
  }

  async function handleSaveSection() {
    if (!sectionDraft) return;
    setSavingSection(true);
    try {
      if (editingSectionId === 'new') {
        await saveSection(sectionDraft);
      } else if (editingSectionId) {
        await editSection(editingSectionId, sectionDraft);
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
      await removeSection(id);
      if (editingProjectId && editingProjectId !== 'new') fetchSections(editingProjectId);
      showToast('Section deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete section.');
    }
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
              <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
              <select value={draft.category_id} onChange={(e) => setDraft((d) => ({ ...d, category_id: e.target.value }))} className={INPUT_CLS}>
                <option value="">— Select —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.category_name}</option>)}
              </select>
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
                        {s.section_type === 'test' && (
                          <span className="text-xs text-slate-400">
                            {assessments.find((a) => a.id === s.assessment_id)?.assessment_title ?? '— assessment not found —'}
                          </span>
                        )}
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
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Assessment</label>
                        <select
                          value={sectionDraft.assessment_id ?? ''}
                          onChange={(e) => setSectionDraft((d) => d && { ...d, assessment_id: e.target.value || null })}
                          className={INPUT_CLS}
                        >
                          <option value="">— Select Assessment —</option>
                          {assessments.map((a) => <option key={a.id} value={a.id}>{a.assessment_title}</option>)}
                        </select>
                        <p className="mt-1 text-xs text-slate-400">
                          Uses your existing Assessment/Question Bank setup — the score is a normal assessment result, so it shows up in Results and Reports automatically.
                        </p>
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
        <p className="mb-3 text-sm font-semibold text-slate-700">Categories</p>
        <div className="mb-3 flex gap-2">
          <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name..." className={INPUT_CLS} />
          <button onClick={handleAddCategory} className="flex-shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Add</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
              {c.category_name}
              <button onClick={() => handleDeleteCategory(c.id)} className="text-red-500 hover:text-red-700">✕</button>
            </span>
          ))}
        </div>
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
                    <p className="text-xs text-slate-400">{categories.find((c) => c.id === p.category_id)?.category_name ?? '—'}</p>
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
