export const ROUTES = {

  LOGIN: "/",

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

} as const;