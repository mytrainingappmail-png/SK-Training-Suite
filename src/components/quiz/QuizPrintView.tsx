// The printable look of a test, used to make the PDF. Plain white page, black text, inline styles only (so it looks the
// same whatever theme the admin screen is in). Every question / the heading is one "block" (data-pdf-block): the PDF
// maker moves whole blocks onto pages, so a question is never cut in half.

import { effectiveZones } from "./hotspotZones";
import type { HotspotZone } from "../../types/quiz";
import { correctAnswerText, visibleQuestions, type ExportQuiz } from "../../services/quiz/quizExportService";

export const PRINT_WIDTH = 714;

/** The correct area(s) drawn in strong red so they stand out on any picture (the on-screen overlay is soft green). */
function PrintZones({ zones }: { zones: HotspotZone[] }) {
  const common = { fill: "rgba(220,38,38,0.22)", stroke: "#dc2626", strokeWidth: 3, vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}>
      {zones.map((z, i) => (
        <g key={i}>
          {z.shape === "circle" && <ellipse cx={z.x} cy={z.y} rx={z.r + 1} ry={z.r + 1} {...common} />}
          {z.shape === "rect" && <rect x={z.x} y={z.y} width={z.w} height={z.h} {...common} />}
          {z.shape === "poly" && <polygon points={z.points.map((p) => p.join(",")).join(" ")} {...common} />}
        </g>
      ))}
    </svg>
  );
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Devanagari', 'Nirmala UI', sans-serif";

export default function QuizPrintView({ quiz, withAnswers }: { quiz: ExportQuiz; withAnswers: boolean }) {
  const qs = visibleQuestions(quiz);
  const totalMarks = qs.reduce((s, q) => s + q.marks, 0);
  const isExam = quiz.mode === "exam";

  return (
    <div style={{ width: PRINT_WIDTH, background: "#ffffff", color: "#111827", fontFamily: FONT, fontSize: 13, lineHeight: 1.5 }}>
      <div data-pdf-block style={{ paddingBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>{quiz.title}</div>
          <div style={{ flex: "none", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: withAnswers ? "#166534" : "#1e3a8a", background: withAnswers ? "#dcfce7" : "#dbeafe", borderRadius: 6, padding: "4px 10px" }}>
            {withAnswers ? "ANSWER KEY" : "QUESTION PAPER"}
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#4b5563" }}>
          {isExam ? "Exam" : "Live Quiz"} · {qs.length} question{qs.length === 1 ? "" : "s"} · {totalMarks} mark{totalMarks === 1 ? "" : "s"} · Pass mark {quiz.passing_score_pct}%
          {isExam && quiz.exam_duration_minutes ? ` · Time ${quiz.exam_duration_minutes} min` : ""} · {quiz.difficulty}
        </div>
        {quiz.description && <div style={{ marginTop: 6, fontSize: 12, color: "#374151", whiteSpace: "pre-line" }}>{quiz.description}</div>}
        {!withAnswers && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#374151", display: "flex", gap: 24 }}>
            <span>Name: ______________________________</span>
            <span>Date: ______________</span>
          </div>
        )}
        <div style={{ marginTop: 12, borderBottom: "2px solid #111827" }} />
      </div>

      {qs.map((q, i) => {
        const zones = effectiveZones(q);
        const timer = quiz.mode === "live" ? q.timer_seconds ?? quiz.default_timer_seconds : null;
        const answer = correctAnswerText(q);
        const correctIdx = q.options.findIndex((o) => o.is_correct);
        return (
          <div key={i} data-pdf-block style={{ paddingBottom: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: "none", minWidth: 34, textAlign: "center", fontSize: 12, fontWeight: 800, background: "#111827", color: "#fff", borderRadius: 6, padding: "3px 6px" }}>Q{i + 1}</div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{q.question_text}</div>
              <div style={{ flex: "none", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                {q.marks} mark{q.marks === 1 ? "" : "s"}{timer ? ` · ${timer}s` : ""}
              </div>
            </div>

            {q.type === "hotspot" && q.image_url && (
              <div style={{ marginTop: 8, marginLeft: 44 }}>
                <div style={{ position: "relative", display: "inline-block", maxWidth: 440, border: "1px solid #d1d5db" }}>
                  <img src={q.image_url} crossOrigin="anonymous" alt="" style={{ display: "block", maxWidth: 440, maxHeight: 300 }} />
                  {withAnswers && zones.length > 0 && <PrintZones zones={zones} />}
                </div>
                {!withAnswers && <div style={{ marginTop: 4, fontSize: 12, color: "#4b5563" }}>Mark the correct area on the image.</div>}
              </div>
            )}

            {(q.type === "mcq" || q.type === "truefalse") && (
              <div style={{ marginTop: 8, marginLeft: 44, display: "grid", gap: 5 }}>
                {q.options.map((o, oi) => {
                  const right = withAnswers && o.is_correct;
                  return (
                    <div
                      key={oi}
                      style={{
                        display: "flex", gap: 8, alignItems: "flex-start",
                        border: `1px solid ${right ? "#16a34a" : "#e5e7eb"}`, background: right ? "#dcfce7" : "#ffffff",
                        borderRadius: 6, padding: "5px 9px", fontWeight: right ? 700 : 400,
                      }}
                    >
                      <span style={{ flex: "none", width: 18, fontWeight: 700, color: right ? "#166534" : "#6b7280" }}>{LETTERS[oi] ?? oi + 1}</span>
                      <span style={{ flex: 1, overflowWrap: "anywhere" }}>{o.option_text}</span>
                      {right && <span style={{ flex: "none", color: "#166534", fontWeight: 800 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {q.type === "written" && !withAnswers && (
              <div style={{ marginTop: 8, marginLeft: 44 }}>
                {[0, 1, 2, 3].map((n) => (
                  <div key={n} style={{ height: 24, borderBottom: "1px solid #9ca3af" }} />
                ))}
              </div>
            )}

            {withAnswers && (
              <div style={{ marginTop: 8, marginLeft: 44, display: "grid", gap: 5 }}>
                <div style={{ fontSize: 12.5, color: "#166534", fontWeight: 700 }}>
                  Correct answer:{" "}
                  {q.type === "written"
                    ? <span style={{ fontWeight: 600, color: "#374151" }}>written answer — marked by the trainer</span>
                    : <span>{q.type === "mcq" || q.type === "truefalse" ? `${LETTERS[correctIdx] ?? ""}${correctIdx >= 0 ? ") " : ""}` : ""}{answer || "—"}</span>}
                </div>
                {q.explanation && (
                  <div style={{ fontSize: 12, color: "#374151", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 9px", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                    <b>Explanation:</b> {q.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {qs.length === 0 && <div style={{ color: "#6b7280" }}>This test has no visible questions yet.</div>}
    </div>
  );
}
