// src/types/myLearningPath.ts

export type MyLearningPathStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed';

export interface MyLearningPath {
  enrollmentId:       string;
  learningPathId:     string;
  pathCode:           string;
  pathName:           string;
  description:        string;
  thumbnailUrl:        string;
  difficultyLevel:    string;
  estimatedDuration:  number;
  totalCourses:       number;
  completedCourses:   number;
  progressPercentage: number;
  status:             MyLearningPathStatus;
  dueDate:            string;
}
