import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { getDashboardFilterOptions, getDashboardSnapshot } from "../../services/quiz/quizDashboardService";
import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { ChartCard, AreaChart, VerticalBars, HorizontalBars, DonutChart } from "../../components/quiz/QuizDashboardCharts";
import type { DashboardFilterOptions, DashboardFilters, DashboardSnapshot } from "../../types/quiz";

type DatePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "thisMonth" | "lastMonth" | "thisQuarter" | "custom";

const PHASE_LABEL: Record<string, string> = {
  lobby: "🟡 In Lobby",
  question: "🔴 Live",
  paused: "⏸ Paused",
  ended: "✅ Ended",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function presetToRange(preset: DatePreset, customFrom: string, customTo: string): { fromIso?: string; toIso?: string } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { fromIso: startOfDay(now).toISOString(), toIso: endOfDay(now).toISOString() };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { fromIso: startOfDay(y).toISOString(), toIso: endOfDay(y).toISOString() };
    }
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { fromIso: startOfDay(from).toISOString(), toIso: endOfDay(now).toISOString() };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { fromIso: startOfDay(from).toISOString(), toIso: endOfDay(now).toISOString() };
    }
    case "thisMonth": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fromIso: startOfDay(from).toISOString(), toIso: endOfDay(now).toISOString() };
    }
    case "lastMonth": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { fromIso: startOfDay(from).toISOString(), toIso: endOfDay(to).toISOString() };
    }
    case "thisQuarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const from = new Date(now.getFullYear(), qStartMonth, 1);
      return { fromIso: startOfDay(from).toISOString(), toIso: endOfDay(now).toISOString() };
    }
    case "custom":
      return {
        fromIso: customFrom ? startOfDay(new Date(customFrom)).toISOString() : undefined,
        toIso: customTo ? endOfDay(new Date(customTo)).toISOString() : undefined,
      };
    default:
      return {};
  }
}

