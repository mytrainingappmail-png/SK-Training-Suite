// Makes the OLD card pictures lighter: every picture already used on a card (Induction days and cards, Projects, Courses, Modules,
// Learning paths) is fetched, fitted to the 16:9 card shape and saved as a light WebP (see utils/fitCardImage), the card is pointed
// at the new file, and nothing else changes. The old files are NOT deleted: another company's copy of the same content may still
// show them. Only pictures stored in this app's own storage are touched; links to other websites are left alone.

import { supabase } from '../../lib/supabase';
import { fitCardImage } from '../../utils/fitCardImage';

const SOURCES = [
  { table: 'induction_days', col: 'thumbnail_url', label: 'Induction days' },
  { table: 'induction_day_sections', col: 'thumbnail_url', label: 'Induction cards' },
  { table: 'real_estate_projects', col: 'thumbnail_url', label: 'Projects' },
  { table: 'courses', col: 'thumbnail', label: 'Courses' },
  { table: 'modules', col: 'thumbnail', label: 'Modules' },
  { table: 'learning_paths', col: 'thumbnail_url', label: 'Learning paths' },
] as const;

const BUCKET = 'course-content';
/** A picture smaller than this and already WebP is not worth touching. */
const LIGHT_ENOUGH = 200 * 1024;
/** The new file must be at least this much smaller, otherwise the old one stays. */
const MIN_SAVING = 0.15;

interface Use { table: string; col: string; id: string }
export interface PictureInfo { url: string; bytes: number; type: string; uses: Use[]; candidate: boolean }
export interface ScanResult { pictures: PictureInfo[]; totalBytes: number; candidateBytes: number; candidates: number; byKind: Record<string, number> }
export interface OptimiseResult { changed: number; alreadyLight: number; failed: number; beforeBytes: number; afterBytes: number }

const ownOrigin = (() => { try { return new URL(String(import.meta.env.VITE_SUPABASE_URL ?? '')).origin; } catch { return ''; } })();
const isOwnStorageUrl = (u: string) => { try { const x = new URL(u); return !!ownOrigin && x.origin === ownOrigin && x.pathname.includes('/storage/v1/object/public/'); } catch { return false; } };

async function headInfo(url: string): Promise<{ bytes: number; type: string }> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return { bytes: Number(res.headers.get('content-length') ?? 0), type: res.headers.get('content-type') ?? '' };
  } catch { return { bytes: 0, type: '' }; }
}

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>, onStep?: () => void): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(async (it) => { await fn(it); onStep?.(); }));
  }
}

/** Finds every card picture in this company's content and how heavy it is. */
export async function scanPictures(onStep?: (done: number, total: number) => void): Promise<ScanResult> {
  const byUrl = new Map<string, Use[]>();
  const byKind: Record<string, number> = {};
  for (const s of SOURCES) {
    const { data, error } = await supabase.from(s.table).select(`id, ${s.col}`).not(s.col, 'is', null).neq(s.col, '');
    if (error) continue; // a screen this company does not use
    for (const row of (data ?? []) as unknown as Record<string, string>[]) {
      const url = row[s.col];
      if (!isOwnStorageUrl(url)) continue;
      byUrl.set(url, [...(byUrl.get(url) ?? []), { table: s.table, col: s.col, id: row.id }]);
      byKind[s.label] = (byKind[s.label] ?? 0) + 1;
    }
  }
  const urls = Array.from(byUrl.keys());
  const pictures: PictureInfo[] = [];
  let done = 0;
  await inBatches(urls, 6, async (url) => {
    const { bytes, type } = await headInfo(url);
    const isImage = type.startsWith('image/') && !/gif|svg/i.test(type);
    pictures.push({ url, bytes, type, uses: byUrl.get(url) ?? [], candidate: isImage && (!/webp/i.test(type) || bytes > LIGHT_ENOUGH) });
  }, () => onStep?.(++done, urls.length));
  const candidates = pictures.filter((p) => p.candidate);
  return {
    pictures,
    totalBytes: pictures.reduce((a, p) => a + p.bytes, 0),
    candidateBytes: candidates.reduce((a, p) => a + p.bytes, 0),
    candidates: candidates.length,
    byKind,
  };
}

/** Makes the heavy ones lighter, one by one. */
export async function optimisePictures(scan: ScanResult, onStep?: (done: number, total: number) => void): Promise<OptimiseResult> {
  const todo = scan.pictures.filter((p) => p.candidate);
  const result: OptimiseResult = { changed: 0, alreadyLight: 0, failed: 0, beforeBytes: 0, afterBytes: 0 };
  let done = 0;
  await inBatches(todo, 2, async (pic) => {
    try {
      const res = await fetch(pic.url);
      if (!res.ok) throw new Error('download');
      const blob = await res.blob();
      const name = decodeURIComponent(pic.url.split('/').pop() ?? 'picture').replace(/\?.*$/, '');
      const original = new File([blob], name, { type: blob.type || pic.type });
      const fitted = await fitCardImage(original);
      if (fitted === original || fitted.size > original.size * (1 - MIN_SAVING)) { result.alreadyLight += 1; return; }

      const path = `images/optimised/${crypto.randomUUID()}.${fitted.type === 'image/webp' ? 'webp' : 'jpg'}`;
      const up = await supabase.storage.from(BUCKET).upload(path, fitted, { contentType: fitted.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      const newUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      let pointed = 0;
      for (const u of pic.uses) {
        const { error } = await supabase.from(u.table).update({ [u.col]: newUrl }).eq('id', u.id);
        if (!error) pointed += 1;
      }
      if (pointed === 0) { await supabase.storage.from(BUCKET).remove([path]); throw new Error('no card could be updated'); }
      result.changed += 1;
      result.beforeBytes += original.size;
      result.afterBytes += fitted.size;
    } catch {
      result.failed += 1;
    }
  }, () => onStep?.(++done, todo.length));
  return result;
}
