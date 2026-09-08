// src/components/learning/Induction.tsx
//
// Employee-facing Induction — a simple, SEQUENTIAL day-by-day onboarding
// program (unlike Projects, which is a flat, unordered list). Day N+1
// unlocks only once Day N is marked complete AND (if it has a Test
// section) that test has been passed — reusing the exact same
// completion/test-gating pattern as Projects, plus one more rule Projects
// doesn't need: strict day-order locking.

import { useEffect, useState } from 'react';
import {
  loadDays, loadAllSections, loadCompletedDayIds, markComplete, loadMyAssignment,
} from '../../services/induction/inductionService';
import { getPassedTestIds } from '../../services/induction/inductionProgressService';
import { getCurrentUser } from '../../services/auth/session';
import SectionHeroBanner from './SectionHeroBanner';
import AssessmentPlayer from '../assessment/AssessmentPlayer';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import type { InductionDay, InductionDaySection } from '../../types/induction';

function IconLock({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>);
}
function IconCheck({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>);
}
function IconArrowLeft({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>);
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
    </div>
  );
}

function Induction() {
  const user = getCurrentUser();
  const [hasAssignment, setHasAssignment] = useState<boolean | null>(null);
  const [days, setDays] = useState<InductionDay[]>([]);
  const [sectionsByDay, setSectionsByDay] = useState<Record<string, InductionDaySection[]>>({});
  const [completedDayIds, setCompletedDayIds] = useState<Set<string>>(new Set());
  const [passedTestIds, setPassedTestIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [activeTestAssessmentId, setActiveTestAssessmentId] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

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
    Promise.all([loadMyAssignment(user.id), loadDays(), loadAllSections(), loadCompletedDayIds(user.id)])
      .then(async ([assignment, allDays, allSections, completedIds]) => {
        setHasAssignment(!!assignment && assignment.status === 'active');
        const active = allDays.filter((d) => d.active).sort((a, b) => a.display_order - b.display_order);
        setDays(active);
        const grouped: Record<string, InductionDaySection[]> = {};
        for (const s of allSections) {
          if (!grouped[s.day_id]) grouped[s.day_id] = [];
          grouped[s.day_id].push(s);
        }
        for (const key of Object.keys(grouped)) grouped[key].sort((a, b) => a.display_order - b.display_order);
        setSectionsByDay(grouped);
        setCompletedDayIds(new Set(completedIds));

        const testAssessmentIds = allSections.filter((s) => s.section_type === 'test' && s.assessment_id).map((s) => s.assessment_id!);
        const passed = await getPassedTestIds(user.id, testAssessmentIds);
        setPassedTestIds(passed);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load induction.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadEverything(); }, [user?.id]);

  function isDayUnlocked(index: number): boolean {
    if (index === 0) return true;
    const prevDay = days[index - 1];
    if (!completedDayIds.has(prevDay.id)) return false;
    const prevTest = (sectionsByDay[prevDay.id] ?? []).find((s) => s.section_type === 'test');
    if (prevTest?.assessment_id) return passedTestIds.has(prevTest.assessment_id);
    return true;
  }

  async function handleMarkComplete(dayId: string) {
    if (!user?.id || !user.companyId) return;
    setMarking(true);
    try {
      await markComplete(dayId, user.id, user.companyId);
      setCompletedDayIds((prev) => new Set(prev).add(dayId));
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
  const openCompleted = openDay ? completedDayIds.has(openDay.id) : false;

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeroBanner title="Induction" subtitle="Your day-by-day onboarding program." statLabel="Days" statValue={days.length} />
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><Skeleton /></div>
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
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 px-8 py-8 text-white">
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
                    <button onClick={() => toggleKey(key)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:underline">
                      {openKeys.has(key) ? '▼' : '▶'} {section.title}
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
              // section_type === 'test'
              const passed = section.assessment_id ? passedTestIds.has(section.assessment_id) : false;
              return (
                <div key={section.id} className={`flex items-center justify-between gap-3 rounded-xl p-4 ${openCompleted ? 'bg-amber-50' : 'bg-slate-100'}`}>
                  <div>
                    <p className={`text-sm font-semibold ${openCompleted ? 'text-amber-900' : 'text-slate-500'}`}>
                      {openCompleted ? (passed ? '✅ ' : '') : '🔒 '}{section.title}
                    </p>
                    <p className={`text-xs ${openCompleted ? 'text-amber-700' : 'text-slate-400'}`}>
                      {!openCompleted ? 'Mark this day complete above to unlock the test.' : passed ? 'Passed — the next day is unlocked.' : `Take this test to unlock Day ${dayNumber + 1}.`}
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
      </>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeroBanner title="Induction" subtitle="Your day-by-day onboarding program." statLabel="Days" statValue={days.length} />

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>}

        {!error && days.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
            No induction days have been added yet.
          </div>
        )}

        <div className="space-y-3">
          {days.map((day, i) => {
            const unlocked = isDayUnlocked(i);
            const completed = completedDayIds.has(day.id);
            return (
              <button
                key={day.id}
                onClick={() => unlocked && setOpenDayId(day.id)}
                disabled={!unlocked}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-5 text-left transition ${
                  !unlocked ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60' :
                  completed ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-300' :
                  'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                    completed ? 'bg-emerald-500 text-white' : unlocked ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {completed ? <IconCheck /> : unlocked ? i + 1 : <IconLock />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Day {i + 1}: {day.title}</p>
                    {day.description && <p className="mt-0.5 text-xs text-slate-500">{day.description}</p>}
                  </div>
                </div>
                {!unlocked && <span className="flex-shrink-0 text-xs font-semibold text-slate-400">Complete Day {i} first</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Induction;
