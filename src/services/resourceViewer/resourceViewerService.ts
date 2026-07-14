// src/services/resourceViewer/resourceViewerService.ts
// Business logic only — no Supabase imports.

import {
  getResourceById,
  getResourcesByLesson,
} from '../../repositories/resourceViewer/resourceViewerRepository';
import type { ResourceViewerItem } from '../../types/resourceViewer';

export async function loadResource(resourceId: string): Promise<ResourceViewerItem> {
  if (!resourceId) throw new Error('Resource ID is required.');
  return await getResourceById(resourceId);
}

export async function loadLessonResources(
  lessonId: string
): Promise<ResourceViewerItem[]> {
  if (!lessonId) throw new Error('Lesson ID is required.');
  return await getResourcesByLesson(lessonId);
}
