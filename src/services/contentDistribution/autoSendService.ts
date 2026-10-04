// "Auto-send": the platform owner picks companies (for example their own RMT001) that automatically
// receive everything the owner PUBLISHES, so the owner can check it there as a real company without
// pushing by hand each time.
//
// Rules, kept simple on purpose:
//   * only items that are published (active) are sent — a draft stays private until it is switched on
//   * an item is sent once per company (the distribution log remembers it, so nothing is duplicated)
//   * when the owner later CORRECTS an item that was already sent, the company's copy is updated in place
//     (same rows, so employees' progress is untouched; anything the company deleted stays deleted)
//   * an item that was touched in the last 10 minutes waits, so a half-built course or induction day
//     is never copied in the middle of being written
//   * it runs while the owner has Admin open (checked every 10 minutes) and on the "Send now" button
//     (which ignores the 10-minute wait)

import { supabase } from "../../lib/supabase";
import { loadCompanies, loadCompany } from "../company/companyService";
import { linkExistingCopies, loadContentChanges, loadDistributionLog, pushContentToCompany, syncContent } from "./contentDistributionService";
import type { DistributionKind } from "./contentDistributionService";

export interface AutoSendTarget {
  company_id: string;
  created_at: string;
  last_run_at: string | null;
}

export interface AutoSendResult {
  sentItems: number;
  /** Already-sent items whose copies were corrected because the master changed. */
  updatedItems: number;
  companies: string[];
  failed: string[];
}

const SETTLE_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 10 * 60 * 1000;
const LOCK_KEY = "sk:autosend:lock";
const LAST_RUN_KEY = "sk:autosend:last";

interface Candidate {
  kind: DistributionKind;
  id: string;
  touchedAt: number; // the latest time anything in it was created or changed that we can see
}

export async function listAutoSendTargets(): Promise<AutoSendTarget[]> {
  const { data, error } = await supabase.from("platform_auto_send_targets").select("company_id, created_at, last_run_at");
  if (error) throw new Error(error.message);
  return (data as AutoSendTarget[] | null) ?? [];
}

/** Everything the owner has published, each with the latest time something in it changed. */
async function publishedCandidates(myCompanyId: string): Promise<Candidate[]> {
  const t = (v: string | null | undefined) => (v ? Date.parse(v) || 0 : 0);
  const out: Candidate[] = [];

  const [courses, modules, lessons, days, daySections, videos, projects, projectSections] = await Promise.all([
    supabase.from("courses").select("id, updated_at, created_at").eq("company_id", myCompanyId).eq("active", true),
    supabase.from("modules").select("id, course_id, updated_at, created_at"),
    supabase.from("lessons").select("module_id, created_at"),
    supabase.from("induction_days").select("id, updated_at, created_at").eq("company_id", myCompanyId).eq("active", true).is("branch_id", null),
    supabase.from("induction_day_sections").select("day_id, updated_at, created_at").eq("company_id", myCompanyId),
    supabase.from("library_videos").select("id, updated_at, created_at").eq("company_id", myCompanyId).eq("active", true),
    supabase.from("real_estate_projects").select("id, updated_at, created_at").eq("company_id", myCompanyId).eq("active", true).is("branch_id", null).is("induction_section_id", null),
    supabase.from("real_estate_project_sections").select("project_id, updated_at, created_at").eq("company_id", myCompanyId),
  ]);

  const maxBy = <T,>(rows: T[] | null, key: (r: T) => string, stamp: (r: T) => number): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(key(r), Math.max(m.get(key(r)) ?? 0, stamp(r)));
    return m;
  };

  const lessonTouchByModule = maxBy(lessons.data as { module_id: string; created_at: string }[] | null, (r) => r.module_id, (r) => t(r.created_at));
  const moduleRows = (modules.data as { id: string; course_id: string; updated_at: string; created_at: string }[] | null) ?? [];
  const courseTouchFromChildren = new Map<string, number>();
  for (const m of moduleRows) {
    const stamp = Math.max(t(m.updated_at), t(m.created_at), lessonTouchByModule.get(m.id) ?? 0);
    courseTouchFromChildren.set(m.course_id, Math.max(courseTouchFromChildren.get(m.course_id) ?? 0, stamp));
  }
  for (const c of (courses.data as { id: string; updated_at: string; created_at: string }[] | null) ?? []) {
    out.push({ kind: "course", id: c.id, touchedAt: Math.max(t(c.updated_at), t(c.created_at), courseTouchFromChildren.get(c.id) ?? 0) });
  }

  const daySectionTouch = maxBy(daySections.data as { day_id: string; updated_at: string; created_at: string }[] | null, (r) => r.day_id, (r) => Math.max(t(r.updated_at), t(r.created_at)));
  for (const d of (days.data as { id: string; updated_at: string; created_at: string }[] | null) ?? []) {
    out.push({ kind: "induction_day", id: d.id, touchedAt: Math.max(t(d.updated_at), t(d.created_at), daySectionTouch.get(d.id) ?? 0) });
  }

  for (const v of (videos.data as { id: string; updated_at: string; created_at: string }[] | null) ?? []) {
    out.push({ kind: "video", id: v.id, touchedAt: Math.max(t(v.updated_at), t(v.created_at)) });
  }

  const projectSectionTouch = maxBy(projectSections.data as { project_id: string; updated_at: string; created_at: string }[] | null, (r) => r.project_id, (r) => Math.max(t(r.updated_at), t(r.created_at)));
  for (const p of (projects.data as { id: string; updated_at: string; created_at: string }[] | null) ?? []) {
    out.push({ kind: "project", id: p.id, touchedAt: Math.max(t(p.updated_at), t(p.created_at), projectSectionTouch.get(p.id) ?? 0) });
  }

  return out;
}

