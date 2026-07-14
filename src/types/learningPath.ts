export type DifficultyLevel =
  | "beginner"
  | "intermediate"
  | "advanced";

export interface LearningPath {

  id: string;

  path_code: string;

  path_name: string;

  description: string;

  thumbnail_url: string;

  estimated_duration: number;

  difficulty_level: DifficultyLevel;

  prerequisite_path_id: string | null;

  certificate_template_id: string | null;

  active: boolean;

  published: boolean;

  display_order: number;

  created_at: string;

  updated_at: string;

}

export type LearningPathForm = Omit<
  LearningPath,
  "id" | "created_at" | "updated_at"
>;

export const defaultLearningPathForm: LearningPathForm = {
  path_code:               "",
  path_name:               "",
  description:             "",
  thumbnail_url:           "",
  estimated_duration:      0,
  difficulty_level:        "beginner",
  prerequisite_path_id:    null,
  certificate_template_id: null,
  active:                  true,
  published:               false,
  display_order:           1,
};
