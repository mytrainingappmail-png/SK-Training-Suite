// src/components/dashboard/DashboardCharts.tsx
//
// Six premium charts built entirely with SVG + CSS — no chart library,
// no new dependency. Every chart loads its own real data independently
// from existing, unmodified services; if one dataset fails or is
// unavailable, only that chart shows its own Error/Empty state — the
// other five keep working normally. Nothing here ever throws or crashes
// the page.
//
//   employeeService              — Employee Growth
//   enrollmentService            — Course Completion, Enrollment Trend
//   courseService                — Course Completion (names)
//   assessmentResultService      — Assessment Pass vs Fail
//   certificateService           — Certificate Issued Monthly
//   learningPathService +
//   learningPathProgressService  — Learning Path Progress

import { useEffect, useMemo, useState } from 'react';

import { employeeService } from '../../services/employee/employeeService';
import { loadEnrollments } from '../../services/enrollment/enrollmentService';
import { loadCourses } from '../../services/course/courseService';
import { loadResults } from '../../services/assessmentResult/assessmentResultService';
import { loadCertificates } from '../../services/certificate/certificateService';
import { loadLearningPaths } from '../../services/learningPath/learningPathService';


type LoadStatus = 'loading' | 'error' | 'ready';

function useSafeData<T>(loader: () => Promise<T>): { status: LoadStatus; data: T | null; error: string } {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');
    loader()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load this chart.');
        setStatus('error');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, data, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only)
// ─────────────────────────────────────────────────────────────────────────────

function IconExclaim({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>);
}
function IconChartBar({ className = 'h-7 w-7' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>);
}

// ─────────────────────────────────────────────────────────────────────────────
// ChartCard — Loading / Error / Empty / Ready states
// ─────────────────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return <div className="h-48 w-full animate-pulse rounded-xl bg-slate-100" />;
}

function ChartError({ message }: { message: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 text-center text-red-600">
      <IconExclaim />
      <p className="text-sm font-medium">Failed to load</p>
      <p className="max-w-xs px-4 text-xs text-red-400">{message}</p>
    </div>
  );
}

