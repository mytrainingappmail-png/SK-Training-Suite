import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { logout } from "../../services/quiz/quizAuthService";
import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";

const navItems = [
  { to: ROUTES.QUIZ_ADMIN_DASHBOARD, label: "Dashboard" },
  { to: ROUTES.QUIZ_ADMIN_QUIZZES, label: "Quizzes" },
  { to: ROUTES.QUIZ_ADMIN_RESULTS, label: "Results" },
];

export default function QuizAdminLayout() {
  const navigate = useNavigate();
  const admin = getCurrentQuizAdmin();

  async function handleLogout() {
    await logout();
    navigate(ROUTES.QUIZ_ADMIN_LOGIN, { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="flex items-center justify-between gap-4 px-6 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-semibold tracking-wide">Live Quiz</span>
        </div>

        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 bg-slate-800 rounded-lg px-2.5 py-1">
            {admin?.display_name || admin?.username}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