function greeting(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function QuizDashboardPage() {
  const admin = getCurrentQuizAdmin();

  const [now, setNow] = useState(new Date());
  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions>({ categories: [], quizzes: [], trainers: [] });
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [quizId, setQuizId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveTick, setLiveTick] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!admin) return;
    getDashboardFilterOptions(admin.company_id).then(setFilterOptions);
  }, [admin]);

  const filters: DashboardFilters = useMemo(() => {
    const range = presetToRange(datePreset, customFrom, customTo);
    return {
      ...range,
      categoryId: categoryId || null,
      quizId: quizId || null,
      trainerId: trainerId || null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, customFrom, customTo, categoryId, quizId, trainerId]);

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    setLoading(true);
    getDashboardSnapshot(admin.company_id, filters)
      .then((snap) => {
        if (!cancelled) setSnapshot(snap);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, filters, liveTick]);

  // Real-time: any session/participant change for this company bumps liveTick (debounced) so the whole dashboard silently refreshes.
  useEffect(() => {
    if (!admin) return;

    function bump() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setLiveTick((t) => t + 1), 1500);
    }

    const channel = supabaseQuiz
      .channel(`quiz-dashboard-${admin.company_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_sessions", filter: `company_id=eq.${admin.company_id}` }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_participants" }, bump)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabaseQuiz.removeChannel(channel);
    };
  }, [admin]);

  const hasActiveFilters = categoryId || quizId || trainerId || datePreset !== "30d";

  return (
    <div className="space-y-6 pb-16">
      {/* Smart Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting(now.getHours())}, {admin?.display_name || admin?.username} 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
            {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          {snapshot && snapshot.kpis.liveSessionsNow > 0 && (
            <div className="text-xs font-semibold text-red-400 mt-0.5 flex items-center gap-1 justify-end">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {snapshot.kpis.liveSessionsNow} session{snapshot.kpis.liveSessionsNow === 1 ? "" : "s"} live now
            </div>
          )}
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <select
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All Categories</option>
          {filterOptions.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 max-w-[16rem]"
          value={quizId}
          onChange={(e) => setQuizId(e.target.value)}
        >
          <option value="">All Quizzes</option>
          {filterOptions.quizzes.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          value={trainerId}
          onChange={(e) => setTrainerId(e.target.value)}
        >
          <option value="">All Trainers</option>
          {filterOptions.trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
          <option value="thisQuarter">This Quarter</option>
          <option value="custom">Custom Range</option>
        </select>

        {datePreset === "custom" && (
          <>
            <input
              type="date"
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span className="text-xs text-slate-500">to</span>
            <input
              type="date"
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </>
        )}

        {hasActiveFilters && (
          <button
            onClick={() => {
              setCategoryId("");
              setQuizId("");
              setTrainerId("");
              setDatePreset("30d");
              setCustomFrom("");
              setCustomTo("");
            }}
            className="text-xs font-semibold text-slate-400 hover:text-white ml-auto"
          >
            ✕ Reset Filters
          </button>
        )}
      </div>

      {loading || !snapshot ? (
        <div className="text-slate-500 text-sm py-12 text-center">Loading dashboard…</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <Kpi icon="📚" label="Total Quizzes" value={snapshot.kpis.totalQuizzes} accent="violet" />
            <Kpi icon="🟢" label="Published" value={snapshot.kpis.publishedQuizzes} accent="emerald" />
            <Kpi icon="📝" label="Drafts" value={snapshot.kpis.draftQuizzes} accent="slate" />
            <Kpi icon="🔴" label="Live Sessions Now" value={snapshot.kpis.liveSessionsNow} accent="red" />
            <Kpi icon="✅" label="Completed Sessions" value={snapshot.kpis.completedSessions} accent="emerald" />
            <Kpi icon="👥" label="Today's Participants" value={snapshot.kpis.todaysParticipants} accent="amber" />
            <Kpi icon="🧑‍🤝‍🧑" label="Total Participants" value={snapshot.kpis.totalParticipants} accent="violet" />
            <Kpi icon="❓" label="Questions in Bank" value={snapshot.kpis.questionBankSize} accent="slate" />
            <Kpi icon="📊" label="Average Score" value={`${snapshot.kpis.averageScorePct}%`} accent="amber" />
            <Kpi icon="✔️" label="Pass %" value={`${snapshot.kpis.passPct}%`} accent="emerald" />
            <Kpi icon="✖️" label="Fail %" value={`${snapshot.kpis.failPct}%`} accent="red" />
            <Kpi icon="📈" label="Completion %" value={`${snapshot.kpis.completionPct}%`} accent="violet" />
            <Kpi icon="⏱️" label="Avg Response Time" value={`${(snapshot.kpis.avgResponseTimeMs / 1000).toFixed(1)}s`} accent="slate" />
            <Kpi icon="🏆" label="Certificates Generated" value={snapshot.kpis.certificatesGenerated} accent="amber" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            <ChartCard title="Quiz Participation Trend" subtitle="Trainees joining per day">
              <AreaChart data={snapshot.participationTrend} color="#8b5cf6" />
            </ChartCard>

            <ChartCard title="Average Score Trend" subtitle="Daily average %">
              <AreaChart data={snapshot.scoreTrend} color="#10b981" />
            </ChartCard>

            <ChartCard title="Pass vs Fail" subtitle="Overall grade distribution">
              <DonutChart segments={snapshot.passFail} />
            </ChartCard>

            <ChartCard title="Category Performance" subtitle="Average % by category">
              <HorizontalBars data={snapshot.categoryPerformance} color="violet" />
            </ChartCard>

            <ChartCard title="Difficulty Analysis" subtitle="Average % by difficulty">
              <VerticalBars data={snapshot.difficultyPerformance} suffix="%" color="#f59e0b" />
            </ChartCard>

            <ChartCard title="Trainer Performance" subtitle="Average % by host">
              <HorizontalBars data={snapshot.trainerPerformance} color="amber" />
            </ChartCard>

            <ChartCard title="Top Performing Quizzes" subtitle="Highest average %">
              <HorizontalBars data={snapshot.topQuizzes} color="violet" />
            </ChartCard>

            <ChartCard title="Lowest Performing Quizzes" subtitle="Needs attention">
              <HorizontalBars data={snapshot.bottomQuizzes} color="amber" />
            </ChartCard>

            <ChartCard title="Top Performing Participants" subtitle="Best score achieved">
              <HorizontalBars data={snapshot.topParticipants} color="violet" />
            </ChartCard>

            <ChartCard title="Certificate Generation Trend" subtitle="Issued per day">
              <AreaChart data={snapshot.certificateTrend} color="#f59e0b" />
            </ChartCard>
          </div>

          {/* Summary Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel title="🗂️ Recent Quiz Activity">
              {snapshot.recentQuizActivity.length === 0 ? (
                <EmptyRow />
              ) : (
                snapshot.recentQuizActivity.map((q) => (
                  <Row key={q.id}>
                    <Link to={ROUTES.QUIZ_ADMIN_BUILDER_EDIT.replace(":quizId", q.id)} className="flex-1 truncate hover:text-violet-300">
                      {q.title}
                    </Link>
                    <Badge tone={q.status === "published" ? "emerald" : "slate"}>{q.status}</Badge>
                  </Row>
                ))
              )}
            </Panel>

            <Panel title="🎮 Recent Live Sessions">
              {snapshot.recentSessions.length === 0 ? (
                <EmptyRow />
              ) : (
                snapshot.recentSessions.map((s) => (
                  <Row key={s.id}>
                    <span className="flex-1 truncate">{s.quizTitle}</span>
                    <span className="text-xs text-slate-500">{s.participantCount} players</span>
                    <Badge tone={s.phase === "ended" ? "emerald" : s.phase === "paused" ? "amber" : "red"}>{PHASE_LABEL[s.phase] ?? s.phase}</Badge>
                  </Row>
                ))
              )}
            </Panel>

            <Panel title="📋 Recent Results">
              {snapshot.recentResults.length === 0 ? (
                <EmptyRow />
              ) : (
                snapshot.recentResults.map((r) => (
                  <Row key={`${r.sessionId}-${r.participantId}`}>
                    <span className="flex-1 truncate">
                      {r.displayName} <span className="text-slate-500">· {r.quizTitle}</span>
                    </span>
                    <span className="text-xs font-mono text-slate-400">{r.percent}%</span>
                    <Badge tone={r.grade === "PASS" ? "emerald" : r.grade === "NEED_IMPROVEMENT" ? "amber" : "red"}>
                      {r.grade.replace("_", " ")}
                    </Badge>
                  </Row>
                ))
              )}
            </Panel>

            <Panel title="🏅 Latest Certificates">
              {snapshot.recentCertificates.length === 0 ? (
                <EmptyRow />
              ) : (
                snapshot.recentCertificates.map((c) => (
                  <Row key={c.id}>
                    <span className="flex-1 truncate">
                      {c.candidateName} <span className="text-slate-500">· {c.quizTitle}</span>
                    </span>
                    <span className="text-xs text-slate-500">{new Date(c.issuedAt).toLocaleDateString("en-IN")}</span>
                  </Row>
                ))
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

const ACCENTS: Record<string, string> = {
  violet: "from-violet-500/20 to-violet-500/5 text-violet-300 border-violet-500/30",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-500/30",
  amber: "from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-500/30",
  red: "from-red-500/20 to-red-500/5 text-red-300 border-red-500/30",
  slate: "from-slate-500/20 to-slate-500/5 text-slate-300 border-slate-600/30",
};

function Kpi({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: keyof typeof ACCENTS }) {
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${ACCENTS[accent]}`}>
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xl font-bold font-mono text-white">{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-3">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2 text-sm text-slate-200">{children}</div>;
}

function EmptyRow() {
  return <div className="text-xs text-slate-500 py-4 text-center">Nothing here yet.</div>;
}

function Badge({ tone, children }: { tone: "emerald" | "amber" | "red" | "slate"; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    red: "bg-red-500/15 text-red-300",
    slate: "bg-slate-700/50 text-slate-300",
  };
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${styles[tone]}`}>{children}</span>;
}
