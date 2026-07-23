import * as ticketRepo from "../../repositories/support/supportTicketRepository";
import * as notificationRepo from "../../repositories/notification/notificationRepository";
import { sendEmail } from "../../repositories/email/emailRepository";
import type { SupportTicket, SupportTicketForm, SupportTicketMessage, TicketStatus } from "../../types/supportTicket";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "../../types/supportTicket";

export async function loadCompanyTickets(): Promise<SupportTicket[]> {
  return ticketRepo.getAllTicketsForCompany();
}

export async function loadMyTickets(employeeId: string): Promise<SupportTicket[]> {
  return ticketRepo.getTicketsForEmployee(employeeId);
}

export async function loadTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
  return ticketRepo.getMessagesForTicket(ticketId);
}

/** Platform Support inbox — RLS auto-scopes this: the platform operator
 * sees every company's platform tickets, a tenant company sees only its own. */
export async function loadPlatformTickets(): Promise<SupportTicket[]> {
  return ticketRepo.getPlatformTickets();
}

/**
 * Raises a new ticket, then best-effort notifies the company's admins:
 * an in-app notification (always attempted — reliable, no external
 * dependency) and a real email to each admin's address on file (skipped
 * silently if Resend isn't configured yet, or an admin has no email).
 * Email/notification failures never surface to the employee — the ticket
 * itself is already saved by the time either is attempted.
 */
export async function raiseTicket(
  companyId: string,
  companyName: string,
  employeeId: string,
  employeeName: string,
  form: SupportTicketForm
): Promise<SupportTicket> {
  const ticket = await ticketRepo.createTicket(companyId, employeeId, employeeName, form);

  const categoryLabel = TICKET_CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category;
  const priorityLabel = TICKET_PRIORITIES.find((p) => p.value === form.priority)?.label ?? form.priority;

  try {
    const admins = await ticketRepo.getAdminEmployeesForCompany(companyId);

    const notification = await notificationRepo.createNotification(companyId, employeeId, {
      type: "ticket_created",
      title: `New support ticket: ${form.subject}`,
      message: `${employeeName} raised a ${priorityLabel.toLowerCase()}-priority ${categoryLabel} ticket: "${form.subject}". Open Ticket Management to respond.`,
      priority: form.priority === "urgent" || form.priority === "high" ? "high" : "normal",
      audience_type: "company",
      audience_target_id: null,
      course_id: null,
      channel_in_app: true,
      channel_email: false,
      channel_sms: false,
      channel_push: false,
      schedule_date: null,
      schedule_time: null,
      expiry_date: null,
      status: "draft",
      created_by_name: employeeName,
    });

    if (admins.length > 0) {
      await notificationRepo.replaceRecipients(notification.id, companyId, admins.map((a) => a.id));
      await notificationRepo.markRecipientsDelivered(notification.id);
    }

    for (const admin of admins) {
      if (!admin.email) continue;
      await sendEmail(
        admin.email,
        `New support ticket: ${form.subject}`,
        `<p>Hi ${admin.first_name},</p><p><strong>${employeeName}</strong> at ${companyName} raised a new support ticket:</p>
         <p><strong>Subject:</strong> ${form.subject}<br/><strong>Category:</strong> ${categoryLabel}<br/><strong>Priority:</strong> ${priorityLabel}</p>
         <p>${form.description}</p><p>Open Ticket Management in the admin console to respond.</p>`
      );
    }
  } catch (err) {
    console.error("[supportTicketService] raiseTicket notification step failed (ticket itself was still saved):", err);
  }

  return ticket;
}

/**
 * Raises a ticket FROM a client company's own admin TO the platform
 * operator (billing, subscription, platform-level problems) — a
 * different audience from raiseTicket() above (employee -> own company).
 * Notifies the operator's admins in-app (via a self-authorizing RPC, since
 * plain RLS can't write cross-company) and by real email (best-effort).
 */
export async function raisePlatformTicket(
  companyId: string,
  companyName: string,
  employeeId: string,
  employeeName: string,
  form: SupportTicketForm
): Promise<SupportTicket> {
  const ticket = await ticketRepo.createTicket(companyId, employeeId, employeeName, form, "platform", companyName);

  const categoryLabel = TICKET_CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category;
  const priorityLabel = TICKET_PRIORITIES.find((p) => p.value === form.priority)?.label ?? form.priority;

  try {
    await ticketRepo.notifyOperatorOfPlatformTicket(ticket.id);

    const operatorAdmins = await ticketRepo.getPlatformOperatorAdmins();
    for (const admin of operatorAdmins) {
      if (!admin.email) continue;
      await sendEmail(
        admin.email,
        `New platform support ticket from ${companyName}: ${form.subject}`,
        `<p>Hi ${admin.first_name},</p><p><strong>${employeeName}</strong> at <strong>${companyName}</strong> raised a platform support ticket:</p>
         <p><strong>Subject:</strong> ${form.subject}<br/><strong>Category:</strong> ${categoryLabel}<br/><strong>Priority:</strong> ${priorityLabel}</p>
         <p>${form.description}</p><p>Open Ticket Management → Platform Support to respond.</p>`
      );
    }
  } catch (err) {
    console.error("[supportTicketService] raisePlatformTicket notification step failed (ticket itself was still saved):", err);
  }

  return ticket;
}

