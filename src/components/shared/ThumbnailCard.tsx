// src/components/shared/ThumbnailCard.tsx
//
// One shared card style for every browsable grid in the app (Courses,
// Modules, Lessons, Learning Paths, Projects) — a real thumbnail image
// filling an aspect-video top, or a colorful placeholder (a deterministic
// gradient + icon picked from the title, so a grid of un-thumbnailed
// items still reads as varied and alive instead of a wall of identical
// gray boxes) when none is set, with the heading below.

import type { ReactNode } from 'react';

// Warm-to-cool spread so a full page of cards doesn't skew toward one hue.
const PLACEHOLDER_PALETTES: [string, string][] = [
  ['#6366F1', '#8B5CF6'], // indigo → violet
  ['#F59E0B', '#EA580C'], // amber → orange
  ['#0EA5E9', '#0891B2'], // sky → cyan
  ['#EC4899', '#DB2777'], // pink → rose
  ['#10B981', '#059669'], // emerald → green
  ['#8B5CF6', '#D946EF'], // violet → fuchsia
  ['#1E3A8A', '#0F172A'], // blue → navy (echoes the section hero banner)
];

function paletteFor(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_PALETTES[hash % PLACEHOLDER_PALETTES.length];
}

function IconBook({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

interface ThumbnailCardProps {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string | null;
  /** Small pill shown top-right over the thumbnail, e.g. "80%" or "3 lessons". */
  badge?: ReactNode;
  /** Small pill shown top-left over the thumbnail, e.g. a difficulty/status tag. */
  cornerTag?: ReactNode;
  /** Extra content below the title/subtitle, e.g. a progress bar or status pill. */
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

function ThumbnailCard({ title, subtitle, thumbnailUrl, badge, cornerTag, children, onClick, disabled }: ThumbnailCardProps) {
  const [from, to] = paletteFor(title || 'course');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
    >
      <div className="relative aspect-video w-full flex-shrink-0 bg-slate-100">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
        ) : (
          <div
            className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden text-white"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, #FFFFFF 0%, transparent 30%), radial-gradient(circle at 85% 80%, #FFFFFF 0%, transparent 35%)' }}
            />
            <IconBook className="relative h-9 w-9 drop-shadow-sm" />
            <span className="relative text-[11px] font-bold uppercase tracking-wider drop-shadow-sm">No Thumbnail</span>
          </div>
        )}
        {cornerTag && (
          <div className="absolute left-2 top-2">{cornerTag}</div>
        )}
        {badge && (
          <div className="absolute right-2 top-2">{badge}</div>
        )}
      </div>
      <div className="flex-1 p-4">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800">{title}</p>
        {subtitle && <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </button>
  );
}

export default ThumbnailCard;
