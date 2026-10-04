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

import { useEffect, useRef, useState } from 'react';
import {
  loadDays, loadAllSections, loadCompletions, markComplete, loadMyAssignment, loadViewedSectionIds, recordSectionViewed, loadMyLocationKey,
} from '../../services/induction/inductionService';
import { getPassedTestIds } from '../../services/induction/inductionProgressService';
import { getMyCardResponses, saveMyCardResponse } from '../../repositories/induction/inductionCardRepository';
import { getMyInductionCertificate } from '../../repositories/induction/inductionSettingsRepository';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '../../services/auth/session';
import { resolveForBranch } from '../../utils/branchScoping';
import { visibleInLocation } from '../../constants/locations';
import { isDateUnlocked, nextUnlockDate, formatUnlockDate } from '../../utils/inductionDateGate';
import SectionHeroBanner from './SectionHeroBanner';
import ThumbnailCard from '../shared/ThumbnailCard';
import AssessmentPlayer from '../assessment/AssessmentPlayer';
import InductionDayView from './InductionDayView';
import { dayLabels, isStandaloneDay, nextInOrder, previousInOrder, refName, withLabel } from '../../utils/inductionDayLabel';
import type { InductionDay, InductionDaySection, InductionDayCompletion, InductionCardResponse, InductionResponseKind } from '../../types/induction';

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
  const [responses, setResponses] = useState<Record<string, InductionCardResponse>>({});
  const [certificate, setCertificate] = useState<{ id: string; title: string; number: string } | null>(null);
  const certKnown = useRef<boolean | null>(null);
  const [assignmentDone, setAssignmentDone] = useState(false);
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
    Promise.all([loadMyAssignment(user.id), loadDays(), loadAllSections(), loadCompletions(user.id), loadViewedSectionIds(user.id), loadMyLocationKey(user.branchId || null), getMyCardResponses(user.id).catch(() => [] as InductionCardResponse[]), getMyInductionCertificate(user.id).catch(() => null)])
      .then(async ([assignment, allDays, allSectionsRaw, comps, viewed, myLocation, myResponses, myCertificate]) => {
        setResponses(Object.fromEntries(myResponses.map((r) => [r.section_id, r])));
        setCertificate(myCertificate);
        if (certKnown.current === false && myCertificate) showToast('🎉 Induction complete — your certificate is ready!');
        certKnown.current = !!myCertificate;
        // Days and sections limited to other locations are simply not there for this employee.
        const allSections = allSectionsRaw.filter((s) => visibleInLocation(s.locations, myLocation));
        setViewedIds(new Set(viewed));
        setHasAssignment(!!assignment && assignment.status === 'active');
        setAssignmentDone(!!assignment && assignment.status === 'completed');
        const scoped = resolveForBranch(allDays, user.branchId || null);
        const active = scoped
          .filter((d) => d.active && visibleInLocation(d.locations, myLocation))
          // A day whose every section is for other locations has nothing left to show this employee.
          .filter((d) => !allSectionsRaw.some((s) => s.day_id === d.id) || allSections.some((s) => s.day_id === d.id))
          .sort((a, b) => a.display_order - b.display_order);
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
  // The admin decides each day's label ("Day 1", "Day 0", none…); see utils/inductionDayLabel.
  const labels = dayLabels(days);
  const nameOf = (i: number) => (days[i] ? refName(labels[i], days[i].title) : 'the next day');

  function dayStatus(index: number): DayStatus {
    const day = days[index];
    if (completionByDay.has(day.id)) return 'completed';
    // A standalone part (no label, e.g. a company overview) is always open and outside the day-by-day order.
    if (isStandaloneDay(day)) return 'available';
    // The admin chooses, day by day, how a Day opens (see InductionUnlockMode).
    if (day.unlock_mode === 'anytime') return 'available';
    // The first day IN THE ORDER is open from the start; later ones follow the previous day in the order.
    const prevIndex = previousInOrder(days, index);
    if (prevIndex < 0) return 'available';

    const prevDay = days[prevIndex];
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
      const prevCompletedAt = completionByDay.get(days[previousInOrder(days, index)].id)!;
      showToast(`${nameOf(index)} unlocks on ${formatUnlockDate(nextUnlockDate(prevCompletedAt))} — one new day at a time, so it actually sinks in.`);
      return;
    }
    showToast(`Complete ${nameOf(previousInOrder(days, index))} first to unlock ${nameOf(index)}.`);
  }

  // Opening a card is remembered, so 'Mark Day Complete' only unlocks once every reading card was opened.
  function handleOpenSection(section: InductionDaySection) {
    if (!user?.id) return;
    setViewedIds((prev) => (prev.has(section.id) ? prev : new Set(prev).add(section.id)));
    if (!viewedIds.has(section.id)) void recordSectionViewed(section.id, user.id).catch(() => undefined);
  }

  // An acknowledgment / feedback / task answer is saved right away and counts toward finishing the day.
  async function handleSubmitResponse(section: InductionDaySection, payload: Record<string, unknown>) {
    if (!user?.id || !user.companyId) throw new Error('No active session.');
    const saved = await saveMyCardResponse({
      sectionId: section.id, employeeId: user.id, companyId: user.companyId,
      kind: section.section_type as InductionResponseKind, response: payload,
    });
    setResponses((prev) => ({ ...prev, [section.id]: saved }));
    showToast(section.section_type === 'task' ? 'Sent.' : 'Saved — thank you.');
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
        <SectionHeroBanner title="Induction" subtitle="Your day-by-day onboarding program." statLabel="Days" statValue={assignmentDone ? days.length : 0} />
        {certificate && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800">🎉 You have completed the induction! Your certificate “{certificate.title}” is ready.</p>
            <Link to={`/learning/certificate/${certificate.id}`} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">View certificate</Link>
          </div>
        )}
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center text-slate-400">
          {assignmentDone ? 'You have completed your Induction program. Well done!' : "You're not currently assigned to an Induction program."}
        </div>
        {toast && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
      </div>
    );
  }

  if (openDay) {
    return (
      <>
        <InductionDayView
          day={openDay}
          dayLabel={labels[openDayIndex] ?? ''}
          nextName={nameOf(isStandaloneDay(openDay) ? -1 : nextInOrder(days, openDayIndex))}
          nextDay={isStandaloneDay(openDay) ? undefined : days[nextInOrder(days, openDayIndex)]}
          sections={openSections}
          viewedIds={viewedIds}
          completed={openCompleted}
          passedTestIds={passedTestIds}
          responses={responses}
          onSubmitResponse={handleSubmitResponse}
          marking={marking}
          onBack={() => setOpenDayId(null)}
          onOpenSection={handleOpenSection}
          onMarkComplete={() => handleMarkComplete(openDay.id)}
          onStartTest={setActiveTestAssessmentId}
          showToast={showToast}
        />

        {activeTestAssessmentId && user?.id && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-0 backdrop-blur-sm sm:p-4">
            <div className="mx-auto max-w-4xl rounded-none bg-white p-0 shadow-2xl sm:rounded-2xl sm:p-6">
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

      {certificate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">🎉 You have completed the induction! Your certificate “{certificate.title}” is ready.</p>
          <Link to={`/learning/certificate/${certificate.id}`} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">View certificate</Link>
        </div>
      )}

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
              title={withLabel(labels[i], day.title)}
              subtitle={day.description || undefined}
              thumbnailUrl={day.thumbnail_url}
              onClick={() => handleDayClick(i)}
              cornerTag={
                status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-white"><IconCheck className="h-3 w-3" /> Completed</span>
                ) : status === 'date-locked' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-bold text-white">
                    <IconClock className="h-3 w-3" /> Opens {formatUnlockDate(nextUnlockDate(completionByDay.get(days[previousInOrder(days, i)]?.id ?? '') ?? ''))}
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
                  {status === 'date-locked' ? 'Come back tomorrow to continue.' : `Complete ${nameOf(previousInOrder(days, i))} first.`}
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
