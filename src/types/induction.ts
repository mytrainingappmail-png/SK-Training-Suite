// A simple, standalone day-by-day onboarding program for new employees —
// deliberately modeled on RealEstateProject (flat, no categories, no
// learning-path machinery). A Day is like a Project; each Day has
// Page/Test sections exactly like a Project's sections.

export interface InductionDay {
  id: string;
  company_id: string;
  title: string;
  description: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type InductionDayForm = Omit<InductionDay, 'id' | 'created_at' | 'updated_at'>;

export const defaultInductionDayForm: InductionDayForm = {
  company_id: '',
  title: '',
  description: '',
  display_order: 0,
  active: true,
};

export type InductionSectionType = 'page' | 'test';

export interface InductionDaySection {
  id: string;
  company_id: string;
  day_id: string;
  section_type: InductionSectionType;
  title: string;
  display_order: number;
  page_content: string;
  assessment_id: string | null;
  created_at: string;
  updated_at: string;
}

export type InductionDaySectionForm = Omit<InductionDaySection, 'id' | 'created_at' | 'updated_at'>;

export const defaultInductionDaySectionForm: InductionDaySectionForm = {
  company_id: '',
  day_id: '',
  section_type: 'page',
  title: '',
  display_order: 0,
  page_content: '',
  assessment_id: null,
};

export type InductionAssignmentStatus = 'active' | 'completed';

export interface InductionAssignment {
  id: string;
  company_id: string;
  employee_id: string;
  status: InductionAssignmentStatus;
  assigned_at: string;
  completed_at: string | null;
}
