// A simple, standalone day-by-day onboarding program for new employees —
// deliberately modeled on RealEstateProject (flat, no categories, no
// learning-path machinery). A Day is like a Project; each Day has
// Page/Test sections exactly like a Project's sections.

export interface InductionDay {
  id: string;
  company_id: string;
  title: string;
  description: string;
  // Card thumbnail, shown in the employee grid — same shape/role as a
  // Project's thumbnail_url, so InductionDay cards can reuse ThumbnailCard.
  thumbnail_url: string | null;
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
  thumbnail_url: null,
  display_order: 0,
  active: true,
  branch_id: null,
  source_id: null,
};

export type InductionSectionType = 'page' | 'test' | 'faq';

export interface InductionFaqItem {
  question: string;
  answer: string;
}

export interface InductionDaySection {
  id: string;
  company_id: string;
  day_id: string;
  section_type: InductionSectionType;
  title: string;
  display_order: number;
  page_content: string;
  assessment_id: string | null;
  faq_items: InductionFaqItem[];
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

export type InductionDaySectionForm = Omit<InductionDaySection, 'id' | 'created_at' | 'updated_at'>;

export const defaultInductionDaySectionForm: InductionDaySectionForm = {
  company_id: '',
  day_id: '',
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

// One completed Day, with WHEN it was completed — the next Day's earliest
// unlock date is derived from this (see inductionDateGate.ts).
export interface InductionDayCompletion {
  day_id: string;
  completed_at: string;
}

export type InductionAssignmentStatus = 'active' | 'completed';

export interface InductionAssignment {
  id: string;
  company_id: string;
  employee_id: string;
  status: InductionAssignmentStatus;
  assigned_at: string;
  completed_at: string | null;
}
