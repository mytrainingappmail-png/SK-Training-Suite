export type HelpArticleStatus = "draft" | "published";

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  content_html: string;
  keywords: string;
  display_order: number;
  status: HelpArticleStatus;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export type HelpArticleForm = Pick<HelpArticle, "category" | "title" | "content_html" | "keywords" | "display_order" | "status">;

export const HELP_CATEGORIES: { value: string; label: string }[] = [
  { value: "getting_started", label: "Getting Started" },
  { value: "courses", label: "Courses & Modules" },
  { value: "assessments", label: "Assessments & Quizzes" },
  { value: "certificates", label: "Certificates" },
  { value: "learning_paths", label: "Learning Paths" },
  { value: "employees", label: "Employees & Roles" },
  { value: "settings", label: "Settings & Theme" },
  { value: "reports", label: "Reports" },
  { value: "support", label: "Notifications & Support" },
  { value: "general", label: "General" },
];
