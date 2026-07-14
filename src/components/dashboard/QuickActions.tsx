// src/components/dashboard/QuickActions.tsx
//
// Professional colorful quick-action cards. Each one navigates to an
// existing, already-routed module using the app's own ROUTES constants
// and react-router-dom (both already used elsewhere in this project,
// not new dependencies). No new routes are created here.

import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

function IconBook({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292v-14.25" /></svg>);
}
function IconQuiz({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.008v.008H12v-.008Z" /></svg>);
}
function IconPath({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-9.372 5.25-2.25c.667-.286 1.372.191 1.372.907v13.607a1 1 0 0 1-.628.928l-5.494 2.222a1 1 0 0 1-.744 0l-5.494-2.222a1 1 0 0 0-.744 0l-5.494 2.222A1 1 0 0 1 3.75 21V7.393a1 1 0 0 1 .628-.928l5.494-2.222a1 1 0 0 1 .744 0l5.494 2.222c.24.097.51.097.75 0Z" /></svg>);
}
function IconUserPlus({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" /></svg>);
}
function IconCertificate({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>);
}
function IconUsers({ className = 'h-6 w-6' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>);
}

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  path: string;
}

function QuickActions() {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    { title: 'Create Course', description: 'Author a new course', icon: <IconBook />, gradient: 'from-indigo-500 to-blue-500', path: ROUTES.COURSES },
    { title: 'Create Assessment', description: 'Build a new assessment', icon: <IconQuiz />, gradient: 'from-amber-500 to-orange-500', path: ROUTES.ASSESSMENT },
    { title: 'Create Learning Path', description: 'Sequence multiple courses', icon: <IconPath />, gradient: 'from-fuchsia-500 to-purple-500', path: ROUTES.TRAINING },
    { title: 'Enroll Employee', description: 'Assign training to an employee', icon: <IconUserPlus />, gradient: 'from-emerald-500 to-teal-500', path: ROUTES.EMPLOYEES },
    { title: 'Issue Certificate', description: 'Generate a certificate', icon: <IconCertificate />, gradient: 'from-violet-500 to-indigo-500', path: ROUTES.ADMIN },
    { title: 'Manage Employees', description: 'View and update employee records', icon: <IconUsers />, gradient: 'from-cyan-500 to-blue-500', path: ROUTES.EMPLOYEES },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-slate-800">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={() => navigate(action.path)}
            className={`group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl bg-gradient-to-br ${action.gradient} p-5 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition group-hover:bg-white/30">
              {action.icon}
            </span>
            <div>
              <p className="font-semibold">{action.title}</p>
              <p className="text-xs text-white/80">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
