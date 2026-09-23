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
  // Content protection — set only via the platform operator's own account (Admin UI hides
  // these for everyone else); survives being cloned to another company since a clone copies
  // every column of the source row.
  watermark_enabled: boolean;
  watermark_text: string | null;
  watermark_orientation: 'horizontal' | 'vertical' | 'diagonal';
  watermark_opacity: number;
  no_copy: boolean;
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
  watermark_enabled: false,
  watermark_text: '',
  watermark_orientation: 'diagonal',
  watermark_opacity: 12,
  no_copy: false,
};
