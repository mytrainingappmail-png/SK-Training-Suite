// src/services/realEstateProject/realEstateProjectService.ts
//
// Business logic — validation + orchestration.

import {
  getCategories,
  createCategory as repoCreateCategory,
  updateCategory,
  deleteCategory,
  getProjects,
  createProject as repoCreateProject,
  updateProject,
  deleteProject,
  getBrochuresForProject,
  getAllBrochures,
  createBrochure as repoCreateBrochure,
  deleteBrochure,
  uploadProjectThumbnail,
  uploadProjectBrochure,
  getSectionsForProject,
  getAllSections,
  createSection as repoCreateSection,
  updateSection,
  deleteSection,
} from '../../repositories/realEstateProject/realEstateProjectRepository';
import type {
  RealEstateProjectCategory,
  RealEstateProjectCategoryForm,
  RealEstateProject,
  RealEstateProjectForm,
  RealEstateProjectBrochure,
} from '../../types/realEstateProject';
import type {
  RealEstateProjectSection,
  RealEstateProjectSectionForm,
} from '../../types/realEstateProjectSection';

export async function loadCategories(): Promise<RealEstateProjectCategory[]> {
  return getCategories();
}

export async function saveCategory(form: RealEstateProjectCategoryForm): Promise<RealEstateProjectCategory> {
  if (!form.category_name.trim()) throw new Error('Category name is required.');
  return repoCreateCategory(form);
}

export async function editCategory(id: string, form: Partial<RealEstateProjectCategoryForm>): Promise<RealEstateProjectCategory> {
  return updateCategory(id, form);
}

export async function removeCategory(id: string): Promise<void> {
  await deleteCategory(id);
}

export async function loadProjects(): Promise<RealEstateProject[]> {
  return getProjects();
}

function validateProjectForm(form: RealEstateProjectForm): void {
  if (!form.project_name.trim()) throw new Error('Project name is required.');
}

export async function saveProject(form: RealEstateProjectForm): Promise<RealEstateProject> {
  validateProjectForm(form);
  return repoCreateProject(form);
}

export async function editProject(id: string, form: Partial<RealEstateProjectForm>): Promise<RealEstateProject> {
  if (!id) throw new Error('Invalid project ID.');
  return updateProject(id, form);
}

export async function removeProject(id: string): Promise<void> {
  await deleteProject(id);
}

export async function loadBrochuresForProject(projectId: string): Promise<RealEstateProjectBrochure[]> {
  return getBrochuresForProject(projectId);
}

export async function loadAllBrochures(): Promise<RealEstateProjectBrochure[]> {
  return getAllBrochures();
}

export async function addBrochure(projectId: string, title: string, file: File): Promise<RealEstateProjectBrochure> {
  if (!title.trim()) throw new Error('Brochure title is required.');
  const fileUrl = await uploadProjectBrochure(file, projectId);
  return repoCreateBrochure({ project_id: projectId, title: title.trim(), file_url: fileUrl });
}

/**
 * Adds a brochure using a direct link (e.g. Google Drive) instead of
 * uploading a file — useful for large PDFs that don't need to live in
 * our own storage. The employee-facing Download button works exactly
 * the same either way, since both just store a real file_url.
 */
export async function addBrochureLink(projectId: string, title: string, url: string): Promise<RealEstateProjectBrochure> {
  if (!title.trim()) throw new Error('Brochure title is required.');
  if (!url.trim()) throw new Error('Link is required.');
  return repoCreateBrochure({ project_id: projectId, title: title.trim(), file_url: url.trim() });
}

export async function removeBrochure(id: string): Promise<void> {
  await deleteBrochure(id);
}

export async function uploadThumbnail(file: File, projectId: string): Promise<string> {
  return uploadProjectThumbnail(file, projectId);
}

/** Used by the rich text editor to upload an image dropped inline into
 * the description — reuses the same real storage bucket/folder as
 * thumbnails, just a distinct random name so nothing collides. */
export async function uploadInlineImage(file: File): Promise<string> {
  return uploadProjectThumbnail(file, `inline-${Date.now()}-${Math.round(Math.random() * 10000)}`);
}

// ── Sections (Page / Test / FAQ) ────────────────────────────────────────────────

export async function loadSectionsForProject(projectId: string): Promise<RealEstateProjectSection[]> {
  return getSectionsForProject(projectId);
}

export async function loadAllSections(): Promise<RealEstateProjectSection[]> {
  return getAllSections();
}

function validateSectionForm(form: RealEstateProjectSectionForm): void {
  if (!form.project_id) throw new Error('Project is required.');
  if (!form.title.trim()) throw new Error('Subject line is required.');
  if (form.section_type === 'test' && !form.assessment_id) {
    throw new Error('Choose an assessment for this test section.');
  }
}

export async function saveSection(form: RealEstateProjectSectionForm): Promise<RealEstateProjectSection> {
  validateSectionForm(form);
  return repoCreateSection(form);
}

export async function editSection(id: string, form: Partial<RealEstateProjectSectionForm>): Promise<RealEstateProjectSection> {
  if (!id) throw new Error('Invalid section ID.');
  return updateSection(id, form);
}

export async function removeSection(id: string): Promise<void> {
  await deleteSection(id);
}
