// "Focused projects" card, admin side: the card has its OWN projects (separate from the main Projects section).
// "Manage projects" opens the normal Projects screen limited to this card — add new, edit, preview, delete,
// copy one in from the Projects section, or copy one out to it. Nothing here ever changes the main section.

import { useEffect, useState } from 'react';
import RealEstateProjectManagement from '../realEstateProject/RealEstateProjectManagement';
import { loadProjects } from '../../services/realEstateProject/realEstateProjectService';
import type { RealEstateProject } from '../../types/realEstateProject';

export default function InductionCardProjects({ sectionId, projectIds, onIdsChange }: {
  /** null until the card has been saved once (the projects need the card to exist first). */
  sectionId: string | null;
  projectIds: string[];
  onIdsChange: (ids: string[]) => void;
}) {
  const [projects, setProjects] = useState<RealEstateProject[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sectionId) { setProjects([]); return; }
    let live = true;
    loadProjects({ inductionSectionId: sectionId }).then((rows) => { if (live) setProjects(rows); }).catch(() => { if (live) setProjects([]); });
    return () => { live = false; };
  }, [sectionId, open, projectIds.join(',')]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">Projects in this card ({projects?.length ?? 0})</p>
        {sectionId && (
          <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Manage projects
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        These projects belong only to this card — employees see exactly these. Your main Projects section is separate: add, edit and delete here never change it,
        and you can copy a project from one to the other so the work is done once.
      </p>

      {!sectionId && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Save this card first (button below) — then you can add its projects.</p>
      )}
      {sectionId && projects && projects.length === 0 && <p className="text-sm text-slate-400">No projects in this card yet — press “Manage projects”.</p>}
      <div className="space-y-2">
        {(projects ?? []).map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">{i + 1}</span>
            {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="h-10 w-14 flex-shrink-0 rounded-lg object-cover" /> : <div className="h-10 w-14 flex-shrink-0 rounded-lg bg-slate-100" />}
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{p.project_name}</p>
            {!p.active && <span className="text-[11px] font-semibold text-amber-600">Inactive</span>}
          </div>
        ))}
      </div>

      {open && sectionId && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-100">
          <div className="mx-auto max-w-5xl p-3 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-600">Induction card — projects</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Done</button>
            </div>
            <RealEstateProjectManagement scope={{ inductionSectionId: sectionId, initialIds: projectIds, onChanged: onIdsChange }} />
          </div>
        </div>
      )}
    </div>
  );
}
