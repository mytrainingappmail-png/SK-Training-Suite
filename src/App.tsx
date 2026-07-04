import { ROUTES } from "./constants/routes";
import { Routes, Route } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Training from "./pages/Training";
import Courses from "./pages/Courses";
import Admin from "./pages/Admin";
import Modules from "./pages/Modules";

function App() {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
      <Route path={ROUTES.EMPLOYEES} element={<Employees />} />
      <Route path={ROUTES.TRAINING} element={<Training />} />
      <Route path={ROUTES.COURSES} element={<Courses />} />
      <Route path={ROUTES.ADMIN} element={<Admin />} />
      <Route path={ROUTES.MODULES} element={<Modules />} />
    </Routes>
  );
}

export default App;