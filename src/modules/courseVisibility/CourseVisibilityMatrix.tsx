// src/modules/courseVisibility/CourseVisibilityMatrix.tsx
//
// Courses (rows) × Designations (columns) checkbox matrix — same
// interaction pattern as PermissionMatrix, which already works well
// for this app. A course with NO checkboxes ticked is visible to
// EVERYONE (default, backward-compatible); ticking one or more
// designations restricts it to only those designations. Not yet wired
// into sidebar/routes — standalone module.

import { useEffect, useMemo, useState } from 'react';
import {
  loadCourseVisibility,
  saveVisibilityMatrixChanges,
  loadDesignationsForMatrix,
} from '../../services/courseVisibility/courseVisibilityService';
import { loadCourses } from '../../services/course/courseService';
import type { CourseVisibility } from '../../types/courseVisibility';
import type { Course } from '../../types/course';
import type { Designation } from '../../types/designation';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconSave({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}
function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>{children}</button>);
}

function Skeleton() {
  return (<div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />)}</div>);
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"><p className="font-semibold">Failed to load course visibility</p><p className="mt-1">{message}</p><SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton></div>);
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" /></svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function CourseVisibilityMatrix() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [visibility, setVisibility] = useState<CourseVisibility[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // grid[courseId][designationId] = visible (current, editable state)
  const [grid, setGrid] = useState<Record<string, Record<string, boolean>>>({});

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCourses(), loadDesignationsForMatrix(), loadCourseVisibility()])
      .then(([courseRows, designationRows, visibilityRows]) => {
        setCourses(courseRows);
        setDesignations(designationRows.filter((d) => d.active));
        setVisibility(visibilityRows);

        const nextGrid: Record<string, Record<string, boolean>> = {};
        courseRows.forEach((course) => {
          nextGrid[course.id] = {};
          designationRows.forEach((designation) => {
            nextGrid[course.id][designation.id] = visibilityRows.some(
              (v) => v.course_id === course.id && v.designation_id === designation.id
            );
          });
        });
        setGrid(nextGrid);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load course visibility.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const searchTerm = search.trim().toLowerCase();
  const filteredCourses = useMemo(
    () => courses.filter((c) => !searchTerm || c.course_name.toLowerCase().includes(searchTerm)),
    [courses, searchTerm]
  );

  function toggleCell(courseId: string, designationId: string) {
    setGrid((prev) => ({
      ...prev,
      [courseId]: { ...prev[courseId], [designationId]: !prev[courseId]?.[designationId] },
    }));
  }

  function isCourseRestricted(courseId: string): boolean {
    return Object.values(grid[courseId] ?? {}).some(Boolean);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const changes: { courseId: string; designationId: string; visible: boolean }[] = [];
      courses.forEach((course) => {
        designations.forEach((designation) => {
          const current = grid[course.id]?.[designation.id] ?? false;
          const original = visibility.some(
            (v) => v.course_id === course.id && v.designation_id === designation.id
          );
          if (current !== original) {
            changes.push({ courseId: course.id, designationId: designation.id, visible: current });
          }
        });
      });

      if (changes.length === 0) {
        showToast('No changes to save');
        return;
      }

      await saveVisibilityMatrixChanges(changes);
      fetchAll();
      showToast(`Saved ${changes.length} change(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save course visibility.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Course Visibility</h2>
          <p className="text-sm text-slate-500">
            Tick a designation to restrict a course to it. A course with no ticks is visible to everyone.
          </p>
        </div>
        <PrimaryButton onClick={handleSave} disabled={saving}>
          {saving ? <IconSpinner className="h-3.5 w-3.5" /> : <IconSave className="h-4 w-4" />} Save
        </PrimaryButton>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search courses…"
          className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
        />
      </div>

      {designations.length === 0 ? (
        <EmptyState message="No active designations found — add some in Designations first." />
      ) : filteredCourses.length === 0 ? (
        <EmptyState message="No courses match your search." />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="sticky left-0 bg-slate-50 px-4 py-3">Course</th>
                {designations.map((d) => (
                  <th key={d.id} className="px-4 py-3 text-center">{d.designation_name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCourses.map((course) => (
                <tr key={course.id}>
                  <td className="sticky left-0 bg-white px-4 py-2.5">
                    <p className="text-sm font-semibold text-slate-700">{course.course_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {isCourseRestricted(course.id) ? 'Restricted' : 'Visible to everyone'}
                    </p>
                  </td>
                  {designations.map((d) => (
                    <td key={d.id} className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={!!grid[course.id]?.[d.id]}
                        onChange={() => toggleCell(course.id, d.id)}
                        className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default CourseVisibilityMatrix;
