import { ROUTES } from "../constants/routes";

export interface MenuItem {
  id: string;
  title: string;
  route: string;
  icon: string;
  visible: boolean;
}

export const MENU: MenuItem[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    route: ROUTES.DASHBOARD,
    icon: "layout-dashboard",
    visible: true,
  },
  {
    id: "employees",
    title: "Employees",
    route: ROUTES.EMPLOYEES,
    icon: "users",
    visible: true,
  },
  {
    id: "training",
    title: "Training",
    route: ROUTES.TRAINING,
    icon: "graduation-cap",
    visible: true,
  },
  {
  id: "learning-home",
  title: "Learning Home",
  route: ROUTES.LEARNING_HOME,
  icon: "home",
  visible: true,
},
{
  id: "my-courses",
  title: "My Courses",
  route: ROUTES.MY_COURSES,
  icon: "book-open",
  visible: true,
},
{
  id: "continue-learning",
  title: "Continue Learning",
  route: ROUTES.CONTINUE_LEARNING,
  icon: "play-circle",
  visible: true,
},
{
  id: "my-assessments",
  title: "My Assessments",
  route: ROUTES.MY_ASSESSMENTS,
  icon: "clipboard-check",
  visible: true,
},
{
  id: "my-certificates",
  title: "My Certificates",
  route: ROUTES.MY_CERTIFICATES,
  icon: "award",
  visible: true,
},
{
  id: "my-learning-paths",
  title: "Learning Paths",
  route: ROUTES.MY_LEARNING_PATHS,
  icon: "map",
  visible: true,
},
{
  id: "my-progress",
  title: "My Progress",
  route: ROUTES.MY_PROGRESS,
  icon: "bar-chart-3",
  visible: true,
},
  {
    id: "courses",
    title: "Courses",
    route: ROUTES.COURSES,
    icon: "book-open",
    visible: true,
  },
  {
  id: "modules",
  title: "Modules",
  route: ROUTES.MODULES,
  icon: "layers",
  visible: true,
},
  {
    id: "assessment",
    title: "Assessment",
    route: ROUTES.ASSESSMENT,
    icon: "clipboard-check",
    visible: true,
  },
  {
  id: "reports",
  title: "Reports",
  route: ROUTES.REPORTS,
  icon: "bar-chart-3",
  visible: true,
},
  {
    id: "settings",
    title: "Settings",
    route: ROUTES.SETTINGS,
    icon: "settings",
    visible: true,
  },
  {
    id: "admin",
    title: "Admin",
    route: ROUTES.ADMIN,
    icon: "shield",
    visible: true,
  },
];