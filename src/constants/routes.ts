export const ROUTES = {

  // Public marketing homepage — was the login screen, now a proper
  // logged-out landing page (Admin > Platform Configuration > Marketing
  // Website controls everything shown here).
  HOME: "/",

  LOGIN: "/login",

  // A branded per-company login link (e.g. /hero-realty) — same login
  // screen as LOGIN, just with the company code pre-filled. Handed to a
  // company after they're onboarded so they have their own memorable URL.
  // Must stay registered AFTER every other literal top-level route so it
  // never shadows them.
  COMPANY_LOGIN: "/:companyCode",

  LEGAL_DOCUMENT: "/legal/:slug",

  CONTACT_US: "/contact",

  PAY_LICENSE: "/pay/:licenseId",

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

  VIDEOS: "/learning/videos",

  PROJECTS: "/learning/projects",
  BRAINSTORMING: "/learning/brainstorming",
  INDUCTION: "/learning/induction",

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
  QUIZ_ADMIN_DASHBOARD: "/quiz-admin/dashboard",
  QUIZ_ADMIN_QUIZZES: "/quiz-admin/quizzes",
  QUIZ_ADMIN_BUILDER_NEW: "/quiz-admin/quizzes/new",
  QUIZ_ADMIN_BUILDER_EDIT: "/quiz-admin/quizzes/:quizId",
  QUIZ_ADMIN_HOST: "/quiz-admin/host/:sessionId",
  QUIZ_ADMIN_RESULTS: "/quiz-admin/results",
  QUIZ_ADMIN_FINAL_RESULT: "/quiz-admin/final-result",
  QUIZ_ADMIN_USERS: "/quiz-admin/users",
  QUIZ_ADMIN_SETTINGS: "/quiz-admin/settings",

  QUIZ_JOIN: "/quiz/join",
  QUIZ_PLAY: "/quiz/play/:sessionId",

  // Exams - a paper-style test (whole paper on one screen, one clock for the
  // whole paper) inside the same quiz-admin shell. Employees join by PIN.
  QUIZ_ADMIN_EXAMS: "/quiz-admin/exams",
  QUIZ_ADMIN_EXAM_NEW: "/quiz-admin/exams/new",
  QUIZ_ADMIN_EXAM_EDIT: "/quiz-admin/exams/:quizId",
  QUIZ_ADMIN_EXAM_HOST: "/quiz-admin/exams/session/:sessionId",
  EXAM_JOIN: "/exam",
  EXAM_PAPER: "/exam/:sessionId",

  // Survey — opinion-gathering, no score, inside the same quiz-admin
  // shell. Taking a survey is public/anonymous, no join/sign-in step.
  QUIZ_ADMIN_SURVEYS: "/quiz-admin/surveys",
  QUIZ_ADMIN_SURVEY_BUILDER_NEW: "/quiz-admin/surveys/new",
  QUIZ_ADMIN_SURVEY_SETTINGS: "/quiz-admin/surveys/settings",
  QUIZ_ADMIN_SURVEY_BUILDER_EDIT: "/quiz-admin/surveys/:surveyId",
  QUIZ_ADMIN_SURVEY_RESULTS: "/quiz-admin/surveys/:surveyId/results",
  QUIZ_ADMIN_SURVEY_LIVE_HOST: "/quiz-admin/surveys/:surveyId/live/:sessionId",
  SURVEY_TAKE: "/survey/:accessCode",
  SURVEY_LIVE_JOIN: "/survey-live",

  // In-LMS bootstrap for a company's first Live Quiz admin account —
  // SuperAdmin only, rendered inside AppLayout since it needs the LMS's
  // own real Supabase Auth session to call the provisioning edge function.
  QUIZ_ADMIN_SETUP: "/settings/live-quiz-setup",

  // ===========================
  // Calling App (premium add-on) — dual entry:
  //   - CALLING_APP (embedded, inside AppLayout): for someone using
  //     their existing LMS login, gated by a calling_app_admins grant.
  //   - CALLING_APP_LOGIN/DASHBOARD (standalone, no LMS chrome): a
  //     genuinely separate calling-only credential, same pattern as
  //     Live Quiz/Aptitude Test.
  // ===========================

  CALLING_APP: "/calling-app",
  CALLING_APP_LOGIN: "/calling-app/login",
  CALLING_APP_DASHBOARD: "/calling-app/dashboard",

  // ===========================
  // Performance Tracker (premium add-on) — embedded inside AppLayout using
  // the existing LMS session (same pattern as CALLING_APP above), not a
  // separate credential like Live Quiz — the daily commit/report loop needs
  // to be the SAME employee identity the rest of the app already knows,
  // not a parallel one.
  // ===========================

  PERFORMANCE_TRACKER: "/performance-tracker",
  // Full-bleed, no-chrome auto-rotating leaderboard — meant for an office
  // TV/monitor, not day-to-day use. Still requires the normal login (no
  // separate credential), just skips AppLayout's sidebar/header.
  PERFORMANCE_TRACKER_TV: "/performance-tracker/tv",

  // ===========================
  // Scripts — a standalone, employee-facing section (own sidebar item,
  // not nested under Projects). Any logged-in user can search/read/
  // download; only Admin/Super Admin can add or edit (checked inside the
  // page itself, same as Performance Tracker's own internal role split).
  // ===========================

  SCRIPTS: "/scripts",

} as const;
