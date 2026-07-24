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

} as const;
