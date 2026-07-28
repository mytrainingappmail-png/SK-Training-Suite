import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

// import Sidebar from "../components/dashboard/Sidebar";
// import Header from "../components/dashboard/Header";

import CompanyManagement from "../components/superadmin/CompanyManagement";
import BranchManagement from "../components/superadmin/BranchManagement";
import DepartmentManagement from "../components/superadmin/DepartmentManagement";
import DesignationManagement from "../components/superadmin/DesignationManagement";
import EmployeeManagement from "../components/superadmin/EmployeeManagement";
import CategoryManagement from "../components/superadmin/CategoryManagement";
import CourseManagement from "../components/superadmin/CourseManagement";
import CourseBuilder from "../components/admin/coursebuilder/CourseBuilder";
import RoleManagement from "../components/superadmin/RoleManagement";
import ThemeManagement from "../components/superadmin/ThemeManagement";
import MenuManagement from "../components/superadmin/MenuManagement";
import SettingsManagement from "../components/settings/SettingsManagement";
import PermissionManagement from "../modules/permissions/PermissionManagement";
import PermissionMatrix from "../modules/permissions/PermissionMatrix";
import ResourceManagement from "../components/superadmin/ResourceManagement";
import AssessmentManagement from "../components/admin/assessment/AssessmentManagement";
import QuestionManagement from "../components/superadmin/QuestionManagement";
import AssessmentAssignmentManagement from "../components/superadmin/AssessmentAssignmentManagement";
import EvaluationRuleManagement from "../components/superadmin/EvaluationRuleManagement";
import AssessmentResultManagement from "../components/superadmin/AssessmentResultManagement";
import CertificateManagement from "../components/superadmin/CertificateManagement";
import CertificateTemplateManagement from "../components/superadmin/CertificateTemplateManagement";
import CertificateGenerationManagement from "../components/superadmin/CertificateGenerationManagement";
import CertificateVerificationManagement from "../components/superadmin/CertificateVerificationManagement";
import LearningPathManagement from "../components/superadmin/LearningPathManagement";
import LearningPathCourseManagement from "../components/superadmin/LearningPathCourseManagement";
import LearningPathEnrollmentManagement from "../components/superadmin/LearningPathEnrollmentManagement";
import LearningPathProgressManagement from "../components/superadmin/LearningPathProgressManagement";
import EnrollmentManagement from "../components/superadmin/EnrollmentManagement";
import TrainingBatchManagement from "../components/superadmin/TrainingBatchManagement";
import EmployeeRoleManagement from "../components/superadmin/EmployeeRoleManagement";
import ReportManagement from "../components/superadmin/ReportManagement";
import TrainerAssignmentManagement from "../components/superadmin/TrainerAssignmentManagement";

import PlanManagement from "../modules/license/PlanManagement";
import CompanyOnboardingWizard from "../components/superadmin/CompanyOnboardingWizard";
import CompanyLicenseManagement from "../modules/license/CompanyLicenseManagement";
import DiscountCodeManagement from "../modules/license/DiscountCodeManagement";
import NotificationLog from "../modules/license/NotificationLog";
import PaymentSettingsManagement from "../modules/payment/PaymentSettingsManagement";
import CompanyModulesManagement from "../components/superadmin/CompanyModulesManagement";
import CourseVisibilityMatrix from "../modules/courseVisibility/CourseVisibilityMatrix";
import RealEstateProjectManagement from "../modules/realEstateProject/RealEstateProjectManagement";
import BrainstormingManagement from "../components/admin/brainstorming/BrainstormingManagement";
import EmployeeOfTheMonthManagement from "../components/admin/employeeOfTheMonth/EmployeeOfTheMonthManagement";
import LegalDocumentManagement from "../components/admin/legal/LegalDocumentManagement";
import VideoLibraryManagement from "../modules/videoLibraryContent/VideoLibraryManagement";
import BulkCertificateIssue from "../modules/certificate/BulkCertificateIssue";
import AttendanceManagement from "../modules/attendance/AttendanceManagement";
import SecurityMigration from "../modules/security/SecurityMigration";
import GeofenceManagement from "../modules/geofence/GeofenceManagement";
import NotificationCenter from "../components/admin/notifications/NotificationCenter";
import TicketManagement from "../components/admin/support/TicketManagement";
import EmailTemplateBuilder from "../components/admin/email/EmailTemplateBuilder";
import MarketDataManagement from "../components/admin/marketData/MarketDataManagement";
import QuizAdminSetupPanel from "../components/quiz/QuizAdminSetupPanel";
import AuditLogCenter from "../components/admin/audit/AuditLogCenter";

