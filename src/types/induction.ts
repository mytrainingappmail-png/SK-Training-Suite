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
  // null = shared across every branch (the default). Set = visible only
  // to employees in that one branch.
  branch_id: string | null;
  // Set only on a row created via "Clone to Branch" -- points back at the
  // generic (branch_id null) day it was cloned from, so the
  // employee-facing query can prefer this branch's own customized clone
  // over the generic version instead of showing both.
  source_id: string | null;
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
  branch_id: null,
  source_id: null,
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
