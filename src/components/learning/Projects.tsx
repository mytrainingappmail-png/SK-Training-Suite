// src/components/learning/Projects.tsx
//
// "Projects" sidebar section — a flat, browsable list of real estate
// projects (no category grouping — every project used to need its own
// one-to-one category, which added a step without adding real value).
// Each project can show its description, downloadable brochures, and any
// Page/Test/FAQ sections an admin has added. Same visual language as
// MyCourses/LearningHome, with a more colorful/photographic
// real-estate-brochure feel.

import { useEffect, useState } from 'react';
import { loadProjectsForEmployee } from '../../services/projects/projectsService';
import { getCurrentUser } from '../../services/auth/session';
import SectionHeroBanner from './SectionHeroBanner';
import AssessmentPlayer from '../assessment/AssessmentPlayer';
import type { Project } from '../../services/projects/projectsService';

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
// distinct, even with no per-project photo available.
const GRADIENTS = [
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
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [openFaqKeys, setOpenFaqKeys] = useState<Set<string>>(new Set());
  const [activeTestAssessmentId, setActiveTestAssessmentId] = useState<string | null>(null);

  function toggleFaq(key: string) {
    setOpenFaqKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
    (p) => !searchTerm || p.projectName.toLowerCase().includes(searchTerm)
  );

  const openProject = projects.find((p) => p.projectId === openProjectId) ?? null;
  const openProjectIndex = projects.findIndex((p) => p.projectId === openProjectId);
  const openGradient = GRADIENTS[Math.max(openProjectIndex, 0) % GRADIENTS.length];

  if (openProject) {
    return (
      <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`bg-gradient-to-r ${openGradient} px-8 py-8 text-white`}>
          <button onClick={() => setOpenProjectId(null)} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 transition hover:text-white">
            <IconArrowLeft /> Back to Projects
          </button>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-white/20 backdrop-blur-sm">
              {openProject.thumbnail ? (
                <img src={openProject.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><IconBuilding className="h-9 w-9" /></div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{openProject.projectName}</h2>
              {openProject.shortDescription && <p className="mt-1 text-sm text-white/80">{openProject.shortDescription}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-5 p-8">
          {openProject.fullDescription && (
            <div>
              <button
                onClick={() => setShowFullDetails((v) => !v)}
                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline"
              >
                {showFullDetails ? 'Hide Full Details ▲' : 'View Full Details ▼'}
              </button>
              {showFullDetails && (
                <div
                  className="prose prose-sm mt-3 max-w-none rounded-xl bg-slate-50 p-4 text-sm leading-relaxed [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2"
                  dangerouslySetInnerHTML={{ __html: openProject.fullDescription }}
                />
              )}
            </div>
          )}

          {openProject.brochures.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {openProject.brochures.map((b) => (
                <a
                  key={b.resourceId}
                  href={b.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md active:scale-95"
                >
                  <IconPdf className="h-4 w-4" />
                  Download Brochure
                  <IconDownload className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          )}

          {openProject.sections.length > 0 && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {openProject.sections.map((section) => {
                if (section.section_type === 'page') {
                  const key = `page-${section.id}`;
                  return (
                    <div key={section.id}>
                      <button
                        onClick={() => toggleFaq(key)}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:underline"
                      >
                        {openFaqKeys.has(key) ? '▼' : '▶'} {section.title}
                      </button>
                      {openFaqKeys.has(key) && (
                        <div
                          className="prose prose-sm mt-2 max-w-none rounded-xl bg-slate-50 p-4 text-sm leading-relaxed [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2"
                          dangerouslySetInnerHTML={{ __html: section.page_content }}
                        />
                      )}
                    </div>
                  );
                }
                if (section.section_type === 'faq') {
                  return (
                    <div key={section.id}>
                      <p className="mb-2 text-sm font-semibold text-slate-700">{section.title}</p>
                      <div className="space-y-2">
                        {section.faq_items.map((item, i) => {
                          const key = `faq-${section.id}-${i}`;
                          return (
                            <div key={key} className="rounded-xl bg-slate-50 p-3">
                              <button
                                onClick={() => toggleFaq(key)}
                                className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-700"
                              >
                                {item.question}
                                <span className="ml-2 flex-shrink-0 text-slate-400">{openFaqKeys.has(key) ? '−' : '+'}</span>
                              </button>
                              {openFaqKeys.has(key) && (
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.answer}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                // section_type === 'test'
                return (
                  <div key={section.id} className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-4">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">{section.title}</p>
                      <p className="text-xs text-amber-700">Take this test to confirm you've gone through {openProject.projectName}.</p>
                    </div>
                    {section.assessment_id && (
                      <button
                        onClick={() => setActiveTestAssessmentId(section.assessment_id)}
                        className="flex-shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-95"
                      >
                        Take Test
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeTestAssessmentId && user?.id && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
            <AssessmentPlayer
              assessmentId={activeTestAssessmentId}
              employeeId={user.id}
              onFinish={() => setActiveTestAssessmentId(null)}
            />
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        title="Projects"
        subtitle="Browse training by project, with brochures to download."
        statLabel="Projects"
        statValue={projects.length}
      />

    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

      <div className="mb-6">
        <input
          className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          placeholder="Search by project name..."
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
            const gradient = GRADIENTS[index % GRADIENTS.length];
            return (
              <button
                key={project.projectId}
                onClick={() => setOpenProjectId(project.projectId)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl"
              >
                <div className={`relative h-24 bg-gradient-to-br ${gradient}`}>
                  <div className="absolute -bottom-6 left-5 h-14 w-14 overflow-hidden rounded-2xl bg-white shadow-md ring-4 ring-white">
                    {project.thumbnail ? (
                      <img src={project.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-700"><IconBuilding className="h-7 w-7" /></div>
                    )}
                  </div>
                  <IconArrowRight className="absolute right-4 top-4 h-5 w-5 text-white/70 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
                <div className="flex-1 px-5 pb-5 pt-9">
                  <p className="font-bold text-slate-800">{project.projectName}</p>
                  {project.shortDescription && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{project.shortDescription}</p>}
                  {project.brochures.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-500">
                        <IconPdf className="h-3 w-3" /> {project.brochures.length} brochure{project.brochures.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

    </div>
    </div>
  );
}

export default Projects;
