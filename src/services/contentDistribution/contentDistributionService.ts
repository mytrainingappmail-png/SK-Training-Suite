// Platform-operator-only: sends a COPY of the owner's courses / videos / projects / induction days
// (with every chapter, lesson, file, page, brochure and test) into another company, and later pushes the
// owner's corrections into those copies.
//
// All the real work happens inside the database (platform_clone_content / platform_sync_content, see
// migration 20261002160000), because the owner may only INSERT into another company's tables, not read or
// change them, and because a copy and its later update must follow exactly the same rules.
//
//  * a copy is the company's own set of rows — they can edit or delete it freely
//  * the database remembers which copied row came from which master row, so an UPDATE changes the very same
//    rows: employees' progress, results and certificates stay where they were
//  * an update never brings back what the company deleted, and never deletes anything from a copy
//  * a copy is added after whatever the company already has, never in the middle of it

import { supabase } from "../../lib/supabase";

export type DistributionKind = "course" | "video" | "project" | "induction_day";

export interface DistributionLogRow {
  kind: DistributionKind;
  source_id: string;
  target_company_id: string;
  pushed_at: string;
}

/** Everything the owner has already sent, so the screen can show it and skip duplicates. */
export async function loadDistributionLog(): Promise<DistributionLogRow[]> {
  const { data, error } = await supabase
    .from("content_distribution_log")
    .select("kind, source_id, target_company_id, pushed_at");
  if (error) return []; // the log is a convenience: never block the screen on it
  return (data as DistributionLogRow[] | null) ?? [];
}

// ── sending ─────────────────────────────────────────────────────────────────

export interface PushSelection {
  courseIds: string[];
  videoIds: string[];
  projectIds: string[];
  inductionDayIds?: string[];
}

export interface PushResult {
  courses: number;
  videos: number;
  projects: number;
  inductionDays: number;
}

const SOURCE_TABLE: Record<DistributionKind, string> = {
  course: "courses",
  video: "library_videos",
  project: "real_estate_projects",
  induction_day: "induction_days",
};

/** Items sent together keep the owner's own order (Day 1 before Day 2) once they land in the company. */
async function inOwnerOrder(kind: DistributionKind, ids: string[]): Promise<string[]> {
  if (ids.length < 2) return ids;
  const { data } = await supabase.from(SOURCE_TABLE[kind]).select("id, display_order").in("id", ids);
  const order = new Map((data as { id: string; display_order: number }[] | null)?.map((r) => [r.id, r.display_order]) ?? []);
  return [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

async function cloneOne(kind: DistributionKind, sourceId: string, targetCompanyId: string): Promise<void> {
  const { error } = await supabase.rpc("platform_clone_content", { p_kind: kind, p_source: sourceId, p_target_company: targetCompanyId });
  if (error) throw new Error(error.message);
}

export async function pushContentToCompany(
  targetCompanyId: string,
  _targetCompanyCode: string,
  selection: PushSelection
): Promise<PushResult> {
  const lists: [DistributionKind, string[]][] = [
    ["course", selection.courseIds],
    ["video", selection.videoIds],
    ["project", selection.projectIds],
    ["induction_day", selection.inductionDayIds ?? []],
  ];
  for (const [kind, ids] of lists) {
    for (const id of await inOwnerOrder(kind, ids)) await cloneOne(kind, id, targetCompanyId);
  }
  return {
    courses: selection.courseIds.length,
    videos: selection.videoIds.length,
    projects: selection.projectIds.length,
    inductionDays: selection.inductionDayIds?.length ?? 0,
  };
}

// ── updating copies that were sent earlier ──────────────────────────────────

export interface ContentChange {
  kind: DistributionKind;
  source_id: string;
  target_company_id: string;
  /** How many of the company's copies still exist. */
  copies: number;
  /** The master was changed after the copies were last made / updated. */
  changed: boolean;
}

export async function loadContentChanges(): Promise<ContentChange[]> {
  const { data, error } = await supabase.rpc("platform_content_changes");
  if (error) return []; // a convenience view: never block the screen on it
  return (data as ContentChange[] | null) ?? [];
}

/** Pushes the master's current content into the company's copies of it. Returns how many copies were updated. */
export async function syncContent(kind: DistributionKind, sourceId: string, targetCompanyId: string): Promise<{ updated: number; missing: number }> {
  const { data, error } = await supabase.rpc("platform_sync_content", { p_kind: kind, p_source: sourceId, p_target_company: targetCompanyId });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { updated?: number; missing?: number };
  return { updated: r.updated ?? 0, missing: r.missing ?? 0 };
}

/**
 * Links content the company already had (and the owner later copied into the master) to its master twin, when
 * the two are identical — so corrections reach the company's existing items too. Different ones are reported, not touched.
 */
export async function linkExistingCopies(targetCompanyId: string): Promise<{ linked: number; skipped: string[] }> {
  const { data, error } = await supabase.rpc("platform_link_existing_copies", { p_target_company: targetCompanyId });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { linked?: number; skipped?: string[] };
  return { linked: r.linked ?? 0, skipped: r.skipped ?? [] };
}
