import { Routes, Route, Navigate } from "react-router-dom";

import { ROUTES } from "./constants/routes";

import AppLayout from "./layouts/AppLayout";
import Assessment from "./pages/Assessment";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Training from "./pages/Training";
import Courses from "./pages/Courses";
import Modules from "./pages/Modules";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import LearningHome from "./pages/LearningHome";
import MyCourses from "./pages/MyCourses";
import CoursePlayer from "./pages/CoursePlayer";
import LessonPlayer from "./pages/LessonPlayer";
import ResourceViewer from "./pages/ResourceViewer";
import MyAssessments from "./pages/MyAssessments";
import MyCertificates from "./pages/MyCertificates";
import MyLearningPaths from "./pages/MyLearningPaths";
import MyProgress from "./pages/MyProgress";
import ContinueLearning from "./pages/ContinueLearning";

import ProtectedRoute from "./components/auth/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />

      {/* Protected Application */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path={ROUTES.DASHBOARD}
          element={<Dashboard />}
        />

        <Route
          path={ROUTES.EMPLOYEES}
          element={<Employees />}
        />

        <Route
          path={ROUTES.TRAINING}
          element={<Training />}
        />
<Route
  path={ROUTES.ASSESSMENT}
  element={<Assessment />}
/>
        <Route
          path={ROUTES.COURSES}
          element={<Courses />}
        />

        <Route
          path={ROUTES.MODULES}
          element={<Modules />}
        />

        <Route
          path={ROUTES.REPORTS}
          element={<Reports />}
        />

        <Route
          path={ROUTES.SETTINGS}
          element={<Settings />}
        />
        <Route
  path={ROUTES.LEARNING_HOME}
  element={<LearningHome />}
/>

<Route
  path={ROUTES.MY_COURSES}
  element={<MyCourses />}
/>

<Route
  path={ROUTES.COURSE_PLAYER}
  element={<CoursePlayer />}
/>

<Route
  path={ROUTES.LESSON_PLAYER}
  element={<LessonPlayer />}
/>

<Route
  path={ROUTES.RESOURCE_VIEWER}
  element={<ResourceViewer />}
/>

<Route
  path={ROUTES.MY_ASSESSMENTS}
  element={<MyAssessments />}
/>

<Route
  path={ROUTES.MY_CERTIFICATES}
  element={<MyCertificates />}
/>

<Route
  path={ROUTES.MY_LEARNING_PATHS}
  element={<MyLearningPaths />}
/>

<Route
  path={ROUTES.MY_PROGRESS}
  element={<MyProgress />}
/>

<Route
  path={ROUTES.CONTINUE_LEARNING}
  element={<ContinueLearning />}
/>

        <Route
          path={ROUTES.ADMIN}
          element={<Admin />}
        />
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