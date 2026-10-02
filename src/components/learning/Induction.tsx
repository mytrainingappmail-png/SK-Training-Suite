// src/components/learning/Induction.tsx
//
// Employee-facing Induction — a card grid (same visual language as
// Projects, via the shared ThumbnailCard) of a day-by-day onboarding
// program. HOW each Day opens is chosen by the admin, day by day
// (induction_days.unlock_mode):
//   anytime        — open from the start, nothing required
//   after_previous — Day N+1 opens once Day N is marked complete ("I've read
//                    this") and Day N's Test (if any) is passed — attempts are
//                    governed by that Test's own Assessment.maximum_attempts
//   next_day       — as after_previous, AND today's calendar date must have
//                    reached the day after Day N was completed, so passing
//                    everything in one sitting can't unlock more than one new
//                    Day per date (the original behaviour, still the default)

import { useEffect, useState } from 'react';
import {
  loadDays, loadAllSections, loadCompletions, markComplete, loadMyAssignment, loadViewedSectionIds, recordSectionViewed,
} from '../../services/induction/inductionService';
import { getPassedTestIds } from '../../services/induction/inductionProgressService';
import { getCurrentUser } from '../../services/auth/session';
import { resolveForBranch } from '../../utils/branchScoping';
import { isDateUnlocked, nextUnlockDate, formatUnlockDate } from '../../utils/inductionDateGate';
import SectionHeroBanner from './SectionHeroBanner';
import ThumbnailCard from '../shared/ThumbnailCard';
import AssessmentPlayer from '../assessment/AssessmentPlayer';
import InductionDayView from './InductionDayView';
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
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [activeTestAssessmentId, setActiveTestAssessmentId] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 3200);
  }

  function loadEverything() {
    if (!user?.id) { setError('No active session.'); setLoading(false); return; }
    setLoading(true);
    setError('');
    Promise.all([loadMyAssignment(user.id), loadDays(), loadAllSections(), loadCompletions(user.id), loadViewedSectionIds(user.id)])
      .then(async ([assignment, allDays, allSections, comps, viewed]) => {
        setViewedIds(new Set(viewed));
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
    // The admin chooses, day by day, how a Day opens (see InductionUnlockMode).
    if (day.unlock_mode === 'anytime') return 'available';
    if (index === 0) return 'available';

    const prevDay = days[index - 1];
    const prevCompletedAt = completionByDay.get(prevDay.id);
    if (!prevCompletedAt) return 'locked';

    const prevTest = (sectionsByDay[prevDay.id] ?? []).find((s) => s.section_type === 'test');
    if (prevTest?.assessment_id && !passedTestIds.has(prevTest.assessment_id)) return 'locked';

    if (day.unlock_mode !== 'after_previous' && !isDateUnlocked(prevCompletedAt)) return 'date-locked';
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

  // Opening a card is remembered, so 'Mark Day Complete' only unlocks once every reading card was opened.
  function handleOpenSection(section: InductionDaySection) {
    if (!user?.id) return;
    setViewedIds((prev) => (prev.has(section.id) ? prev : new Set(prev).add(section.id)));
    if (!viewedIds.has(section.id)) void recordSectionViewed(section.id, user.id).catch(() => undefined);
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
        <InductionDayView
          day={openDay}
          dayNumber={dayNumber}
          nextDay={days[openDayIndex + 1]}
          sections={openSections}
          viewedIds={viewedIds}
          completed={openCompleted}
          passedTestIds={passedTestIds}
          marking={marking}
          onBack={() => setOpenDayId(null)}
          onOpenSection={handleOpenSection}
          onMarkComplete={() => handleMarkComplete(openDay.id)}
          onStartTest={setActiveTestAssessmentId}
          showToast={showToast}
        />

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
      <SectionHeroBanner title="Induction" subtitle="Your day-by-day onboarding program." statLabel="Days" statValue={days.length} />

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
                ) : day.unlock_mode === 'anytime' && i > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/90 px-2.5 py-1 text-[11px] font-bold text-white">Open anytime</span>
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
