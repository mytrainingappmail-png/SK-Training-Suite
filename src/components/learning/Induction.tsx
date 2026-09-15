// src/components/learning/Induction.tsx
//
// Employee-facing Induction — a card grid (same visual language as
// Projects, via the shared ThumbnailCard) of a SEQUENTIAL day-by-day
// onboarding program. Day N+1 requires, in order:
//   1. Day N marked complete (an explicit "I've read this" attestation)
//   2. Day N's Test (if it has one) passed — attempts are governed by
//      that Test's own Assessment.maximum_attempts, set in Admin →
//      Assessments, same as everywhere else in the app
//   3. Today's calendar date has reached the day AFTER Day N was
//      completed — so passing every test back-to-back in one sitting
//      still can't unlock more than one new Day per calendar day.

import { useEffect, useState } from 'react';
import {
  loadDays, loadAllSections, loadCompletions, markComplete, loadMyAssignment,
} from '../../services/induction/inductionService';
import { getPassedTestIds } from '../../services/induction/inductionProgressService';
import { getCurrentUser } from '../../services/auth/session';
import { resolveForBranch } from '../../utils/branchScoping';
import { isDateUnlocked, nextUnlockDate, formatUnlockDate } from '../../utils/inductionDateGate';
import SectionHeroBanner from './SectionHeroBanner';
import ThumbnailCard from '../shared/ThumbnailCard';
import AssessmentPlayer from '../assessment/AssessmentPlayer';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import type { InductionDay, InductionDaySection, InductionDayCompletion } from '../../types/induction';

