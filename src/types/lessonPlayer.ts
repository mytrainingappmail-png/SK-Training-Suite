// src/types/lessonPlayer.ts

export type LessonPlayerType   = 'video' | 'text' | 'document' | 'scorm' | 'quiz';
export type LessonResourceType = 'video' | 'pdf' | 'image' | 'zip' | 'other';

export interface LessonPlayerResource {
  id:            string;
  resourceTitle: string;
  resourceType:  LessonResourceType;
  fileUrl:       string;
  description:   string;
  displayOrder:  number;
  downloadable:  boolean;
}

export interface LessonPlayerLesson {
  id:              string;
  moduleId:        string;
  lessonTitle:     string;
  lessonType:      LessonPlayerType;
  content:         string;
  videoUrl:        string;
  durationMinutes: number;
  displayOrder:    number;
  downloadable:    boolean;
  resources:       LessonPlayerResource[];
  /** Platform-operator-only setting on the parent course — only ever
   * applied on top of a 'text'-type lesson's content, never video. */
  watermarkEnabled: boolean;
  watermarkText:    string;
}
