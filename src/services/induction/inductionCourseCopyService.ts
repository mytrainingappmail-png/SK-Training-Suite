// src/services/induction/inductionCourseCopyService.ts
//
// Copies between an Induction Day and a Course Module, and keeping such a pair in step ("Update the other one too").
// A Day <-> Module copy remembers its original so it can be brought up to date from either side; deleting one never deletes the
// other, and an update only adds and changes (nothing is removed over there, and what was deleted over there is not brought back).
// Until the database part exists these quietly report "no linked copies" instead of failing.

import { supabase } from '../../lib/supabase';

export type DayModuleKind = 'day' | 'module';

/** Something that was left out of a copy because the other side has no place for it (FAQ / Projects cards, video lessons...). */
export interface SkippedItem {
  title: string;
  type: string;
}

export interface CopyResult {
  /** The id of the new Module (Day -> Module) or the new Day (Module -> Day). */
  newId: string;
  copied: number;
  skipped: SkippedItem[];
}

export interface DayModuleLink {
  link_id: string;
  other_id: string;
  other_name: string;
  /** "Course · <course name>" or "Induction". */
  other_place: string;
  /** Update the other one automatically when this one is closed after changes. */
  auto_sync: boolean;
  /** This one changed after the last update of the other. */
  behind: boolean;
  /** The other one has changes of its own since the last update. */
  other_changed: boolean;
}

function toResult(data: unknown, idKey: 'module_id' | 'day_id'): CopyResult {
  const row = (data ?? {}) as { copied?: number; skipped?: SkippedItem[] } & Record<string, unknown>;
  return { newId: String(row[idKey] ?? ''), copied: Number(row.copied) || 0, skipped: Array.isArray(row.skipped) ? row.skipped : [] };
}

/** An Induction Day becomes a Module of the chosen Course (page cards -> text lessons, test cards -> quiz lessons). */
export async function copyDayToCourseModule(dayId: string, courseId: string): Promise<CopyResult> {
  const { data, error } = await supabase.rpc('copy_day_to_course_module', { p_day: dayId, p_course: courseId });
  if (error) throw new Error(error.message);
  return toResult(data, 'module_id');
}

/** A Course Module becomes an Induction Day (text lessons -> page cards, quiz lessons -> test cards). */
export async function copyModuleToInductionDay(moduleId: string): Promise<CopyResult> {
  const { data, error } = await supabase.rpc('copy_module_to_induction_day', { p_module: moduleId });
  if (error) throw new Error(error.message);
  return toResult(data, 'day_id');
}

export async function loadDayModuleLinks(kind: DayModuleKind, id: string): Promise<DayModuleLink[]> {
  const { data, error } = await supabase.rpc('get_day_module_links', { p_kind: kind, p_id: id });
  if (error) return [];
  return (data ?? []) as DayModuleLink[];
}

/** Brings the other one up to date from this one (adds and changes only). */
export async function syncDayModuleCopy(fromKind: DayModuleKind, fromId: string, toId: string): Promise<void> {
  const { error } = await supabase.rpc('sync_day_module_copy', { p_from_kind: fromKind, p_from: fromId, p_to: toId });
  if (error) throw new Error(error.message);
}

export async function setDayModuleAuto(linkId: string, kind: DayModuleKind, auto: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_day_module_auto', { p_link: linkId, p_kind: kind, p_auto: auto });
  if (error) throw new Error(error.message);
}

/** Called when a Day is closed: updates the linked Modules that are set to follow it (returns how many). */
export async function syncDayModuleCopiesAuto(kind: DayModuleKind, id: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_day_module_copies_auto', { p_kind: kind, p_id: id });
  if (error) {
    if (/could not find the function/i.test(error.message)) return 0;
    throw new Error(error.message);
  }
  return Number(data) || 0;
}

/** Called when the Course Builder is left: updates the Days that follow a module of this course (returns how many). */
export async function syncCourseDayCopiesAuto(courseId: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_course_day_copies_auto', { p_course: courseId });
  if (error) return 0;
  return Number(data) || 0;
}

/** Ids of the Days / Modules whose linked copy is behind (they changed after the last update) - for the mark in the lists. */
export async function loadStaleDayModuleCopies(): Promise<{ days: Set<string>; modules: Set<string> }> {
  const { data, error } = await supabase.rpc('day_module_stale');
  const out = { days: new Set<string>(), modules: new Set<string>() };
  if (error) return out;
  for (const r of (data ?? []) as { kind: string; id: string }[]) (r.kind === 'day' ? out.days : out.modules).add(String(r.id));
  return out;
}

/** A readable name for what was left out ("faq" -> "FAQ card", "video" -> "Video lesson"). */
export function skippedLabel(item: SkippedItem): string {
  const t = item.type;
  const isLesson = ['video', 'pdf', 'ppt', 'document', 'audio', 'link', 'scorm'].includes(t) || !['faq', 'projects', 'acknowledge', 'feedback', 'task', 'contact', 'page', 'test'].includes(t);
  const name = t === 'faq' ? 'FAQ' : t.charAt(0).toUpperCase() + t.slice(1);
  return `${name} ${isLesson ? 'lesson' : 'card'}${item.title ? ` “${item.title}”` : ''}`;
}
