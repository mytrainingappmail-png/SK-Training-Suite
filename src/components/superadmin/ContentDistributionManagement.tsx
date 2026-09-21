// Platform-operator-only: push a COPY of one of the operator's own
// courses/videos/real-estate-projects into another company's own data --
// e.g. selling "premium training material" as an add-on. Same
// company-picker layout as Company Modules, but the right side is a
// pick-list of the operator's own content instead of toggles.

import { useEffect, useMemo, useState } from "react";
import { loadCompanies, loadCompany } from "../../services/company/companyService";
import { getAllCourses } from "../../repositories/course/courseRepository";
import { getVideos } from "../../repositories/videoLibraryContent/videoLibraryContentRepository";
import { loadProjects } from "../../services/realEstateProject/realEstateProjectService";
import { loadDays } from "../../services/induction/inductionService";
import type { InductionDay } from "../../types/induction";
import { pushContentToCompany } from "../../services/contentDistribution/contentDistributionService";
import type { Company } from "../../types/company";
import type { Course } from "../../types/course";
import type { LibraryVideo } from "../../types/videoLibraryContent";
import type { RealEstateProject } from "../../types/realEstateProject";

function ContentDistributionManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [projects, setProjects] = useState<RealEstateProject[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);

  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [inductionDays, setInductionDays] = useState<InductionDay[]>([]);
  const [selectedDayIds, setSelectedDayIds] = useState<Set<string>>(new Set());
  const [pushToAll, setPushToAll] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    Promise.all([loadCompanies(), loadCompany()])
      .then(([rows, mine]) => {
        const targets = rows.filter((c) => c.id !== mine?.id);
        setCompanies(targets);
        setActiveCompanyId(targets[0]?.id ?? "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load companies."))
      .finally(() => setLoadingCompanies(false));

    Promise.all([getAllCourses(), getVideos(), loadProjects(), loadDays()])
      .then(([c, v, p, d]) => {
        setCourses(c);
        setVideos(v);
        setProjects(p);
        setInductionDays(d);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load your content."))
      .finally(() => setLoadingContent(false));
  }, []);

  const filteredCompanies = useMemo(() => {
    const kw = companySearch.trim().toLowerCase();
    if (!kw) return companies;
    return companies.filter((c) => c.company_name.toLowerCase().includes(kw) || c.company_code.toLowerCase().includes(kw));
  }, [companies, companySearch]);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;
  const totalSelected = selectedCourseIds.size + selectedVideoIds.size + selectedProjectIds.size + selectedDayIds.size;

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function handlePush() {
    if (totalSelected === 0) return;
    if (pushToAll) {
      if (companies.length === 0) return;
      if (!confirm(`Send a copy of the ${totalSelected} selected item(s) to ALL ${companies.length} other companies? Sending the same item twice creates a duplicate.`)) return;
      setPushing(true);
      setError("");
      setSuccessMsg("");
      const selection = {
        courseIds: Array.from(selectedCourseIds),
        videoIds: Array.from(selectedVideoIds),
        projectIds: Array.from(selectedProjectIds),
        inductionDayIds: Array.from(selectedDayIds),
      };
      const done: string[] = [];
      const failed: string[] = [];
      for (const c of companies) {
        try {
          await pushContentToCompany(c.id, c.company_code, selection);
          done.push(c.company_name);
        } catch (err) {
          failed.push(`${c.company_name} (${err instanceof Error ? err.message : "failed"})`);
        }
      }
      if (done.length > 0) setSuccessMsg(`Sent to ${done.length} company(ies): ${done.join(", ")}.`);
      if (failed.length > 0) setError(`Not sent to: ${failed.join("; ")}`);
      if (failed.length === 0) {
        setSelectedCourseIds(new Set());
        setSelectedVideoIds(new Set());
        setSelectedProjectIds(new Set());
        setSelectedDayIds(new Set());
      }
      setPushing(false);
      return;
    }
    if (!activeCompanyId || !activeCompany) return;
    setPushing(true);
    setError("");
    setSuccessMsg("");
    try {
      const result = await pushContentToCompany(activeCompanyId, activeCompany.company_code, {
        courseIds: Array.from(selectedCourseIds),
        videoIds: Array.from(selectedVideoIds),
        projectIds: Array.from(selectedProjectIds),
        inductionDayIds: Array.from(selectedDayIds),
      });
      setSuccessMsg(
        `Pushed ${result.courses} course(s), ${result.videos} video(s), ${result.projects} project(s), ${result.inductionDays} induction day(s) to ${activeCompany?.company_name}.`
      );
      setSelectedCourseIds(new Set());
      setSelectedVideoIds(new Set());
      setSelectedProjectIds(new Set());
      setSelectedDayIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed.");
    } finally {
      setPushing(false);
    }
  }

  if (loadingCompanies) return <div className="text-sm text-slate-400">Loading companies…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Content Distribution</h2>
        <p className="text-sm text-slate-500">
          Push a copy of your own courses (training modules), induction days, videos, or projects into one company or all of them at once. Once pushed, it's their own
          copy — they can edit or delete it freely, and it never links back to yours.
        </p>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {successMsg && <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{successMsg}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Company picker */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <p className="mb-3 text-sm font-bold text-slate-800">Push To</p>
          <label className={`mb-3 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${pushToAll ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "bg-slate-50 text-slate-700"}`}>
            <input type="checkbox" checked={pushToAll} onChange={(e) => setPushToAll(e.target.checked)} />
            All other companies ({companies.length})
          </label>
          <input
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            placeholder="Search company…"
            className="mb-2 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
          <div className="max-h-[500px] space-y-1 overflow-y-auto">
            {filteredCompanies.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCompanyId(c.id)}
                className={`block w-full truncate rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  activeCompanyId === c.id ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {c.company_name}
                <span className="ml-1.5 text-xs text-slate-400">{c.company_code}</span>
              </button>
            ))}
            {filteredCompanies.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-400">No companies found.</p>}
          </div>
        </div>

        {/* Content picker */}
        <div className="space-y-4">
          {!activeCompany && !pushToAll ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">Select a company.</div>
          ) : loadingContent ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">Loading your content…</div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm">
                <span className="text-sm font-semibold text-slate-800">{pushToAll ? `Pushing to ALL ${companies.length} other companies` : `Pushing to ${activeCompany?.company_name}`}</span>
                <button
                  onClick={handlePush}
                  disabled={pushing || totalSelected === 0}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  {pushing ? "Pushing…" : `Push Selected (${totalSelected})`}
                </button>
              </div>

              <div className="rounded-2xl bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h3 className="text-sm font-bold text-slate-800">Courses ({courses.length})</h3>
                </div>
                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {courses.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.has(c.id)}
                        onChange={() => toggle(selectedCourseIds, setSelectedCourseIds, c.id)}
                      />
                      <span className="flex-1 truncate text-slate-700">{c.course_name}</span>
                      <span className="text-xs text-slate-400">{c.course_code}</span>
                    </label>
                  ))}
                  {courses.length === 0 && <p className="px-5 py-4 text-center text-xs text-slate-400">No courses yet.</p>}
                </div>
              </div>

              <div className="rounded-2xl bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h3 className="text-sm font-bold text-slate-800">Induction Days ({inductionDays.length})</h3>
                  <p className="text-xs text-slate-400">Copied with their pages. A Test section keeps its place but needs an Assessment attached by the receiving company.</p>
                </div>
                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {inductionDays.map((d, i) => (
                    <label key={d.id} className="flex cursor-pointer items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={selectedDayIds.has(d.id)} onChange={() => toggle(selectedDayIds, setSelectedDayIds, d.id)} />
                      <span className="flex-1 truncate text-slate-700">Day {i + 1}: {d.title}</span>
                    </label>
                  ))}
                  {inductionDays.length === 0 && <p className="px-5 py-4 text-center text-xs text-slate-400">No induction days yet.</p>}
                </div>
              </div>

              <div className="rounded-2xl bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h3 className="text-sm font-bold text-slate-800">Videos ({videos.length})</h3>
                </div>
                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {videos.map((v) => (
                    <label key={v.id} className="flex cursor-pointer items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedVideoIds.has(v.id)}
                        onChange={() => toggle(selectedVideoIds, setSelectedVideoIds, v.id)}
                      />
                      <span className="flex-1 truncate text-slate-700">{v.title}</span>
                    </label>
                  ))}
                  {videos.length === 0 && <p className="px-5 py-4 text-center text-xs text-slate-400">No videos yet.</p>}
                </div>
              </div>

              <div className="rounded-2xl bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h3 className="text-sm font-bold text-slate-800">Projects ({projects.length})</h3>
                </div>
                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {projects.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.has(p.id)}
                        onChange={() => toggle(selectedProjectIds, setSelectedProjectIds, p.id)}
                      />
                      <span className="flex-1 truncate text-slate-700">{p.project_name}</span>
                    </label>
                  ))}
                  {projects.length === 0 && <p className="px-5 py-4 text-center text-xs text-slate-400">No projects yet.</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContentDistributionManagement;