export async function changeTicketStatus(id: string, status: TicketStatus): Promise<SupportTicket> {
  return ticketRepo.updateTicketStatus(id, status);
}

/**
 * Adds a reply to a ticket's thread and best-effort notifies the other
 * side: an admin reply emails/notifies the employee who raised it; an
 * employee follow-up notifies the company's admins again.
 */
export async function replyToTicket(
  ticket: SupportTicket,
  authorEmployeeId: string | null,
  authorName: string,
  isAdminReply: boolean,
  message: string,
  // Only used when isAdminReply — the ticket-raiser's own contact info,
  // so the reply can reach their inbox directly (not just the in-app bell).
  raiserEmail?: string,
  raiserFirstName?: string
): Promise<SupportTicketMessage> {
  const saved = await ticketRepo.addTicketMessage(ticket.company_id, ticket.id, authorEmployeeId, authorName, isAdminReply, message);
  const isPlatformTicket = ticket.audience === "platform";

  try {
    if (isAdminReply) {
      if (isPlatformTicket) {
        // The replier here is the PLATFORM OPERATOR, a different company
        // than the ticket — plain RLS can't write into the raiser's
        // company notifications, so this goes through a self-authorizing
        // RPC instead (see notify_raiser_of_platform_reply in the migration).
        await ticketRepo.notifyRaiserOfPlatformReply(ticket.id, authorName, message);
        const raiser = await ticketRepo.getPlatformTicketRaiser(ticket.id);
        if (raiser?.email) {
          await sendEmail(
            raiser.email,
            `Reply on your platform ticket: ${ticket.subject}`,
            `<p>Hi ${raiser.first_name},</p><p><strong>${authorName}</strong> replied to your platform ticket "${ticket.subject}":</p><p>${message}</p>`
          );
        }
      } else {
        const notification = await notificationRepo.createNotification(ticket.company_id, authorEmployeeId, {
          type: "ticket_reply",
          title: `Reply on your ticket: ${ticket.subject}`,
          message: `${authorName} replied: "${message}"`,
          priority: "normal",
          audience_type: "employee",
          audience_target_id: ticket.employee_id,
          course_id: null,
          channel_in_app: true,
          channel_email: false,
          channel_sms: false,
          channel_push: false,
          schedule_date: null,
          schedule_time: null,
          expiry_date: null,
          status: "draft",
          created_by_name: authorName,
        });
        await notificationRepo.replaceRecipients(notification.id, ticket.company_id, [ticket.employee_id]);
        await notificationRepo.markRecipientsDelivered(notification.id);
      }

      if (raiserEmail) {
        await sendEmail(
          raiserEmail,
          `Reply on your ticket: ${ticket.subject}`,
          `<p>Hi ${raiserFirstName ?? ""},</p><p><strong>${authorName}</strong> replied to your ticket "${ticket.subject}":</p><p>${message}</p>`
        );
      }
    } else if (isPlatformTicket) {
      // A follow-up from the RAISING company's own admin on their platform
      // ticket — re-notify the platform operator (self-authorizing RPC,
      // same one used at creation; the operator will see the new message
      // itself once they open the thread).
      await ticketRepo.notifyOperatorOfPlatformTicket(ticket.id);
      const operatorAdmins = await ticketRepo.getPlatformOperatorAdmins();
      for (const admin of operatorAdmins) {
        if (!admin.email) continue;
        await sendEmail(
          admin.email,
          `Update on platform ticket: ${ticket.subject}`,
          `<p>${authorName} at ${ticket.raiser_company_name} added a follow-up on "${ticket.subject}":</p><p>${message}</p>`
        );
      }
    } else {
      const admins = await ticketRepo.getAdminEmployeesForCompany(ticket.company_id);
      const notification = await notificationRepo.createNotification(ticket.company_id, authorEmployeeId, {
        type: "ticket_reply",
        title: `Update on ticket: ${ticket.subject}`,
        message: `${authorName} added a follow-up: "${message}"`,
        priority: "normal",
        audience_type: "company",
        audience_target_id: null,
        course_id: null,
        channel_in_app: true,
        channel_email: false,
        channel_sms: false,
        channel_push: false,
        schedule_date: null,
        schedule_time: null,
        expiry_date: null,
        status: "draft",
        created_by_name: authorName,
      });
      if (admins.length > 0) {
        await notificationRepo.replaceRecipients(notification.id, ticket.company_id, admins.map((a) => a.id));
        await notificationRepo.markRecipientsDelivered(notification.id);
      }
      for (const admin of admins) {
        if (!admin.email) continue;
        await sendEmail(
          admin.email,
          `Update on ticket: ${ticket.subject}`,
          `<p>${authorName} added a follow-up on "${ticket.subject}":</p><p>${message}</p>`
        );
      }
    }
  } catch (err) {
    console.error("[supportTicketService] replyToTicket notification step failed (reply itself was still saved):", err);
  }

  return saved;
}

export async function loadAdminsForCompany(companyId: string) {
  return ticketRepo.getAdminEmployeesForCompany(companyId);
}
