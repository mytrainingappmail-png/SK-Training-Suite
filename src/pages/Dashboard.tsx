// src/components/dashboard/Dashboard.tsx
//
// Premium Executive Training App Dashboard — the application home page.
// Every number and visualization here is computed client-side from data
// returned by existing, unmodified services — nothing fake, nothing
// hardcoded. Where no real data source exists for a requested metric, the
// widget shows "No Data Available" rather than an invented number:
//   companyService, branchService, departmentService, employeeService,
//   employeeRoleService, roleService, trainerAssignmentService,
//   courseService, learningPathService, learningPathEnrollmentService,
//   learningPathProgressService, enrollmentService, assessmentService,
//   assessmentResultService, certificateService, lessonBuilderService,
//   resourceService (assignment lessons + submission markers, same
//   technique already used in MyAssignments.tsx / ReportsAnalytics.tsx),
//   session.getCurrentUser().
//
// All charts (line/bar/stacked bar/progress ring/donut/horizontal
// bar/area) are hand-built with pure SVG/CSS — no chart library, no new
// dependency. No repository, service, or database changes.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

import { loadCompanies } from '../services/company/companyService';
import { branchService } from '../services/branch/branchService';
import { departmentService } from '../services/department/departmentService';
import { employeeService } from '../services/employee/employeeService';

import { loadCourses } from '../services/course/courseService';
import { loadLearningPaths } from '../services/learningPath/learningPathService';
import { loadEnrollments } from '../services/enrollment/enrollmentService';
import { loadAssessments } from '../services/assessment/assessmentService';
import { loadResults } from '../services/assessmentResult/assessmentResultService';
import { loadCertificates } from '../services/certificate/certificateService';
import { loadLessons } from '../services/lessonBuilder/lessonBuilderService';
import { loadResources } from '../services/resource/resourceService';
import { getCurrentUser } from '../services/auth/session';

import type { Company } from '../types/company';
import type { Branch } from '../types/branch';
import type { Department } from '../types/department';
import type { Employee } from '../types/employee';
import type { TrainerAssignment } from '../types/trainerAssignment';
import type { Course } from '../types/course';
import type { LearningPath } from '../types/learningPath';
import type { Enrollment } from '../types/enrollment';
import type { Assessment } from '../types/assessment';
import type { AssessmentResult } from '../types/assessmentResult';
import type { Certificate } from '../types/certificate';
import type { Lesson } from '../types/lessonBuilder';
import type { Resource } from '../types/resource';

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only)
// ─────────────────────────────────────────────────────────────────────────────

