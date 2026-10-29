import { describe, expect, it } from "vitest";
import { buildTopicReport, buildTopicReportCsv, NO_TOPIC_LABEL, type TopicSessionInput } from "../../services/quiz/quizTopicReport";

const session: TopicSessionInput = {
  questions: [
    { id: "q1", topic: "RERA", marks: 1 },
    { id: "q2", topic: "RERA", marks: 1 },
    { id: "q3", topic: "Payment plan", marks: 2 },
    { id: "q4", topic: null, marks: 1 },
  ],
  participants: [
    { id: "p1", name: "Rahul Sharma" },
    { id: "p2", name: "Nisha" },
  ],
  answers: [
    { participantId: "p1", questionId: "q1", earned: 1 },
    { participantId: "p1", questionId: "q2", earned: 1 },
    { participantId: "p1", questionId: "q3", earned: 0 },
    { participantId: "p1", questionId: "q4", earned: 1 },
    { participantId: "p2", questionId: "q1", earned: 1 },
    { participantId: "p2", questionId: "q3", earned: 2 },
    // Nisha never answered q2 / q4
  ],
};

describe("buildTopicReport", () => {
  it("scores each topic for the team, weakest first, and counts unanswered as zero", () => {
    const r = buildTopicReport([session], 60);
    expect(r.team.map((t) => [t.topic, t.percent])).toEqual([
      ["Payment plan", 50], // 2 of 4 marks
      ["RERA", 75], // 3 of 4
      [NO_TOPIC_LABEL, 50], // always last
    ]);
    expect(r.taggedQuestions).toBe(3);
    expect(r.untaggedQuestions).toBe(1);
  });

  it("lists each trainee's weak topics under the threshold (both are 60% overall, so by name)", () => {
    const r = buildTopicReport([session], 60);
    expect(r.people.map((p) => [p.name, p.overall.percent])).toEqual([["Nisha", 60], ["Rahul Sharma", 60]]);
    const rahul = r.people.find((p) => p.name === "Rahul Sharma")!;
    const nisha = r.people.find((p) => p.name === "Nisha")!;
    expect(rahul.weakTopics).toEqual(["Payment plan"]); // 0 of 2
    expect(nisha.weakTopics).toEqual(["RERA"]); // 1 of 2 = 50%, she skipped q2
  });

  it("treats the same name in two tests as one trainee", () => {
    const second: TopicSessionInput = {
      questions: [{ id: "x1", topic: "RERA", marks: 1 }],
      participants: [{ id: "z9", name: "  rahul   sharma " }],
      answers: [{ participantId: "z9", questionId: "x1", earned: 0 }],
    };
    const r = buildTopicReport([session, second], 60);
    expect(r.people.filter((p) => p.name.toLowerCase().includes("rahul")).length).toBe(1);
    expect(r.people.find((p) => p.name.toLowerCase().includes("rahul"))!.byTopic["RERA"].possible).toBe(3);
  });

  it("leaves out ungraded written answers instead of counting them as wrong", () => {
    const r = buildTopicReport(
      [{ questions: [{ id: "w", topic: "Objection handling", marks: 5 }, { id: "m", topic: "Objection handling", marks: 1 }], participants: [{ id: "a", name: "A" }], answers: [{ participantId: "a", questionId: "w", earned: null }, { participantId: "a", questionId: "m", earned: 1 }] }],
      60
    );
    expect(r.team[0].percent).toBe(100);
    expect(r.team[0].possible).toBe(1);
  });

  it("reports nothing when no question has a topic", () => {
    const r = buildTopicReport([{ ...session, questions: session.questions.map((q) => ({ ...q, topic: null })) }], 60);
    expect(r.team).toEqual([]);
    expect(r.topics).toEqual([]);
  });

  it("writes a CSV with a TEAM row and the topics to work on", () => {
    const csv = buildTopicReportCsv(buildTopicReport([session], 60), 60).split("\n");
    expect(csv[0]).toContain("Payment plan %");
    expect(csv[1].startsWith("TEAM")).toBe(true);
    expect(csv.length).toBe(4);
  });
});
