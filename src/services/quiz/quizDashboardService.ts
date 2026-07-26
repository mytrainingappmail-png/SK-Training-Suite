// Executive Dashboard aggregation — composes several lightweight queries
// (already-existing repositories plus the new quizDashboardRepository)
// into one snapshot, applying whatever combination of date/category/quiz/
// trainer filters the admin has picked. Kept as plain client-side
// aggregation (no new SQL views) since the data volumes here are small
// (dozens of quizzes, low hundreds of sessions) — simplest to reason about
// and cheapest to extend with a new chart.

import { listQuizzes } from "./quizService";
import { listCategories } from "../../repositories/quiz/quizCategoryRepository";
import { listAdmins } from "../../repositories/quiz/quizAdminRepository";
import { listSessionsForCompany } from "../../repositories/quiz/quizSessionRepository";
import { getCompanySessionResults } from "../../repositories/quiz/quizAnalyticsRepository";
import {
  listCertificatesForCompany,
  countQuestionBankSize,
  listResponseTimes,
  listParticipantJoinTimes,
} from "../../repositories/quiz/quizDashboardRepository";
import type {
  DashboardFilters,
  DashboardFilterOptions,
  DashboardSnapshot,
  DashboardTrendPoint,
  QuizPerformanceRow,
  QuizSessionResultRow,
  QuizSession,
  Quiz,
} from "../../types/quiz";

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}
function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function isTodayIso(iso: string): boolean {
  return dayKey(iso) === dayKey(new Date().toISOString());
}
function inRange(iso: string | null | undefined, fromIso?: string, toIso?: string): boolean {
  if (!iso) return false;
  if (fromIso && iso < fromIso) return false;
  if (toIso && iso > toIso) return false;
  return true;
}
function dateSeries(fromIso?: string, toIso?: string): string[] {
  const end = toIso ? new Date(toIso) : new Date();
  const start = fromIso ? new Date(fromIso) : new Date(end.getTime() - 29 * 86400000);
  const keys: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    keys.push(dayKey(d.toISOString()));
  }
  return keys.slice(-60); // hard cap so a huge custom range can't blow up the chart
}
function average(nums: number[]): number {
  return nums.length === 0 ? 0 : Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

export async function getDashboardFilterOptions(companyId: string): Promise<DashboardFilterOptions> {
  const [quizzes, categories, admins, allResults] = await Promise.all([
    listQuizzes(companyId),
    listCategories(companyId),
    listAdmins(companyId),
    getCompanySessionResults(companyId),
  ]);

  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    quizzes: quizzes.map((q) => ({ id: q.id, title: q.title })),
    // Disabled trainers are excluded here (and from every aggregate below) rather than deleted —
    // re-enabling them from the Users page brings their data straight back into view.
    trainers: admins.filter((a) => a.status === "active").map((a) => ({ id: a.id, name: a.display_name })),
    employees: [...new Set(allResults.map((r) => r.display_name.trim()))].sort(),
  };
}

