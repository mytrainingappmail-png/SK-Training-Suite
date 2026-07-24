export type BrainstormingDifficulty = "Easy" | "Medium" | "Hard";
export type OptionLetter = "a" | "b" | "c" | "d";

export interface BrainstormingItem {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: OptionLetter;
  answer: string; // shown as the explanation after answering
  category: string;
  difficulty: BrainstormingDifficulty;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type BrainstormingItemForm = Pick<
  BrainstormingItem,
  "question" | "option_a" | "option_b" | "option_c" | "option_d" | "correct_option" | "answer" | "category" | "difficulty" | "active" | "display_order"
>;

export const defaultBrainstormingItemForm: BrainstormingItemForm = {
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_option: "a",
  answer: "",
  category: "General",
  difficulty: "Medium",
  active: true,
  display_order: 0,
};
