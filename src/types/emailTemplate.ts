export type EmailTemplateCategory =
  | "welcome" | "course_assigned" | "course_completed" | "assessment_assigned" | "assessment_reminder"
  | "assessment_result" | "assignment_assigned" | "assignment_reminder" | "assignment_submitted"
  | "certificate_issued" | "learning_path_assigned" | "password_reset" | "subscription_reminder"
  | "license_expiry" | "general_announcement" | "ticket_created" | "ticket_reply";

export type EmailTemplateStatus = "draft" | "published" | "archived";

export interface EmailTemplateBranding {
  logoUrl: string;
  headerText: string;
  footerText: string;
  primaryColor: string;
  secondaryColor: string;
  buttonColor: string;
}

export interface EmailTemplate {
  id: string;
  company_id: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body_html: string;
  status: EmailTemplateStatus;
  branding: EmailTemplateBranding;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export type EmailTemplateForm = Pick<EmailTemplate, "name" | "category" | "subject" | "body_html" | "status" | "branding">;
