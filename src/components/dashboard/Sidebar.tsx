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
import type { PermissionCode } from "../../types/authorization";

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

// Every tab inside the Admin page (src/pages/Admin.tsx), grouped for the
// sidebar so each one is reachable directly instead of "click Admin, then
// find the right tab button". `permission` mirrors exactly what Admin.tsx
// itself checks for that tab (or is left unset for tabs Admin.tsx shows to
// anyone who can already reach the Admin page at all) — this only adds a
// second path to the same already-gated destinations, never a new one.
interface AdminSectionItem {
  tab: string;
  label: string;
  permission?: PermissionCode;
}
interface AdminSectionGroup {
  group: string;
  items: AdminSectionItem[];
}

const ADMIN_SECTIONS: AdminSectionGroup[] = [
  {
    group: 'Organization',
    items: [
      { tab: 'company', label: 'Company', permission: PERMISSIONS.VIEW_COMPANY },
      { tab: 'branch', label: 'Branches', permission: PERMISSIONS.VIEW_BRANCH },
      { tab: 'department', label: 'Departments', permission: PERMISSIONS.VIEW_DEPARTMENT },
      { tab: 'designation', label: 'Designations', permission: PERMISSIONS.VIEW_DESIGNATION },
      { tab: 'employee', label: 'Employees', permission: PERMISSIONS.VIEW_EMPLOYEE },
      { tab: 'roles', label: 'Roles', permission: PERMISSIONS.VIEW_ROLE },
      { tab: 'employee-role', label: 'Employee Roles', permission: PERMISSIONS.VIEW_EMPLOYEE_ROLE },
      { tab: 'permissions', label: 'Permissions', permission: PERMISSIONS.VIEW_PERMISSION },
      { tab: 'role-permission', label: 'Permission Matrix', permission: PERMISSIONS.VIEW_PERMISSION },
    ],
  },
  {
    group: 'Learning Content',
    items: [
      { tab: 'category', label: 'Categories', permission: PERMISSIONS.VIEW_CATEGORY },
      { tab: 'course', label: 'Courses', permission: PERMISSIONS.VIEW_COURSE },
      { tab: 'course-builder', label: 'Course Builder', permission: PERMISSIONS.VIEW_COURSE },
      { tab: 'resource', label: 'Resources', permission: PERMISSIONS.VIEW_RESOURCE },
      { tab: 'course-visibility', label: 'Course Visibility' },
      { tab: 'video-library-content', label: 'Video Library' },
      { tab: 'real-estate-projects', label: 'Projects' },
    ],
  },
  {
    group: 'Assessments & Certification',
    items: [
      { tab: 'assessment', label: 'Assessment', permission: PERMISSIONS.VIEW_ASSESSMENT },
      { tab: 'question', label: 'Question Bank', permission: PERMISSIONS.VIEW_QUESTION_BANK },
      { tab: 'assignment', label: 'Assignments', permission: PERMISSIONS.VIEW_ASSIGNMENT },
      { tab: 'evaluation', label: 'Evaluation Rules', permission: PERMISSIONS.VIEW_EVALUATION_RULE },
      { tab: 'results', label: 'Results', permission: PERMISSIONS.VIEW_ASSESSMENT_RESULT },
      { tab: 'certificate', label: 'Certificates', permission: PERMISSIONS.VIEW_CERTIFICATE },
      { tab: 'certificate-template', label: 'Certificate Templates', permission: PERMISSIONS.VIEW_CERT_TEMPLATE },
      { tab: 'certificate-generation', label: 'Certificate Queue', permission: PERMISSIONS.VIEW_CERT_QUEUE },
      { tab: 'certificate-verification', label: 'Certificate Verification', permission: PERMISSIONS.VIEW_CERT_VERIFICATION },
      { tab: 'bulk-certificate-issue', label: 'Bulk Certificate Issue' },
    ],
  },
  {
    group: 'Learning Paths & Training',
    items: [
      { tab: 'learning-path', label: 'Learning Paths', permission: PERMISSIONS.VIEW_LEARNING_PATH },
      { tab: 'learning-path-course', label: 'Learning Path Courses', permission: PERMISSIONS.VIEW_LP_COURSE },
      { tab: 'learning-path-enrollment', label: 'Learning Path Enrollments', permission: PERMISSIONS.VIEW_LP_ENROLLMENT },
      { tab: 'learning-path-progress', label: 'Learning Path Progress', permission: PERMISSIONS.VIEW_LP_PROGRESS },
      { tab: 'enrollment', label: 'Enrollments', permission: PERMISSIONS.VIEW_ENROLLMENT },
      { tab: 'training-batch', label: 'Training Batches', permission: PERMISSIONS.VIEW_TRAINING_BATCH },
      { tab: 'trainer-assignment', label: 'Trainer Assignments', permission: PERMISSIONS.VIEW_TRAINER_ASSIGNMENT },
      { tab: 'attendance', label: 'Attendance' },
      { tab: 'geofence', label: 'Attendance Geofencing' },
    ],
  },
  {
    group: 'Platform & Billing',
    items: [
      { tab: 'plans', label: 'Plans' },
      { tab: 'company-license', label: 'Company Licenses' },
      { tab: 'discount-codes', label: 'Discount Codes' },
      { tab: 'license-notifications', label: 'License Notifications' },
      { tab: 'payment-settings', label: 'Payment Settings' },
    ],
  },
  {
    group: 'System',
    items: [
      { tab: 'theme', label: 'Theme', permission: PERMISSIONS.VIEW_THEME },
      { tab: 'settings', label: 'Settings', permission: PERMISSIONS.VIEW_SETTINGS },
      { tab: 'menu', label: 'Menu', permission: PERMISSIONS.VIEW_MENU },
      { tab: 'reports', label: 'Reports', permission: PERMISSIONS.VIEW_REPORTS },
      { tab: 'notifications', label: 'Notifications' },
      { tab: 'security-migration', label: 'Secure Login Migration' },
      { tab: 'audit-log', label: 'Audit Log', permission: PERMISSIONS.VIEW_AUDIT_LOG },
    ],
  },
  {
    group: 'Support',
    items: [
      { tab: 'support-tickets', label: 'Ticket Management', permission: PERMISSIONS.VIEW_SUPPORT_TICKET },
      { tab: 'email-templates', label: 'Email Templates', permission: PERMISSIONS.VIEW_EMAIL_TEMPLATE },
    ],
  },
];