import { useAuthorization } from "../hooks/useAuthorization";
import { loadCompany } from "../services/company/companyService";
import { loadCompanyModuleFlags } from "../services/company/appModuleService";

// Mirrors the moduleKey annotations on ADMIN_SECTIONS in Sidebar.tsx (single
// concept, two static maps — the sidebar's quick-links and this page's tab
// content are separate render trees, but both must genuinely hide a
// company-disabled module, not just its shortcut link).
const TAB_MODULE_MAP: Record<string, string> = {
  category: "courses", course: "courses", "course-builder": "courses", resource: "courses",
  "course-visibility": "courses", "video-library-content": "courses",
  "real-estate-projects": "projects",
  brainstorming: "brainstorming",
  assessment: "assessments", question: "assessments", assignment: "assessments",
  evaluation: "assessments", results: "assessments",
  certificate: "certificates", "certificate-template": "certificates",
  "certificate-generation": "certificates", "certificate-verification": "certificates",
  "bulk-certificate-issue": "certificates",
  "learning-path": "learning_paths", "learning-path-course": "learning_paths",
  "learning-path-enrollment": "learning_paths", "learning-path-progress": "learning_paths",
  attendance: "attendance", geofence: "attendance",
  "support-tickets": "support_tickets", "email-templates": "support_tickets",
  "employee-of-the-month": "employee_of_the_month",
};

