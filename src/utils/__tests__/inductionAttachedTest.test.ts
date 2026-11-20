import { describe, expect, it } from 'vitest';
import { attachedTestRequired, cardDone, hasAttachedTest } from '../inductionCards';
import type { InductionDaySection } from '../../types/induction';

const page = (over: Partial<InductionDaySection> = {}): InductionDaySection => ({
  id: 's1', company_id: 'c', day_id: 'd', section_type: 'page', title: 'Read', display_order: 0, page_content: '', assessment_id: null,
  faq_items: [], config: {}, requirement: 'open', project_ids: null, thumbnail_url: null, locations: null,
  watermark_enabled: false, watermark_text: null, watermark_orientation: 'diagonal', watermark_opacity: 12, no_copy: false,
  created_at: '', updated_at: '', ...over,
});

describe('a reading card with its own test', () => {
  it('has no attached test unless it is a page card with an assessment', () => {
    expect(hasAttachedTest(page())).toBe(false);
    expect(hasAttachedTest(page({ assessment_id: 'a1' }))).toBe(true);
    expect(hasAttachedTest(page({ section_type: 'test', assessment_id: 'a1' }))).toBe(false);
  });

  it('makes the test required by default, unless the admin switched it off or the card is optional', () => {
    expect(attachedTestRequired(page({ assessment_id: 'a1' }))).toBe(true);
    expect(attachedTestRequired(page({ assessment_id: 'a1', config: { test_required: false } }))).toBe(false);
    expect(attachedTestRequired(page({ assessment_id: 'a1', requirement: 'none' }))).toBe(false);
    expect(attachedTestRequired(page())).toBe(false);
  });

  it('counts the card as done only after the test is passed when the test is required', () => {
    const s = page({ assessment_id: 'a1' });
    expect(cardDone(s, true, undefined, false)).toBe(false);
    expect(cardDone(s, true, undefined, true)).toBe(true);
    expect(cardDone(s, false, undefined, true)).toBe(false); // still has to be opened
  });

  it('ignores an optional test and plain cards behave exactly as before', () => {
    expect(cardDone(page({ assessment_id: 'a1', config: { test_required: false } }), true, undefined, false)).toBe(true);
    expect(cardDone(page(), true)).toBe(true);
    expect(cardDone(page(), false)).toBe(false);
  });
});
