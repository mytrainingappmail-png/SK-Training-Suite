// src/components/performanceTracker/ptIcons.tsx
//
// Small inline SVG icon set for Performance Tracker — matches this app's
// existing convention (Induction.tsx, Projects.tsx) of hand-rolled icons
// rather than an icon library dependency.

type IconProps = { className?: string };

export function IconTrendingUp({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 17.25 9 11l4 4 8-8.5M16.5 6.75h4.5v4.5" /></svg>);
}
export function IconSun({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path strokeLinecap="round" d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>);
}
export function IconMoon({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15A8.25 8.25 0 0 1 9.85 3.75 8.25 8.25 0 1 0 20.25 14.15Z" /></svg>);
}
export function IconChartLine({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v16.5A1.5 1.5 0 0 0 4.5 21H21M6 16l4-5 3 3 6-8" /></svg>);
}
export function IconTrophy({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5h7.5v4.5a3.75 3.75 0 1 1-7.5 0V4.5ZM8.25 6H5.25a2.25 2.25 0 0 0 2.25 2.25M15.75 6h3a2.25 2.25 0 0 1-2.25 2.25M12 13.5v3.75m-3 3h6m-3 0v-3" /></svg>);
}
export function IconBarChart({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5v-6M9.75 19.5V9M15 19.5v-9M20.25 19.5V4.5" /></svg>);
}
export function IconUsers({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.5v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1.5M8.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.5 19.5v-1.5a3.5 3.5 0 0 0-2.5-3.35M14.5 4.65a3 3 0 0 1 0 5.7" /></svg>);
}
export function IconBell({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 19.5a2.25 2.25 0 0 1-4.5 0M5.25 9a6.75 6.75 0 0 1 13.5 0c0 3.5 1 5 1.5 6H3.75c.5-1 1.5-2.5 1.5-6Z" /></svg>);
}
export function IconDocument({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h6l4.5 4.5v11.25a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5ZM13.5 3.75V9h4.5M9 13.5h6M9 16.5h6" /></svg>);
}
export function IconGear({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 3.75h3l.5 2.25a6.7 6.7 0 0 1 1.9 1.1l2.2-.75 1.5 2.6-1.7 1.5a6.8 6.8 0 0 1 0 2.2l1.7 1.5-1.5 2.6-2.2-.75a6.7 6.7 0 0 1-1.9 1.1l-.5 2.25h-3l-.5-2.25a6.7 6.7 0 0 1-1.9-1.1l-2.2.75-1.5-2.6 1.7-1.5a6.8 6.8 0 0 1 0-2.2L4.4 8.9l1.5-2.6 2.2.75a6.7 6.7 0 0 1 1.9-1.1l.5-2.25Z" /><circle cx="12" cy="12" r="2.5" /></svg>);
}
export function IconLock({ className = 'h-5 w-5' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>);
}
export function IconCheck({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>);
}
export function IconClock({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 1.5" /></svg>);
}
export function IconArrowLeft({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>);
}
export function IconSpinner({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
export function IconAward({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8.25" r="4.5" /><path strokeLinecap="round" strokeLinejoin="round" d="m8.5 12.2-1.4 6.55 4.9-2.2 4.9 2.2-1.4-6.55" /></svg>);
}
export function IconSend({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 4.5 15 7.5-15 7.5 3-7.5-3-7.5Z" /></svg>);
}
export function IconTv({ className = 'h-4 w-4' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2.5" y="5.25" width="19" height="13" rx="2" /><path strokeLinecap="round" d="M8.5 21h7M12 18v3" /></svg>);
}
export function IconAlert({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4.5m0 3h.008M10.4 3.9 2.2 18a1.8 1.8 0 0 0 1.55 2.7h16.5A1.8 1.8 0 0 0 21.8 18L13.6 3.9a1.85 1.85 0 0 0-3.2 0Z" /></svg>);
}
