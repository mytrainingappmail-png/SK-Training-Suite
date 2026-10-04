// "Preview" of one Project exactly as an employee sees it (same card the Projects screen uses),
// for the owner/admin. Nothing is saved: "Mark complete" and the test button only explain themselves.

import { useEffect, useState } from 'react';
import PreviewModal from '../../components/shared/PreviewModal';
import { ProjectDetailCard } from '../../components/learning/Projects';
import { loadAllBrochures, loadAllSections, loadProjects } from '../../services/realEstateProject/realEstateProjectService';
import type { Project } from '../../services/projects/projectsService';

export default function ProjectPreview({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([loadProjects({ includeInduction: true }), loadAllBrochures(), loadAllSections()])
      .then(([projects, brochures, sections]) => {
        const p = projects.find((x) => x.id === projectId);
        if (!p) { setError('Project not found.'); return; }
        setProject({
          projectId: p.id,
          projectName: p.project_name,
          shortDescription: p.short_description,
          fullDescription: p.full_description,
          thumbnail: p.thumbnail_url,
          brochures: brochures.filter((b) => b.project_id === p.id).map((b) => ({ resourceId: b.id, title: b.title, fileUrl: b.file_url })),
          sections: sections.filter((s) => s.project_id === p.id).sort((a, b) => a.display_order - b.display_order),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this project.'));
  }, [projectId]);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <PreviewModal title={project?.projectName ?? 'Project'} onClose={onClose}>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!project && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {project && (
        <ProjectDetailCard
          project={project}
          gradient="from-indigo-500 to-violet-500"
          completed={false}
          marking={false}
          onMarkComplete={() => showToast('Preview: nothing is saved.')}
          onLaunchQuiz={() => showToast('Preview: the employee takes the test here.')}
        />
      )}
      {toast && <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </PreviewModal>
  );
}