function IconLock({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>);
}
function IconClock({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}
function IconCheck({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>);
}
function IconArrowLeft({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>);
}
function IconChevron({ className = 'h-4 w-4', open }: { className?: string; open: boolean }) {
  return (<svg className={`${className} transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>);
}

type DayStatus = 'completed' | 'available' | 'date-locked' | 'locked';

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />)}
    </div>
  );
}

function Induction() {
  const user = getCurrentUser();
  const [hasAssignment, setHasAssignment] = useState<boolean | null>(null);
  const [days, setDays] = useState<InductionDay[]>([]);
  const [sectionsByDay, setSectionsByDay] = useState<Record<string, InductionDaySection[]>>({});
  const [completions, setCompletions] = useState<InductionDayCompletion[]>([]);
  const [passedTestIds, setPassedTestIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [activeTestAssessmentId, setActiveTestAssessmentId] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 3200);
  }

  function toggleKey(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function loadEverything() {
    if (!user?.id) { setError('No active session.'); setLoading(false); return; }
    setLoading(true);
    setError('');
    Promise.all([loadMyAssignment(user.id), loadDays(), loadAllSections(), loadCompletions(user.id)])
      .then(async ([assignment, allDays, allSections, comps]) => {
        setHasAssignment(!!assignment && assignment.status === 'active');
        const scoped = resolveForBranch(allDays, user.branchId || null);
        const active = scoped.filter((d) => d.active).sort((a, b) => a.display_order - b.display_order);
        setDays(active);
        const grouped: Record<string, InductionDaySection[]> = {};
        for (const s of allSections) {
          if (!grouped[s.day_id]) grouped[s.day_id] = [];
          grouped[s.day_id].push(s);
        }
        for (const key of Object.keys(grouped)) grouped[key].sort((a, b) => a.display_order - b.display_order);
        setSectionsByDay(grouped);
        setCompletions(comps);

        const testAssessmentIds = allSections.filter((s) => s.section_type === 'test' && s.assessment_id).map((s) => s.assessment_id!);
        const passed = await getPassedTestIds(user.id, testAssessmentIds);
        setPassedTestIds(passed);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load induction.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadEverything(); }, [user?.id]);

  const completionByDay = new Map(completions.map((c) => [c.day_id, c.completed_at]));

  function dayStatus(index: number): DayStatus {
    const day = days[index];
    if (completionByDay.has(day.id)) return 'completed';
    if (index === 0) return 'available';

    const prevDay = days[index - 1];
    const prevCompletedAt = completionByDay.get(prevDay.id);
    if (!prevCompletedAt) return 'locked';

    const prevTest = (sectionsByDay[prevDay.id] ?? []).find((s) => s.section_type === 'test');
    if (prevTest?.assessment_id && !passedTestIds.has(prevTest.assessment_id)) return 'locked';

    if (!isDateUnlocked(prevCompletedAt)) return 'date-locked';
    return 'available';
  }

  function handleDayClick(index: number) {
    const status = dayStatus(index);
    if (status === 'completed' || status === 'available') {
      setOpenDayId(days[index].id);
      return;
    }
    if (status === 'date-locked') {
      const prevCompletedAt = completionByDay.get(days[index - 1].id)!;
      showToast(`Day ${index + 1} unlocks on ${formatUnlockDate(nextUnlockDate(prevCompletedAt))} — one new day at a time, so it actually sinks in.`);
      return;
    }
    showToast(`Complete Day ${index} first to unlock Day ${index + 1}.`);
  }

  async function handleMarkComplete(dayId: string) {
    if (!user?.id || !user.companyId) return;
    setMarking(true);
    try {
      await markComplete(dayId, user.id, user.companyId);
      loadEverything();
    } finally {
      setMarking(false);
    }
  }

  function handleFinishTest() {
    setActiveTestAssessmentId(null);
    loadEverything();
  }

  const openDay = days.find((d) => d.id === openDayId) ?? null;
  const openDayIndex = days.findIndex((d) => d.id === openDayId);
  const openSections = openDay ? (sectionsByDay[openDay.id] ?? []) : [];
  const openCompleted = openDay ? completionByDay.has(openDay.id) : false;

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeroBanner title="Induction" subtitle="Your day-by-day onboarding program." statLabel="Days" statValue={days.length} />
        <Skeleton />
      </div>
    );
  }

  if (hasAssignment === false) {
    return (
      <div className="space-y-6">
        <SectionHeroBanner title="Induction" subtitle="Your day-by-day onboarding program." statLabel="Days" statValue={0} />
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center text-slate-400">
          You're not currently assigned to an Induction program.
        </div>
      </div>
    );
  }

  if (openDay) {
    const dayNumber = openDayIndex + 1;
    return (
      <>
        <button onClick={() => setOpenDayId(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
          <IconArrowLeft className="h-3.5 w-3.5" /> Back to Induction
        </button>

        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
          <div
            className="relative bg-gradient-to-r from-indigo-500 to-violet-500 px-8 py-8 text-white"
            style={openDay.thumbnail_url ? { backgroundImage: `linear-gradient(rgba(79,70,229,.75), rgba(124,58,237,.8)), url(${openDay.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs font-bold">DAY {dayNumber}</span>
            <h2 className="mt-3 text-2xl font-bold">{openDay.title}</h2>
            {openDay.description && <p className="mt-1 text-sm text-white/80">{openDay.description}</p>}
          </div>

          <div className="space-y-5 p-8">
            {openSections.length === 0 && <p className="text-sm text-slate-400">No content added for this day yet.</p>}

            {openSections.map((section) => {
              if (section.section_type === 'page') {
                const key = `page-${section.id}`;
                return (
                  <div key={section.id}>
                    <button onClick={() => toggleKey(key)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:underline">
                      <IconChevron className="h-3.5 w-3.5" open={openKeys.has(key)} /> {section.title}
                    </button>
                    {openKeys.has(key) && (
                      <div
                        className="prose prose-sm mt-2 max-w-none rounded-xl bg-slate-50 p-4 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.page_content) }}
                      />
                    )}
                  </div>
                );
              }

              if (section.section_type === 'faq') {
                return (
                  <div key={section.id}>
                    <p className="mb-2 text-sm font-semibold text-slate-700">{section.title}</p>
                    <div className="space-y-2">
                      {section.faq_items.map((item, i) => {
                        const key = `faq-${section.id}-${i}`;
                        return (
                          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <button onClick={() => toggleKey(key)} className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-slate-800">
                              {item.question}
                              <IconChevron className="h-3.5 w-3.5 flex-shrink-0" open={openKeys.has(key)} />
                            </button>
                            {openKeys.has(key) && <p className="mt-2 text-sm text-slate-600">{item.answer}</p>}
                          </div>
                        );
                      })}
                      {section.faq_items.length === 0 && <p className="text-xs text-slate-400">No questions added yet.</p>}
                    </div>
                  </div>
                );
              }

              // section_type === 'test'
              const passed = section.assessment_id ? passedTestIds.has(section.assessment_id) : false;
              return (
                <div key={section.id} className={`flex items-center justify-between gap-3 rounded-xl p-4 ${openCompleted ? 'bg-amber-50' : 'bg-slate-100'}`}>
                  <div>
                    <p className={`text-sm font-semibold ${openCompleted ? 'text-amber-900' : 'text-slate-500'}`}>
                      {openCompleted ? (passed ? '✅ ' : '') : '🔒 '}{section.title}
                    </p>
                    <p className={`text-xs ${openCompleted ? 'text-amber-700' : 'text-slate-400'}`}>
                      {!openCompleted ? 'Mark this day complete above to unlock the test.' : passed ? 'Passed — the next day unlocks tomorrow.' : `Pass this test, then Day ${dayNumber + 1} opens the day after.`}
                    </p>
                  </div>
                  {section.assessment_id && (
                    <button
                      onClick={() => openCompleted && setActiveTestAssessmentId(section.assessment_id!)}
                      disabled={!openCompleted}
                      className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-95 ${
                        openCompleted ? 'bg-amber-500 text-white hover:bg-amber-600' : 'cursor-not-allowed bg-slate-200 text-slate-400'
                      }`}
                    >
                      {!openCompleted ? 'Locked' : passed ? 'Retake Test' : 'Take Test'}
                    </button>
                  )}
                </div>
              );
            })}

            {!openCompleted && (
              <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-4 text-center">
                <p className="mb-3 text-sm font-medium text-indigo-900">Read through this day's material, then mark it complete.</p>
                <button
                  onClick={() => handleMarkComplete(openDay.id)}
                  disabled={marking}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {marking ? 'Marking…' : '✓ Mark Day Complete'}
                </button>
              </div>
            )}
          </div>
        </div>

        {activeTestAssessmentId && user?.id && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
              <AssessmentPlayer assessmentId={activeTestAssessmentId} employeeId={user.id} onFinish={handleFinishTest} />
            </div>
          </div>
        )}

        {toast && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeroBanner title="Induction" subtitle="Your day-by-day onboarding program — one day at a time." statLabel="Days" statValue={days.length} />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>}

      {!error && days.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center text-slate-400">
          No induction days have been added yet.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((day, i) => {
          const status = dayStatus(i);
          return (
            <ThumbnailCard
              key={day.id}
              title={`Day ${i + 1}: ${day.title}`}
              subtitle={day.description || undefined}
              thumbnailUrl={day.thumbnail_url}
              onClick={() => handleDayClick(i)}
              cornerTag={
                status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-white"><IconCheck className="h-3 w-3" /> Completed</span>
                ) : status === 'date-locked' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-bold text-white">
                    <IconClock className="h-3 w-3" /> Opens {formatUnlockDate(nextUnlockDate(completionByDay.get(days[i - 1]?.id ?? '') ?? ''))}
                  </span>
                ) : status === 'locked' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-[11px] font-bold text-white"><IconLock className="h-3 w-3" /> Locked</span>
                ) : null
              }
            >
              {status !== 'completed' && status !== 'available' && (
                <p className="text-xs text-slate-400">
                  {status === 'date-locked' ? 'Come back tomorrow to continue.' : `Complete Day ${i} first.`}
                </p>
              )}
            </ThumbnailCard>
          );
        })}
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  );
}

export default Induction;
