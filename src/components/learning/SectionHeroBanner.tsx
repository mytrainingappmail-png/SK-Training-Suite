// Shared header banner for every employee-facing learning section — same
// navy gradient + gold stat look as the Learning Home hero banner, but with
// each section's own title/subtitle (no "Good Morning" greeting outside the
// home page). Use this for any new employee section so the look stays
// consistent app-wide.

interface SectionHeroBannerProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  statLabel?: string;
  statValue?: string | number;
}

export default function SectionHeroBanner({
  eyebrow,
  title,
  subtitle,
  statLabel,
  statValue,
}: SectionHeroBannerProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6 text-white shadow-md"
      style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}
    >
      <div className="space-y-1">
        {eyebrow && <p className="text-sm text-slate-400">{eyebrow}</p>}
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-slate-300">{subtitle}</p>
      </div>
      {statLabel !== undefined && statValue !== undefined && (
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-slate-400">{statLabel}</p>
          <p className="mt-1 text-4xl font-bold" style={{ color: '#D4AF37' }}>
            {statValue}
          </p>
        </div>
      )}
    </div>
  );
}
