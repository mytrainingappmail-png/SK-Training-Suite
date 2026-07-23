export type TicketCategory = "technical" | "billing" | "content" | "account" | "general";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
// internal  — an employee raising an issue to their OWN company's admin.
// platform  — a company's admin raising a billing/subscription/platform
//             issue to the platform operator (the business running this SaaS).
export type TicketAudience = "internal" | "platform";

export interface SupportTicket {
  id: string;
  company_id: string;
  employee_id: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  audience: TicketAudience;
  raiser_name: string;
  raiser_company_name: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export type SupportTicketForm = Pick<SupportTicket, "subject" | "description" | "category" | "priority">;

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  company_id: string;
  author_employee_id: string | null;
  author_name: string;
  is_admin_reply: boolean;
  message: string;
  created_at: string;
}

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "technical", label: "Technical Issue" },
  { value: "billing", label: "Billing / Subscription" },
  { value: "content", label: "Course / Content Problem" },
  { value: "account", label: "Account / Login" },
  { value: "general", label: "General Question" },
];

export const TICKET_PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const TICKET_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];
