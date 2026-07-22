// src/services/videoLibrary/videoLibraryService.ts
//
// Collects every video lesson across every course an employee is
// allowed to see (respecting Course Visibility) into one flat, real
// list — the "Videos" sidebar section. YouTube thumbnails are derived
// directly from the real video URL (YouTube's own predictable
// thumbnail CDN pattern) — nothing uploaded, nothing mocked.

import { loadModules } from '../module/moduleService';
import { loadLessons } from '../lessonBuilder/lessonBuilderService';
import { loadVisibleCoursesForEmployee } from '../courseVisibility/courseVisibilityService';

export interface VideoLibraryItem {
  lessonId: string;
  lessonTitle: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationMinutes: number;
  courseId: string;
  courseName: string;
  moduleId: string;
  moduleName: string;
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function thumbnailForVideo(url: string, moduleThumbnail: string): string {
  const youtubeId = extractYoutubeId(url);
  if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  return moduleThumbnail || '';
}

export async function loadVideoLibraryForEmployee(employeeId: string): Promise<VideoLibraryItem[]> {
  const [visibleCourses, modules, lessons] = await Promise.all([
    loadVisibleCoursesForEmployee(employeeId),
    loadModules(),
    loadLessons(),
  ]);

  const visibleCourseIds = new Set(visibleCourses.map((c) => c.id));
  const courseById = new Map(visibleCourses.map((c) => [c.id, c]));
  const visibleModules = modules.filter((m) => visibleCourseIds.has(m.course_id));
  const moduleById = new Map(visibleModules.map((m) => [m.id, m]));

  return lessons
    .filter((l) => l.lesson_type === 'video' && l.video_url && moduleById.has(l.module_id) && l.active)
    .map((lesson) => {
      const module = moduleById.get(lesson.module_id)!;
      const course = courseById.get(module.course_id);
      return {
        lessonId: lesson.id,
        lessonTitle: lesson.lesson_title || 'Untitled Video',
        videoUrl: lesson.video_url,
        thumbnailUrl: thumbnailForVideo(lesson.video_url, module.thumbnail),
        durationMinutes: lesson.duration_minutes,
        courseId: module.course_id,
        courseName: course?.course_name ?? 'Unknown Course',
        moduleId: module.id,
        moduleName: module.module_name,
      };
    });
}