export async function getDashboardSnapshot(companyId: string, filters: DashboardFilters): Promise<DashboardSnapshot> {
  const [quizzes, categories, admins, sessions, allResults, certificates, questionBankSize, responseTimes, joinTimes] =
    await Promise.all([
      listQuizzes(companyId),
      listCategories(companyId),
      listAdmins(companyId),
      listSessionsForCompany(companyId),
      getCompanySessionResults(companyId),
      listCertificatesForCompany(companyId),
      countQuestionBankSize(companyId),
      listResponseTimes(companyId, filters.fromIso, filters.toIso),
      listParticipantJoinTimes(companyId),
    ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const trainerNameById = new Map(admins.map((a) => [a.id, a.display_name]));
  const quizById = new Map(quizzes.map((q) => [q.id, q]));
  const sessionById = new Map<string, QuizSession>(sessions.map((s) => [s.id, s]));

  // A disabled trainer's sessions are excluded from every KPI/chart/panel below —
  // "disabled" only means "not for use" here, never deleted, so re-enabling them
  // from the Users page brings their historical data straight back into view.
  const disabledTrainerIds = new Set(admins.filter((a) => a.status === "disabled").map((a) => a.id));
  const hostIsDisabled = (sessionId: string): boolean => {
    const host = sessionById.get(sessionId)?.host_admin_id;
    return !!host && disabledTrainerIds.has(host);
  };

  const employeeName = filters.employeeName?.trim() || null;

  // ── Apply the global filter set to the session-results rows (the primary dataset behind most KPIs/charts) ──
  const filteredResults: QuizSessionResultRow[] = allResults.filter((r) => {
    if (hostIsDisabled(r.session_id)) return false;
    if (filters.quizId && r.quiz_id !== filters.quizId) return false;
    if (filters.categoryId) {
      const quiz = quizById.get(r.quiz_id);
      if (!quiz || quiz.category_id !== filters.categoryId) return false;
    }
    if (filters.trainerId) {
      const session = sessionById.get(r.session_id);
      if (!session || session.host_admin_id !== filters.trainerId) return false;
    }
    if (employeeName && r.display_name.trim() !== employeeName) return false;
    if (!inRange(r.ended_at, filters.fromIso, filters.toIso)) return false;
    return true;
  });

  const filteredSessions = sessions.filter((s) => {
    if (s.host_admin_id && disabledTrainerIds.has(s.host_admin_id)) return false;
    if (filters.quizId && s.quiz_id !== filters.quizId) return false;
    if (filters.categoryId) {
      const quiz = quizById.get(s.quiz_id);
      if (!quiz || quiz.category_id !== filters.categoryId) return false;
    }
    if (filters.trainerId && s.host_admin_id !== filters.trainerId) return false;
    if ((filters.fromIso || filters.toIso) && !inRange(s.created_at, filters.fromIso, filters.toIso)) return false;
    return true;
  });

  const filteredQuizzes = quizzes.filter((q) => {
    if (filters.quizId && q.id !== filters.quizId) return false;
    if (filters.categoryId && q.category_id !== filters.categoryId) return false;
    return true;
  });

  const filteredCertificates = certificates.filter((c) => {
    if (hostIsDisabled(c.session_id)) return false;
    if (filters.quizId) {
      const quiz = quizById.get(filters.quizId);
      if (quiz && c.quiz_title !== quiz.title) return false;
    }
    if (employeeName && c.candidate_name.trim() !== employeeName) return false;
    if (!inRange(c.issued_at, filters.fromIso, filters.toIso)) return false;
    return true;
  });

  const participantNameById = new Map(allResults.map((r) => [r.participant_id, r.display_name]));

  // Everything except the date range — reused for both "in range" totals and the
  // always-"today" pulse KPI, which intentionally ignores whatever date range is selected.
  function joinTimeMatchesNonDateFilters(j: { session_id: string; participant_id: string }): boolean {
    if (hostIsDisabled(j.session_id)) return false;
    const session = sessionById.get(j.session_id);
    if (filters.quizId && session?.quiz_id !== filters.quizId) return false;
    if (filters.categoryId) {
      const quiz = session ? quizById.get(session.quiz_id) : undefined;
      if (!quiz || quiz.category_id !== filters.categoryId) return false;
    }
    if (filters.trainerId && session?.host_admin_id !== filters.trainerId) return false;
    if (employeeName && (participantNameById.get(j.participant_id) ?? "").trim() !== employeeName) return false;
    return true;
  }

  const filteredJoinTimes = joinTimes
    .filter(joinTimeMatchesNonDateFilters)
    .filter((j) => inRange(j.joined_at, filters.fromIso, filters.toIso));

  const todaysJoinTimes = joinTimes.filter((j) => joinTimeMatchesNonDateFilters(j) && isTodayIso(j.joined_at));

  // ── KPIs ──
  const publishedQuizzes = filteredQuizzes.filter((q) => q.status === "published").length;
  const draftQuizzes = filteredQuizzes.filter((q) => q.status === "draft").length;
  const liveSessionsNow = filteredSessions.filter((s) => s.phase === "lobby" || s.phase === "question" || s.phase === "paused").length;
  const completedSessions = filteredSessions.filter((s) => s.phase === "ended").length;
  const todaysParticipants = todaysJoinTimes.length;
  const totalParticipants = filteredJoinTimes.length;
  const passCount = filteredResults.filter((r) => r.grade === "PASS").length;
  const improveCount = filteredResults.filter((r) => r.grade === "NEED_IMPROVEMENT").length;
  const failCount = filteredResults.filter((r) => r.grade === "FAIL").length;
  const gradedTotal = Math.max(1, filteredResults.length);

  const snapshot: DashboardSnapshot = {
    kpis: {
      totalQuizzes: filteredQuizzes.length,
      publishedQuizzes,
      draftQuizzes,
      liveSessionsNow,
      completedSessions,
      todaysParticipants,
      totalParticipants,
      questionBankSize: filters.quizId || filters.categoryId ? filteredQuizzes.length : questionBankSize,
      averageScorePct: average(filteredResults.map((r) => r.percent_correct)),
      passPct: Math.round((passCount / gradedTotal) * 100),
      failPct: Math.round((failCount / gradedTotal) * 100),
      improvePct: Math.round((improveCount / gradedTotal) * 100),
      completionPct: filteredSessions.length === 0 ? 0 : Math.round((completedSessions / filteredSessions.length) * 100),
      avgResponseTimeMs: average(responseTimes),
      certificatesGenerated: filteredCertificates.length,
    },

    participationTrend: buildDailyCountTrend(
      filteredJoinTimes.map((j) => j.joined_at),
      filters.fromIso,
      filters.toIso
    ),
    scoreTrend: buildDailyAverageTrend(
      filteredResults.map((r) => ({ date: r.ended_at, value: r.percent_correct })),
      filters.fromIso,
      filters.toIso
    ),
    certificateTrend: buildDailyCountTrend(
      filteredCertificates.map((c) => c.issued_at),
      filters.fromIso,
      filters.toIso
    ),

    passFail: [
      { label: "Pass", value: passCount, color: "#10b981" },
      { label: "Improve", value: improveCount, color: "#f59e0b" },
      { label: "Fail", value: failCount, color: "#ef4444" },
    ],

    categoryPerformance: groupAverage(filteredResults, (r) => {
      const quiz = quizById.get(r.quiz_id);
      const name = quiz?.category_id ? categoryNameById.get(quiz.category_id) : undefined;
      return name ?? null;
    }),

    difficultyPerformance: (["Easy", "Medium", "Hard"] as const)
      .map((d) => ({
        label: d,
        value: average(filteredResults.filter((r) => quizById.get(r.quiz_id)?.difficulty === d).map((r) => r.percent_correct)),
      }))
      .filter((p) => filteredResults.some((r) => quizById.get(r.quiz_id)?.difficulty === p.label)),

    trainerPerformance: groupAverage(filteredResults, (r) => {
      const session = sessionById.get(r.session_id);
      const name = session?.host_admin_id ? trainerNameById.get(session.host_admin_id) : undefined;
      return name ?? null;
    }).slice(0, 8),

    topQuizzes: groupAverage(filteredResults, (r) => r.quiz_title)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),

    bottomQuizzes: groupAverage(filteredResults, (r) => r.quiz_title)
      .sort((a, b) => a.value - b.value)
      .slice(0, 5),

    topParticipants: bestPerParticipant(filteredResults)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),

    quizPerformanceTable: buildQuizPerformanceTable(filteredQuizzes, filteredResults, filteredSessions, categoryNameById),

    recentQuizActivity: filteredQuizzes
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 6)
      .map((q) => ({ id: q.id, title: q.title, status: q.status, updatedAt: q.updated_at })),

    recentSessions: filteredSessions
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6)
      .map((s) => ({
        id: s.id,
        quizTitle: quizById.get(s.quiz_id)?.title ?? "Quiz session",
        phase: s.phase,
        participantCount: filteredResults.filter((r) => r.session_id === s.id).length,
        createdAt: s.created_at,
      })),

    recentResults: filteredResults
      .slice()
      .filter((r) => r.ended_at)
      .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))
      .slice(0, 8)
      .map((r) => ({
        sessionId: r.session_id,
        participantId: r.participant_id,
        quizTitle: r.quiz_title,
        displayName: r.display_name,
        percent: r.percent_correct,
        grade: r.grade,
        endedAt: r.ended_at ?? "",
      })),

    recentCertificates: filteredCertificates.slice(0, 6).map((c) => ({
      id: c.id,
      candidateName: c.candidate_name,
      quizTitle: c.quiz_title,
      issuedAt: c.issued_at,
    })),
  };

  return snapshot;
}

