import { useEffect, useState, lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import { ROUTES } from "./constants/routes";
import { PERMISSIONS } from "./constants/permissions";
import { loadBranding, applyDynamicIcon, BRANDING_CHANGED_EVENT } from "./services/branding/brandingService";

import AppLayout from "./layouts/AppLayout";

// Kept eager: these are the first things any visitor sees regardless of role
// (marketing/login before auth, layout chrome + dashboard right after) — every
// other route below is lazy so a single page's code isn't downloaded by
// visitors who never open it.
import LoginPage from "./pages/LoginPage";
import MarketingHomePage from "./pages/MarketingHomePage";
import DashboardRouter from "./pages/DashboardRouter";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Cloudflare Workers assets serve only the CURRENT build's files — a
// deploy replaces ./dist outright rather than keeping old chunk files
// around. A tab left open across a deploy already has the new
// index.html's JS in memory, but navigating to a route it hasn't loaded
// yet triggers a dynamic import() for a chunk hash from the OLD build,
// which now 404s ("Failed to fetch dynamically imported module"). This
// wrapper retries once via a full reload (which picks up the new
// index.html + current chunk hashes) instead of that surfacing as a
// crash; a `sessionStorage` flag stops it from looping if the reload
// itself doesn't fix it (e.g. a real network outage).
function lazyWithRetry<T extends { default: ComponentType<any> }>(
  factory: () => Promise<T>
): LazyExoticComponent<T["default"]> {
  return lazy(async () => {
    const RELOAD_FLAG = "sk-chunk-reload-attempted";
    try {
      const module = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return module;
    } catch (error) {
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        // Never resolves — the reload navigates away before this matters.
        return new Promise<T>(() => {});
      }
      throw error;
    }
  });
}

