import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { logout } from "../../services/quiz/quizAuthService";
import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { getSettings } from "../../repositories/quiz/quizSettingsRepository";
import { applyQuizFavicon } from "../../services/quiz/quizBrandingRuntimeService";
import QuizAccountModal from "../../components/quiz/QuizAccountModal";

const navItems = [
  { to: ROUTES.QUIZ_ADMIN_DASHBOARD, label: "Dashboard" },
  { to: ROUTES.QUIZ_ADMIN_QUIZZES, label: "Quizzes" },
  { to: ROUTES.QUIZ_ADMIN_SURVEYS, label: "Surveys" },
  { to: ROUTES.QUIZ_ADMIN_RESULTS, label: "Results" },
  { to: ROUTES.QUIZ_ADMIN_USERS, label: "Users" },
  { to: ROUTES.QUIZ_ADMIN_SETTINGS, label: "Settings" },
];

export default function QuizAdminLayout() {
  const navigate = useNavigate();
  const admin = getCurrentQuizAdmin();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [footerText, setFooterText] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!admin) return;
    getSettings(admin.company_id).then((s) => {
      applyQuizFavicon(s.favicon_url);
      setFooterText(s.footer_text);
    });
  }, [admin]);

  async function handleLogout() {
    await logout();
    navigate(ROUTES.QUIZ_ADMIN_LOGIN, { replace: true });
  }

  const initial = (admin?.display_name || admin?.username || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="flex items-center justify-between gap-4 px-6 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="font-semibold tracking-wide">Live Quiz</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 rounded-xl pl-2 pr-3 py-1.5 transition-colors"
          >
            <span className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
              {initial}
            </span>
            <span className="text-left leading-tight hidden sm:block">
              <span className="block text-sm font-semibold text-white">{admin?.display_name || admin?.username}</span>
              <span className="block text-[10px] text-slate-400">{admin?.role === "super_admin" ? "Super Admin" : "Admin"}</span>
            </span>
            <span className={`text-xs text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}>▼</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50">
                <div className="text-sm font-semibold text-white">{admin?.display_name || admin?.username}</div>
                <div className="text-xs text-slate-400 mt-0.5">{admin?.role === "super_admin" ? "Super Admin" : "Admin"}</div>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setAccountModalOpen(true);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
              >
                🔑 Change Password
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate(ROUTES.QUIZ_ADMIN_DASHBOARD);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate(ROUTES.QUIZ_ADMIN_RESULTS);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
              >
                📋 Results
              </button>
              <hr className="border-slate-800" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10 transition-colors"
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>

      {footerText && (
        <footer className="border-t border-slate-800 px-6 py-4 text-center text-[11px] text-slate-500 whitespace-pre-line">
          {footerText}
        </footer>
      )}

      {accountModalOpen && <QuizAccountModal onClose={() => setAccountModalOpen(false)} />}
    </div>
  );
}