/** One row per quiz (not just the top/bottom 5) so the admin can compare every quiz side by side, not only the extremes. */
function buildQuizPerformanceTable(
  quizzesInScope: Quiz[],
  results: QuizSessionResultRow[],
  sessionsInScope: QuizSession[],
  categoryNameById: Map<string, string>
): QuizPerformanceRow[] {
  return quizzesInScope
    .map((q) => {
      const rows = results.filter((r) => r.quiz_id === q.id);
      const sessionIds = new Set(sessionsInScope.filter((s) => s.quiz_id === q.id).map((s) => s.id));
      const passCount = rows.filter((r) => r.grade === "PASS").length;

      return {
        quizId: q.id,
        title: q.title,
        categoryName: q.category_id ? categoryNameById.get(q.category_id) ?? null : null,
        difficulty: q.difficulty,
        status: q.status,
        sessionsCount: sessionIds.size,
        participantsCount: rows.length,
        averageScorePct: average(rows.map((r) => r.percent_correct)),
        passPct: rows.length === 0 ? 0 : Math.round((passCount / rows.length) * 100),
      };
    })
    .sort((a, b) => b.averageScorePct - a.averageScorePct);
}

function groupAverage(rows: QuizSessionResultRow[], keyFn: (row: QuizSessionResultRow) => string | null): DashboardTrendPoint[] {
  const buckets = new Map<string, number[]>();
  for (const r of rows) {
    const key = keyFn(r);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r.percent_correct);
  }
  return [...buckets.entries()].map(([label, values]) => ({ label, value: average(values) }));
}

