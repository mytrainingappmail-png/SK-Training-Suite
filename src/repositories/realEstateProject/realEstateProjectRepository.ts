// src/repositories/realEstateProject/realEstateProjectRepository.ts
//
// Repository layer — Supabase ONLY. Reuses the existing, real
// "course-content" storage bucket (already used elsewhere in the app)
// for thumbnail/brochure uploads — no new bucket needed.

import { supabase } from '../../lib/supabase';
import type {
  RealEstateProjectCategory,
  RealEstateProjectCategoryForm,
  RealEstateProject,
  RealEstateProjectForm,
  RealEstateProjectBrochure,
  RealEstateProjectBrochureForm,
} from '../../types/realEstateProject';
import type {
  RealEstateProjectSection,
  RealEstateProjectSectionForm,
} from '../../types/realEstateProjectSection';

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<RealEstateProjectCategory[]> {
  const { data, error } = await supabase
    .from('real_estate_project_categories')
    .select('*')
    .order('category_name', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCategory(form: RealEstateProjectCategoryForm): Promise<RealEstateProjectCategory> {
  const { data, error } = await supabase.from('real_estate_project_categories').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCategory(id: string, form: Partial<RealEstateProjectCategoryForm>): Promise<RealEstateProjectCategory> {
  const { data, error } = await supabase.from('real_estate_project_categories').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('real_estate_project_categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<RealEstateProject[]> {
  const { data, error } = await supabase
    .from('real_estate_projects')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProject(form: RealEstateProjectForm): Promise<RealEstateProject> {
  const { data, error } = await supabase.from('real_estate_projects').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProject(id: string, form: Partial<RealEstateProjectForm>): Promise<RealEstateProject> {
  const { data, error } = await supabase.from('real_estate_projects').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('real_estate_projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Brochures ─────────────────────────────────────────────────────────────────

export async function getBrochuresForProject(projectId: string): Promise<RealEstateProjectBrochure[]> {
  const { data, error } = await supabase
    .from('real_estate_project_brochures')
    .select('*')
    .eq('project_id', projectId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllBrochures(): Promise<RealEstateProjectBrochure[]> {
  const { data, error } = await supabase.from('real_estate_project_brochures').select('*');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBrochure(form: RealEstateProjectBrochureForm): Promise<RealEstateProjectBrochure> {
  const { data, error } = await supabase.from('real_estate_project_brochures').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBrochure(id: string): Promise<void> {
  const { error } = await supabase.from('real_estate_project_brochures').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Sections (Page / Test / FAQ) ────────────────────────────────────────────────

export async function getSectionsForProject(projectId: string): Promise<RealEstateProjectSection[]> {
  const { data, error } = await supabase
    .from('real_estate_project_sections')
    .select('*')
    .eq('project_id', projectId)
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllSections(): Promise<RealEstateProjectSection[]> {
  const { data, error } = await supabase
    .from('real_estate_project_sections')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSection(form: RealEstateProjectSectionForm): Promise<RealEstateProjectSection> {
  const { data, error } = await supabase.from('real_estate_project_sections').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSection(id: string, form: Partial<RealEstateProjectSectionForm>): Promise<RealEstateProjectSection> {
  const { data, error } = await supabase.from('real_estate_project_sections').update(form).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSection(id: string): Promise<void> {
  const { error } = await supabase.from('real_estate_project_sections').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Real file upload (thumbnail images + brochure PDFs) ────────────────────────
// Reuses the existing "course-content" public storage bucket, in its
// images/ and documents/ folders — the same bucket the rest of the app
// already uses, nothing new to configure.

export async function uploadProjectThumbnail(file: File, projectId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `images/projects/${projectId}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('course-content').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('course-content').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProjectBrochure(file: File, projectId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `documents/projects/${projectId}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('course-content').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('course-content').getPublicUrl(path);
  return data.publicUrl;
}
