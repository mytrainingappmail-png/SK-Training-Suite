// src/types/realEstateProject.ts
//
// A genuinely separate content type from Course — a Project is just
// browsable reference material (a property/developer briefing).
// No pass percentage, no duration gating, no certificate — an
// employee can read it whenever they like, as many times as they like.

export interface RealEstateProjectCategory {
  id: string;
  company_id: string;
  category_name: string;
  description: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RealEstateProjectCategoryForm = Omit<RealEstateProjectCategory, 'id' | 'created_at' | 'updated_at'>;

export interface RealEstateProjectBrochure {
  id: string;
  project_id: string;
  title: string;
  file_url: string;
  created_at: string;
}

export type RealEstateProjectBrochureForm = Omit<RealEstateProjectBrochure, 'id' | 'created_at'>;

export interface RealEstateProject {
  id: string;
  company_id: string;
  category_id: string;
  project_name: string;
  short_description: string;
  full_description: string;
  thumbnail_url: string;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type RealEstateProjectForm = Omit<RealEstateProject, 'id' | 'created_at' | 'updated_at'>;

export const defaultRealEstateProjectForm: RealEstateProjectForm = {
  company_id: '',
  category_id: '',
  project_name: '',
  short_description: '',
  full_description: '',
  thumbnail_url: '',
  active: true,
  display_order: 0,
};
