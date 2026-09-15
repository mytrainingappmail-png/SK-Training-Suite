// src/services/induction/inductionService.ts
//
// Business logic — validation + orchestration, mirroring
// realEstateProjectService.ts's shape.

import {
  getDays, createDay, updateDay, deleteDay, getDay,
  getSectionsForDay, getAllSections, createSection, updateSection, deleteSection,
  getCompletionsForEmployee, markDayComplete,
  getAssignments, getMyAssignment, createAssignment, setAssignmentStatus, deleteAssignment,
} from '../../repositories/induction/inductionRepository';
import type {
  InductionDay, InductionDayForm,
  InductionDaySection, InductionDaySectionForm,
  InductionAssignment, InductionDayCompletion,
} from '../../types/induction';

export async function loadDays(): Promise<InductionDay[]> {
  return getDays();
}

function validateDayForm(form: InductionDayForm): void {
  if (!form.title.trim()) throw new Error('Day title is required.');
}

export async function saveDay(form: InductionDayForm): Promise<InductionDay> {
  validateDayForm(form);
  return createDay(form);
}

export async function editDay(id: string, form: Partial<InductionDayForm>): Promise<InductionDay> {
  if (!id) throw new Error('Invalid day ID.');
  return updateDay(id, form);
}

export async function removeDay(id: string): Promise<void> {
  await deleteDay(id);
}

// Reorders the flat Day list — same pattern as reorderProjects.
export async function reorderDays(ordered: InductionDay[]): Promise<void> {
  await Promise.all(ordered.map((d, i) => updateDay(d.id, { display_order: i + 1 })));
}

// Clones a generic Day (branch_id null) plus all its sections into a
// branch-specific copy, so an admin can then edit that copy's content
// (e.g. a different masterplan) without touching the shared original.
// The clone's source_id points back at the original — the employee-facing
// resolution (see src/utils/branchScoping.ts) uses that to prefer this
// branch's own copy over the generic one, never showing both.
export async function cloneDayToBranch(dayId: string, branchId: string, companyId: string): Promise<InductionDay> {
  const source = await getDay(dayId);
  if (!source) throw new Error('Day not found.');
  const sections = await getSectionsForDay(dayId);

  const cloned = await createDay({
    company_id: companyId,
    title: source.title,
    description: source.description,
    thumbnail_url: source.thumbnail_url,
    display_order: source.display_order,
    active: source.active,
    branch_id: branchId,
    source_id: source.id,
  });

  await Promise.all(
    sections.map((s) =>
      createSection({
        company_id: companyId,
        day_id: cloned.id,
        section_type: s.section_type,
        title: s.title,
        display_order: s.display_order,
        page_content: s.page_content,
        assessment_id: s.assessment_id,
        faq_items: s.faq_items,
      })
    )
  );

  return cloned;
}

export async function loadSectionsForDay(dayId: string): Promise<InductionDaySection[]> {
  return getSectionsForDay(dayId);
}

export async function loadAllSections(): Promise<InductionDaySection[]> {
  return getAllSections();
}

function validateSectionForm(form: InductionDaySectionForm): void {
  if (!form.day_id) throw new Error('Day is required.');
  if (!form.title.trim()) throw new Error('Section title is required.');
  if (form.section_type === 'test' && !form.assessment_id) {
    throw new Error('Choose an assessment for this test section.');
  }
}

export async function saveSection(form: InductionDaySectionForm): Promise<InductionDaySection> {
  validateSectionForm(form);
  return createSection(form);
}

export async function editSection(id: string, form: Partial<InductionDaySectionForm>): Promise<InductionDaySection> {
  if (!id) throw new Error('Invalid section ID.');
  return updateSection(id, form);
}

export async function removeSection(id: string): Promise<void> {
  await deleteSection(id);
}

export async function reorderSections(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await updateSection(orderedIds[i], { display_order: i });
  }
}

export async function loadCompletions(employeeId: string): Promise<InductionDayCompletion[]> {
  return getCompletionsForEmployee(employeeId);
}

export async function markComplete(dayId: string, employeeId: string, companyId: string): Promise<void> {
  await markDayComplete(dayId, employeeId, companyId);
}

// ── Assignments ───────────────────────────────────────────────────────────────

export async function loadAssignments(): Promise<InductionAssignment[]> {
  return getAssignments();
}

export async function loadMyAssignment(employeeId: string): Promise<InductionAssignment | null> {
  return getMyAssignment(employeeId);
}

export async function assignEmployee(companyId: string, employeeId: string): Promise<InductionAssignment> {
  return createAssignment(companyId, employeeId);
}

export async function markAssignmentComplete(id: string): Promise<InductionAssignment> {
  return setAssignmentStatus(id, 'completed');
}

export async function reactivateAssignment(id: string): Promise<InductionAssignment> {
  return setAssignmentStatus(id, 'active');
}

export async function removeAssignment(id: string): Promise<void> {
  await deleteAssignment(id);
}
