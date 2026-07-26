// Chart primitives for the Live Quiz Executive Dashboard — pure SVG + CSS,
// no charting library, reskinned for the module's dark slate/violet/amber
// theme. Same technique as the LMS's own src/components/dashboard/
// DashboardCharts.tsx (the established house style for hand-rolled charts
// in this codebase), just restyled and fed quiz data instead.

import { useState } from "react";

export interface ChartPoint {
  label: string;
  value: number;
}

export function ChartCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ChartEmpty({ label = "No data yet" }: { label?: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 text-center text-slate-600">
      <span className="text-2xl">📊</span>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

function Tooltip({ leftPct, label, value, suffix = "" }: { leftPct: number; label: string; value: number; suffix?: string }) {
  return (
    <div
      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
      style={{ left: `${leftPct}%` }}
    >
      <p className="font-semibold">{value}{suffix}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

export function AreaChart({ data, color = "#8b5cf6" }: { data: ChartPoint[]; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <ChartEmpty />;

  const width = 400, height = 150, pad = 12;
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = (width - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => ({ x: pad + i * stepX, y: height - pad - (d.value / max) * (height - pad * 2) }));
  const linePath = `M${points.map((p) => `${p.x},${p.y}`).join(" L")}`;
  const areaPath = `${linePath} L${points[points.length - 1].x},${height - pad} L${points[0].x},${height - pad} Z`;
  const gradientId = `area-${color.replace("#", "")}`;
  const showEveryNth = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="relative">
      {hover !== null && <Tooltip leftPct={(hover / Math.max(1, data.length - 1)) * 100} label={data[hover].label} value={data[hover].value} />}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} style={{ transition: "d 0.6s ease" }} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: "d 0.6s ease" }} />
        {points.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y} r={hover === i ? 5 : 2.5} fill={color}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        {data.map((d, i) => (
          <span key={d.label + i} className={i % showEveryNth === 0 ? "" : "invisible"}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function VerticalBars({ data, suffix = "", color = "#8b5cf6" }: { data: ChartPoint[]; suffix?: string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="relative">
      {hover !== null && (
        <Tooltip leftPct={((hover + 0.5) / data.length) * 100} label={data[hover].label} value={data[hover].value} suffix={suffix} />
      )}
      <div className="flex items-end gap-2" style={{ height: 150 }}>
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex flex-1 flex-col items-center gap-1.5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex w-full flex-1 items-end overflow-hidden rounded-t-lg bg-slate-800/60">
              <div
                className="w-full rounded-t-lg transition-all duration-700 ease-out"
                style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: hover === i ? color : `${color}cc` }}
              />
            </div>
            <span className="truncate text-[10px] text-slate-500 max-w-full" title={d.label}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBars({ data, suffix = "%", color = "amber" }: { data: ChartPoint[]; suffix?: string; color?: "amber" | "violet" }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const gradient = color === "amber" ? "from-amber-500 to-orange-500" : "from-violet-500 to-fuchsia-500";

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label} className="relative flex items-center gap-3" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          {hover === i && (
            <div className="pointer-events-none absolute -top-9 left-0 z-10 rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
              {d.value}{suffix}
            </div>
          )}
          <span className="w-28 flex-shrink-0 truncate text-xs font-medium text-slate-300" title={d.label}>{d.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700 ease-out`}
              style={{ width: `${Math.min(100, (d.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-12 flex-shrink-0 text-right text-xs font-semibold text-slate-400">{d.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <ChartEmpty />;

  const size = 130, radius = size / 2 - 10, circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={16} />
          {segments.map((seg, i) => {
            const fraction = seg.value / total;
            const dash = fraction * circumference;
            const dashOffset = -cumulative * circumference;
            cumulative += fraction;
            return (
              <circle
                key={seg.label} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={seg.color}
                strokeWidth={hover === i ? 20 : 16} strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`} className="cursor-pointer transition-all duration-500"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              />
            );
          })}
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-white text-lg font-bold">
            {hover !== null ? `${Math.round((segments[hover].value / total) * 100)}%` : total}
          </text>
        </svg>
      </div>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${hover === i ? "bg-slate-800/60" : ""}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-400">{seg.label}</span>
            <span className="font-semibold text-white">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
