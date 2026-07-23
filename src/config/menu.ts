import { ROUTES } from "../constants/routes";

export interface MenuItem {
  id: string;
  title: string;
  route: string;
  icon: string;
  visible: boolean;
  group: string;
}

export const MENU: MenuItem[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    route: ROUTES.DASHBOARD,
    icon: "layout-dashboard",
    visible: true,
    group: "Overview",
  },

  // ── My Learning ──────────────────────────────────────────────────────
  {
    id: "learning-home",
    title: "Learning Home",
    route: ROUTES.LEARNING_HOME,
    icon: "home",
    visible: true,
    group: "My Learning",
  },
  {
    id: "my-courses",
    title: "My Courses",
    route: ROUTES.MY_COURSES,
    icon: "book-open",
    visible: true,
    group: "My Learning",
  },
  {
    id: "continue-learning",
    title: "Continue Learning",
    route: ROUTES.CONTINUE_LEARNING,
    icon: "play-circle",
    visible: true,
    group: "My Learning",
  },
  {
    id: "my-assessments",
    title: "My Assessments",
    route: ROUTES.MY_ASSESSMENTS,
    icon: "clipboard-check",
    visible: true,
    group: "My Learning",
  },
  {
    id: "my-certificates",
    title: "My Certificates",
    route: ROUTES.MY_CERTIFICATES,
    icon: "award",
    visible: true,
    group: "My Learning",
  },
  {
    id: "my-learning-paths",
    title: "Learning Paths",
    route: ROUTES.MY_LEARNING_PATHS,
    icon: "map",
    visible: true,
    group: "My Learning",
  },
  {
    id: "my-progress",
    title: "My Progress",
    route: ROUTES.MY_PROGRESS,
    icon: "bar-chart-3",
    visible: true,
    group: "My Learning",
  },
  {
    id: "videos",
    title: "Videos",
    route: ROUTES.VIDEOS,
    icon: "video",
    visible: true,
    group: "My Learning",
  },
  {
    id: "projects",
    title: "Projects",
    route: ROUTES.PROJECTS,
    icon: "folder",
    visible: true,
    group: "My Learning",
  },
  {
    id: "my-attendance",
    title: "My Attendance",
    route: ROUTES.MY_ATTENDANCE,
    icon: "calendar-check",
    visible: true,
    group: "Overview",
  },
  {
    id: "my-tickets",
    title: "Support Tickets",
    route: ROUTES.MY_TICKETS,
    icon: "life-buoy",
    visible: true,
    group: "Overview",
  },

  // ── Teaching (Trainer only) ──────────────────────────────────────────
  {
    id: "trainer-courses",
    title: "My Courses",
    route: ROUTES.TRAINER_COURSES,
    icon: "book-open",
    visible: true,
    group: "Teaching",
  },
  {
    id: "trainer-batches",
    title: "My Batches",
    route: ROUTES.TRAINER_BATCHES,
    icon: "layers",
    visible: true,
    group: "Teaching",
  },
  {
    id: "trainer-students",
    title: "My Students",
    route: ROUTES.TRAINER_STUDENTS,
    icon: "users",
    visible: true,
    group: "Teaching",
  },
  {
    id: "trainer-results",
    title: "Student Results",
    route: ROUTES.TRAINER_RESULTS,
    icon: "bar-chart-3",
    visible: true,
    group: "Teaching",
  },
  {
    id: "trainer-grading-queue",
    title: "Grading Queue",
    route: ROUTES.TRAINER_GRADING_QUEUE,
    icon: "clipboard-check",
    visible: true,
    group: "Teaching",
  },

  // ── Manage ───────────────────────────────────────────────────────────
  {
    id: "employees",
    title: "Employees",
    route: ROUTES.EMPLOYEES,
    icon: "users",
    visible: true,
    group: "Manage",
  },
  {
    id: "training",
    title: "Training",
    route: ROUTES.TRAINING,
    icon: "graduation-cap",
    visible: true,
    group: "Manage",
  },
  {
    id: "courses",
    title: "Courses",
    route: ROUTES.COURSES,
    icon: "book-open",
    visible: true,
    group: "Manage",
  },
  {
    id: "modules",
    title: "Modules",
    route: ROUTES.MODULES,
    icon: "layers",
    visible: true,
    group: "Manage",
  },
  {
    id: "assessment",
    title: "Assessment",
    route: ROUTES.ASSESSMENT,
    icon: "clipboard-check",
    visible: true,
    group: "Manage",
  },
  {
    id: "reports",
    title: "Reports",
    route: ROUTES.REPORTS,
    icon: "bar-chart-3",
    visible: true,
    group: "Manage",
  },

  // ── System ───────────────────────────────────────────────────────────
  {
    id: "settings",
    title: "Settings",
    route: ROUTES.SETTINGS,
    icon: "settings",
    visible: true,
    group: "System",
  },
  {
    id: "admin",
    title: "Admin",
    route: ROUTES.ADMIN,
    icon: "shield",
    visible: true,
    group: "System",
  },
];