/**
 * Turn auto-send on for a company.
 *   only_new   — what the owner already has is marked as "already there" (no copies are made), so only
 *                things published from now on are sent. The right choice when the company already has
 *                this content, like the owner's own RMT001.
 *   everything — everything published so far is sent on the next run too.
 */
export async function enableAutoSend(companyId: string, mode: "only_new" | "everything"): Promise<{ linked: number; skipped: string[] }> {
  const mine = await loadCompany();
  if (!mine) throw new Error("Could not find your company.");
  let linkReport = { linked: 0, skipped: [] as string[] };
  if (mode === "only_new") {
    // the company already has this content: tie each of its items to its master twin so later corrections reach it
    linkReport = await linkExistingCopies(companyId).catch(() => linkReport);
    const [candidates, log] = await Promise.all([publishedCandidates(mine.id), loadDistributionLog()]);
    const known = new Set(log.filter((l) => l.target_company_id === companyId).map((l) => `${l.kind}:${l.source_id}`));
    const rows = candidates
      .filter((c) => !known.has(`${c.kind}:${c.id}`))
      .map((c) => ({ kind: c.kind, source_id: c.id, target_company_id: companyId }));
    if (rows.length > 0) {
      const { error } = await supabase.from("content_distribution_log").insert(rows);
      if (error) throw new Error(error.message);
    }
  }
  const { error } = await supabase.from("platform_auto_send_targets").upsert({ company_id: companyId }, { onConflict: "company_id" });
  if (error) throw new Error(error.message);
  return linkReport;
}

export async function disableAutoSend(companyId: string): Promise<void> {
  const { error } = await supabase.from("platform_auto_send_targets").delete().eq("company_id", companyId);
  if (error) throw new Error(error.message);
}

function takeLock(): boolean {
  try {
    const held = Number(localStorage.getItem(LOCK_KEY) ?? 0);
    if (Date.now() - held < 2 * 60 * 1000) return false; // another tab/run is doing it right now
    localStorage.setItem(LOCK_KEY, String(Date.now()));
  } catch {
    // storage unavailable: carry on without the lock
  }
  return true;
}

function releaseLock(): void {
  try { localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
}

/**
 * Sends what is new and published to every auto-send company. `force` skips the 10-minute wait and the
 * once-per-10-minutes limit (the "Send now" button).
 */
export async function runAutoSend(force = false): Promise<AutoSendResult> {
  const result: AutoSendResult = { sentItems: 0, updatedItems: 0, companies: [], failed: [] };

  if (!force) {
    try {
      if (Date.now() - Number(localStorage.getItem(LAST_RUN_KEY) ?? 0) < COOLDOWN_MS) return result;
    } catch { /* ignore */ }
  }
  if (!takeLock()) return result;

  try {
    const [targets, mine, companies] = await Promise.all([listAutoSendTargets(), loadCompany(), loadCompanies()]);
    if (!mine) return result; // the session was not ready yet — try again next time, do not start the 10-minute wait
    try { localStorage.setItem(LAST_RUN_KEY, String(Date.now())); } catch { /* ignore */ }
    if (targets.length === 0 || !mine.is_platform_operator) return result;

    const [candidates, log] = await Promise.all([publishedCandidates(mine.id), loadDistributionLog()]);
    const now = Date.now();
    const ready = candidates.filter((c) => force || now - c.touchedAt >= SETTLE_MS);

    for (const target of targets) {
      const company = companies.find((c) => c.id === target.company_id);
      if (!company || !company.active) continue;
      const sent = new Set(log.filter((l) => l.target_company_id === target.company_id).map((l) => `${l.kind}:${l.source_id}`));
      const unsent = ready.filter((c) => !sent.has(`${c.kind}:${c.id}`));
      if (unsent.length === 0) {
        await supabase.from("platform_auto_send_targets").update({ last_run_at: new Date().toISOString() }).eq("company_id", target.company_id);
        continue;
      }
      const pick = (kind: DistributionKind) => unsent.filter((c) => c.kind === kind).map((c) => c.id);
      try {
        await pushContentToCompany(company.id, company.company_code, {
          courseIds: pick("course"), videoIds: pick("video"), projectIds: pick("project"), inductionDayIds: pick("induction_day"),
        });
        result.sentItems += unsent.length;
        result.companies.push(company.company_name);
        await supabase.from("platform_auto_send_targets").update({ last_run_at: new Date().toISOString() }).eq("company_id", target.company_id);
      } catch (err) {
        result.failed.push(`${company.company_name} (${err instanceof Error ? err.message : "failed"})`);
      }
    }
    // corrections to items that were already sent
    const autoIds = new Set(targets.map((t) => t.company_id));
    const touched = new Map(candidates.map((c) => [`${c.kind}:${c.id}`, c.touchedAt]));
    for (const ch of await loadContentChanges()) {
      if (!ch.changed || !autoIds.has(ch.target_company_id)) continue;
      const t = touched.get(`${ch.kind}:${ch.source_id}`);
      if (!force && t !== undefined && now - t < SETTLE_MS) continue; // still being worked on
      try {
        const r = await syncContent(ch.kind, ch.source_id, ch.target_company_id);
        if (r.updated > 0) result.updatedItems += 1;
      } catch (err) {
        const name = companies.find((c) => c.id === ch.target_company_id)?.company_name ?? "a company";
        result.failed.push(`${name} (${err instanceof Error ? err.message : "update failed"})`);
      }
    }
    return result;
  } finally {
    releaseLock();
  }
}
