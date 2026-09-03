// src/types/coursePlayer.ts

export type LessonType    = 'video' | 'text' | 'document' | 'scorm' | 'quiz';
export type ResourceType  = 'video' | 'pdf' | 'image' | 'zip' | 'other';

export interface CoursePlayerResource {
  id:            string;
  resourceTitle: string;
  resourceType:  ResourceType;
  fileUrl:       string;
  description:   string;
  displayOrder:  number;
  downloadable:  boolean;
}

export interface CoursePlayerLesson {
  id:              string;
  lessonTitle:     string;
  lessonType:      LessonType;
  content:         string;
  videoUrl:        string;
  thumbnail:       string;
  durationMinutes: number;
  displayOrder:    number;
  downloadable:    boolean;
  resources:       CoursePlayerResource[];
  completed:       boolean;
  /** Set only for a 'quiz'-type lesson that has a linked Assessment — this is that module's test. */
  assessmentId:    string | null;
}

export interface CoursePlayerModule {
  id:               string;
  moduleCode:       string;
  moduleName:       string;
  description:      string;
  moduleOrder:      number;
  estimatedMinutes: number;
  thumbnail:        string;
  lessons:          CoursePlayerLesson[];
}

export interface CoursePlayerCourse {
  id:                 string;
  courseCode:         string;
  courseName:         string;
  shortDescription:   string;
  fullDescription:    string;
  thumbnail:          string;
  level:              string;
  durationDays:       number;
  durationHours:      number;
  passingPercentage:  number;
  certificateEnabled: boolean;
  /** Admin toggle — when true, "Next" is disabled until the current lesson is marked complete (Back is never gated). */
  requireCompletionBeforeNext: boolean;
  /** Admin toggle — when true, a module's quiz-lesson (if it has one) must be passed before the next module unlocks. */
  testCompulsoryAfterModule: boolean;
  modules:            CoursePlayerModule[];
}

export interface CoursePlayerEnrollment {
  enrollmentId:         string;
  status:               string;
  completionPercentage: number;
  dueDate:              string;
  completedAt:          string | null;
}

export interface CoursePlayerData {
  course:     CoursePlayerCourse;
  enrollment: CoursePlayerEnrollment;
}
