import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { ROUTES } from "./constants/routes";
import { PERMISSIONS } from "./constants/permissions";
import { loadBranding, applyDynamicIcon, BRANDING_CHANGED_EVENT } from "./services/branding/brandingService";

import AppLayout from "./layouts/AppLayout";

import LoginPage from "./pages/LoginPage";
import DashboardRouter from "./pages/DashboardRouter";
import Employees from "./pages/Employees";
import Training from "./pages/Training";
import Courses from "./pages/Courses";
import Modules from "./pages/Modules";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Assessment from "./pages/Assessment";
import Admin from "./pages/Admin";

import LearningHome from "./components/learning/LearningHome";
import MyCourses from "./components/learning/MyCourses";
import Videos from "./pages/Videos";
import ProjectsPage from "./pages/Projects";
import CertificateViewPage from "./components/certificate/CertificateViewPage";
import AttendancePage from "./pages/AttendancePage";
import MyTicketsPage from "./pages/MyTicketsPage";
import TrainerStudentsPage from "./pages/TrainerStudentsPage";
import TrainerGradingQueuePage from "./pages/TrainerGradingQueuePage";
import TrainerCoursesPage from "./pages/TrainerCoursesPage";
import TrainerBatchesPage from "./pages/TrainerBatchesPage";
import TrainerResultsPage from "./pages/TrainerResultsPage";
import { CoursePlayerRoute, LessonPlayerRoute, ResourceViewerRoute } from "./pages/LearningPlayerRoutes";
import MyAssessments from "./components/learning/MyAssessments";
import MyCertificates from "./components/learning/MyCertificates";
import MyLearningPaths from "./components/learning/MyLearningPaths";
import MyProgress from "./components/learning/MyProgress";
import ContinueLearning from "./components/learning/ContinueLearning";

import ProtectedRoute from "./components/auth/ProtectedRoute";

function App() {
  useEffect(() => {
    function refreshIcon() {
      loadBranding().then((b) => applyDynamicIcon(b.appIconUrl));
    }
    refreshIcon();
    window.addEventListener(BRANDING_CHANGED_EVENT, refreshIcon);
    return () => window.removeEventListener(BRANDING_CHANGED_EVENT, refreshIcon);
  }, []);

  return (
    <Routes>
      {/* Public Route */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />

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
        <Route path={ROUTES.MY_LEARNING_PATHS} element={<MyLearningPaths />} />
        <Route path={ROUTES.MY_PROGRESS} element={<MyProgress />} />
        <Route path={ROUTES.CONTINUE_LEARNING} element={<ContinueLearning />} />
        <Route path={ROUTES.VIDEOS} element={<Videos />} />
        <Route path={ROUTES.PROJECTS} element={<ProjectsPage />} />
        <Route path={ROUTES.CERTIFICATE_VIEW} element={<CertificateViewPage />} />
        <Route path={ROUTES.MY_ATTENDANCE} element={<AttendancePage />} />
        <Route path={ROUTES.MY_TICKETS} element={<MyTicketsPage />} />
        <Route path={ROUTES.TRAINER_STUDENTS} element={<TrainerStudentsPage />} />
        <Route path={ROUTES.TRAINER_GRADING_QUEUE} element={<TrainerGradingQueuePage />} />
        <Route path={ROUTES.TRAINER_COURSES} element={<TrainerCoursesPage />} />
        <Route path={ROUTES.TRAINER_BATCHES} element={<TrainerBatchesPage />} />
        <Route path={ROUTES.TRAINER_RESULTS} element={<TrainerResultsPage />} />
      </Route>

      {/* Fallback */}
      <Route
        path="*"
        element={<Navigate to={ROUTES.LOGIN} replace />}
      />
    </Routes>
  );
}

export default App;