function Sidebar() {
  const location = useLocation();
  const user = getCurrentUser();

  const { can } = useAuthorization();
  const [isTrainer, setIsTrainer] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [marketAnalyticsEnabled, setMarketAnalyticsEnabled] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyName, setCompanyName] = useState(BRAND.companyName);
  const [logoUrl, setLogoUrl] = useState('');
  const [adminSectionsOpen, setAdminSectionsOpen] = useState(false);
  const [openAdminGroups, setOpenAdminGroups] = useState<Set<string>>(new Set());
  // From the active Theme (Admin → Theme) — falls back to the static
  // defaults, which match the current design exactly, so nothing changes
  // visually until an admin actually activates a different theme.
  const [sidebarColor, setSidebarColor] = useState(BRAND.primaryColor);
  const [accentColor, setAccentColor] = useState(BRAND.secondaryColor);

  function toggleAdminGroup(group: string) {
    setOpenAdminGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

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
    loadCompany().then((c) => setMarketAnalyticsEnabled(c?.market_analytics_enabled ?? false)).catch(() => setMarketAnalyticsEnabled(false));
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

  const visibleItems = MENU.filter((item) => {
    if (!item.visible) return false;
    if (item.group === "Teaching" && !isTrainer) return false;
    if (item.group === "My Learning" && (isTrainer || isSuperAdmin)) return false;
    if (item.id === "market-analytics" && !marketAnalyticsEnabled) return false;

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
        style={{ backgroundColor: sidebarColor }}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-56 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >

        <div className="p-6 border-b border-slate-800 flex items-center gap-3">

          <img
            src={logoUrl || logo}
            alt="logo"
            className="w-12 h-12 rounded-xl object-contain bg-white"
          />

          <div>
            <h2 className="text-white font-semibold">
              {companyName}
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

          {can(PERMISSIONS.VIEW_COMPANY) && (
            <div className="mb-5">
              <button
                onClick={() => setAdminSectionsOpen((v) => !v)}
                className="mb-2 flex w-full items-center justify-between px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300"
              >
                <span>Admin Sections</span>
                <svg
                  className={`h-3 w-3 transition-transform ${adminSectionsOpen ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {adminSectionsOpen && ADMIN_SECTIONS.map(({ group, items }) => {
                const visible = items.filter((item) => !item.permission || can(item.permission));
                if (visible.length === 0) return null;
                const isGroupOpen = openAdminGroups.has(group);
                return (
                  <div key={group} className="mb-1">
                    <button
                      onClick={() => toggleAdminGroup(group)}
                      className="mb-1 flex w-full items-center justify-between rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    >
                      <span>{group}</span>
                      <svg
                        className={`h-3 w-3 transition-transform ${isGroupOpen ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                    {isGroupOpen && visible.map((item) => {
                      const isActive = location.pathname === '/admin' && (location.state as { tab?: string } | null)?.tab === item.tab;
                      return (
                        <Link
                          key={item.tab}
                          to="/admin"
                          state={{ tab: item.tab }}
                          style={isActive ? { backgroundColor: accentColor, color: "#000" } : undefined}
                          className={`block w-full mb-1 rounded-lg px-6 py-2 text-sm transition ${
                            isActive
                              ? 'font-semibold'
                              : 'text-slate-400 hover:bg-yellow-500 hover:text-black'
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

        </nav>

      </aside>
    </>
  );
}

export default Sidebar;