const Employees = lazyWithRetry(() => import("./pages/Employees"));
const Training = lazyWithRetry(() => import("./pages/Training"));
const Courses = lazyWithRetry(() => import("./pages/Courses"));
const Modules = lazyWithRetry(() => import("./pages/Modules"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Assessment = lazyWithRetry(() => import("./pages/Assessment"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));

const LearningHome = lazyWithRetry(() => import("./components/learning/LearningHome"));
const MyCourses = lazyWithRetry(() => import("./components/learning/MyCourses"));
const Videos = lazyWithRetry(() => import("./pages/Videos"));
const ProjectsPage = lazyWithRetry(() => import("./pages/Projects"));
const InductionPage = lazyWithRetry(() => import("./pages/InductionPage"));
const PerformanceTrackerPage = lazyWithRetry(() => import("./pages/PerformanceTrackerPage"));
const ScriptsPage = lazyWithRetry(() => import("./pages/ScriptsPage"));
const PerformanceTrackerTvPage = lazyWithRetry(() => import("./pages/PerformanceTrackerTvPage"));
const BrainstormingPage = lazyWithRetry(() => import("./pages/Brainstorming"));
const LegalDocumentPage = lazyWithRetry(() => import("./pages/LegalDocumentPage"));
const ContactUsPage = lazyWithRetry(() => import("./pages/ContactUsPage"));
const PayLicensePage = lazyWithRetry(() => import("./pages/PayLicensePage"));
const CertificateViewPage = lazyWithRetry(() => import("./components/certificate/CertificateViewPage"));
const AttendancePage = lazyWithRetry(() => import("./pages/AttendancePage"));
const MyTicketsPage = lazyWithRetry(() => import("./pages/MyTicketsPage"));
const HelpCenterPage = lazyWithRetry(() => import("./pages/HelpCenterPage"));
const MarketAnalyticsPage = lazyWithRetry(() => import("./pages/MarketAnalyticsPage"));
const TrainerStudentsPage = lazyWithRetry(() => import("./pages/TrainerStudentsPage"));
const TrainerGradingQueuePage = lazyWithRetry(() => import("./pages/TrainerGradingQueuePage"));
const TrainerCoursesPage = lazyWithRetry(() => import("./pages/TrainerCoursesPage"));
const TrainerBatchesPage = lazyWithRetry(() => import("./pages/TrainerBatchesPage"));
const TrainerResultsPage = lazyWithRetry(() => import("./pages/TrainerResultsPage"));
// LearningPlayerRoutes.tsx only has named exports — React.lazy needs a
// default, so each is remapped via .then() rather than changing that
// file's export style (it's a small, sensible one-file convention there).
const CoursePlayerRoute = lazyWithRetry(() => import("./pages/LearningPlayerRoutes").then((m) => ({ default: m.CoursePlayerRoute })));
const LessonPlayerRoute = lazyWithRetry(() => import("./pages/LearningPlayerRoutes").then((m) => ({ default: m.LessonPlayerRoute })));
const ResourceViewerRoute = lazyWithRetry(() => import("./pages/LearningPlayerRoutes").then((m) => ({ default: m.ResourceViewerRoute })));
const LearningPathsRoute = lazyWithRetry(() => import("./pages/LearningPlayerRoutes").then((m) => ({ default: m.LearningPathsRoute })));
const MyAssessments = lazyWithRetry(() => import("./components/learning/MyAssessments"));
const MyCertificates = lazyWithRetry(() => import("./components/learning/MyCertificates"));
const MyProgress = lazyWithRetry(() => import("./components/learning/MyProgress"));

const QuizAdminGuard = lazyWithRetry(() => import("./components/quiz/QuizAdminGuard"));
const QuizAdminLoginPage = lazyWithRetry(() => import("./pages/quiz/QuizAdminLoginPage"));
const QuizAdminLayout = lazyWithRetry(() => import("./pages/quiz/QuizAdminLayout"));
const QuizDashboardPage = lazyWithRetry(() => import("./pages/quiz/QuizDashboardPage"));
const QuizListPage = lazyWithRetry(() => import("./pages/quiz/QuizListPage"));
const QuizBuilderPage = lazyWithRetry(() => import("./pages/quiz/QuizBuilderPage"));
const QuizHostLivePage = lazyWithRetry(() => import("./pages/quiz/QuizHostLivePage"));
const QuizResultsPage = lazyWithRetry(() => import("./pages/quiz/QuizResultsPage"));
const QuizFinalResultPage = lazyWithRetry(() => import("./pages/quiz/QuizFinalResultPage"));
const QuizJoinPage = lazyWithRetry(() => import("./pages/quiz/QuizJoinPage"));
const QuizPlayPage = lazyWithRetry(() => import("./pages/quiz/QuizPlayPage"));
const QuizUsersPage = lazyWithRetry(() => import("./pages/quiz/QuizUsersPage"));
const QuizSettingsPage = lazyWithRetry(() => import("./pages/quiz/QuizSettingsPage"));
const SurveyListPage = lazyWithRetry(() => import("./pages/quiz/SurveyListPage"));
const SurveyBuilderPage = lazyWithRetry(() => import("./pages/quiz/SurveyBuilderPage"));
const SurveyResultsPage = lazyWithRetry(() => import("./pages/quiz/SurveyResultsPage"));
const SurveySettingsPage = lazyWithRetry(() => import("./pages/quiz/SurveySettingsPage"));
const SurveyLiveHostPage = lazyWithRetry(() => import("./pages/quiz/SurveyLiveHostPage"));
const SurveyLiveJoinPage = lazyWithRetry(() => import("./pages/quiz/SurveyLiveJoinPage"));
const SurveyTakePage = lazyWithRetry(() => import("./pages/quiz/SurveyTakePage"));

const CallingAppGuard = lazyWithRetry(() => import("./components/callingApp/CallingAppGuard"));
const CallingAppLoginPage = lazyWithRetry(() => import("./pages/callingApp/CallingAppLoginPage"));
const CallingAppStandalonePage = lazyWithRetry(() => import("./pages/callingApp/CallingAppStandalonePage"));
const CallingAppEmbeddedPage = lazyWithRetry(() => import("./pages/callingApp/CallingAppEmbeddedPage"));

// Shown during the brief network fetch of a lazy route chunk (near-instant
// on repeat visits once cached). On a genuinely stalled connection — the
// request neither completing nor failing, which lazyWithRetry's catch can't
// help with — this would otherwise spin forever with no way out. After 8s
// it offers a manual reload instead of leaving the user stuck looking at a
// spinner indefinitely.
function RouteLoadingFallback() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStuck(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, minHeight: "60vh", width: "100%" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "3px solid #E2E8F0",
          borderTopColor: "#1E293B",
          animation: "spin 0.8s linear infinite",
        }}
      />
      {stuck && (
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#64748B", marginBottom: 10 }}>This is taking longer than usual.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ borderRadius: 10, background: "#0F172A", color: "#fff", fontSize: 14, fontWeight: 600, padding: "8px 20px", border: "none", cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  useEffect(() => {
    // Live Quiz is a separate app that opens in its own tab with its own favicon
    // (see QuizAdminLayout/QuizAdminLoginPage/QuizJoinPage) — this root-level
    // effect must not reassert the main LMS's icon over it on that tab.
    if (window.location.pathname.startsWith("/quiz")) return;

    function refreshIcon() {
      loadBranding().then((b) => applyDynamicIcon(b.appIconUrl, b.faviconUrl, b.companyName));
    }
    refreshIcon();
    window.addEventListener(BRANDING_CHANGED_EVENT, refreshIcon);
    return () => window.removeEventListener(BRANDING_CHANGED_EVENT, refreshIcon);
  }, []);

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
    <Routes>
      {/* Public Route */}
      <Route path={ROUTES.HOME} element={<MarketingHomePage />} />
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.LEGAL_DOCUMENT} element={<LegalDocumentPage />} />
      <Route path={ROUTES.CONTACT_US} element={<ContactUsPage />} />
      <Route path={ROUTES.PAY_LICENSE} element={<PayLicensePage />} />

      {/* Live Quiz (premium add-on) — standalone, no LMS sidebar/header,
          own auth (quiz_admins), own feature flag. Opens in a new browser
          tab from the LMS Sidebar; a completely separate app section
          living in the same SPA bundle. */}
      <Route path={ROUTES.QUIZ_ADMIN_LOGIN} element={<QuizAdminLoginPage />} />
      <Route element={<QuizAdminGuard><QuizAdminLayout /></QuizAdminGuard>}>
        <Route path={ROUTES.QUIZ_ADMIN_DASHBOARD} element={<QuizDashboardPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_QUIZZES} element={<QuizListPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_BUILDER_NEW} element={<QuizBuilderPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_BUILDER_EDIT} element={<QuizBuilderPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_SURVEYS} element={<SurveyListPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_SURVEY_BUILDER_NEW} element={<SurveyBuilderPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_SURVEY_BUILDER_EDIT} element={<SurveyBuilderPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_SURVEY_RESULTS} element={<SurveyResultsPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_SURVEY_SETTINGS} element={<SurveySettingsPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_SURVEY_LIVE_HOST} element={<SurveyLiveHostPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_RESULTS} element={<QuizResultsPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_FINAL_RESULT} element={<QuizFinalResultPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_USERS} element={<QuizUsersPage />} />
        <Route path={ROUTES.QUIZ_ADMIN_SETTINGS} element={<QuizSettingsPage />} />
      </Route>
      {/* Host Live renders its own full-bleed screen without QuizAdminLayout's nav chrome */}
      <Route element={<QuizAdminGuard><Outlet /></QuizAdminGuard>}>
        <Route path={ROUTES.QUIZ_ADMIN_HOST} element={<QuizHostLivePage />} />
      </Route>
      <Route path={ROUTES.QUIZ_JOIN} element={<QuizJoinPage />} />
      <Route path={ROUTES.QUIZ_PLAY} element={<QuizPlayPage />} />
      <Route path={ROUTES.SURVEY_TAKE} element={<SurveyTakePage />} />
      <Route path={ROUTES.SURVEY_LIVE_JOIN} element={<SurveyLiveJoinPage />} />

      {/* Calling App (premium add-on) — dedicated-login entry, standalone,
          no LMS chrome. Same "separate app in the same SPA bundle"
          pattern as Live Quiz/Aptitude Test above. */}
      <Route path={ROUTES.CALLING_APP_LOGIN} element={<CallingAppLoginPage />} />
      <Route element={<CallingAppGuard><Outlet /></CallingAppGuard>}>
        <Route path={ROUTES.CALLING_APP_DASHBOARD} element={<CallingAppStandalonePage />} />
      </Route>

      {/* Performance Tracker TV Mode — full-bleed, no AppLayout chrome, for
          an office TV/monitor. Uses the normal employee login (ProtectedRoute),
          not a separate credential — see PerformanceTrackerTvMode.tsx. */}
      <Route
        path={ROUTES.PERFORMANCE_TRACKER_TV}
        element={
          <ProtectedRoute>
            <PerformanceTrackerTvPage />
          </ProtectedRoute>
        }
      />

      {/* Protected Application — outer guard only checks "is logged in" */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Admin / management screens — each requires the specific
            permission to view that resource, on top of the outer
            login check. */}
        <Route
  path={ROUTES.DASHBOARD}
  element={<DashboardRouter />}
