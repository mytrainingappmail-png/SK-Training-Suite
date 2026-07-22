// src/components/shared/MiniCharts.tsx
//
// Small, reusable, pure-SVG chart primitives — no external charting
// library needed (matches the existing DashboardCharts.tsx approach
// already used in this app). Used by both TrainerDashboard and
// LearningHome to add real, dynamic graphs.

export interface BarDatum {
  label: string;
  value: number;
}

export function MiniBarChart({ data, color = '#6366F1', maxValue }: { data: BarDatum[]; color?: string; maxValue?: number }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>;
  }
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 flex-shrink-0 truncate text-xs text-slate-500" title={d.label}>{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${max > 0 ? (d.value / max) * 100 : 0}%`, backgroundColor: color }} />
          </div>
          <span className="w-10 flex-shrink-0 text-right text-xs font-semibold text-slate-700">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export function MiniDonutChart({ data, size = 140 }: { data: DonutDatum[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulative = 0;
  const segments = data.map((d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const dash = fraction * circumference;
    const offset = -cumulative * circumference;
    cumulative += fraction;
    return { ...d, dash, offset };
  });

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={16} />
        {total === 0 ? null : segments.map((s) => (
          <circle
            key={s.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={16}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={s.offset}
            transform={`rotate(-90 ${center} ${center})`}
            strokeLinecap="butt"
          />
        ))}
        <text x={center} y={center - 4} textAnchor="middle" fontSize="22" fontWeight="bold" fill="#1E293B">{total}</text>
        <text x={center} y={center + 16} textAnchor="middle" fontSize="10" fill="#94A3B8">Total</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-slate-500">{d.label}</span>
            <span className="font-semibold text-slate-700">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClickableStatCard({
  label,
  value,
  suffix,
  className,
  onClick,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  className: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${className} ${onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-800">
        {value}{suffix && <span className="ml-1 text-lg font-normal text-slate-400">{suffix}</span>}
      </p>
    </button>
  );
}
