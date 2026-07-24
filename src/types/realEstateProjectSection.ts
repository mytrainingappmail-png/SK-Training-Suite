export type ProjectSectionType = 'page' | 'test' | 'faq';

export interface ProjectSectionFaqItem {
  question: string;
  answer: string;
}

export interface RealEstateProjectSection {
  id: string;
  company_id: string;
  project_id: string;
  section_type: ProjectSectionType;
  title: string;
  display_order: number;
  page_content: string;
  assessment_id: string | null;
  faq_items: ProjectSectionFaqItem[];
  created_at: string;
  updated_at: string;
}

export type RealEstateProjectSectionForm = Omit<
  RealEstateProjectSection,
  'id' | 'created_at' | 'updated_at'
>;

export const defaultProjectSectionForm: RealEstateProjectSectionForm = {
  company_id: '',
  project_id: '',
  section_type: 'page',
  title: '',
  display_order: 0,
  page_content: '',
  assessment_id: null,
  faq_items: [],
};
