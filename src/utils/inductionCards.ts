// Rules shared by the employee's day screen, the admin preview and the admin editor for the
// acknowledgment / feedback / task / contact cards.

import type { FeedbackQuestion, InductionCardResponse, InductionDaySection, InductionRequirement } from '../types/induction';

/** Card kinds an employee fills in (and can therefore be "must complete"). */
export const COMPLETABLE_TYPES = new Set(['acknowledge', 'feedback', 'task']);

/** Card kinds that need the employee's answers stored. */
export function isFormCard(section: Pick<InductionDaySection, 'section_type'>): boolean {
  return COMPLETABLE_TYPES.has(section.section_type);
}

/** The card's real requirement: "must complete" only makes sense for cards that can be filled in. */
export function cardRequirement(section: Pick<InductionDaySection, 'section_type' | 'requirement'>): InductionRequirement {
  if (section.section_type === 'test') return 'open';
  const r = section.requirement ?? 'open';
  return r === 'complete' && !COMPLETABLE_TYPES.has(section.section_type) ? 'open' : r;
}

/** Has the employee done what this card asks (opened it / filled it in)? */
export function cardDone(section: InductionDaySection, opened: boolean, response?: InductionCardResponse): boolean {
  if (cardRequirement(section) !== 'complete') return opened;
  if (!response) return false;
  if (section.section_type === 'task') {
    return section.config?.must_be_approved ? response.status === 'approved' : response.status !== 'needs_work';
  }
  return true;
}

/** A starting point for an "after training" feedback form — every question can be changed or removed. */
export function standardFeedbackQuestions(): FeedbackQuestion[] {
  return [
    { id: 'q1', type: 'stars', label: 'How would you rate this training overall?', required: true, max: 5 },
    { id: 'q2', type: 'stars', label: 'How would you rate the trainer?', required: false, max: 5 },
    { id: 'q3', type: 'scale', label: 'How likely are you to recommend this training to a colleague?', required: true, max: 10, low_label: 'Not at all', high_label: 'Definitely' },
    { id: 'q4', type: 'text', label: 'What was good?', required: false },
    { id: 'q5', type: 'text', label: 'What was not good?', required: false },
    { id: 'q6', type: 'text', label: 'What should we improve?', required: false },
    { id: 'q7', type: 'yesno', label: 'Do you feel ready to start your work?', required: false },
  ];
}

export function newQuestionId(): string {
  return `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Digits only, for a wa.me link. */
export function whatsappLink(number: string | undefined): string | null {
  const digits = (number ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export const REQUIREMENT_LABEL: Record<InductionRequirement, string> = {
  none: 'Optional — not needed to finish the day',
  open: 'Must be opened',
  complete: 'Must be filled in / submitted',
};
