import { BRAND } from "../../config/branding";
import logo from "../../assets/logo.png";
import { MENU } from "../../config/menu";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuthorization } from "../../hooks/useAuthorization";
import { PERMISSIONS } from "../../constants/permissions";
import { getCurrentUser } from "../../services/auth/session";
import { loadRoles } from "../../services/role/roleService";
import { loadBranding, BRANDING_CHANGED_EVENT } from "../../services/branding/brandingService";
import { loadCompany } from "../../services/company/companyService";
import { loadCompanyModuleFlags } from "../../services/company/appModuleService";
import { getMyEmployeeLinkedGrant } from "../../repositories/callingApp/callingAppAdminRepository";
import type { PermissionCode } from "../../types/authorization";

// Shrinks text to fit its container on a single line, however long the
// company name is — never wraps, never overflows. Measures the rendered
// text's width against the available space and reduces font-size in 1px
// steps until it fits (or hits the floor, at which point it ellipsizes
// as a last resort for absurdly long names).
function FitText({ text, className, align = "left", maxFontSize = 15, minFontSize = 10 }: { text: string; className?: string; align?: "left" | "center"; maxFontSize?: number; minFontSize?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;
    let size = maxFontSize;
    textEl.style.fontSize = `${size}px`;
    while (textEl.scrollWidth > container.clientWidth && size > minFontSize) {
      size -= 1;
      textEl.style.fontSize = `${size}px`;
    }
    setFontSize(size);
  }, [text, maxFontSize, minFontSize]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden" style={{ textAlign: align }}>
      <p
        ref={textRef}
        className={className}
        style={{ fontSize, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", maxWidth: "100%" }}
      >
        {text}
      </p>
    </div>
  );
}

// Maps a MENU item id to the app_modules key that must be enabled for the
// company before the item shows at all — on top of whatever permission
// gate already applies. Items not listed here are core/structural (running
// the company at all, e.g. Employees/Reports/Settings) and always show.
const MENU_MODULE_MAP: Record<string, string> = {
  "market-analytics": "market_analytics",
  "live-quiz": "live_quiz",
  "calling-app": "calling_app",
  projects: "projects",
  brainstorming: "brainstorming",
  "help-center": "help_center",
  "my-tickets": "support_tickets",
  "my-attendance": "attendance",
  "my-courses": "courses",
  "continue-learning": "courses",
  "learning-home": "courses",
  videos: "courses",
  courses: "courses",
  training: "courses",
  "my-learning-paths": "learning_paths",
  "my-assessments": "assessments",
  assessment: "assessments",
  "my-certificates": "certificates",
};

// Maps each "Manage" / "System" sidebar item to the permission required
// to see it. Any menu id NOT listed here (all "My Learning" items, plus
// "Overview") is available to every logged-in user — no gate needed.
//
// Support Tickets and Help Center ARE gated here even though they live in
// the "Overview" group — they're admin-facing (a company's Admin/Super
// Admin/HR uses them, then trains employees directly), not employee
// self-service, so plain employees should not see either link.
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
  "my-tickets": PERMISSIONS.VIEW_SUPPORT_TICKET,
  "help-center": PERMISSIONS.VIEW_HELP_CENTER,
};