function IconSearch({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>);
}
function IconBell({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>);
}
function IconUsers({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>);
}
function IconBook({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292v-14.25" /></svg>);
}
function IconPath({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-9.372 5.25-2.25c.667-.286 1.372.191 1.372.907v13.607a1 1 0 0 1-.628.928l-5.494 2.222a1 1 0 0 1-.744 0l-5.494-2.222a1 1 0 0 0-.744 0l-5.494 2.222A1 1 0 0 1 3.75 21V7.393a1 1 0 0 1 .628-.928l5.494-2.222a1 1 0 0 1 .744 0l5.494 2.222c.24.097.51.097.75 0Z" /></svg>);
}
function IconQuiz({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.008v.008H12v-.008Z" /></svg>);
}
function IconAssignment({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>);
}
function IconCertificate({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>);
}
function IconTrend({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>);
}
function IconTarget({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>);
}
function IconClock({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}
function IconExclaim({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>);
}
function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
}
function IconMail({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>);
}
function IconCalendar({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>);
}
function IconArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>);
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart primitives — pure SVG/CSS, no chart library
// ─────────────────────────────────────────────────────────────────────────────

function NoData({ label = 'No Data Available' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
      {label}
    </div>
  );
}

function ProgressRing({ value, size = 96, color = '#6366f1' }: { value: number; size?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-800 text-lg font-bold">{Math.round(pct)}%</text>
    </svg>
  );
}

function DonutChart({ segments, size = 140 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <NoData />;
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={16} />
        {segments.map((seg) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const dashArray = `${dash} ${circumference - dash}`;
          const dashOffset = -cumulative * circumference;
          cumulative += fraction;
          return (
            <circle
              key={seg.label} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={seg.color} strokeWidth={16}
              strokeDasharray={dashArray} strokeDashoffset={dashOffset} transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-500">{seg.label}</span>
            <span className="font-semibold text-slate-700">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({ data, suffix = '' }: { data: { label: string; value: number }[]; suffix?: string }) {
  if (data.length === 0) return <NoData />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 flex-shrink-0 truncate text-xs font-medium text-slate-600">{d.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${Math.min(100, (d.value / max) * 100)}%`, transition: 'width 0.6s ease' }} />
          </div>
          <span className="w-14 flex-shrink-0 text-right text-xs font-semibold text-slate-500">{d.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

function LineArea({ data, color = '#6366f1', filled = false }: { data: { label: string; value: number }[]; color?: string; filled?: boolean }) {
  if (data.length === 0) return <NoData />;
  const width = 320, height = 120, pad = 12;
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = (width - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = height - pad - (d.value / max) * (height - pad * 2);
    return `${x},${y}`;
  });
  const linePath = `M${points.join(' L')}`;
  const areaPath = `${linePath} L${pad + (data.length - 1) * stepX},${height - pad} L${pad},${height - pad} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {filled && <path d={areaPath} fill={color} opacity={0.12} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const [x, y] = p.split(',').map(Number);
        return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
      })}
    </svg>
  );
}

function StackedBars({ data, keys }: { data: { label: string; values: Record<string, number> }[]; keys: { key: string; color: string; label: string }[] }) {
  if (data.length === 0) return <NoData />;
  const max = Math.max(...data.map((d) => keys.reduce((s, k) => s + (d.values[k.key] ?? 0), 0)), 1);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        {keys.map((k) => (
          <div key={k.key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: k.color }} /> {k.label}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-3" style={{ height: 140 }}>
        {data.map((d) => {
          const total = keys.reduce((s, k) => s + (d.values[k.key] ?? 0), 0);
          return (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-lg" style={{ height: 120 }}>
                {keys.map((k) => {
                  const v = d.values[k.key] ?? 0;
                  const h = total > 0 ? (v / max) * 120 : 0;
                  return <div key={k.key} style={{ height: `${h}px`, backgroundColor: k.color, transition: 'height 0.6s ease' }} />;
                })}
              </div>
              <span className="text-[10px] text-slate-400">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnimatedCounter({ value }: { value: number | string }) {
  return <span className="tabular-nums transition-all duration-300">{value}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/60 bg-white/80 p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl transition hover:shadow-[0_12px_36px_-10px_rgba(79,70,229,0.25)] ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, action }: { icon?: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-indigo-500">{icon}</span>}
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      </div>
      {action}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: number | string | null;
  icon: React.ReactNode;
  gradient: string;
  suffix?: string;
}
function KpiCard({ label, value, icon, gradient, suffix = '' }: KpiCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_rgba(79,70,229,0.3)]">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition group-hover:opacity-30 ${gradient}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-800">
            {value === null ? <span className="text-sm font-medium text-slate-400">No Data Available</span> : <AnimatedCounter value={`${value}${suffix}`} />}
          </p>
        </div>
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${gradient}`}>{icon}</span>
      </div>
    </div>
  );
}

function StatusPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
      <span className="flex items-center gap-2 text-sm text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {label}</span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load dashboard</p>
      <p className="mt-1">{message}</p>
      <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium transition hover:bg-red-100">Try Again</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardProps {
  onSearchResultSelect?: (type: 'course' | 'employee' | 'path', id: string) => void;
  onCreateCourse?: () => void;
  onCreateAssessment?: () => void;
  onAssignCourse?: () => void;
  onIssueCertificate?: () => void;
  onInviteEmployee?: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
}

type DateRangePreset = 'this_month' | 'last_month' | 'last_quarter' | 'custom';

// Extra shortcuts a user can pin to their own Quick Actions panel, on top
// of the five built-in ones above. Each points at an Admin console tab.
const QUICK_ACTION_CATALOG: { key: string; label: string; tab: string }[] = [
  { key: 'employees',     label: 'Employees',           tab: 'employee' },
  { key: 'courses',       label: 'Courses',              tab: 'course' },
  { key: 'question-bank', label: 'Question Bank',        tab: 'question' },
  { key: 'certificates',  label: 'Certificates',         tab: 'certificate' },
  { key: 'cert-template', label: 'Certificate Templates',tab: 'certificate-template' },
  { key: 'learning-path', label: 'Learning Paths',       tab: 'learning-path' },
  { key: 'training-batch',label: 'Training Batches',     tab: 'training-batch' },
  { key: 'enrollments',   label: 'Enrollments',          tab: 'enrollment' },
  { key: 'reports',       label: 'Reports',              tab: 'reports' },
  { key: 'attendance',    label: 'Attendance',           tab: 'attendance' },
  { key: 'geofence',      label: 'Attendance Geofencing',tab: 'geofence' },
];

const CUSTOM_QUICK_ACTIONS_KEY = 'dashboardCustomQuickActions';

function loadCustomQuickActionKeys(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_QUICK_ACTIONS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function Dashboard({
  onSearchResultSelect, onCreateCourse, onCreateAssessment, onAssignCourse, onIssueCertificate,
  onInviteEmployee, onOpenNotifications, onOpenProfile,
}: DashboardProps) {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const [customActionKeys, setCustomActionKeys] = useState<string[]>(loadCustomQuickActionKeys);
  const [showAddPicker, setShowAddPicker] = useState(false);

  useEffect(() => {
    localStorage.setItem(CUSTOM_QUICK_ACTIONS_KEY, JSON.stringify(customActionKeys));
  }, [customActionKeys]);

  const availableToAdd = QUICK_ACTION_CATALOG.filter((a) => !customActionKeys.includes(a.key));

  function addCustomAction(key: string) {
    setCustomActionKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setShowAddPicker(false);
  }

  function removeCustomAction(key: string) {
    setCustomActionKeys((prev) => prev.filter((k) => k !== key));
  }

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainerAssignments, setTrainerAssignments] = useState<TrainerAssignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [trainerFilter, setTrainerFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [pathFilter, setPathFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangePreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([
      loadCompanies(), branchService.getAll(), departmentService.getAll(), employeeService.getAll(),
      Promise.resolve([]), loadCourses(), loadLearningPaths(),
      loadEnrollments(), loadAssessments(), loadResults(),
      loadCertificates(), loadLessons(), loadResources(),
    ])
      .then(([companyRows, branchRows, departmentRows, employeeRows, trainerRows,
        courseRows, pathRows, enrollmentRows, assessmentRows, resultRows,
        certificateRows, lessonRows, resourceRows]) => {
        setCompanies(companyRows);
        setBranches(branchRows);
        setDepartments(departmentRows);
        setEmployees(employeeRows);
        setTrainerAssignments(trainerRows);
        setCourses(courseRows);
        setLearningPaths(pathRows);
        setEnrollments(enrollmentRows);
        setAssessments(assessmentRows);
        setResults(resultRows);
        setCertificates(certificateRows);
        setLessons(lessonRows);
        setResources(resourceRows);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    const clock = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(clock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Date range resolution ────────────────────────────────────────────────────

  const dateBounds = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    if (dateRange === 'this_month') return { from: start, to: end };
    if (dateRange === 'last_month') {
      const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { from: lmStart, to: lmEnd };
    }
    if (dateRange === 'last_quarter') {
      const qStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return { from: qStart, to: end };
    }
    return {
      from: customFrom ? new Date(customFrom) : new Date(0),
      to: customTo ? new Date(new Date(customTo).getTime() + 86400000) : now,
    };
  }, [dateRange, customFrom, customTo, now]);

  function withinRange(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    return t >= dateBounds.from.getTime() && t <= dateBounds.to.getTime();
  }

  // ── Scope: employees matching Company/Branch/Department/Trainer filters ────

  const trainerIds = useMemo(() => new Set(trainerAssignments.filter((t) => t.is_active).map((t) => t.trainer_id)), [trainerAssignments]);

  const scopedEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (companyFilter !== 'all' && e.company_id !== companyFilter) return false;
      if (branchFilter !== 'all' && e.branch_id !== branchFilter) return false;
      if (departmentFilter !== 'all' && e.department_id !== departmentFilter) return false;
      if (trainerFilter !== 'all' && e.id !== trainerFilter) return false;
      return true;
    });
  }, [employees, companyFilter, branchFilter, departmentFilter, trainerFilter]);

  const scopedEmployeeIds = useMemo(() => new Set(scopedEmployees.map((e) => e.id)), [scopedEmployees]);

  const scopedEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      if (!scopedEmployeeIds.has(e.employee_id)) return false;
      if (courseFilter !== 'all' && e.course_id !== courseFilter) return false;
      if (!withinRange(e.assigned_at)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, scopedEmployeeIds, courseFilter, dateBounds]);

  const scopedResults = useMemo(() => results.filter((r) => scopedEmployeeIds.has(r.employee_id) && withinRange(r.evaluated_at)), [results, scopedEmployeeIds, dateBounds]);
  const scopedCertificates = useMemo(() => certificates.filter((c) => scopedEmployeeIds.has(c.employee_id) && withinRange(c.issue_date)), [certificates, scopedEmployeeIds, dateBounds]);

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const departmentById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const assessmentById = useMemo(() => new Map(assessments.map((a) => [a.id, a])), [assessments]);

  // ── Assignment lessons (same technique as ReportsAnalytics/MyAssignments) ──

  const assignmentLessons = useMemo(() => lessons.filter((l) => l.lesson_type === 'assignment' && l.active), [lessons]);
  const submissionCountByLesson = useMemo(() => {
    const map = new Map<string, number>();
    resources.forEach((r) => {
      if (r.description.startsWith('submission:')) map.set(r.lesson_id, (map.get(r.lesson_id) ?? 0) + 1);
    });
    return map;
  }, [resources]);
  const pendingAssignments = useMemo(
    () => assignmentLessons.filter((l) => (submissionCountByLesson.get(l.id) ?? 0) === 0).length,
    [assignmentLessons, submissionCountByLesson]
  );

  // ── KPI cards ────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalEmployees = scopedEmployees.length;
    const activeLearnerIds = new Set(scopedEnrollments.filter((e) => e.status === 'IN_PROGRESS').map((e) => e.employee_id));
    const activeLearners = activeLearnerIds.size;
    const totalCourses = courseFilter === 'all' ? courses.length : 1;
    const publishedCourses = courseFilter === 'all' ? courses.filter((c) => c.active).length : (courseById.get(courseFilter)?.active ? 1 : 0);
    const totalPaths = pathFilter === 'all' ? learningPaths.length : 1;
    const totalAssessments = assessments.length;
    const totalAssignments = assignmentLessons.length;
    const certificatesIssued = scopedCertificates.filter((c) => c.generated).length;
    const completionRate = scopedEnrollments.length > 0
      ? Math.round(scopedEnrollments.reduce((s, e) => s + e.completion_percentage, 0) / scopedEnrollments.length)
      : null;
    const averageScore = scopedResults.length > 0
      ? Math.round(scopedResults.reduce((s, r) => s + r.percentage, 0) / scopedResults.length)
      : null;
    const pendingAssessments = assessments.filter((a) => !results.some((r) => r.assessment_id === a.id)).length;

    return {
      totalEmployees, activeLearners, totalCourses, publishedCourses, totalPaths, totalAssessments,
      totalAssignments, certificatesIssued, completionRate, averageScore, pendingAssessments, pendingAssignments,
    };
  }, [scopedEmployees, scopedEnrollments, courses, courseFilter, courseById, learningPaths, pathFilter, assessments,
      assignmentLessons, scopedCertificates, scopedResults, results, pendingAssignments]);

  // ── Analytics ────────────────────────────────────────────────────────────────

  function monthKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  function lastNMonths(n: number): string[] {
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    return out;
  }

  const completionTrend = useMemo(() => {
    const months = lastNMonths(6);
    const counts = new Map(months.map((m) => [m, 0]));
    scopedEnrollments.filter((e) => e.completed_at).forEach((e) => {
      const key = monthKey(new Date(e.completed_at as string));
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return months.map((m) => ({ label: m.slice(5), value: counts.get(m) ?? 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedEnrollments, now]);

  const enrollmentTrend = useMemo(() => {
    const months = lastNMonths(6);
    const counts = new Map(months.map((m) => [m, 0]));
    scopedEnrollments.filter((e) => e.assigned_at).forEach((e) => {
      const key = monthKey(new Date(e.assigned_at));
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return months.map((m) => ({ label: m.slice(5), value: counts.get(m) ?? 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedEnrollments, now]);

  const monthlyLearningHours = useMemo(() => {
    const months = lastNMonths(6);
    const totals = new Map(months.map((m) => [m, 0]));
    scopedEnrollments.filter((e) => e.completed_at).forEach((e) => {
      const key = monthKey(new Date(e.completed_at as string));
      if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + (courseById.get(e.course_id)?.duration_hours ?? 0));
    });
    return months.map((m) => ({ label: m.slice(5), value: totals.get(m) ?? 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedEnrollments, courseById, now]);

  function groupAvg(items: { key: string; value: number }[], nameFn: (k: string) => string, limit = 6) {
    const map = new Map<string, { total: number; count: number }>();
    items.forEach(({ key, value }) => {
      const b = map.get(key) ?? { total: 0, count: 0 };
      b.total += value; b.count += 1;
      map.set(key, b);
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ label: nameFn(key), value: Math.round(v.total / v.count) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  const courseProgress = groupAvg(scopedEnrollments.map((e) => ({ key: e.course_id, value: e.completion_percentage })), (id) => courseById.get(id)?.course_name ?? 'Unknown');
  const assessmentPerformance = groupAvg(scopedResults.map((r) => ({ key: r.assessment_id, value: r.percentage })), (id) => assessmentById.get(id)?.assessment_title ?? 'Unknown');
  const assignmentPerformance: { label: string; value: number }[] = assignmentLessons.length > 0
    ? [
        { label: 'Submitted', value: Math.round(((assignmentLessons.length - pendingAssignments) / assignmentLessons.length) * 100) },
        { label: 'Pending', value: Math.round((pendingAssignments / assignmentLessons.length) * 100) },
      ]
    : [];
  const topCourses = groupAvg(scopedEnrollments.map((e) => ({ key: e.course_id, value: e.completion_percentage })), (id) => courseById.get(id)?.course_name ?? 'Unknown', 5);
  const topDepartments = groupAvg(
    scopedEnrollments.map((e) => ({ deptId: employeeById.get(e.employee_id)?.department_id, value: e.completion_percentage }))
      .filter((x): x is { deptId: string; value: number } => !!x.deptId)
      .map((x) => ({ key: x.deptId, value: x.value })),
    (id) => departmentById.get(id)?.department_name ?? 'Unknown', 5
  );
  const topTrainers = Array.from(trainerIds)
    .map((id) => ({ label: employeeById.get(id) ? `${employeeById.get(id)!.first_name} ${employeeById.get(id)!.last_name}` : id, value: trainerAssignments.filter((t) => t.trainer_id === id && t.is_active).length }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ── Training status ──────────────────────────────────────────────────────────

  const trainingStatus = useMemo(() => {
    const completed = scopedEnrollments.filter((e) => e.status === 'COMPLETED').length;
    const inProgress = scopedEnrollments.filter((e) => e.status === 'IN_PROGRESS').length;
    const notStarted = scopedEnrollments.filter((e) => e.status === 'PENDING').length;
    const overdue = scopedEnrollments.filter((e) => e.due_date && new Date(e.due_date) < now && e.status !== 'COMPLETED').length;
    return { completed, inProgress, notStarted, overdue };
  }, [scopedEnrollments, now]);

  const trainingStatusByDepartment = useMemo(() => {
    const map = new Map<string, { completed: number; inProgress: number; notStarted: number }>();
    scopedEnrollments.forEach((e) => {
      const deptId = employeeById.get(e.employee_id)?.department_id;
      if (!deptId) return;
      const bucket = map.get(deptId) ?? { completed: 0, inProgress: 0, notStarted: 0 };
      if (e.status === 'COMPLETED') bucket.completed += 1;
      else if (e.status === 'IN_PROGRESS') bucket.inProgress += 1;
      else if (e.status === 'PENDING') bucket.notStarted += 1;
      map.set(deptId, bucket);
    });
    return Array.from(map.entries())
      .map(([deptId, v]) => ({
        label: departmentById.get(deptId)?.department_name ?? 'Unknown',
        values: { completed: v.completed, inProgress: v.inProgress, notStarted: v.notStarted },
      }))
      .slice(0, 6);
  }, [scopedEnrollments, employeeById, departmentById]);

  // ── Performance ──────────────────────────────────────────────────────────────

  const topPerformers = useMemo(() => {
    const map = new Map<string, number[]>();
    scopedResults.forEach((r) => { const arr = map.get(r.employee_id) ?? []; arr.push(r.percentage); map.set(r.employee_id, arr); });
    return Array.from(map.entries())
      .map(([id, scores]) => ({ label: employeeById.get(id) ? `${employeeById.get(id)!.first_name} ${employeeById.get(id)!.last_name}` : id, value: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [scopedResults, employeeById]);

  const lowestCompletion = courseProgress.length > 0 ? [...courseProgress].sort((a, b) => a.value - b.value).slice(0, 5) : [];
  const mostActiveCourse = topCourses[0]?.label ?? null;
  const mostActiveDepartment = topDepartments[0]?.label ?? null;

  // ── Activity feed ────────────────────────────────────────────────────────────

  interface FeedItem { id: string; label: string; detail: string; date: string; icon: React.ReactNode; }
  const activityFeed = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [];
    scopedEnrollments.forEach((e) => {
      const emp = employeeById.get(e.employee_id);
      items.push({ id: `enr-${e.id}`, label: 'Enrollment', detail: `${emp ? `${emp.first_name} ${emp.last_name}` : 'Employee'} enrolled in ${courseById.get(e.course_id)?.course_name ?? 'a course'}`, date: e.assigned_at, icon: <IconBook className="h-4 w-4" /> });
      if (e.completed_at) items.push({ id: `comp-${e.id}`, label: 'Course Completed', detail: `${emp ? `${emp.first_name} ${emp.last_name}` : 'Employee'} completed ${courseById.get(e.course_id)?.course_name ?? 'a course'}`, date: e.completed_at, icon: <IconTarget className="h-4 w-4" /> });
    });
    scopedCertificates.filter((c) => c.generated).forEach((c) => {
      const emp = employeeById.get(c.employee_id);
      items.push({ id: `cert-${c.id}`, label: 'Certificate Issued', detail: `Certificate issued to ${emp ? `${emp.first_name} ${emp.last_name}` : 'employee'}`, date: c.issue_date, icon: <IconCertificate className="h-4 w-4" /> });
    });
    scopedResults.forEach((r) => {
      const emp = employeeById.get(r.employee_id);
      items.push({ id: `res-${r.id}`, label: 'Assessment Submitted', detail: `${emp ? `${emp.first_name} ${emp.last_name}` : 'Employee'} scored ${r.percentage.toFixed(1)}%`, date: r.evaluated_at, icon: <IconQuiz className="h-4 w-4" /> });
    });
    resources.filter((r) => r.description.startsWith('submission:')).forEach((r) => {
      const empId = r.description.replace('submission:', '');
      if (!scopedEmployeeIds.has(empId)) return;
      const emp = employeeById.get(empId);
      items.push({ id: `sub-${r.id}`, label: 'Assignment Submitted', detail: `${emp ? `${emp.first_name} ${emp.last_name}` : 'Employee'} submitted an assignment`, date: r.created_at, icon: <IconAssignment className="h-4 w-4" /> });
    });
    return items
      .filter((i) => i.date && !Number.isNaN(new Date(i.date).getTime()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [scopedEnrollments, scopedCertificates, scopedResults, resources, employeeById, courseById, scopedEmployeeIds]);

  // ── Calendar ─────────────────────────────────────────────────────────────────

  interface CalendarItem { id: string; label: string; date: string; type: 'enrollment' | 'assessment' | 'assignment'; }
  const calendarItems = useMemo((): CalendarItem[] => {
    const items: CalendarItem[] = [];
    scopedEnrollments.filter((e) => e.due_date && new Date(e.due_date) >= now).forEach((e) => {
      items.push({ id: `due-${e.id}`, label: `${courseById.get(e.course_id)?.course_name ?? 'Course'} due`, date: e.due_date, type: 'enrollment' });
    });
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 8);
  }, [scopedEnrollments, courseById, now]);

  // ── Global search ────────────────────────────────────────────────────────────

  const searchTerm = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchTerm) return { courses: [], employees: [], paths: [] };
    return {
      courses: courses.filter((c) => c.course_name.toLowerCase().includes(searchTerm)).slice(0, 5),
      employees: employees.filter((e) => `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm)).slice(0, 5),
      paths: learningPaths.filter((p) => p.path_name.toLowerCase().includes(searchTerm)).slice(0, 5),
    };
  }, [searchTerm, courses, employees, learningPaths]);
  const hasSearchResults = searchResults.courses.length + searchResults.employees.length + searchResults.paths.length > 0;

  // ── Welcome section ──────────────────────────────────────────────────────────

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const userCompany = user ? companies.find((c) => c.id === user.companyId) : null;
  const formattedDate = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // ── Recently updated / bottom lists ──────────────────────────────────────────

  const recentCourses = [...courses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const recentlyUpdatedCourses = [...courses].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5);
  const recentPaths = [...learningPaths].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-1">

      {/* TOP BAR */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm backdrop-blur-xl">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconSearch className="h-4 w-4" /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses, employees, learning paths…"
            className="w-full rounded-xl bg-slate-100/70 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
          {searchTerm && (
            <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-xl">
              {!hasSearchResults ? (
                <p className="px-3 py-4 text-center text-sm text-slate-400">No results found.</p>
              ) : (
                <>
                  {searchResults.courses.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Courses</p>
                      {searchResults.courses.map((c) => (
                        <button key={c.id} onClick={() => onSearchResultSelect?.('course', c.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50">
                          <IconBook className="h-4 w-4 text-indigo-400" /> {c.course_name}
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.employees.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Employees</p>
                      {searchResults.employees.map((e) => (
                        <button key={e.id} onClick={() => onSearchResultSelect?.('employee', e.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50">
                          <IconUsers className="h-4 w-4 text-indigo-400" /> {e.first_name} {e.last_name}
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.paths.length > 0 && (
                    <div>
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Learning Paths</p>
                      {searchResults.paths.map((p) => (
                        <button key={p.id} onClick={() => onSearchResultSelect?.('path', p.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50">
                          <IconPath className="h-4 w-4 text-indigo-400" /> {p.path_name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <button onClick={onOpenNotifications} className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100/70 text-slate-500 transition hover:bg-slate-200">
          <IconBell />
          {(kpis.pendingAssessments + kpis.pendingAssignments) > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {kpis.pendingAssessments + kpis.pendingAssignments}
            </span>
          )}
        </button>

        <button onClick={onOpenProfile} className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-slate-100/70 px-3 py-2 transition hover:bg-slate-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xs font-bold text-white">
            {user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}` : '—'}
          </span>
          <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user ? `${user.firstName} ${user.lastName}` : 'Profile'}</span>
        </button>
      </div>

      {/* SMART FILTER BAR */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur-xl">
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="rounded-xl bg-slate-100/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Companies</option>
          {companies.map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="rounded-xl bg-slate-100/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Branches</option>
          {branches.map((b) => (<option key={b.id} value={b.id}>{b.branch_name}</option>))}
        </select>
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="rounded-xl bg-slate-100/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Departments</option>
          {departments.map((d) => (<option key={d.id} value={d.id}>{d.department_name}</option>))}
        </select>
        <select value={trainerFilter} onChange={(e) => setTrainerFilter(e.target.value)} className="rounded-xl bg-slate-100/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Trainers</option>
          {Array.from(trainerIds).map((id) => (<option key={id} value={id}>{employeeById.get(id) ? `${employeeById.get(id)!.first_name} ${employeeById.get(id)!.last_name}` : id}</option>))}
        </select>
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="rounded-xl bg-slate-100/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Courses</option>
          {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
        </select>
        <select value={pathFilter} onChange={(e) => setPathFilter(e.target.value)} className="rounded-xl bg-slate-100/70 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Learning Paths</option>
          {learningPaths.map((p) => (<option key={p.id} value={p.id}>{p.path_name}</option>))}
        </select>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100/70 p-1">
          {(['this_month', 'last_month', 'last_quarter', 'custom'] as DateRangePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setDateRange(preset)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${dateRange === preset ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}
            >
              {preset === 'this_month' ? 'This Month' : preset === 'last_month' ? 'Last Month' : preset === 'last_quarter' ? 'Last Quarter' : 'Custom'}
            </button>
          ))}
        </div>
        {dateRange === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-xl bg-slate-100/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-xl bg-slate-100/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </>
        )}
      </div>

      {/* WELCOME SECTION */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-white/80">{formattedDate}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{greeting}, {user ? user.firstName : 'there'} 👋</h1>
        <p className="mt-1 text-sm text-white/80">{userCompany?.company_name ?? 'Training Platform'}</p>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Total Employees" value={kpis.totalEmployees} icon={<IconUsers className="h-5 w-5" />} gradient="bg-gradient-to-br from-indigo-500 to-indigo-400" />
        <KpiCard label="Active Learners" value={kpis.activeLearners} icon={<IconTrend className="h-5 w-5" />} gradient="bg-gradient-to-br from-emerald-500 to-emerald-400" />
        <KpiCard label="Courses" value={kpis.totalCourses} icon={<IconBook className="h-5 w-5" />} gradient="bg-gradient-to-br from-blue-500 to-blue-400" />
        <KpiCard label="Published Courses" value={kpis.publishedCourses} icon={<IconBook className="h-5 w-5" />} gradient="bg-gradient-to-br from-cyan-500 to-cyan-400" />
        <KpiCard label="Learning Paths" value={kpis.totalPaths} icon={<IconPath className="h-5 w-5" />} gradient="bg-gradient-to-br from-fuchsia-500 to-fuchsia-400" />
        <KpiCard label="Assessments" value={kpis.totalAssessments} icon={<IconQuiz className="h-5 w-5" />} gradient="bg-gradient-to-br from-amber-500 to-amber-400" />
        <KpiCard label="Assignments" value={kpis.totalAssignments} icon={<IconAssignment className="h-5 w-5" />} gradient="bg-gradient-to-br from-orange-500 to-orange-400" />
        <KpiCard label="Certificates Issued" value={kpis.certificatesIssued} icon={<IconCertificate className="h-5 w-5" />} gradient="bg-gradient-to-br from-violet-500 to-violet-400" />
        <KpiCard label="Completion Rate" value={kpis.completionRate} suffix={kpis.completionRate !== null ? '%' : ''} icon={<IconTarget className="h-5 w-5" />} gradient="bg-gradient-to-br from-teal-500 to-teal-400" />
        <KpiCard label="Average Score" value={kpis.averageScore} suffix={kpis.averageScore !== null ? '%' : ''} icon={<IconTrend className="h-5 w-5" />} gradient="bg-gradient-to-br from-rose-500 to-rose-400" />
        <KpiCard label="Pending Assessments" value={kpis.pendingAssessments} icon={<IconExclaim className="h-5 w-5" />} gradient="bg-gradient-to-br from-red-500 to-red-400" />
        <KpiCard label="Pending Assignments" value={kpis.pendingAssignments} icon={<IconExclaim className="h-5 w-5" />} gradient="bg-gradient-to-br from-pink-500 to-pink-400" />
      </div>

      {/* ANALYTICS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <GlassCard>
          <SectionTitle icon={<IconTrend className="h-4 w-4" />} title="Completion Trend" />
          <LineArea data={completionTrend} color="#10b981" filled />
        </GlassCard>
        <GlassCard>
          <SectionTitle icon={<IconTrend className="h-4 w-4" />} title="Enrollment Trend" />
          <LineArea data={enrollmentTrend} color="#6366f1" filled />
        </GlassCard>
        <GlassCard>
          <SectionTitle icon={<IconClock className="h-4 w-4" />} title="Monthly Learning Hours" />
          <LineArea data={monthlyLearningHours} color="#f59e0b" />
        </GlassCard>
        <GlassCard>
          <SectionTitle icon={<IconBook className="h-4 w-4" />} title="Course Progress" />
          <HorizontalBars data={courseProgress} suffix="%" />
        </GlassCard>
        <GlassCard>
          <SectionTitle icon={<IconQuiz className="h-4 w-4" />} title="Assessment Performance" />
          <HorizontalBars data={assessmentPerformance} suffix="%" />
        </GlassCard>
        <GlassCard>
          <SectionTitle icon={<IconAssignment className="h-4 w-4" />} title="Assignment Performance" />
          {assignmentPerformance.length === 0 ? <NoData /> : <DonutChart segments={[{ label: 'Submitted', value: assignmentPerformance[0].value, color: '#10b981' }, { label: 'Pending', value: assignmentPerformance[1].value, color: '#f43f5e' }]} />}
        </GlassCard>
        <GlassCard>
          <SectionTitle icon={<IconBook className="h-4 w-4" />} title="Top Courses" />
          <HorizontalBars data={topCourses} suffix="%" />
        </GlassCard>
        <GlassCard>
          <SectionTitle icon={<IconUsers className="h-4 w-4" />} title="Top Trainers" />
          <HorizontalBars data={topTrainers} />
        </GlassCard>
        <GlassCard>
          <SectionTitle icon={<IconUsers className="h-4 w-4" />} title="Top Departments" />
          <HorizontalBars data={topDepartments} suffix="%" />
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* TRAINING STATUS */}
        <GlassCard>
          <SectionTitle title="Training Status" />
          <div className="mb-5 flex items-center gap-6">
            <ProgressRing value={scopedEnrollments.length > 0 ? (trainingStatus.completed / scopedEnrollments.length) * 100 : 0} color="#10b981" />
            <div className="flex-1 space-y-2">
              <StatusPill label="Completed" value={trainingStatus.completed} color="#10b981" />
              <StatusPill label="In Progress" value={trainingStatus.inProgress} color="#6366f1" />
              <StatusPill label="Not Started" value={trainingStatus.notStarted} color="#94a3b8" />
              <StatusPill label="Overdue" value={trainingStatus.overdue} color="#f43f5e" />
            </div>
          </div>
          <p className="mb-2 text-xs font-semibold text-slate-400">By Department</p>
          <StackedBars
            data={trainingStatusByDepartment}
            keys={[
              { key: 'completed', color: '#10b981', label: 'Completed' },
              { key: 'inProgress', color: '#6366f1', label: 'In Progress' },
              { key: 'notStarted', color: '#94a3b8', label: 'Not Started' },
            ]}
          />
        </GlassCard>

        {/* PERFORMANCE */}
        <GlassCard>
          <SectionTitle title="Performance" />
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-400">Top Performing Employees</p>
              {topPerformers.length === 0 ? <NoData /> : <HorizontalBars data={topPerformers} suffix="%" />}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-400">Most Active Course</p>
                <p className="mt-0.5 truncate font-semibold text-slate-700">{mostActiveCourse ?? 'No Data Available'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-slate-400">Most Active Department</p>
                <p className="mt-0.5 truncate font-semibold text-slate-700">{mostActiveDepartment ?? 'No Data Available'}</p>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-400">Lowest Completion</p>
              {lowestCompletion.length === 0 ? <NoData /> : <HorizontalBars data={lowestCompletion} suffix="%" />}
            </div>
          </div>
        </GlassCard>

        {/* CALENDAR */}
        <GlassCard>
          <SectionTitle icon={<IconCalendar className="h-4 w-4" />} title="Upcoming" />
          {calendarItems.length === 0 ? (
            <NoData label="No upcoming deadlines." />
          ) : (
            <div className="space-y-2">
              {calendarItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <span className="truncate text-sm text-slate-700">{item.label}</span>
                  <span className="flex-shrink-0 text-xs font-semibold text-slate-500">{new Date(item.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">

        {/* ACTIVITY FEED */}
        <GlassCard>
          <SectionTitle title="Recent Activity" />
          {activityFeed.length === 0 ? (
            <NoData label="No recent activity yet." />
          ) : (
            <ol className="space-y-4 border-l border-slate-100 pl-4">
              {activityFeed.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-4 ring-white">{item.icon}</span>
                  <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{new Date(item.date).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          )}
        </GlassCard>

        {/* RIGHT PANEL — QUICK ACTIONS */}
        <GlassCard>
          <SectionTitle title="Quick Actions" />
          <div className="grid grid-cols-1 gap-2.5">
            <button onClick={onCreateCourse} className="flex items-center justify-between rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md">
              <span className="flex items-center gap-2"><IconPlus /> Create Course</span> <IconArrowRight />
            </button>
            <button onClick={onCreateAssessment} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <span className="flex items-center gap-2"><IconQuiz className="h-4 w-4" /> Create Assessment</span> <IconArrowRight />
            </button>
            <button onClick={onAssignCourse} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <span className="flex items-center gap-2"><IconBook className="h-4 w-4" /> Assign Course</span> <IconArrowRight />
            </button>
            <button onClick={onIssueCertificate} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <span className="flex items-center gap-2"><IconCertificate className="h-4 w-4" /> Issue Certificate</span> <IconArrowRight />
            </button>
            <button onClick={onInviteEmployee} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
              <span className="flex items-center gap-2"><IconMail className="h-4 w-4" /> Invite Employee</span> <IconArrowRight />
            </button>

            {customActionKeys.map((key) => {
              const action = QUICK_ACTION_CATALOG.find((a) => a.key === key);
              if (!action) return null;
              return (
                <div key={key} className="group flex items-center gap-1.5">
                  <button
                    onClick={() => navigate(ROUTES.ADMIN, { state: { tab: action.tab } })}
                    className="flex flex-1 items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <span className="flex items-center gap-2"><IconPlus className="h-4 w-4" /> {action.label}</span> <IconArrowRight />
                  </button>
                  <button
                    onClick={() => removeCustomAction(key)}
                    title="Remove from Quick Actions"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {showAddPicker ? (
              availableToAdd.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  All available shortcuts are already added.
                </p>
              ) : (
                <select
                  autoFocus
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) addCustomAction(e.target.value); }}
                  onBlur={() => setShowAddPicker(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
                >
                  <option value="" disabled>Choose a shortcut to add…</option>
                  {availableToAdd.map((a) => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </select>
              )
            ) : (
              <button
                onClick={() => setShowAddPicker(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
              >
                <IconPlus className="h-4 w-4" /> Add Quick Action
              </button>
            )}
          </div>
        </GlassCard>
      </div>

      {/* BOTTOM */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard>
          <SectionTitle title="Recent Courses" />
          {recentCourses.length === 0 ? <NoData /> : (
            <div className="space-y-2">
              {recentCourses.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                  {c.thumbnail ? <img src={c.thumbnail} alt="" className="h-10 w-14 flex-shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300"><IconBook className="h-4 w-4" /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{c.course_name}</p>
                    <p className="text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Recently Updated Courses" />
          {recentlyUpdatedCourses.length === 0 ? <NoData /> : (
            <div className="space-y-2">
              {recentlyUpdatedCourses.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                  {c.thumbnail ? <img src={c.thumbnail} alt="" className="h-10 w-14 flex-shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300"><IconBook className="h-4 w-4" /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{c.course_name}</p>
                    <p className="text-xs text-slate-400">Updated {new Date(c.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Recent Learning Paths" />
          {recentPaths.length === 0 ? <NoData /> : (
            <div className="space-y-2">
              {recentPaths.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                  {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="h-10 w-14 flex-shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300"><IconPath className="h-4 w-4" /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{p.path_name}</p>
                    <p className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

export default Dashboard;