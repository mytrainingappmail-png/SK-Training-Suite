// A plain-words description of what players will actually see, derived from the quiz's three shuffle switches.
// Used in the builder, the launch check and the host screen so everyone reads the same explanation.

export interface PlayModeFlags {
  shuffle_options: boolean;
  shuffle_questions: boolean;
  shuffle_questions_per_participant: boolean;
}

export interface PlayModeSummary {
  questions: { icon: string; text: string; same: boolean };
  answers: { icon: string; text: string; same: boolean };
  /** true when every phone shows exactly what the host screen shows */
  sameOnEveryScreen: boolean;
}

export function describePlayMode(f: PlayModeFlags): PlayModeSummary {
  const questions = f.shuffle_questions_per_participant
    ? { icon: "🕵️", text: "Question order is different for every player (anti-cheat)", same: false }
    : f.shuffle_questions
      ? { icon: "🔀", text: "Question order is shuffled once — the same on every screen", same: true }
      : { icon: "📋", text: "Question order is as written — the same on every screen", same: true };
  const answers = f.shuffle_options
    ? { icon: "🔀", text: "Answer order (A/B/C/D) is different on every phone — it will not match the host screen", same: false }
    : { icon: "✅", text: "Answer order is the same on every screen", same: true };
  return { questions, answers, sameOnEveryScreen: questions.same && answers.same };
}

/** The switches that make phones differ from each other and from the host screen. */
export function hasPerPlayerShuffle(f: PlayModeFlags): boolean {
  return f.shuffle_options || f.shuffle_questions_per_participant;
}
