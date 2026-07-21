import { BRAND } from "../../config/branding";
import { MENU } from "../../config/menu";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuthorization } from "../../hooks/useAuthorization";
import { PERMISSIONS } from "../../constants/permissions";
import { getCurrentUser } from "../../services/auth/session";
import { loadRoles } from "../../services/role/roleService";
import type { PermissionCode } from "../../types/authorization";

// Maps each "Manage" / "System" sidebar item to the permission required
// to see it. Any menu id NOT listed here (all "My Learning" items, plus
// "Overview") is available to every logged-in user — no gate needed.
const MENU_PERMISSION_MAP: Record<string, PermissionCode> = {
  dashboard: PERMISSIONS.VIEW_DASHBOARD,
  employees: PERMISSIONS.VIEW_EMPLOYEE,
  training: PERMISSIONS.VIEW_COURSE,
  courses: PERMISSIONS.VIEW_COURSE,
  modules: PERMISSIONS.VIEW_MODULE,
  assessment: PERMISSIONS.VIEW_ASSESSMENT,
  reports: PERMISSIONS.VIEW_REPORTS,
  settings: PERMISSIONS.VIEW_SETTINGS,
  admin: PERMISSIONS.VIEW_COMPANY,
};

function Sidebar() {
  const location = useLocation();
  const user = getCurrentUser();

  const { can } = useAuthorization();
  const [isTrainer, setIsTrainer] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.roleId) return;
    loadRoles()
      .then((roles) => {
        const role = roles.find((r) => r.id === user.roleId);
        setIsTrainer(role?.role_code === "TRAINER");
        setIsSuperAdmin(role?.role_code === "SUPER_ADMIN");
      })
      .catch(() => {
        setIsTrainer(false);
        setIsSuperAdmin(false);
      });
  }, [user?.roleId]);

  const visibleItems = MENU.filter((item) => {
    if (!item.visible) return false;
    if (item.group === "Teaching" && !isTrainer) return false;
    if (item.group === "My Learning" && (isTrainer || isSuperAdmin)) return false;

    const requiredPermission = MENU_PERMISSION_MAP[item.id];
    if (!requiredPermission) return true;
    return can(requiredPermission);
  });
  const groups = Array.from(new Set(visibleItems.map((item) => item.group)));

  const navRef = useRef<HTMLElement>(null);

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg lg:hidden"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 10px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: #1e293b; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background-color: #eab308; border-radius: 9999px; border: 2px solid #1e293b; }
        .sidebar-scroll { scrollbar-width: auto; scrollbar-color: #eab308 #1e293b; }
      `}</style>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-56 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >

        <div className="p-6 border-b border-slate-800 flex items-center gap-3">

          <img
            src={BRAND.logo}
            alt="logo"
            className="w-12 h-12 rounded-xl object-contain bg-white"
          />

          <div>
            <h2 className="text-white font-semibold">
              {BRAND.companyName}
            </h2>

            <p className="text-slate-400 text-xs">
              Training Suite
            </p>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

        </div>

        <nav ref={navRef} className="sidebar-scroll flex-1 overflow-y-auto p-4 pb-6">

          {groups.map((group) => (
            <div key={group} className="mb-5">

              <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {group}
              </p>

              {visibleItems
                .filter((item) => item.group === group)
                .map((item) => {
                  const isActive = location.pathname === item.route;
                  return (
                    <Link
                      key={item.id}
                      to={item.route}
                      className={`block w-full mb-1 px-4 py-2.5 rounded-xl transition ${
                        isActive
                          ? "bg-yellow-500 text-black font-semibold"
                          : "text-slate-300 hover:bg-yellow-500 hover:text-black"
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}

            </div>
          ))}

        </nav>

      </aside>
    </>
  );
}

export default Sidebar;