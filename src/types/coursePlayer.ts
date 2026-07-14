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
  durationMinutes: number;
  displayOrder:    number;
  downloadable:    boolean;
  resources:       CoursePlayerResource[];
  completed:       boolean;
}

export interface CoursePlayerModule {
  id:               string;
  moduleCode:       string;
  moduleName:       string;
  description:      string;
  moduleOrder:      number;
  estimatedMinutes: number;
  lessons:          CoursePlayerLesson[];
}

export interface CoursePlayerCourse {
  id:                 string;
  courseCode:         string;
  courseName:         string;
  shortDescription:   string;
  thumbnail:          string;
  level:              string;
  durationDays:       number;
  durationHours:      number;
  passingPercentage:  number;
  certificateEnabled: boolean;
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
