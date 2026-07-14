// src/types/contentEditor.ts
//
// Content Editor — edits the `content` column of an existing `lessons` row
// (see types/lesson.ts). This sprint builds the editor UI and editing
// experience only; actual media upload APIs ship next sprint.

export interface LessonContent {
  lessonId:    string;
  lessonTitle: string;
  content:     string; // HTML produced by the rich text editor
}
export type MediaUploadKind =
  | "image"
  | "video"
  | "document";

export interface MediaUploadResult {
  url: string;
  path: string;
  fileName: string;
}

export type LessonContentForm = Pick<LessonContent, 'content'>;
