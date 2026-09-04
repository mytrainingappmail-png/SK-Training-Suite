// src/components/learning/Projects.tsx
//
// "Projects" sidebar section — a flat, browsable list of real estate
// projects (no category grouping — every project used to need its own
// one-to-one category, which added a step without adding real value).
// Each project can show its description, downloadable brochures, and any
// Page/Test/FAQ sections an admin has added. Same visual language as
// MyCourses/LearningHome, with a more colorful/photographic
// real-estate-brochure feel.
//
// Compare mode reuses the exact same single-project detail card
// (ProjectDetailCard) stacked once per selected project, each in its own
// bordered box — not a row-by-row attribute table — so "compare" just
// means "read these side by side, one after another."

import { useEffect, useState } from 'react';
import { loadProjectsForEmployee } from '../../services/projects/projectsService';
import { loadCompletedProjectIds, markProjectComplete } from '../../services/realEstateProject/realEstateProjectService';
import { getCurrentUser } from '../../services/auth/session';
import SectionHeroBanner from './SectionHeroBanner';
import AssessmentPlayer from '../assessment/AssessmentPlayer';
import ThumbnailCard from '../shared/ThumbnailCard';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import type { Project } from '../../services/projects/projectsService';

function IconBuilding({ className = 'h-7 w-7' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h9a1.5 1.5 0 0 1 1.5 1.5V21M4.5 3v18M4.5 3H3m10.5 0H15m-1.5 18V15a1.5 1.5 0 0 1 1.5-1.5h1.5A1.5 1.5 0 0 1 18 15v6M15 3l4.5 3v15M18.75 3H15M7.5 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6h1.5m-1.5 3h1.5m-1.5 3h1.5" /></svg>);
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
function IconScale({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M12 3l-5.5 3M12 3l5.5 3m-11 0-3 6a4 4 0 0 0 8 0l-3-6h-2Zm11 0-3 6a4 4 0 0 0 8 0l-3-6h-2Z" /></svg>);
}
function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>);
}

const MAX_COMPARE = 3;

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

// ─────────────────────────────────────────────────────────────────────────────
// The single-project detail — used both for "open one project" and,
// stacked, for "compare N projects". Owns its own expand/collapse state
// so multiple instances on screen at once never fight over one toggle.
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectDetailCardProps {
  project: Project;
  gradient: string;
  completed: boolean;
  marking: boolean;
  onMarkComplete: () => void;
  onLaunchQuiz: (assessmentId: string) => void;
  indexBadge?: number;
  onRemove?: () => void;
}

function ProjectDetailCard({
  project, gradient, completed, marking, onMarkComplete, onLaunchQuiz, indexBadge, onRemove,
}: ProjectDetailCardProps) {
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function toggleKey(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
      <div className={`relative bg-gradient-to-r ${gradient} px-8 py-8 text-white`}>
        {indexBadge !== undefined && (
          <span className="absolute left-8 top-6 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-bold">#{indexBadge}</span>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label="Remove from comparison"
            className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow transition hover:bg-white"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
        <div className={`flex items-center gap-4 ${indexBadge !== undefined ? 'mt-6' : ''}`}>
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-white/20 backdrop-blur-sm">
            {project.thumbnail ? (
              <img src={project.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><IconBuilding className="h-9 w-9" /></div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{project.projectName}</h2>
            {project.shortDescription && <p className="mt-1 text-sm text-white/80">{project.shortDescription}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-8">
        {project.fullDescription && (
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
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.fullDescription) }}
              />
            )}
          </div>
        )}

        {project.brochures.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.brochures.map((b) => (
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

        {project.sections.length > 0 && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            {project.sections.map((section) => {
              if (section.section_type === 'page') {
                const key = `page-${section.id}`;
                return (
                  <div key={section.id}>
                    <button
                      onClick={() => toggleKey(key)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:underline"
                    >
                      {openKeys.has(key) ? '▼' : '▶'} {section.title}
                    </button>
                    {openKeys.has(key) && (
                      <div
                        className="prose prose-sm mt-2 max-w-none rounded-xl bg-slate-50 p-4 text-sm leading-relaxed [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.page_content) }}
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
                              onClick={() => toggleKey(key)}
                              className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-700"
                            >
                              {item.question}
                              <span className="ml-2 flex-shrink-0 text-slate-400">{openKeys.has(key) ? '−' : '+'}</span>
                            </button>
                            {openKeys.has(key) && (
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
                <div key={section.id} className={`flex items-center justify-between gap-3 rounded-xl p-4 ${completed ? 'bg-amber-50' : 'bg-slate-100'}`}>
                  <div>
                    <p className={`text-sm font-semibold ${completed ? 'text-amber-900' : 'text-slate-500'}`}>
                      {completed ? '' : '🔒 '}{section.title}
                    </p>
                    <p className={`text-xs ${completed ? 'text-amber-700' : 'text-slate-400'}`}>
                      {completed
                        ? `Take this test to confirm you've gone through ${project.projectName}.`
                        : 'Mark the project complete above to unlock this mandatory test.'}
                    </p>
                  </div>
                  {section.assessment_id && (
                    <button
                      onClick={() => completed && onLaunchQuiz(section.assessment_id!)}
                      disabled={!completed}
                      className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-95 ${
                        completed ? 'bg-amber-500 text-white hover:bg-amber-600' : 'cursor-not-allowed bg-slate-200 text-slate-400'
                      }`}
                    >
                      {completed ? 'Take Test' : 'Locked'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {project.sections.some((s) => s.section_type === 'test') && !completed && (
          <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-4 text-center">
            <p className="mb-3 text-sm font-medium text-indigo-900">
              Read through this project, then mark it complete to unlock the mandatory test.
            </p>
            <button
              onClick={onMarkComplete}
              disabled={marking}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {marking ? 'Marking…' : '✓ Mark Project as Complete'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Projects
// ─────────────────────────────────────────────────────────────────────────────

function Projects() {
  const user = getCurrentUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [activeTestAssessmentId, setActiveTestAssessmentId] = useState<string | null>(null);
  const [completedProjectIds, setCompletedProjectIds] = useState<Set<string>>(new Set());
  const [markingProjectId, setMarkingProjectId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareView, setShowCompareView] = useState(false);
  const [compareToast, setCompareToast] = useState('');

  function toggleCompareMode() {
    setCompareMode((v) => !v);
    setCompareIds([]);
    setShowCompareView(false);
  }

  function toggleCompareSelection(projectId: string) {
    setCompareIds((prev) => {
      if (prev.includes(projectId)) return prev.filter((id) => id !== projectId);
      if (prev.length >= MAX_COMPARE) {
        setCompareToast(`You can compare up to ${MAX_COMPARE} projects at a time.`);
        setTimeout(() => setCompareToast(''), 2200);
        return prev;
      }
      return [...prev, projectId];
    });
  }

  const compareProjects = compareIds
    .map((id) => projects.find((p) => p.projectId === id))
    .filter((p): p is Project => !!p);

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
    loadCompletedProjectIds(user.id).then((ids) => setCompletedProjectIds(new Set(ids))).catch(() => {});
  }, [user?.id]);

  async function handleMarkComplete(projectId: string) {
    if (!user?.id) return;
    setMarkingProjectId(projectId);
    try {
      await markProjectComplete(projectId, user.id, user.companyId ?? '');
      setCompletedProjectIds((prev) => new Set(prev).add(projectId));
    } finally {
      setMarkingProjectId(null);
    }
  }

  const searchTerm = search.trim().toLowerCase();
  const filtered = projects.filter(
    (p) => !searchTerm || p.projectName.toLowerCase().includes(searchTerm)
  );

  const openProject = projects.find((p) => p.projectId === openProjectId) ?? null;
  const openProjectIndex = projects.findIndex((p) => p.projectId === openProjectId);
  const openGradient = GRADIENTS[Math.max(openProjectIndex, 0) % GRADIENTS.length];

  if (showCompareView && compareProjects.length >= 2) {
    return (
      <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setShowCompareView(false)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
          >
            <IconArrowLeft className="h-3.5 w-3.5" /> Back to Projects
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
            <IconScale className="h-3.5 w-3.5" /> Comparing {compareProjects.length} Projects
          </div>
        </div>

        {compareProjects.map((p, i) => (
          <ProjectDetailCard
            key={p.projectId}
            project={p}
            gradient={GRADIENTS[projects.findIndex((x) => x.projectId === p.projectId) % GRADIENTS.length]}
            completed={completedProjectIds.has(p.projectId)}
            marking={markingProjectId === p.projectId}
            onMarkComplete={() => handleMarkComplete(p.projectId)}
            onLaunchQuiz={setActiveTestAssessmentId}
            indexBadge={i + 1}
            onRemove={() => setCompareIds((prev) => prev.filter((id) => id !== p.projectId))}
          />
        ))}
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

  if (openProject) {
    return (
      <>
      <button onClick={() => setOpenProjectId(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
        <IconArrowLeft className="h-3.5 w-3.5" /> Back to Projects
      </button>
      <ProjectDetailCard
        project={openProject}
        gradient={openGradient}
        completed={completedProjectIds.has(openProject.projectId)}
        marking={markingProjectId === openProject.projectId}
        onMarkComplete={() => handleMarkComplete(openProject.projectId)}
        onLaunchQuiz={setActiveTestAssessmentId}
      />

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

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          placeholder="Search by project name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={toggleCompareMode}
          className={`inline-flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-95 ${
            compareMode
              ? 'bg-slate-800 text-white hover:bg-slate-900'
              : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:shadow-md'
          }`}
        >
          {compareMode ? <IconX className="h-4 w-4" /> : <IconScale className="h-4 w-4" />}
          {compareMode ? 'Cancel Compare' : 'Compare Projects'}
        </button>
      </div>

      {compareMode && (
        <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700">
          Pick up to {MAX_COMPARE} projects to compare — tap a card to select it.
        </div>
      )}

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
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 ${compareMode ? 'pb-20' : ''}`}>
          {filtered.map((project) => {
            const selected = compareIds.includes(project.projectId);
            const selectionOrder = compareIds.indexOf(project.projectId);
            return (
              <div key={project.projectId} className={`w-full [&>button]:w-full ${selected ? 'rounded-2xl ring-2 ring-indigo-500' : ''}`}>
                <ThumbnailCard
                  title={project.projectName}
                  subtitle={project.shortDescription}
                  thumbnailUrl={project.thumbnail}
                  onClick={() => compareMode ? toggleCompareSelection(project.projectId) : setOpenProjectId(project.projectId)}
                  badge={selected ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white shadow">
                      {selectionOrder + 1}
                    </span>
                  ) : undefined}
                >
                  {project.brochures.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-500">
                      <IconPdf className="h-3 w-3" /> {project.brochures.length} brochure{project.brochures.length === 1 ? '' : 's'}
                    </span>
                  )}
                </ThumbnailCard>
              </div>
            );
          })}
        </div>
      )}

    </div>

    {compareMode && compareIds.length > 0 && (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {compareProjects.map((p) => (
              <span key={p.projectId} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-slate-700">
                {p.projectName}
                <button onClick={() => toggleCompareSelection(p.projectId)} aria-label="Remove" className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={() => setShowCompareView(true)}
            disabled={compareIds.length < 2}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconScale className="h-4 w-4" /> Compare {compareIds.length > 0 ? `(${compareIds.length})` : ''}
          </button>
        </div>
      </div>
    )}

    {compareToast && (
      <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
        {compareToast}
      </div>
    )}
    </div>
  );
}

export default Projects;