function bestPerParticipant(rows: QuizSessionResultRow[]): DashboardTrendPoint[] {
  const best = new Map<string, number>();
  for (const r of rows) {
    const key = r.display_name.trim();
    if (!best.has(key) || r.percent_correct > best.get(key)!) best.set(key, r.percent_correct);
  }
  return [...best.entries()].map(([label, value]) => ({ label, value }));
}

function buildDailyCountTrend(isoDates: string[], fromIso?: string, toIso?: string): DashboardTrendPoint[] {
  const series = dateSeries(fromIso, toIso);
  const counts = new Map(series.map((k) => [k, 0]));
  for (const iso of isoDates) {
    const key = dayKey(iso);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return series.map((k) => ({ label: dayLabel(k), value: counts.get(k) ?? 0 }));
}

function buildDailyAverageTrend(rows: { date: string | null; value: number }[], fromIso?: string, toIso?: string): DashboardTrendPoint[] {
  const series = dateSeries(fromIso, toIso);
  const buckets = new Map<string, number[]>(series.map((k) => [k, []]));
  for (const r of rows) {
    if (!r.date) continue;
    const key = dayKey(r.date);
    if (buckets.has(key)) buckets.get(key)!.push(r.value);
  }
  return series.map((k) => ({ label: dayLabel(k), value: average(buckets.get(k) ?? []) }));
}
