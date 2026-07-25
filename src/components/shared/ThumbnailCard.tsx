// src/components/shared/ThumbnailCard.tsx
//
// One shared card style for every browsable grid in the app (Courses,
// Modules, Lessons, Learning Paths, Projects) — a real thumbnail image
// filling an aspect-video top, or an explicit "No Thumbnail" placeholder
// when none is set, with the heading below. Matches VideoLibrary.tsx,
// which was the reference design employees already know.

import type { ReactNode } from 'react';

function IconImagePlaceholder({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 20.25h18a1.5 1.5 0 0 0 1.5-1.5V5.25a1.5 1.5 0 0 0-1.5-1.5H3a1.5 1.5 0 0 0-1.5 1.5v13.5a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25a1.125 1.125 0 1 1-2.25 0 1.125 1.125 0 0 1 2.25 0Z" />
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="relative aspect-video w-full flex-shrink-0 bg-slate-100">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-300">
            <IconImagePlaceholder />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">No Thumbnail</span>
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
