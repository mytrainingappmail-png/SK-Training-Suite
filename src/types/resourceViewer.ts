// src/types/resourceViewer.ts

export type ResourceViewerType =
  | 'video'
  | 'pdf'
  | 'image'
  | 'audio'
  | 'external_url'
  | 'download';

export interface ResourceViewerLesson {
  id:          string;
  lessonTitle: string;
  moduleId:    string;
}

export interface ResourceViewerItem {
  id:            string;
  lessonId:      string;
  resourceTitle: string;
  resourceType:  ResourceViewerType;
  fileUrl:       string;
  description:   string;
  displayOrder:  number;
  downloadable:  boolean;
  lesson?:       ResourceViewerLesson;
}