function Admin() {
  const location = useLocation();
  const requestedTab = (location.state as { tab?: string; courseId?: string } | null)?.tab;
  const requestedCourseId = (location.state as { tab?: string; courseId?: string } | null)?.courseId;
  const [activeTab, setActiveTab] = useState(requestedTab || "company");
  const { can, PERMISSIONS } = useAuthorization();
  const [search, setSearch] = useState("");
  const [moduleFlags, setModuleFlags] = useState<Record<string, boolean>>({});
  // Settings/Menu/Theme/Permissions/Plans/Discount Codes/Payment Settings are
  // genuinely platform-wide config (no company_id at all — see
  // 20260722130000_platform_operator_scoping.sql), writable only by the one
  // platform-operator company. Every other company's admin could already see
  // these tabs and "successfully" click Save, only to hit a raw Postgres RLS
  // error with nothing explaining why — hiding them here matches what the
  // tenant can actually do, the same way the Paid Add-ons section in Company
  // Management is already hidden for non-operator companies.
  const [isPlatformOperator, setIsPlatformOperator] = useState(false);

  // Per-company Super Admin Console colors — every subscribing company
  // picks its own via Company Management, defaulting to a blue/gold look
  // until they do.
  const [consoleColors, setConsoleColors] = useState({
    bg: "#1e3a8a",
    button: "#eab308",
    border: "#facc15",
  });

  // A tab whose module has been switched off for this company still renders
  // its button (cosmetic-only elsewhere), but never its real content below —
  // that's the part that actually exposes data/functionality.
  const moduleAllowed = (tab: string) => {
    const key = TAB_MODULE_MAP[tab];
    return !key || moduleFlags[key] !== false;
  };

  useEffect(() => {
    loadCompany().then((c) => {
      setIsPlatformOperator(c?.is_platform_operator ?? false);
      if (c?.id) {
        loadCompanyModuleFlags(c.id).then(setModuleFlags).catch(() => setModuleFlags({}));
      }
      if (c) {
        setConsoleColors({
          bg: c.admin_console_bg_color || "#1e3a8a",
          button: c.admin_console_button_color || "#eab308",
          border: c.admin_console_border_color || "#facc15",
        });
      }
    }).catch(() => {
      setIsPlatformOperator(false);
      setModuleFlags({});
    });
  }, []);

  // Picks readable black/white text against whatever color the company chose.
  const contrastText = (hex: string) => {
    const c = hex.replace("#", "");
    if (c.length !== 6) return "#000000";
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#000000" : "#ffffff";
  };

  const getTabStyle = (tab: string): React.CSSProperties =>
    activeTab === tab
      ? { backgroundColor: consoleColors.button, color: contrastText(consoleColors.button), boxShadow: "0 0 0 2px #ffffff inset" }
      : { backgroundColor: consoleColors.button, color: contrastText(consoleColors.button) };
  const getTabClass = () => "px-4 py-2 rounded-xl font-semibold transition text-sm shadow hover:brightness-110";
  const GROUP_CARD_CLS = "rounded-2xl p-4";
  const GROUP_CARD_STYLE: React.CSSProperties = { backgroundColor: consoleColors.bg, border: `2px solid ${consoleColors.border}` };
  const GROUP_LABEL_CLS = "mb-3 text-xs font-bold uppercase tracking-wider";
  const GROUP_LABEL_STYLE: React.CSSProperties = { color: consoleColors.border };

  const kw = search.trim().toLowerCase();
  const matches = (label: string) => !kw || label.toLowerCase().includes(kw);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <></>

      <div className="flex flex-1 flex-col">
        <></>

        <main className="p-8">
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: consoleColors.bg, border: `2px solid ${consoleColors.border}` }}
          >
            <h1 className="text-3xl font-bold" style={{ color: contrastText(consoleColors.bg) }}>
              Super Admin Console
            </h1>

            <p className="mt-2" style={{ color: consoleColors.border }}>
              Configure and manage the complete Learning Management Platform.
            </p>

            <div className="mt-6">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search modules…"
                className="w-full max-w-md rounded-xl bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none"
                style={{ border: `2px solid ${consoleColors.border}` }}
              />
            </div>
          </div>

          <div className="mt-8 space-y-5">
            {(can(PERMISSIONS.VIEW_COMPANY) && matches("Company")) ||
             (can(PERMISSIONS.VIEW_BRANCH) && matches("Branches")) ||
             (can(PERMISSIONS.VIEW_DEPARTMENT) && matches("Departments")) ||
             (can(PERMISSIONS.VIEW_DESIGNATION) && matches("Designations")) ||
             (can(PERMISSIONS.VIEW_EMPLOYEE) && (matches("Employees") || matches("Employee of the Month"))) ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Organization Setup</p>
                <div className="flex flex-wrap gap-3">
                  {can(PERMISSIONS.VIEW_COMPANY) && matches("Company") && (
                    <button onClick={() => setActiveTab("company")} className={getTabClass()} style={getTabStyle("company")}>Company</button>
                  )}
                  {can(PERMISSIONS.VIEW_BRANCH) && matches("Branches") && (
                    <button onClick={() => setActiveTab("branch")} className={getTabClass()} style={getTabStyle("branch")}>Branches</button>
                  )}
                  {can(PERMISSIONS.VIEW_DEPARTMENT) && matches("Departments") && (
                    <button onClick={() => setActiveTab("department")} className={getTabClass()} style={getTabStyle("department")}>Departments</button>
                  )}
                  {can(PERMISSIONS.VIEW_DESIGNATION) && matches("Designations") && (
                    <button onClick={() => setActiveTab("designation")} className={getTabClass()} style={getTabStyle("designation")}>Designations</button>
                  )}
                  {can(PERMISSIONS.VIEW_EMPLOYEE) && matches("Employees") && (
                    <button onClick={() => setActiveTab("employee")} className={getTabClass()} style={getTabStyle("employee")}>Employees</button>
                  )}
                  {can(PERMISSIONS.VIEW_EMPLOYEE) && matches("Employee of the Month") && (
                    <button onClick={() => setActiveTab("employee-of-the-month")} className={getTabClass()} style={getTabStyle("employee-of-the-month")}>Employee of the Month</button>
                  )}
                </div>
              </div>
            ) : null}

            {(can(PERMISSIONS.VIEW_CATEGORY) && matches("Categories")) ||
             (can(PERMISSIONS.VIEW_COURSE) && (matches("Courses") || matches("Course Builder"))) ||
             (can(PERMISSIONS.VIEW_RESOURCE) && matches("Resources")) ||
             matches("Course Visibility") || matches("Video Library") ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Course Content</p>
                <div className="flex flex-wrap gap-3">
                  {can(PERMISSIONS.VIEW_CATEGORY) && matches("Categories") && (
                    <button onClick={() => setActiveTab("category")} className={getTabClass()} style={getTabStyle("category")}>Categories</button>
                  )}
                  {can(PERMISSIONS.VIEW_COURSE) && matches("Courses") && (
                    <button onClick={() => setActiveTab("course")} className={getTabClass()} style={getTabStyle("course")}>Courses</button>
                  )}
                  {can(PERMISSIONS.VIEW_COURSE) && matches("Course Builder") && (
                    <button onClick={() => setActiveTab("course-builder")} className={getTabClass()} style={getTabStyle("course-builder")}>Course Builder</button>
                  )}
                  {can(PERMISSIONS.VIEW_RESOURCE) && matches("Resources") && (
                    <button onClick={() => setActiveTab("resource")} className={getTabClass()} style={getTabStyle("resource")}>Resources</button>
                  )}
                  {matches("Course Visibility") && (
                    <button onClick={() => setActiveTab("course-visibility")} className={getTabClass()} style={getTabStyle("course-visibility")}>Course Visibility</button>
                  )}
                  {matches("Video Library") && (
                    <button onClick={() => setActiveTab("video-library-content")} className={getTabClass()} style={getTabStyle("video-library-content")}>Video Library</button>
                  )}
                </div>
              </div>
            ) : null}

            {(can(PERMISSIONS.VIEW_ASSESSMENT) && matches("Assessment")) ||
             (can(PERMISSIONS.VIEW_QUESTION_BANK) && matches("Question Bank")) ||
             (can(PERMISSIONS.VIEW_ASSIGNMENT) && matches("Assignments")) ||
             (can(PERMISSIONS.VIEW_EVALUATION_RULE) && matches("Evaluation Rules")) ||
             (can(PERMISSIONS.VIEW_ASSESSMENT_RESULT) && matches("Results")) ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Assessment & Evaluation</p>
                <div className="flex flex-wrap gap-3">
                  {can(PERMISSIONS.VIEW_ASSESSMENT) && matches("Assessment") && (
                    <button onClick={() => setActiveTab("assessment")} className={getTabClass()} style={getTabStyle("assessment")}>Assessment</button>
                  )}
                  {can(PERMISSIONS.VIEW_QUESTION_BANK) && matches("Question Bank") && (
                    <button onClick={() => setActiveTab("question")} className={getTabClass()} style={getTabStyle("question")}>Question Bank</button>
                  )}
                  {can(PERMISSIONS.VIEW_ASSIGNMENT) && matches("Assignments") && (
                    <button onClick={() => setActiveTab("assignment")} className={getTabClass()} style={getTabStyle("assignment")}>Assignments</button>
                  )}
                  {can(PERMISSIONS.VIEW_EVALUATION_RULE) && matches("Evaluation Rules") && (
                    <button onClick={() => setActiveTab("evaluation")} className={getTabClass()} style={getTabStyle("evaluation")}>Evaluation Rules</button>
                  )}
                  {can(PERMISSIONS.VIEW_ASSESSMENT_RESULT) && matches("Results") && (
                    <button onClick={() => setActiveTab("results")} className={getTabClass()} style={getTabStyle("results")}>Results</button>
                  )}
                </div>
              </div>
            ) : null}

            {(can(PERMISSIONS.VIEW_CERTIFICATE) && matches("Certificates")) ||
             (can(PERMISSIONS.VIEW_CERT_TEMPLATE) && matches("Certificate Templates")) ||
             (can(PERMISSIONS.VIEW_CERT_QUEUE) && matches("Certificate Queue")) ||
             (can(PERMISSIONS.VIEW_CERT_VERIFICATION) && matches("Certificate Verification")) ||
             matches("Bulk Certificate Issue") ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Certificates</p>
                <div className="flex flex-wrap gap-3">
                  {can(PERMISSIONS.VIEW_CERTIFICATE) && matches("Certificates") && (
                    <button onClick={() => setActiveTab("certificate")} className={getTabClass()} style={getTabStyle("certificate")}>Certificates</button>
                  )}
                  {can(PERMISSIONS.VIEW_CERT_TEMPLATE) && matches("Certificate Templates") && (
                    <button onClick={() => setActiveTab("certificate-template")} className={getTabClass()} style={getTabStyle("certificate-template")}>Certificate Templates</button>
                  )}
                  {can(PERMISSIONS.VIEW_CERT_QUEUE) && matches("Certificate Queue") && (
                    <button onClick={() => setActiveTab("certificate-generation")} className={getTabClass()} style={getTabStyle("certificate-generation")}>Certificate Queue</button>
                  )}
                  {can(PERMISSIONS.VIEW_CERT_VERIFICATION) && matches("Certificate Verification") && (
                    <button onClick={() => setActiveTab("certificate-verification")} className={getTabClass()} style={getTabStyle("certificate-verification")}>Certificate Verification</button>
                  )}
                  {matches("Bulk Certificate Issue") && (
                    <button onClick={() => setActiveTab("bulk-certificate-issue")} className={getTabClass()} style={getTabStyle("bulk-certificate-issue")}>Bulk Certificate Issue</button>
                  )}
                </div>
              </div>
            ) : null}

            {(can(PERMISSIONS.VIEW_LEARNING_PATH) && matches("Learning Paths")) ||
             (can(PERMISSIONS.VIEW_LP_COURSE) && matches("Learning Path Courses")) ||
             (can(PERMISSIONS.VIEW_LP_ENROLLMENT) && matches("Learning Path Enrollments")) ||
             (can(PERMISSIONS.VIEW_LP_PROGRESS) && matches("Learning Path Progress")) ||
             (can(PERMISSIONS.VIEW_ENROLLMENT) && matches("Enrollments")) ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Learning Paths & Enrollment</p>
                <div className="flex flex-wrap gap-3">
                  {can(PERMISSIONS.VIEW_LEARNING_PATH) && matches("Learning Paths") && (
                    <button onClick={() => setActiveTab("learning-path")} className={getTabClass()} style={getTabStyle("learning-path")}>Learning Paths</button>
                  )}
                  {can(PERMISSIONS.VIEW_LP_COURSE) && matches("Learning Path Courses") && (
                    <button onClick={() => setActiveTab("learning-path-course")} className={getTabClass()} style={getTabStyle("learning-path-course")}>Learning Path Courses</button>
                  )}
                  {can(PERMISSIONS.VIEW_LP_ENROLLMENT) && matches("Learning Path Enrollments") && (
                    <button onClick={() => setActiveTab("learning-path-enrollment")} className={getTabClass()} style={getTabStyle("learning-path-enrollment")}>Learning Path Enrollments</button>
                  )}
                  {can(PERMISSIONS.VIEW_LP_PROGRESS) && matches("Learning Path Progress") && (
                    <button onClick={() => setActiveTab("learning-path-progress")} className={getTabClass()} style={getTabStyle("learning-path-progress")}>Learning Path Progress</button>
                  )}
                  {can(PERMISSIONS.VIEW_ENROLLMENT) && matches("Enrollments") && (
                    <button onClick={() => setActiveTab("enrollment")} className={getTabClass()} style={getTabStyle("enrollment")}>Enrollments</button>
                  )}
                </div>
              </div>
            ) : null}

            {(can(PERMISSIONS.VIEW_TRAINING_BATCH) && matches("Training Batches")) ||
             (can(PERMISSIONS.VIEW_TRAINER_ASSIGNMENT) && matches("Trainer Assignments")) ||
             matches("Attendance") || matches("Attendance Geofencing") ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Training & Attendance</p>
                <div className="flex flex-wrap gap-3">
                  {can(PERMISSIONS.VIEW_TRAINING_BATCH) && matches("Training Batches") && (
                    <button onClick={() => setActiveTab("training-batch")} className={getTabClass()} style={getTabStyle("training-batch")}>Training Batches</button>
                  )}
                  {can(PERMISSIONS.VIEW_TRAINER_ASSIGNMENT) && matches("Trainer Assignments") && (
                    <button onClick={() => setActiveTab("trainer-assignment")} className={getTabClass()} style={getTabStyle("trainer-assignment")}>Trainer Assignments</button>
                  )}
                  {matches("Attendance") && (
                    <button onClick={() => setActiveTab("attendance")} className={getTabClass()} style={getTabStyle("attendance")}>Attendance</button>
                  )}
                  {matches("Attendance Geofencing") && (
                    <button onClick={() => setActiveTab("geofence")} className={getTabClass()} style={getTabStyle("geofence")}>Attendance Geofencing</button>
                  )}
                </div>
              </div>
            ) : null}

            {(can(PERMISSIONS.VIEW_ROLE) && matches("Roles")) ||
             (can(PERMISSIONS.VIEW_EMPLOYEE_ROLE) && matches("Employee Roles")) ||
             (isPlatformOperator && can(PERMISSIONS.VIEW_PERMISSION) && matches("Permissions")) ||
             (can(PERMISSIONS.VIEW_PERMISSION) && matches("Permission Matrix")) ||
             matches("Secure Login Migration") ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Roles & Permissions</p>
                <div className="flex flex-wrap gap-3">
                  {can(PERMISSIONS.VIEW_ROLE) && matches("Roles") && (
                    <button onClick={() => setActiveTab("roles")} className={getTabClass()} style={getTabStyle("roles")}>Roles</button>
                  )}
                  {can(PERMISSIONS.VIEW_EMPLOYEE_ROLE) && matches("Employee Roles") && (
                    <button onClick={() => setActiveTab("employee-role")} className={getTabClass()} style={getTabStyle("employee-role")}>Employee Roles</button>
                  )}
                  {isPlatformOperator && can(PERMISSIONS.VIEW_PERMISSION) && matches("Permissions") && (
                    <button onClick={() => setActiveTab("permissions")} className={getTabClass()} style={getTabStyle("permissions")}>Permissions</button>
                  )}
                  {can(PERMISSIONS.VIEW_PERMISSION) && matches("Permission Matrix") && (
                    <button onClick={() => setActiveTab("role-permission")} className={getTabClass()} style={getTabStyle("role-permission")}>Permission Matrix</button>
                  )}
                  {matches("Secure Login Migration") && (
                    <button onClick={() => setActiveTab("security-migration")} className={getTabClass()} style={getTabStyle("security-migration")}>Secure Login Migration</button>
                  )}
                </div>
              </div>
            ) : null}

            {(isPlatformOperator && can(PERMISSIONS.VIEW_THEME) && matches("Theme")) ||
             (isPlatformOperator && can(PERMISSIONS.VIEW_SETTINGS) && matches("Settings")) ||
             (isPlatformOperator && matches("Legal Documents")) ||
             (isPlatformOperator && can(PERMISSIONS.VIEW_MENU) && matches("Menu")) ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Platform Configuration</p>
                <div className="flex flex-wrap gap-3">
                  {isPlatformOperator && can(PERMISSIONS.VIEW_THEME) && matches("Theme") && (
                    <button onClick={() => setActiveTab("theme")} className={getTabClass()} style={getTabStyle("theme")}>Theme</button>
                  )}
                  {isPlatformOperator && can(PERMISSIONS.VIEW_SETTINGS) && matches("Settings") && (
                    <button onClick={() => setActiveTab("settings")} className={getTabClass()} style={getTabStyle("settings")}>Settings</button>
                  )}
                  {isPlatformOperator && matches("Legal Documents") && (
                    <button onClick={() => setActiveTab("legal-documents")} className={getTabClass()} style={getTabStyle("legal-documents")}>Legal Documents</button>
                  )}
                  {isPlatformOperator && can(PERMISSIONS.VIEW_MENU) && matches("Menu") && (
                    <button onClick={() => setActiveTab("menu")} className={getTabClass()} style={getTabStyle("menu")}>Menu</button>
                  )}
                </div>
              </div>
            ) : null}

            {(can(PERMISSIONS.VIEW_REPORTS) && matches("Reports")) ||
             matches("Notifications") ||
             (can(PERMISSIONS.VIEW_SUPPORT_TICKET) && matches("Ticket Management")) ||
             (can(PERMISSIONS.VIEW_EMAIL_TEMPLATE) && matches("Email Templates")) ||
             (can(PERMISSIONS.VIEW_AUDIT_LOG) && matches("Audit Log")) ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Communication & Reports</p>
                <div className="flex flex-wrap gap-3">
                  {can(PERMISSIONS.VIEW_REPORTS) && matches("Reports") && (
                    <button onClick={() => setActiveTab("reports")} className={getTabClass()} style={getTabStyle("reports")}>Reports</button>
                  )}
                  {matches("Notifications") && (
                    <button onClick={() => setActiveTab("notifications")} className={getTabClass()} style={getTabStyle("notifications")}>Notifications</button>
                  )}
                  {can(PERMISSIONS.VIEW_SUPPORT_TICKET) && matches("Ticket Management") && (
                    <button onClick={() => setActiveTab("support-tickets")} className={getTabClass()} style={getTabStyle("support-tickets")}>Ticket Management</button>
                  )}
                  {can(PERMISSIONS.VIEW_EMAIL_TEMPLATE) && matches("Email Templates") && (
                    <button onClick={() => setActiveTab("email-templates")} className={getTabClass()} style={getTabStyle("email-templates")}>Email Templates</button>
                  )}
                  {can(PERMISSIONS.VIEW_AUDIT_LOG) && matches("Audit Log") && (
                    <button onClick={() => setActiveTab("audit-log")} className={getTabClass()} style={getTabStyle("audit-log")}>Audit Log</button>
                  )}
                </div>
              </div>
            ) : null}

            {(moduleFlags.market_analytics && matches("Market Analytics")) ||
             (moduleFlags.live_quiz && matches("Live Quiz")) ||
             (isPlatformOperator && matches("Brainstorming")) ||
             matches("Projects") ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Premium Add-ons</p>
                <div className="flex flex-wrap gap-3">
                  {moduleFlags.market_analytics && matches("Market Analytics") && (
                    <button onClick={() => setActiveTab("market-analytics")} className={getTabClass()} style={getTabStyle("market-analytics")}>Market Analytics</button>
                  )}
                  {moduleFlags.live_quiz && matches("Live Quiz") && (
                    <button onClick={() => setActiveTab("live-quiz")} className={getTabClass()} style={getTabStyle("live-quiz")}>Live Quiz</button>
                  )}
                  {isPlatformOperator && matches("Brainstorming") && (
                    <button onClick={() => setActiveTab("brainstorming")} className={getTabClass()} style={getTabStyle("brainstorming")}>Brainstorming</button>
                  )}
                  {matches("Projects") && (
                    <button onClick={() => setActiveTab("real-estate-projects")} className={getTabClass()} style={getTabStyle("real-estate-projects")}>Projects</button>
                  )}
                </div>
              </div>
            ) : null}

            {(isPlatformOperator && matches("Plans")) ||
             (isPlatformOperator && matches("Add Company")) ||
             matches("Company Licenses") ||
             (isPlatformOperator && matches("Discount Codes")) ||
             matches("License Notifications") ||
             (isPlatformOperator && matches("Payment Settings")) ||
             (isPlatformOperator && matches("Company Modules")) ? (
              <div className={GROUP_CARD_CLS} style={GROUP_CARD_STYLE}>
                <p className={GROUP_LABEL_CLS} style={GROUP_LABEL_STYLE}>Billing & Licensing</p>
                <div className="flex flex-wrap gap-3">
                  {isPlatformOperator && matches("Plans") && (
                    <button onClick={() => setActiveTab("plans")} className={getTabClass()} style={getTabStyle("plans")}>Plans</button>
                  )}
                  {isPlatformOperator && matches("Add Company") && (
                    <button onClick={() => setActiveTab("add-company")} className={getTabClass()} style={getTabStyle("add-company")}>Add Company</button>
                  )}
                  {matches("Company Licenses") && (
                    <button onClick={() => setActiveTab("company-license")} className={getTabClass()} style={getTabStyle("company-license")}>Company Licenses</button>
                  )}
                  {isPlatformOperator && matches("Discount Codes") && (
                    <button onClick={() => setActiveTab("discount-codes")} className={getTabClass()} style={getTabStyle("discount-codes")}>Discount Codes</button>
                  )}
                  {matches("License Notifications") && (
                    <button onClick={() => setActiveTab("license-notifications")} className={getTabClass()} style={getTabStyle("license-notifications")}>License Notifications</button>
                  )}
                  {isPlatformOperator && matches("Payment Settings") && (
                    <button onClick={() => setActiveTab("payment-settings")} className={getTabClass()} style={getTabStyle("payment-settings")}>Payment Settings</button>
                  )}
                  {isPlatformOperator && matches("Company Modules") && (
                    <button onClick={() => setActiveTab("company-modules")} className={getTabClass()} style={getTabStyle("company-modules")}>Company Modules</button>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-8">
            {activeTab === "company" && can(PERMISSIONS.VIEW_COMPANY) && <CompanyManagement />}

            {activeTab === "branch" && can(PERMISSIONS.VIEW_BRANCH) && <BranchManagement />}

            {activeTab === "department" && can(PERMISSIONS.VIEW_DEPARTMENT) && <DepartmentManagement />}

            {activeTab === "designation" && can(PERMISSIONS.VIEW_DESIGNATION) && <DesignationManagement />}

            {activeTab === "roles" && can(PERMISSIONS.VIEW_ROLE) && <RoleManagement />}

            {activeTab === "employee" && can(PERMISSIONS.VIEW_EMPLOYEE) && <EmployeeManagement />}

            {activeTab === "employee-of-the-month" && can(PERMISSIONS.VIEW_EMPLOYEE) && moduleAllowed("employee-of-the-month") && <EmployeeOfTheMonthManagement />}

            {activeTab === "category" && can(PERMISSIONS.VIEW_CATEGORY) && moduleAllowed("category") && <CategoryManagement />}

            {activeTab === "course" && can(PERMISSIONS.VIEW_COURSE) && moduleAllowed("course") && <CourseManagement />}

            {activeTab === "course-builder" && can(PERMISSIONS.VIEW_COURSE) && moduleAllowed("course-builder") && <CourseBuilder initialCourseId={requestedCourseId} />}
            {activeTab === "resource" && can(PERMISSIONS.VIEW_RESOURCE) && moduleAllowed("resource") && <ResourceManagement />}
            {activeTab === "assessment" && can(PERMISSIONS.VIEW_ASSESSMENT) && moduleAllowed("assessment") && <AssessmentManagement />}
            {activeTab === "question" && can(PERMISSIONS.VIEW_QUESTION_BANK) && moduleAllowed("question") && <QuestionManagement />}
            {activeTab === "assignment" && can(PERMISSIONS.VIEW_ASSIGNMENT) && moduleAllowed("assignment") && <AssessmentAssignmentManagement />}
            {activeTab === "evaluation" && can(PERMISSIONS.VIEW_EVALUATION_RULE) && moduleAllowed("evaluation") && <EvaluationRuleManagement />}
            {activeTab === "results" && can(PERMISSIONS.VIEW_ASSESSMENT_RESULT) && moduleAllowed("results") && <AssessmentResultManagement />}
            {activeTab === "certificate" && can(PERMISSIONS.VIEW_CERTIFICATE) && moduleAllowed("certificate") && <CertificateManagement />}

            {activeTab === "certificate-template" && can(PERMISSIONS.VIEW_CERT_TEMPLATE) && moduleAllowed("certificate-template") && (
              <CertificateTemplateManagement />
            )}

            {activeTab === "certificate-generation" && can(PERMISSIONS.VIEW_CERT_QUEUE) && moduleAllowed("certificate-generation") && (
              <CertificateGenerationManagement />
            )}
            {activeTab === "certificate-verification" && can(PERMISSIONS.VIEW_CERT_VERIFICATION) && moduleAllowed("certificate-verification") && (
              <CertificateVerificationManagement />
            )}
            {activeTab === "learning-path" && can(PERMISSIONS.VIEW_LEARNING_PATH) && moduleAllowed("learning-path") && (
              <LearningPathManagement />
            )}
            {activeTab === "learning-path-course" && can(PERMISSIONS.VIEW_LP_COURSE) && moduleAllowed("learning-path-course") && (
              <LearningPathCourseManagement />
            )}
            {activeTab === "learning-path-enrollment" && can(PERMISSIONS.VIEW_LP_ENROLLMENT) && moduleAllowed("learning-path-enrollment") && (
              <LearningPathEnrollmentManagement />
            )}
            {activeTab === "learning-path-progress" && can(PERMISSIONS.VIEW_LP_PROGRESS) && moduleAllowed("learning-path-progress") && (
              <LearningPathProgressManagement />
            )}
            {activeTab === "enrollment" && can(PERMISSIONS.VIEW_ENROLLMENT) && (
              <EnrollmentManagement />
            )}
            {activeTab === "training-batch" && can(PERMISSIONS.VIEW_TRAINING_BATCH) && (
              <TrainingBatchManagement />
            )}
            {activeTab === "trainer-assignment" && can(PERMISSIONS.VIEW_TRAINER_ASSIGNMENT) && (
              <TrainerAssignmentManagement />
            )}
            {activeTab === "employee-role" && can(PERMISSIONS.VIEW_EMPLOYEE_ROLE) && <EmployeeRoleManagement />}

            {activeTab === "reports" && can(PERMISSIONS.VIEW_REPORTS) && <ReportManagement />}

            {activeTab === "notifications" && <NotificationCenter />}

            {activeTab === "support-tickets" && can(PERMISSIONS.VIEW_SUPPORT_TICKET) && moduleAllowed("support-tickets") && <TicketManagement />}

            {activeTab === "email-templates" && can(PERMISSIONS.VIEW_EMAIL_TEMPLATE) && moduleAllowed("email-templates") && <EmailTemplateBuilder />}

            {activeTab === "market-analytics" && moduleFlags.market_analytics && <MarketDataManagement />}

            {activeTab === "live-quiz" && moduleFlags.live_quiz && <QuizAdminSetupPanel />}

            {activeTab === "audit-log" && can(PERMISSIONS.VIEW_AUDIT_LOG) && <AuditLogCenter />}

            {activeTab === "permissions" && isPlatformOperator && can(PERMISSIONS.VIEW_PERMISSION) && <PermissionManagement />}
            {activeTab === "role-permission" && can(PERMISSIONS.VIEW_PERMISSION) && (
              <PermissionMatrix />
            )}

            {activeTab === "theme" && isPlatformOperator && can(PERMISSIONS.VIEW_THEME) && <ThemeManagement />}

            {activeTab === "settings" && isPlatformOperator && can(PERMISSIONS.VIEW_SETTINGS) && <SettingsManagement />}

            {activeTab === "legal-documents" && isPlatformOperator && <LegalDocumentManagement />}

            {activeTab === "menu" && isPlatformOperator && can(PERMISSIONS.VIEW_MENU) && <MenuManagement />}

            {activeTab === "plans" && isPlatformOperator && <PlanManagement />}

            {activeTab === "add-company" && isPlatformOperator && <CompanyOnboardingWizard />}

            {activeTab === "company-license" && <CompanyLicenseManagement />}

            {activeTab === "discount-codes" && isPlatformOperator && <DiscountCodeManagement />}

            {activeTab === "license-notifications" && <NotificationLog />}

            {activeTab === "payment-settings" && isPlatformOperator && <PaymentSettingsManagement />}

            {activeTab === "company-modules" && isPlatformOperator && <CompanyModulesManagement />}

            {activeTab === "course-visibility" && moduleAllowed("course-visibility") && <CourseVisibilityMatrix />}

            {activeTab === "real-estate-projects" && moduleAllowed("real-estate-projects") && <RealEstateProjectManagement />}

            {activeTab === "brainstorming" && isPlatformOperator && moduleAllowed("brainstorming") && <BrainstormingManagement />}

            {activeTab === "video-library-content" && moduleAllowed("video-library-content") && <VideoLibraryManagement />}

            {activeTab === "bulk-certificate-issue" && moduleAllowed("bulk-certificate-issue") && <BulkCertificateIssue />}

            {activeTab === "attendance" && moduleAllowed("attendance") && <AttendanceManagement />}

            {activeTab === "security-migration" && <SecurityMigration />}

            {activeTab === "geofence" && moduleAllowed("geofence") && <GeofenceManagement />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Admin;
