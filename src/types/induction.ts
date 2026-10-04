// A simple, standalone day-by-day onboarding program for new employees —
// deliberately modeled on RealEstateProject (flat, no categories, no
// learning-path machinery). A Day is like a Project; each Day has
// Page/Test sections exactly like a Project's sections.

// When an employee may open a Day (admin chooses, day by day):
//   next_day       — after the previous Day was completed on an EARLIER date (the original behaviour)
//   after_previous — right after the previous Day is completed and its test passed, no waiting
//   anytime        — open from the start, no conditions at all
export type InductionUnlockMode = 'next_day' | 'after_previous' | 'anytime';

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
  unlock_mode: InductionUnlockMode;
  // The label before the title: null = automatic ("Day 1", "Day 2"…), '' = none, any text = as typed.
  day_label: string | null;
  // A standalone part (company overview…): always open, outside the day-by-day order, not numbered.
  standalone: boolean;
  // Limited to certain locations (city keys, see constants/locations): null / empty = shown to everyone.
  locations: string[] | null;
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
  unlock_mode: 'next_day',
  day_label: null,
  standalone: false,
  locations: null,
  branch_id: null,
  source_id: null,
};

export type InductionSectionType = 'page' | 'test' | 'faq' | 'projects' | 'acknowledge' | 'feedback' | 'task' | 'contact';

// How much a card matters for finishing its day: none = optional, open = must be opened, complete = must be filled in.
export type InductionRequirement = 'none' | 'open' | 'complete';

export type FeedbackQuestionType = 'stars' | 'scale' | 'text' | 'yesno' | 'choice';
export interface FeedbackQuestion {
  id: string;
  type: FeedbackQuestionType;
  label: string;
  required: boolean;
  /** stars: 3-10 stars; scale: 1 to this number (default 5 / 10) */
  max?: number;
  low_label?: string;
  high_label?: string;
  /** choice: the options to pick from */
  options?: string[];
}

// Settings of the newer card kinds — everything is optional and every wording is the admin's own.
export interface InductionCardConfig {
  // acknowledge
  checkbox_label?: string;
  button_label?: string;
  // feedback
  intro?: string;
  thanks?: string;
  anonymous?: boolean;
  questions?: FeedbackQuestion[];
  // task
  allow_text?: boolean;
  allow_link?: boolean;
  allow_file?: boolean;
  must_be_approved?: boolean;
  submit_label?: string;
  // contact (the picture is the card picture)
  name?: string;
  role?: string;
  phone?: string;
  whatsapp?: string;
  note?: string;
}

export type InductionResponseKind = 'acknowledge' | 'feedback' | 'task';
export type InductionResponseStatus = 'submitted' | 'approved' | 'needs_work';

// What an employee submitted for an acknowledgment / feedback / task card (one per card per employee).
export interface InductionCardResponse {
  id: string;
  company_id: string;
  section_id: string;
  employee_id: string;
  kind: InductionResponseKind;
  response: Record<string, unknown>;
  status: InductionResponseStatus;
  reviewer_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

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
  // Settings of acknowledgment / feedback / task / contact cards.
  config: InductionCardConfig;
  // Is this card needed to finish the day?
  requirement: InductionRequirement;
  // Only for a "Focused projects" section: which projects it shows (in this order).
  project_ids: string[] | null;
  // The card picture shown to the employee for this section (null = a colourful default).
  thumbnail_url: string | null;
  // Limited to certain locations (city keys): null / empty = shown to everyone.
  locations: string[] | null;
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
  config: {},
  requirement: 'open',
  project_ids: null,
  thumbnail_url: null,
  locations: null,
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