function Sidebar() {
  const location = useLocation();
  const user = getCurrentUser();

  const { can } = useAuthorization();
  const [isTrainer, setIsTrainer] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [moduleFlags, setModuleFlags] = useState<Record<string, boolean>>({});
  const [isPlatformOperator, setIsPlatformOperator] = useState(false);
  // Whether the CURRENT employee personally has a Calling App grant —
  // separate from moduleFlags.calling_app (company-level purchase), since
  // Calling App access is also gated per-person (Admin → Calling App).
  const [hasCallingAppGrant, setHasCallingAppGrant] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyName, setCompanyName] = useState(BRAND.companyName);
  const [logoUrl, setLogoUrl] = useState('');
  const [namePosition, setNamePosition] = useState<"left" | "center">("left");
  const [menuOrder, setMenuOrder] = useState<string[] | null>(null);
  // From the active Theme (Admin → Theme) — falls back to the static
  // defaults, which match the current design exactly, so nothing changes
  // visually until an admin actually activates a different theme.
  const [sidebarColor, setSidebarColor] = useState(BRAND.primaryColor);
  const [accentColor, setAccentColor] = useState(BRAND.secondaryColor);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function refreshBranding() {
      loadBranding().then((b) => {
        setCompanyName(b.companyName);
        setLogoUrl(b.logoUrl);
        setSidebarColor(b.sidebarColor);
        setAccentColor(b.secondaryColor);
      });
    }
    refreshBranding();
    window.addEventListener(BRANDING_CHANGED_EVENT, refreshBranding);
    return () => window.removeEventListener(BRANDING_CHANGED_EVENT, refreshBranding);
  }, []);

  useEffect(() => {
    loadCompany().then((c) => {
      setIsPlatformOperator(c?.is_platform_operator ?? false);
      setNamePosition(c?.sidebar_name_position ?? "left");
      setMenuOrder(c?.sidebar_menu_order ?? null);
      if (c?.id) {
        loadCompanyModuleFlags(c.id).then(setModuleFlags).catch(() => setModuleFlags({}));
      }
    }).catch(() => {
      setIsPlatformOperator(false);
      setModuleFlags({});
    });
  }, []);

  useEffect(() => {
    getMyEmployeeLinkedGrant()
      .then((grant) => setHasCallingAppGrant(!!grant && grant.status === "active"))
      .catch(() => setHasCallingAppGrant(false));
  }, []);

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

  let visibleItems = MENU.filter((item) => {
    if (!item.visible) return false;
    if (item.group === "Teaching" && !isTrainer) return false;
    if (item.group === "My Learning" && (isTrainer || isSuperAdmin)) return false;
    if (item.id === "settings" && !isPlatformOperator) return false;
    // Live Quiz: Admin-tier only (same gate as the "Admin" console link)
    // AND only once the company has purchased the add-on. Employees,
    // Trainers, and Managers must never see it, per spec.
    if (item.id === "live-quiz" && !can(PERMISSIONS.VIEW_COMPANY)) return false;
    // Calling App: company must have the add-on (MENU_MODULE_MAP below)
    // AND this specific employee must have been personally granted
    // access (Admin → Calling App) — unlike every other item here, that's
    // a per-person check, not a role/permission one.
    if (item.id === "calling-app" && !hasCallingAppGrant) return false;
    const requiredModule = MENU_MODULE_MAP[item.id];
    if (requiredModule && moduleFlags[requiredModule] === false) return false;

    const requiredPermission = MENU_PERMISSION_MAP[item.id];
    if (!requiredPermission) return true;
    return can(requiredPermission);
  });
  // Admin-controlled sidebar sequence: a flat custom order of item ids
  // reorders visibleItems before `groups` is derived from it below, so
  // both group order and within-group item order follow the same list —
  // no separate group-order concept needed. Items not present in the
  // saved order (added after it was last saved) fall back to the end,
  // in their built-in order.
  if (menuOrder && menuOrder.length > 0) {
    const orderIndex = new Map(menuOrder.map((id, i) => [id, i]));
    visibleItems = [...visibleItems].sort((a, b) => {
      const ai = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }
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
        style={{ backgroundColor: sidebarColor }}
        className={`print:hidden fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-56 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >

        <div className="p-6 border-b border-slate-800 flex items-start gap-3">

          <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <img
              src={logoUrl || logo}
              alt="logo"
              className="w-12 h-12 rounded-xl object-contain bg-white flex-shrink-0"
            />

            <div className="w-full min-w-0">
              <FitText text={companyName} align={namePosition} className="text-white font-semibold" />
              <p className={`text-slate-400 text-xs mt-0.5 ${namePosition === "center" ? "text-center" : "text-left"}`}>
                Training Suite
              </p>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
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

                  if (item.external) {
                    return (
                      <a
                        key={item.id}
                        href={item.route}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full mb-1 px-4 py-2.5 rounded-xl transition text-slate-300 hover:bg-yellow-500 hover:text-black"
                      >
                        {item.title} <span className="text-[10px] align-super opacity-70">↗</span>
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.id}
                      to={item.route}
                      style={isActive ? { backgroundColor: accentColor, color: "#000" } : undefined}
                      className={`block w-full mb-1 px-4 py-2.5 rounded-xl transition ${
                        isActive
                          ? "font-semibold"
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