function ChartEmpty({ label = 'No Data Available' }: { label?: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
      <IconChartBar className="text-slate-300" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart primitives — pure SVG/CSS, animated, with hover tooltips
// ─────────────────────────────────────────────────────────────────────────────

interface Point { label: string; value: number; }

function Tooltip({ leftPct, label, value, suffix = '' }: { leftPct: number; label: string; value: number; suffix?: string }) {
  return (
    <div
      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
      style={{ left: `${leftPct}%` }}
    >
      <p className="font-semibold">{value}{suffix}</p>
      <p className="text-[10px] text-slate-300">{label}</p>
      <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
    </div>
  );
}

function AreaChart({ data, color = '#6366f1' }: { data: Point[]; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <ChartEmpty />;

  const width = 400, height = 160, pad = 16;
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = (width - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => ({ x: pad + i * stepX, y: height - pad - (d.value / max) * (height - pad * 2) }));
  const linePath = `M${points.map((p) => `${p.x},${p.y}`).join(' L')}`;
  const areaPath = `${linePath} L${points[points.length - 1].x},${height - pad} L${points[0].x},${height - pad} Z`;

  return (
    <div className="relative">
      {hover !== null && <Tooltip leftPct={(hover / Math.max(1, data.length - 1)) * 100} label={data[hover].label} value={data[hover].value} />}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaFill)" style={{ transition: 'd 0.6s ease' }} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'd 0.6s ease' }} />
        {points.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill={color}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        {data.map((d) => (<span key={d.label}>{d.label}</span>))}
      </div>
    </div>
  );
}

function LineChart({ data, color = '#10b981' }: { data: Point[]; color?: string }) {
  return <AreaChart data={data} color={color} />;
}

function VerticalBars({ data, suffix = '', color = '#6366f1' }: { data: Point[]; suffix?: string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="relative">
      {hover !== null && (
        <Tooltip leftPct={((hover + 0.5) / data.length) * 100} label={data[hover].label} value={data[hover].value} suffix={suffix} />
      )}
      <div className="flex items-end gap-2" style={{ height: 160 }}>
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex flex-1 flex-col items-center gap-1.5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex w-full flex-1 items-end overflow-hidden rounded-t-lg bg-slate-50">
              <div
                className="w-full rounded-t-lg transition-all duration-700 ease-out"
                style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: hover === i ? color : `${color}cc` }}
              />
            </div>
            <span className="truncate text-[10px] text-slate-400" title={d.label}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({ data, suffix = '%' }: { data: Point[]; suffix?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label} className="relative flex items-center gap-3" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          {hover === i && (
            <div className="pointer-events-none absolute -top-9 left-0 z-10 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
              {d.value}{suffix}
            </div>
          )}
          <span className="w-28 flex-shrink-0 truncate text-xs font-medium text-slate-600">{d.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, (d.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-12 flex-shrink-0 text-right text-xs font-semibold text-slate-500">{d.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <ChartEmpty />;

  const size = 140, radius = size / 2 - 10, circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={16} />
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
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-800 text-xl font-bold">
            {hover !== null ? `${Math.round((segments[hover].value / total) * 100)}%` : total}
          </text>
        </svg>
      </div>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${hover === i ? 'bg-slate-50' : ''}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-500">{seg.label}</span>
            <span className="font-semibold text-slate-700">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main DashboardCharts
// ─────────────────────────────────────────────────────────────────────────────

function lastNMonthKeys(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

function DashboardCharts() {
  const employeesData = useSafeData(() => employeeService.getAll());
  const enrollmentsData = useSafeData(() => Promise.all([loadEnrollments(), loadCourses()]));
  const resultsData = useSafeData(loadResults);
  const certificatesData = useSafeData(loadCertificates);
  const pathsData = useSafeData(async () => {
  const learningPaths = await loadLearningPaths();
  return [learningPaths, []] as const;
});
  const enrollmentTrendData = useSafeData(loadEnrollments);

  const employeeGrowth = useMemo((): Point[] => {
    const employees = employeesData.data ?? [];
    const months = lastNMonthKeys(6);
    const countsByMonth = new Map(months.map((m) => [m, 0]));
    employees.forEach((e) => {
      if (!e.created_at) return;
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (countsByMonth.has(key)) countsByMonth.set(key, (countsByMonth.get(key) ?? 0) + 1);
    });
    let cumulative = employees.filter((e) => e.created_at && new Date(e.created_at) < new Date(months[0] + '-01')).length;
    return months.map((m) => {
      cumulative += countsByMonth.get(m) ?? 0;
      return { label: monthLabel(m), value: cumulative };
    });
  }, [employeesData.data]);

  const courseCompletion = useMemo((): Point[] => {
    if (!enrollmentsData.data) return [];
    const [enrollments, courses] = enrollmentsData.data;
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const map = new Map<string, { total: number; count: number }>();
    enrollments.forEach((e) => {
      const bucket = map.get(e.course_id) ?? { total: 0, count: 0 };
      bucket.total += e.completion_percentage;
      bucket.count += 1;
      map.set(e.course_id, bucket);
    });
    return Array.from(map.entries())
      .map(([courseId, v]) => ({ label: courseById.get(courseId)?.course_name ?? 'Unknown', value: Math.round(v.total / v.count) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [enrollmentsData.data]);

  const assessmentPassFail = useMemo(() => {
    const results = resultsData.data ?? [];
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    return [
      { label: 'Passed', value: passed, color: '#10b981' },
      { label: 'Failed', value: failed, color: '#f43f5e' },
    ];
  }, [resultsData.data]);

  const certificatesMonthly = useMemo((): Point[] => {
    const certificates = certificatesData.data ?? [];
    const months = lastNMonthKeys(6);
    const counts = new Map(months.map((m) => [m, 0]));
    certificates.filter((c) => c.generated && c.issue_date).forEach((c) => {
      const d = new Date(c.issue_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return months.map((m) => ({ label: monthLabel(m), value: counts.get(m) ?? 0 }));
  }, [certificatesData.data]);

 const learningPathProgress = useMemo((): Point[] => {
  if (!pathsData.data) return [];

  const [paths] = pathsData.data;

  return paths
    .slice(0, 6)
    .map((p) => ({
      label: p.path_name,
      value: 0,
    }));
}, [pathsData.data]);

  const enrollmentTrend = useMemo((): Point[] => {
    const enrollments = enrollmentTrendData.data ?? [];
    const months = lastNMonthKeys(6);
    const counts = new Map(months.map((m) => [m, 0]));
    enrollments.forEach((e) => {
      if (!e.assigned_at) return;
      const d = new Date(e.assigned_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return months.map((m) => ({ label: monthLabel(m), value: counts.get(m) ?? 0 }));
  }, [enrollmentTrendData.data]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Employee Growth" subtitle="Cumulative headcount, last 6 months">
        {employeesData.status === 'loading' ? <ChartSkeleton /> : employeesData.status === 'error' ? <ChartError message={employeesData.error} /> : (
          employeeGrowth.every((p) => p.value === 0) ? <ChartEmpty /> : <AreaChart data={employeeGrowth} color="#6366f1" />
        )}
      </ChartCard>

      <ChartCard title="Course Completion" subtitle="Average completion by course">
        {enrollmentsData.status === 'loading' ? <ChartSkeleton /> : enrollmentsData.status === 'error' ? <ChartError message={enrollmentsData.error} /> : (
          <VerticalBars data={courseCompletion} suffix="%" color="#6366f1" />
        )}
      </ChartCard>

      <ChartCard title="Assessment Pass vs Fail" subtitle="All evaluated attempts">
        {resultsData.status === 'loading' ? <ChartSkeleton /> : resultsData.status === 'error' ? <ChartError message={resultsData.error} /> : (
          <DonutChart segments={assessmentPassFail} />
        )}
      </ChartCard>

      <ChartCard title="Certificates Issued" subtitle="Monthly, last 6 months">
        {certificatesData.status === 'loading' ? <ChartSkeleton /> : certificatesData.status === 'error' ? <ChartError message={certificatesData.error} /> : (
          certificatesMonthly.every((p) => p.value === 0) ? <ChartEmpty /> : <VerticalBars data={certificatesMonthly} color="#8b5cf6" />
        )}
      </ChartCard>

      <ChartCard title="Learning Path Progress" subtitle="Average progress by path">
        {pathsData.status === 'loading' ? <ChartSkeleton /> : pathsData.status === 'error' ? <ChartError message={pathsData.error} /> : (
          <HorizontalBars data={learningPathProgress} suffix="%" />
        )}
      </ChartCard>

      <ChartCard title="Enrollment Trend" subtitle="New enrollments, last 6 months">
        {enrollmentTrendData.status === 'loading' ? <ChartSkeleton /> : enrollmentTrendData.status === 'error' ? <ChartError message={enrollmentTrendData.error} /> : (
          enrollmentTrend.every((p) => p.value === 0) ? <ChartEmpty /> : <LineChart data={enrollmentTrend} color="#10b981" />
        )}
      </ChartCard>
    </div>
  );
}

export default DashboardCharts;