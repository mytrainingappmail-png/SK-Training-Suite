export const ROUTES = {

  LOGIN: "/",

  LEGAL_DOCUMENT: "/legal/:slug",

  DASHBOARD: "/dashboard",

  TRAINING: "/training",

  COURSES: "/courses",

  EMPLOYEES: "/employees",

  ASSESSMENT: "/assessment",

  REPORTS: "/reports",

  SETTINGS: "/settings",

  ADMIN: "/admin",

  MODULES: "/modules",

  // ===========================
  // Learning
  // ===========================

  LEARNING_HOME: "/learning",

  MY_COURSES: "/learning/courses",

  COURSE_PLAYER: "/learning/course/:courseId",

  LESSON_PLAYER: "/learning/lesson/:lessonId",

  RESOURCE_VIEWER: "/learning/resource/:resourceId",

  MY_ASSESSMENTS: "/learning/assessments",

  MY_CERTIFICATES: "/learning/certificates",

  MY_LEARNING_PATHS: "/learning/paths",

  MY_PROGRESS: "/learning/progress",

  CONTINUE_LEARNING: "/learning/continue",

  VIDEOS: "/learning/videos",

  PROJECTS: "/learning/projects",
  BRAINSTORMING: "/learning/brainstorming",

  CERTIFICATE_VIEW: "/learning/certificate/:certificateId",

  MY_ATTENDANCE: "/learning/attendance",

  MY_TICKETS: "/support/tickets",

  HELP_CENTER: "/help",

  MARKET_ANALYTICS: "/market-analytics",

  TRAINER_STUDENTS: "/teaching/students",

  TRAINER_GRADING_QUEUE: "/teaching/grading",

  TRAINER_COURSES: "/teaching/courses",

  TRAINER_BATCHES: "/teaching/batches",

  TRAINER_RESULTS: "/teaching/results",

  // ===========================
  // Live Quiz (premium add-on) — standalone, no LMS sidebar/header.
  // Admin routes require a quiz_admins session; join/play are public.
  // ===========================

  QUIZ_ADMIN_LOGIN: "/quiz-admin/login",
  QUIZ_ADMIN_RESET_PASSWORD: "/quiz-admin/reset-password",
  QUIZ_ADMIN_DASHBOARD: "/quiz-admin/dashboard",
  QUIZ_ADMIN_QUIZZES: "/quiz-admin/quizzes",
  QUIZ_ADMIN_BUILDER_NEW: "/quiz-admin/quizzes/new",
  QUIZ_ADMIN_BUILDER_EDIT: "/quiz-admin/quizzes/:quizId",
  QUIZ_ADMIN_HOST: "/quiz-admin/host/:sessionId",
  QUIZ_ADMIN_RESULTS: "/quiz-admin/results",

  QUIZ_JOIN: "/quiz/join",
  QUIZ_PLAY: "/quiz/play/:sessionId",

  // In-LMS bootstrap for a company's first Live Quiz admin account —
  // SuperAdmin only, rendered inside AppLayout since it needs the LMS's
  // own real Supabase Auth session to call the provisioning edge function.
  QUIZ_ADMIN_SETUP: "/settings/live-quiz-setup",

} as const;
