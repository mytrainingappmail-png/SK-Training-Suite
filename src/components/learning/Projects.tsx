// src/components/learning/Projects.tsx
//
// "Projects" sidebar section — real Categories, each showing its
// visible courses and any real "document" (PDF) resource attached as a
// downloadable brochure. Same visual language as MyCourses/LearningHome.

import { useEffect, useState } from 'react';
import { loadProjectsForEmployee } from '../../services/projects/projectsService';
import { getCurrentUser } from '../../services/auth/session';
import type { Project } from '../../services/projects/projectsService';

function IconFolder({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-19.5 0v6a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25v-6m-19.5 0V6a2.25 2.25 0 0 1 2.25-2.25h5.379a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H19.5A2.25 2.25 0 0 1 21.75 9v3.75" /></svg>);
}
function IconDocument({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>);
}
function IconArrowLeft({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>);
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}
    </div>
  );
}

function Projects() {
  const user = getCurrentUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(new Set());

  function toggleDetails(courseId: string) {
    setExpandedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  useEffect(() => {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    loadProjectsForEmployee(user.id)
      .then(setProjects)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load projects.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const searchTerm = search.trim().toLowerCase();
  const filtered = projects.filter(
    (p) =>
      !searchTerm ||
      p.categoryName.toLowerCase().includes(searchTerm) ||
      p.courses.some((c) => c.courseName.toLowerCase().includes(searchTerm))
  );

  const openProject = projects.find((p) => p.categoryId === openProjectId) ?? null;

  if (openProject) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <button onClick={() => setOpenProjectId(null)} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <IconArrowLeft /> Back to Projects
        </button>

        <h2 className="text-2xl font-bold text-slate-800">{openProject.categoryName}</h2>
        {openProject.description && <p className="mt-1 text-slate-500">{openProject.description}</p>}

        <div className="mt-8 space-y-5">
          {openProject.courses.map((course) => (
            <div key={course.courseId} className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 p-5">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300"><IconFolder /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">{course.courseName}</p>
                {course.shortDescription && <p className="mt-1 text-sm text-slate-500">{course.shortDescription}</p>}

                {course.fullDescription && (
                  <>
                    <button
                      onClick={() => toggleDetails(course.courseId)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      {expandedCourseIds.has(course.courseId) ? 'Hide Full Details ▲' : 'View Full Details ▼'}
                    </button>
                    {expandedCourseIds.has(course.courseId) && (
                      <div
                        className="prose prose-sm mt-3 max-w-none rounded-xl bg-slate-50 p-4 text-sm leading-relaxed [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2"
                        dangerouslySetInnerHTML={{ __html: course.fullDescription }}
                      />
                    )}
                  </>
                )}

                {course.brochures.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {course.brochures.map((b) => (
                      <a
                        key={b.resourceId}
                        href={b.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <IconDocument className="h-3.5 w-3.5" /> Download: {b.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Projects</h2>
        <p className="mt-1 text-slate-500">Browse training by project, with brochures to download.</p>
      </div>

      <div className="mb-6">
        <input
          className="w-full rounded-xl border p-3"
          placeholder="Search by project or course name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>
      )}

      {loading && <Skeleton />}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
          {search ? `No projects match "${search}".` : 'No projects available yet.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <button
              key={project.categoryId}
              onClick={() => setOpenProjectId(project.categoryId)}
              className="flex flex-col items-start rounded-2xl border border-slate-200 p-5 text-left transition hover:shadow-lg"
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
                <IconFolder />
              </div>
              <p className="font-semibold text-slate-800">{project.categoryName}</p>
              <p className="mt-1 text-xs text-slate-400">{project.courses.length} course{project.courses.length === 1 ? '' : 's'}</p>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}

export default Projects;
