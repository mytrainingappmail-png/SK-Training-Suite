// One Induction Day as the employee sees it: a grid of CARDS, one per section (page / FAQ / test),
// each with its own thumbnail. Opening a card shows that section on its own page — nothing is piled
// onto one long page. "Mark Day Complete" only unlocks once every reading card has been opened.
//
// Used by the employee's Induction screen and by the owner's/admin's "Preview" (preview = nothing is
// saved, nothing is locked by anyone else's progress).

import { useState } from 'react';
import ThumbnailCard from '../shared/ThumbnailCard';
import ContentWatermark, { noCopyProps } from '../shared/ContentWatermark';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import type { InductionDay, InductionDaySection } from '../../types/induction';

function IconArrowLeft({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>);
}
function IconChevron({ className = 'h-4 w-4', open }: { className?: string; open: boolean }) {
  return (<svg className={`${className} transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>);
}

/** What the test card says about the NEXT day, according to how the admin set that day to open. */
function afterTestNote(nextDay: InductionDay | undefined, passed: boolean, nextNumber: number): string {
  if (!nextDay) return passed ? 'Passed — well done!' : 'Pass this test to finish the induction.';
  if (nextDay.unlock_mode === 'anytime') return passed ? 'Passed — well done!' : 'Pass this test to complete this day.';
  if (nextDay.unlock_mode === 'after_previous') return passed ? 'Passed — the next day is open now.' : `Pass this test to open Day ${nextNumber}.`;
  return passed ? 'Passed — the next day opens on the next date.' : `Pass this test, then Day ${nextNumber} opens on the next date.`;
}

const TYPE_LABEL: Record<string, string> = { page: 'Reading', faq: 'Questions & answers', test: 'Test' };

interface InductionDayViewProps {
  day: InductionDay;
  dayNumber: number;
  nextDay?: InductionDay;
  sections: InductionDaySection[];
  viewedIds: Set<string>;
  completed: boolean;
  passedTestIds: Set<string>;
  marking?: boolean;
  /** Preview: nothing is saved and the buttons only say what they would do. */
  preview?: boolean;
  onBack: () => void;
  /** Called the first time a card is opened (the screen records it). */
  onOpenSection: (section: InductionDaySection) => void;
  onMarkComplete: () => void;
  onStartTest: (assessmentId: string) => void;
  showToast: (message: string) => void;
}

export default function InductionDayView({
  day, dayNumber, nextDay, sections, viewedIds, completed, passedTestIds, marking = false, preview = false,
  onBack, onOpenSection, onMarkComplete, onStartTest, showToast,
}: InductionDayViewProps) {
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<Set<number>>(new Set());

  const reading = sections.filter((s) => s.section_type !== 'test');
  const opened = reading.filter((s) => viewedIds.has(s.id)).length;
  const allOpened = opened >= reading.length;
  const openSection = sections.find((s) => s.id === openSectionId) ?? null;

  function openCard(s: InductionDaySection) {
    if (s.section_type === 'test') {
      if (!completed) { showToast('Open all the cards and mark the day complete to unlock the test.'); return; }
      if (!s.assessment_id) { showToast('This test has no questions yet.'); return; }
      if (preview) { showToast('Preview: the employee takes the test here. Nothing is recorded.'); return; }
      onStartTest(s.assessment_id);
      return;
    }
    setOpenFaq(new Set());
    setOpenSectionId(s.id);
    onOpenSection(s);
  }

  // ── One section on its own page ─────────────────────────────────────────────
  if (openSection) {
    const idx = sections.findIndex((s) => s.id === openSection.id);
    const next = sections.slice(idx + 1).find((s) => s.section_type !== 'test');
    return (
      <>
        <button onClick={() => setOpenSectionId(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
          <IconArrowLeft className="h-3.5 w-3.5" /> Back to Day {dayNumber}
        </button>
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div
            className="bg-gradient-to-r from-indigo-500 to-violet-500 px-8 py-7 text-white"
            style={openSection.thumbnail_url ? { backgroundImage: `linear-gradient(rgba(79,70,229,.78), rgba(124,58,237,.82)), url(${openSection.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs font-bold">DAY {dayNumber} · {idx + 1} OF {sections.length}</span>
            <h2 className="mt-3 text-2xl font-bold">{openSection.title}</h2>
          </div>
          <div className="p-8">
            {openSection.section_type === 'page' && (
              <div className="relative">
                <div
                  className="prose prose-sm max-w-none rounded-xl bg-slate-50 p-5 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(openSection.page_content) }}
                  {...noCopyProps(openSection.no_copy)}
                />
                <ContentWatermark config={{ enabled: openSection.watermark_enabled, text: openSection.watermark_text, orientation: openSection.watermark_orientation, opacity: openSection.watermark_opacity }} />
              </div>
            )}
            {openSection.section_type === 'faq' && (
              <div className="space-y-2">
                {openSection.faq_items.map((item, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <button
                      onClick={() => setOpenFaq((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                      className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-slate-800"
                    >
                      {item.question}
                      <IconChevron className="h-3.5 w-3.5 flex-shrink-0" open={openFaq.has(i)} />
                    </button>
                    {openFaq.has(i) && <p className="mt-2 text-sm text-slate-600">{item.answer}</p>}
                  </div>
                ))}
                {openSection.faq_items.length === 0 && <p className="text-xs text-slate-400">No questions added yet.</p>}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button onClick={() => setOpenSectionId(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                ← All cards
              </button>
              {next && (
                <button onClick={() => openCard(next)} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                  Next: {next.title} →
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── The Day: header + one card per section ──────────────────────────────────
  return (
    <>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
        <IconArrowLeft className="h-3.5 w-3.5" /> Back to Induction
      </button>

      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div
          className="relative bg-gradient-to-r from-indigo-500 to-violet-500 px-8 py-8 text-white"
          style={day.thumbnail_url ? { backgroundImage: `linear-gradient(rgba(79,70,229,.75), rgba(124,58,237,.8)), url(${day.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs font-bold">DAY {dayNumber}</span>
          <h2 className="mt-3 text-2xl font-bold">{day.title}</h2>
          {day.description && <p className="mt-1 text-sm text-white/80">{day.description}</p>}
          {reading.length > 0 && (
            <p className="mt-3 text-xs font-semibold text-white/90">{opened} of {reading.length} cards opened</p>
          )}
        </div>

        <div className="space-y-6 p-8">
          {sections.length === 0 && <p className="text-sm text-slate-400">No content added for this day yet.</p>}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((s, i) => {
              const isTest = s.section_type === 'test';
              const passed = isTest && s.assessment_id ? passedTestIds.has(s.assessment_id) : false;
              const seen = !isTest && viewedIds.has(s.id);
              return (
                <ThumbnailCard
                  key={s.id}
                  title={s.title}
                  subtitle={TYPE_LABEL[s.section_type] ?? undefined}
                  thumbnailUrl={s.thumbnail_url}
                  badge={<span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold text-white">{i + 1} / {sections.length}</span>}
                  cornerTag={
                    isTest ? (
                      passed
                        ? <span className="rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-white">✓ Passed</span>
                        : !completed
                        ? <span className="rounded-full bg-slate-800/80 px-2.5 py-1 text-[11px] font-bold text-white">🔒 Locked</span>
                        : <span className="rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-bold text-white">Test</span>
                    ) : seen ? (
                      <span className="rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-white">✓ Opened</span>
                    ) : null
                  }
                  onClick={() => openCard(s)}
                >
                  {isTest && (
                    <p className="text-xs text-slate-500">
                      {!completed ? 'Complete the day above to unlock.' : afterTestNote(nextDay, passed, dayNumber + 1)}
                    </p>
                  )}
                </ThumbnailCard>
              );
            })}
          </div>

          {!completed && (
            <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-4 text-center">
              <p className="mb-3 text-sm font-medium text-indigo-900">
                {allOpened
                  ? "You've opened everything for this day. Mark it complete to move on."
                  : `Open every card to finish this day — ${opened} of ${reading.length} opened.`}
              </p>
              <button
                onClick={onMarkComplete}
                disabled={marking || !allOpened}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {marking ? 'Marking…' : '✓ Mark Day Complete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
