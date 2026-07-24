export type BrainstormingDifficulty = "Easy" | "Medium" | "Hard";

export interface BrainstormingItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  difficulty: BrainstormingDifficulty;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type BrainstormingItemForm = Pick<
  BrainstormingItem,
  "question" | "answer" | "category" | "difficulty" | "active" | "display_order"
>;

export const defaultBrainstormingItemForm: BrainstormingItemForm = {
  question: "",
  answer: "",
  category: "General",
  difficulty: "Medium",
  active: true,
  display_order: 0,
};