/>

        <Route
          path={ROUTES.EMPLOYEES}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_EMPLOYEE]} redirectTo={ROUTES.DASHBOARD}>
              <Employees />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.TRAINING}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_COURSE]} redirectTo={ROUTES.DASHBOARD}>
              <Training />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.COURSES}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_COURSE]} redirectTo={ROUTES.DASHBOARD}>
              <Courses />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.MODULES}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_MODULE]} redirectTo={ROUTES.DASHBOARD}>
              <Modules />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.ASSESSMENT}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_ASSESSMENT]} redirectTo={ROUTES.DASHBOARD}>
              <Assessment />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.REPORTS}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_REPORTS]} redirectTo={ROUTES.DASHBOARD}>
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.SETTINGS}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_SETTINGS]} redirectTo={ROUTES.DASHBOARD}>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.ADMIN}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_COMPANY]} redirectTo={ROUTES.DASHBOARD}>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path={`${ROUTES.ADMIN}/:tab`}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_COMPANY]} redirectTo={ROUTES.DASHBOARD}>
              <Admin />
            </ProtectedRoute>
          }
        />

        {/* Learning (employee-facing) — any logged-in user can access
            their own learning content. These are intentionally NOT
            gated by admin-style permissions (VIEW_COURSE etc. governs
            the course CATALOG/authoring side, not an employee's own
            assigned learning) — only the outer login check applies. */}
        <Route path={ROUTES.LEARNING_HOME} element={<LearningHome />} />
        <Route path={ROUTES.MY_COURSES} element={<MyCourses />} />
        <Route path={ROUTES.COURSE_PLAYER} element={<CoursePlayerRoute />} />
        <Route path={ROUTES.LESSON_PLAYER} element={<LessonPlayerRoute />} />
        <Route path={ROUTES.RESOURCE_VIEWER} element={<ResourceViewerRoute />} />
        <Route path={ROUTES.MY_ASSESSMENTS} element={<MyAssessments />} />
        <Route path={ROUTES.MY_CERTIFICATES} element={<MyCertificates />} />
        <Route path={ROUTES.MY_LEARNING_PATHS} element={<LearningPathsRoute />} />
        <Route path={ROUTES.MY_PROGRESS} element={<MyProgress />} />
        <Route path={ROUTES.VIDEOS} element={<Videos />} />
        <Route path={ROUTES.PROJECTS} element={<ProjectsPage />} />
        <Route path={ROUTES.INDUCTION} element={<InductionPage />} />
        <Route path={ROUTES.PERFORMANCE_TRACKER} element={<PerformanceTrackerPage />} />
        <Route path={ROUTES.SCRIPTS} element={<ScriptsPage />} />
        <Route path={ROUTES.BRAINSTORMING} element={<BrainstormingPage />} />
        <Route path={ROUTES.CERTIFICATE_VIEW} element={<CertificateViewPage />} />
        <Route path={ROUTES.MY_ATTENDANCE} element={<AttendancePage />} />
        <Route
          path={ROUTES.MY_TICKETS}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_SUPPORT_TICKET]} redirectTo={ROUTES.DASHBOARD}>
              <MyTicketsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.HELP_CENTER}
          element={
            <ProtectedRoute requiredPermissions={[PERMISSIONS.VIEW_HELP_CENTER]} redirectTo={ROUTES.DASHBOARD}>
              <HelpCenterPage />
            </ProtectedRoute>
          }
        />
        <Route path={ROUTES.MARKET_ANALYTICS} element={<MarketAnalyticsPage />} />
        <Route path={ROUTES.CALLING_APP} element={<CallingAppEmbeddedPage />} />
        <Route path={ROUTES.TRAINER_STUDENTS} element={<TrainerStudentsPage />} />
        <Route path={ROUTES.TRAINER_GRADING_QUEUE} element={<TrainerGradingQueuePage />} />
        <Route path={ROUTES.TRAINER_COURSES} element={<TrainerCoursesPage />} />
        <Route path={ROUTES.TRAINER_BATCHES} element={<TrainerBatchesPage />} />
        <Route path={ROUTES.TRAINER_RESULTS} element={<TrainerResultsPage />} />
      </Route>

      {/* Branded per-company login link, e.g. /hero-realty — must be the
          very last route so it never shadows a more specific path
          declared above it. */}
      <Route path={ROUTES.COMPANY_LOGIN} element={<LoginPage />} />

      {/* Fallback */}
      <Route
        path="*"
        element={<Navigate to={ROUTES.LOGIN} replace />}
      />
    </Routes>
    </Suspense>
  );
}

export default App;
