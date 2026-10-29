// Topic report: which topics the team - and each trainee - is weak in. Works for one test or several ticked together.
// The loader is handed in, so the same screen serves live quiz results and exam results.

import { useEffect, useMemo, useState } from "react";
import { buildTopicReport, buildTopicReportCsv, NO_TOPIC_LABEL, type TopicSessionInput } from "../../services/quiz/quizTopicReport";
import { downloadCsvFile } from "../../services/quiz/quizCsvService";

interface Props {
  title: string;
  /** Loads the answers of the test(s) being reported on. */
  load: () => Promise<TopicSessionInput[]>;
  /** The "weak" line starts here (percent) - the test's own pass mark unless the trainer changes it. */
  defaultThreshold: number;
  onClose: () => void;
}

/** Red under the line, amber within 15 points above it, green beyond. */
function tone(percent: number, line: number): { bar: string; text: string; cell: string } {
  if (percent < line) return { bar: "bg-red-500", text: "text-red-300", cell: "bg-red-500/20 text-red-200" };
  if (percent < line + 15) return { bar: "bg-amber-400", text: "text-amber-300", cell: "bg-amber-400/15 text-amber-200" };
  return { bar: "bg-emerald-500", text: "text-emerald-300", cell: "bg-emerald-500/15 text-emerald-200" };
}

export default function TopicReportModal({ title, load, defaultThreshold, onClose }: Props) {
  const [inputs, setInputs] = useState<TopicSessionInput[] | null>(null);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(defaultThreshold);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((x) => { if (!cancelled) setInputs(x); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the answers."); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const report = useMemo(() => (inputs ? buildTopicReport(inputs, threshold) : null), [inputs, threshold]);

  function handleDownload() {
    if (!report) return;
    downloadCsvFile(`topic-report-${new Date().toISOString().slice(0, 10)}.csv`, buildTopicReportCsv(report, threshold));
  }

  const hasData = !!report && report.team.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-5 text-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold">📚 Topic report</h2>
            <p className="truncate text-xs text-slate-400">{title}</p>
          </div>
          <div className="flex gap-2">
            {hasData && (
              <button type="button" onClick={handleDownload} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-300">⬇ Download (Excel)</button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">✕ Close</button>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        {!error && !report && <div className="py-10 text-center text-sm text-slate-400">Working out the topics…</div>}

        {report && !hasData && (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-300">
            These questions have no topic yet.
            <div className="mt-1 text-xs text-slate-500">
              Open the quiz / exam, type a topic under each question (e.g. RERA, Payment plan) - or tick several questions and use “Set topic” - and save.
              The report then shows which topics your team is weak in.
            </div>
          </div>
        )}

        {report && hasData && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                A topic is “weak” below
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={threshold}
                  onChange={(e) => setThreshold(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-white outline-none focus:border-violet-500"
                />
                %
              </label>
              <span className="text-slate-500">
                {report.people.length} trainee{report.people.length === 1 ? "" : "s"} · {report.taggedQuestions} question{report.taggedQuestions === 1 ? "" : "s"} with a topic
                {report.untaggedQuestions > 0 && ` · ${report.untaggedQuestions} without`}
              </span>
            </div>

            {/* the whole team, weakest first */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Whole team - weakest topic first</h3>
              <div className="space-y-2">
                {report.team.map((t) => {
                  const c = tone(t.percent, threshold);
                  return (
                    <div key={t.topic} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[12rem_1fr_auto]">
                      <div className="truncate font-medium text-slate-200" title={t.topic}>{t.topic === NO_TOPIC_LABEL ? <span className="italic text-slate-400">{t.topic}</span> : t.topic}</div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.max(2, t.percent)}%` }} />
                      </div>
                      <div className={`w-24 text-right font-mono font-semibold ${c.text}`}>{t.percent}% <span className="font-sans font-normal text-slate-500">· {t.questions} Q</span></div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* each trainee */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Each trainee - who needs which topic</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/60 text-slate-400">
                    <tr>
                      <th className="sticky left-0 bg-slate-800 px-3 py-2">Trainee</th>
                      <th className="px-3 py-2">Overall</th>
                      {report.topics.map((t) => <th key={t} className="px-3 py-2 whitespace-nowrap">{t}</th>)}
                      <th className="px-3 py-2 whitespace-nowrap">Needs work on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.people.map((p) => (
                      <tr key={p.name} className="border-t border-slate-800">
                        <td className="sticky left-0 bg-slate-900 px-3 py-2 font-medium text-white whitespace-nowrap">{p.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-200">{p.overall.percent}%</td>
                        {report.topics.map((t) => {
                          const c = p.byTopic[t];
                          return (
                            <td key={t} className="px-2 py-1.5">
                              {c ? <span className={`inline-block min-w-[3rem] rounded-md px-2 py-1 text-center font-mono font-semibold ${tone(c.percent, threshold).cell}`}>{c.percent}%</span> : <span className="text-slate-600">-</span>}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-slate-300">{p.weakTopics.length ? p.weakTopics.join(", ") : <span className="text-emerald-400">Nothing weak 👍</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                A question left unanswered counts as zero. Written answers that are not graded yet are left out until you grade them. The same name in several tests is counted as one trainee.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
