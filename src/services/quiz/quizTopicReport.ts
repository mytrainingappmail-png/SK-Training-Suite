// Topic report: which topics a trainee - and the whole team - is weak in, worked out from the answers of one or more tests.
// Every question may carry a topic (e.g. "RERA", "Payment plan"). A trainee's score in a topic is the marks they earned in it divided by
// the marks of its questions (a question they did not answer counts as zero). The same trainee in several tests is one person, found by name.
// Nothing here talks to the database - the loaders (quizTopicRepository) hand in plain rows, so it is easy to test.

import { csvEscape } from "./quizCsvService";

/** Shown for questions that have no topic, when others do. */
export const NO_TOPIC_LABEL = "No topic";

export interface TopicQuestion {
  id: string;
  topic: string | null;
  marks: number;
}

export interface TopicAnswer {
  participantId: string;
  questionId: string;
  /** Marks earned for this answer; null = written answer not graded yet (left out of the percentage rather than counted as zero). */
  earned: number | null;
}

/** One test's worth of data (a live quiz session or an exam session). */
export interface TopicSessionInput {
  questions: TopicQuestion[];
  participants: { id: string; name: string }[];
  answers: TopicAnswer[];
}

export interface TopicCell {
  earned: number;
  possible: number;
  percent: number;
}

export interface TopicTeamRow extends TopicCell {
  topic: string;
  /** Different questions in this topic. */
  questions: number;
}

export interface TopicPerson {
  name: string;
  overall: TopicCell;
  byTopic: Record<string, TopicCell>;
  /** Topics under the threshold, weakest first. */
  weakTopics: string[];
}

export interface TopicReport {
  /** Weakest topic first. */
  team: TopicTeamRow[];
  /** Topic column order for the trainee table (same as team). */
  topics: string[];
  /** Weakest overall first. */
  people: TopicPerson[];
  /** How many questions have a topic / have none. */
  taggedQuestions: number;
  untaggedQuestions: number;
}

const cell = (earned: number, possible: number): TopicCell => ({ earned, possible, percent: possible > 0 ? Math.round((earned / possible) * 100) : 0 });
const personKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export function buildTopicReport(sessions: TopicSessionInput[], weakBelowPercent: number): TopicReport {
  const people = new Map<string, { name: string; buckets: Map<string, { earned: number; possible: number }> }>();
  const teamBuckets = new Map<string, { earned: number; possible: number }>();
  const questionsByTopic = new Map<string, Set<string>>();
  let tagged = 0;
  let untagged = 0;
  const anyTagged = sessions.some((s) => s.questions.some((q) => q.topic?.trim()));

  for (const s of sessions) {
    const answerOf = new Map<string, TopicAnswer>();
    for (const a of s.answers) answerOf.set(`${a.participantId}|${a.questionId}`, a);

    for (const q of s.questions) {
      const topic = q.topic?.trim() || NO_TOPIC_LABEL;
      if (topic === NO_TOPIC_LABEL) untagged++; else tagged++;
      if (!questionsByTopic.has(topic)) questionsByTopic.set(topic, new Set());
      questionsByTopic.get(topic)!.add(q.id);
    }

    for (const p of s.participants) {
      const key = personKey(p.name);
      if (!people.has(key)) people.set(key, { name: p.name.trim(), buckets: new Map() });
      const person = people.get(key)!;
      for (const q of s.questions) {
        const topic = q.topic?.trim() || NO_TOPIC_LABEL;
        const answer = answerOf.get(`${p.id}|${q.id}`);
        if (answer && answer.earned === null) continue; // not graded yet
        const marks = q.marks > 0 ? q.marks : 1;
        const earned = Math.min(marks, Math.max(0, answer?.earned ?? 0));
        for (const bucketMap of [person.buckets, teamBuckets]) {
          const b = bucketMap.get(topic) ?? { earned: 0, possible: 0 };
          b.earned += earned;
          b.possible += marks;
          bucketMap.set(topic, b);
        }
      }
    }
  }

  // "No topic" only matters when the trainer has tagged some questions - otherwise there is nothing to report.
  const topicNames = [...teamBuckets.keys()].filter((t) => anyTagged || t !== NO_TOPIC_LABEL);
  const team: TopicTeamRow[] = topicNames
    .map((topic) => {
      const b = teamBuckets.get(topic)!;
      return { topic, questions: questionsByTopic.get(topic)?.size ?? 0, ...cell(b.earned, b.possible) };
    })
    .filter((r) => anyTagged && r.possible > 0)
    .sort((a, b) => (a.topic === NO_TOPIC_LABEL ? 1 : 0) - (b.topic === NO_TOPIC_LABEL ? 1 : 0) || a.percent - b.percent || a.topic.localeCompare(b.topic));
  const topics = team.map((r) => r.topic);

  const peopleRows: TopicPerson[] = [...people.values()].map((p) => {
    let earned = 0;
    let possible = 0;
    const byTopic: Record<string, TopicCell> = {};
    for (const [topic, b] of p.buckets) {
      if (!topics.includes(topic)) continue;
      byTopic[topic] = cell(b.earned, b.possible);
      earned += b.earned;
      possible += b.possible;
    }
    const weakTopics = topics
      .filter((t) => t !== NO_TOPIC_LABEL && byTopic[t] && byTopic[t].possible > 0 && byTopic[t].percent < weakBelowPercent)
      .sort((a, b) => byTopic[a].percent - byTopic[b].percent);
    return { name: p.name, overall: cell(earned, possible), byTopic, weakTopics };
  });
  peopleRows.sort((a, b) => a.overall.percent - b.overall.percent || a.name.localeCompare(b.name));

  return { team, topics, people: peopleRows, taggedQuestions: tagged, untaggedQuestions: untagged };
}

/** The trainee table as a spreadsheet: a TEAM row first, then every trainee with a % per topic and the topics to work on. */
export function buildTopicReportCsv(report: TopicReport, weakBelowPercent: number): string {
  const header = ["Trainee", "Overall %", ...report.topics.map((t) => `${t} %`), `Needs work on (below ${weakBelowPercent}%)`];
  const teamRow = [
    "TEAM",
    String(report.people.length ? Math.round(report.team.reduce((s, r) => s + r.earned, 0) / Math.max(1, report.team.reduce((s, r) => s + r.possible, 0)) * 100) : 0),
    ...report.topics.map((t) => String(report.team.find((r) => r.topic === t)?.percent ?? "")),
    report.team.filter((r) => r.topic !== NO_TOPIC_LABEL && r.percent < weakBelowPercent).map((r) => r.topic).join("; "),
  ];
  const rows = report.people.map((p) => [
    p.name,
    String(p.overall.percent),
    ...report.topics.map((t) => (p.byTopic[t] ? String(p.byTopic[t].percent) : "")),
    p.weakTopics.join("; "),
  ]);
  return [header, teamRow, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}
