export type LessonType =
  | "video"
  | "text"
  | "document"
  | "audio"
  | "ppt"
  | "pdf"
  | "image"
  | "youtube"
  | "scorm"
  | "assignment"
  | "quiz"
  | "live";

export interface Lesson {

  id: string;

  module_id: string;

  lesson_title: string;

  lesson_type: LessonType;

  content: string;

  video_url: string;

  duration_minutes: number;

  display_order: number;

  downloadable: boolean;

  active: boolean;

  created_at: string;

}

export type LessonForm = Omit<
  Lesson,
  "id" | "created_at"
>;

export const defaultLessonForm: LessonForm = {
  module_id:        "",
  lesson_title:     "",
  lesson_type:      "video",
  content:          "",
  video_url:        "",
  duration_minutes: 1,
  display_order:    1,
  downloadable:     false,
  active:           true,
};
