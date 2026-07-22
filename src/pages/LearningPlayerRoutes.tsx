// src/pages/LearningPlayerRoutes.tsx
//
// Small route-level wrappers so App.tsx's <Route> elements (which only
// have access to raw URL params) can satisfy the exact props these
// pre-existing player components expect. No change to CoursePlayer.tsx
// or LessonPlayer.tsx themselves.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CoursePlayer from '../components/learning/CoursePlayer';
import LessonPlayer from '../components/learning/LessonPlayer';
import ResourceViewer from '../components/learning/ResourceViewer';
import { loadLesson } from '../services/lessonPlayer/lessonPlayerService';
import { loadResource } from '../services/resourceViewer/resourceViewerService';

// ROUTES.COURSE_PLAYER's :courseId param is the enrollment being
// played (CoursePlayer takes enrollmentId directly, not a course id).
export function CoursePlayerRoute() {
  const { courseId } = useParams<{ courseId: string }>();
  if (!courseId) return null;
  return <CoursePlayer enrollmentId={courseId} />;
}

// ROUTES.LESSON_PLAYER only carries :lessonId, but LessonPlayer also
// needs moduleId — resolved here via the existing lessonPlayerService.
export function LessonPlayerRoute() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    loadLesson(lessonId)
      .then((lesson) => {
        if (!cancelled) setModuleId(lesson.moduleId);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load lesson.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lessonId]);

  if (!lessonId) return null;
  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>;
  if (error || !moduleId) return <div className="p-6 text-sm text-red-600">{error || 'Lesson not found.'}</div>;

  return <LessonPlayer lessonId={lessonId} moduleId={moduleId} />;
}

// ROUTES.RESOURCE_VIEWER only carries :resourceId, but ResourceViewer
// also needs lessonId — resolved here via the existing
// resourceViewerService, same pattern as LessonPlayerRoute above.
export function ResourceViewerRoute() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resourceId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    loadResource(resourceId)
      .then((resource) => {
        if (!cancelled) setLessonId(resource.lessonId);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load resource.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [resourceId]);

  if (!resourceId) return null;
  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>;
  if (error || !lessonId) return <div className="p-6 text-sm text-red-600">{error || 'Resource not found.'}</div>;

  return <ResourceViewer resourceId={resourceId} lessonId={lessonId} />;
}
