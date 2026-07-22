// src/components/learning/Projects.tsx
//
// "Projects" sidebar section — real Categories, each showing its
// visible courses and any real "document" (PDF) resource attached as a
// downloadable brochure. Same visual language as MyCourses/LearningHome,
// with a more colorful/photographic real-estate-brochure feel.

import { useEffect, useState } from 'react';
import { loadProjectsForEmployee } from '../../services/projects/projectsService';
import { getCurrentUser } from '../../services/auth/session';
import type { Project } from '../../services/projects/projectsService';

function IconFolder({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-19.5 0v6a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25v-6m-19.5 0V6a2.25 2.25 0 0 1 2.25-2.25h5.379a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H19.5A2.25 2.25 0 0 1 21.75 9v3.75" /></svg>);
}
function IconBuilding({ className = 'h-7 w-7' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h9a1.5 1.5 0 0 1 1.5 1.5V21M4.5 3v18M4.5 3H3m10.5 0H15m-1.5 18V15a1.5 1.5 0 0 1 1.5-1.5h1.5A1.5 1.5 0 0 1 18 15v6M15 3l4.5 3v15M18.75 3H15M7.5 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6h1.5m-1.5 3h1.5m-1.5 3h1.5" /></svg>);
}
function IconArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>);
}
function IconArrowLeft({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>);
}
function IconPdf({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>);
}
function IconDownload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
}

// Rotating gradient palette so the project grid reads as colorful and
// distinct, even with no per-category photo available.
const CATEGORY_GRADIENTS = [
  'from-indigo-500 to-violet-500',
  'from-rose-500 to-orange-400',
  'from-emerald-500 to-teal-400',
  'from-sky-500 to-cyan-400',
  'from-amber-500 to-yellow-400',
  'from-fuchsia-500 to-pink-500',
];

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />)}
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
  const openProjectIndex = projects.findIndex((p) => p.categoryId === openProjectId);
  const openGradient = CATEGORY_GRADIENTS[Math.max(openProjectIndex, 0) % CATEGORY_GRADIENTS.length];

  if (openProject) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`bg-gradient-to-r ${openGradient} px-8 py-8 text-white`}>
          <button onClick={() => setOpenProjectId(null)} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 transition hover:text-white">
            <IconArrowLeft /> Back to Projects
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <IconBuilding />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{openProject.categoryName}</h2>
              {openProject.description && <p className="mt-1 text-sm text-white/80">{openProject.description}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-5 p-8">
          {openProject.courses.map((course) => (
            <div key={course.courseId} className="flex flex-wrap items-start gap-4 rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300 hover:shadow-md">
              <div className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${openGradient}`}>
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/70"><IconBuilding className="h-9 w-9" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-800">{course.courseName}</p>
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
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {course.brochures.map((b) => (
                      <a
                        key={b.resourceId}
                        href={b.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition hover:border-red-200 hover:bg-red-50/40"
                      >
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-500">
                          <IconPdf />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{b.title}</p>
                          <p className="text-xs text-slate-400">Tap to download</p>
                        </div>
                        <IconDownload className="h-4 w-4 flex-shrink-0 text-slate-400 transition group-hover:text-red-500" />
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
          className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
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
          {filtered.map((project, index) => {
            const gradient = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
            const brochureCount = project.courses.reduce((sum, c) => sum + c.brochures.length, 0);
            return (
              <button
                key={project.categoryId}
                onClick={() => setOpenProjectId(project.categoryId)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl"
              >
                <div className={`relative h-24 bg-gradient-to-br ${gradient}`}>
                  <div className="absolute -bottom-6 left-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-md ring-4 ring-white">
                    <IconFolder className="h-7 w-7" />
                  </div>
                  <IconArrowRight className="absolute right-4 top-4 h-5 w-5 text-white/70 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
                <div className="flex-1 px-5 pb-5 pt-9">
                  <p className="font-bold text-slate-800">{project.categoryName}</p>
                  {project.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{project.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {project.courses.length} course{project.courses.length === 1 ? '' : 's'}
                    </span>
                    {brochureCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-500">
                        <IconPdf className="h-3 w-3" /> {brochureCount} brochure{brochureCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default Projects;
