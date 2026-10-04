// "Focused projects" section: tick which of the company's projects this card shows. The employee then
// gets the normal Projects experience (cards, details, brochures, compare) limited to exactly these —
// the Projects section itself can hold any number of projects, an induction day only the focused ones.

import { useEffect, useMemo, useState } from 'react';
import { loadProjects } from '../../services/realEstateProject/realEstateProjectService';
import type { RealEstateProject } from '../../types/realEstateProject';

export default function InductionProjectPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [projects, setProjects] = useState<RealEstateProject[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProjects()
      .then((rows) => setProjects([...rows].sort((a, b) => a.display_order - b.display_order)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the projects.'));
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects ?? []).filter((p) => !q || p.project_name.toLowerCase().includes(q));
  }, [projects, search]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  // Projects that were picked earlier but no longer exist are simply not shown to employees; drop them from the count.
  const existing = new Set((projects ?? []).map((p) => p.id));
  const pickedCount = projects ? value.filter((id) => existing.has(id)).length : value.length;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">Focused projects for this card ({pickedCount} picked)</p>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…"
          className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 sm:w-56"
        />
      </div>
      <p className="mb-2 text-xs text-slate-400">Employees see only the projects ticked here, in the order you tick them. Your full Projects section is not affected.</p>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!projects && !error && <p className="text-sm text-slate-400">Loading projects…</p>}
      {projects && projects.length === 0 && <p className="text-sm text-slate-400">No projects yet — add them in the Projects section first.</p>}

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {shown.map((p) => {
          const pos = value.indexOf(p.id);
          const on = pos >= 0;
          return (
            <button
              key={p.id} type="button" onClick={() => toggle(p.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${on ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${on ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{on ? pos + 1 : ''}</span>
              {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="h-10 w-14 flex-shrink-0 rounded-lg object-cover" /> : <div className="h-10 w-14 flex-shrink-0 rounded-lg bg-slate-100" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">{p.project_name}</span>
                {!p.active && <span className="text-[11px] font-semibold text-amber-600">Inactive — employees won't see it until it is active</span>}
              </span>
            </button>
          );
        })}
        {projects && projects.length > 0 && shown.length === 0 && <p className="text-sm text-slate-400">No project matches "{search}".</p>}
      </div>
    </div>
  );
}
