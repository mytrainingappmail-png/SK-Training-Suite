// src/services/notification/notificationService.ts

import * as repo from '../../repositories/notification/notificationRepository';
import { defaultNotificationForm } from '../../types/notification';
import type { Notification, NotificationForm, NotificationAudienceType, EmployeeNotification } from '../../types/notification';
import type { Employee } from '../../types/employee';
import type { EmployeeRole } from '../../types/employeeRole';
import type { Enrollment } from '../../types/enrollment';
import { formatDeadline } from '../../utils/deadline';

export async function loadCompanyNotifications(companyId: string): Promise<Notification[]> {
  return repo.loadNotifications(companyId);
}

export async function saveNotification(
  companyId: string,
  createdBy: string | null,
  form: NotificationForm,
  existingId: string | null
): Promise<Notification> {
  if (existingId) return repo.updateNotification(existingId, form);
  return repo.createNotification(companyId, createdBy, form);
}

export async function removeNotification(id: string): Promise<void> {
  return repo.deleteNotification(id);
}

/** Mirrors the resolution rules the compose UI already uses, applied
 * against real employee/department/branch/designation/role rosters. */
export function resolveAudience(
  audienceType: NotificationAudienceType,
  targetId: string | null,
  employees: Employee[],
  employeeRoles: EmployeeRole[]
): Employee[] {
  if (!targetId) return audienceType === 'company' ? employees : [];
  if (audienceType === 'company') return employees.filter((e) => e.company_id === targetId);
  if (audienceType === 'branch') return employees.filter((e) => e.branch_id === targetId);
  if (audienceType === 'department') return employees.filter((e) => e.department_id === targetId);
  if (audienceType === 'designation') return employees.filter((e) => e.designation_id === targetId);
  if (audienceType === 'role') {
    const employeeIds = new Set(employeeRoles.filter((er) => er.active && er.role_id === targetId).map((er) => er.employee_id));
    return employees.filter((e) => employeeIds.has(e.id));
  }
  if (audienceType === 'employee') return employees.filter((e) => e.id === targetId);
  return [];
}

export function filterByCourseEnrollment(candidates: Employee[], courseId: string | null, enrollments: Enrollment[]): Employee[] {
  if (!courseId) return candidates;
  const enrolledIds = new Set(enrollments.filter((e) => e.course_id === courseId).map((e) => e.employee_id));
  return candidates.filter((e) => enrolledIds.has(e.id));
}

export async function sendNotificationNow(
  notification: Notification,
  recipientEmployeeIds: string[]
): Promise<void> {
  await repo.replaceRecipients(notification.id, notification.company_id, recipientEmployeeIds);
  if (recipientEmployeeIds.length > 0) {
    await repo.markRecipientsDelivered(notification.id);
  }
  await repo.updateNotification(notification.id, {
    status: recipientEmployeeIds.length > 0 ? 'delivered' : 'sent',
  });
}

export async function scheduleNotification(
  notification: Notification,
  recipientEmployeeIds: string[]
): Promise<void> {
  const existing = await repo.loadRecipients(notification.id);
  if (existing.length === 0) {
    await repo.replaceRecipients(notification.id, notification.company_id, recipientEmployeeIds);
  }
  await repo.updateNotification(notification.id, { status: 'scheduled' });
}

export async function cancelNotification(id: string): Promise<void> {
  await repo.updateNotification(id, { status: 'cancelled' });
}

export async function markNotificationFailed(id: string): Promise<void> {
  await repo.markRecipientsFailed(id);
  await repo.updateNotification(id, { status: 'failed' });
}

export async function toggleRecipientReadStatus(recipientId: string, nextStatus: 'read' | 'unread'): Promise<void> {
  return repo.toggleRecipientRead(recipientId, nextStatus);
}

export async function loadAllRecipientsForCompany(companyId: string) {
  return repo.loadAllRecipients(companyId);
}

// ── Employee-facing feed ─────────────────────────────────────────────────────

export async function loadMyNotifications(employeeId: string): Promise<EmployeeNotification[]> {
  const recipientRows = await repo.loadMyRecipientRows(employeeId);
  const deliveredRows = recipientRows.filter((r) => r.delivery_status === 'delivered');
  if (deliveredRows.length === 0) return [];
  const notifications = await repo.loadNotificationsByIds(deliveredRows.map((r) => r.notification_id));
  const notificationById = new Map(notifications.map((n) => [n.id, n]));
  return deliveredRows
    .map((recipient) => {
      const notification = notificationById.get(recipient.notification_id);
      return notification ? { notification, recipient } : null;
    })
    .filter((x): x is EmployeeNotification => x !== null)
    .sort((a, b) => new Date(b.notification.created_at).getTime() - new Date(a.notification.created_at).getTime());
}

export async function markMyNotificationRead(recipientId: string): Promise<void> {
  return repo.markMyNotificationRead(recipientId);
}

// ── Assignment notifications ─────────────────────────────────────────────────
// Fired right after an admin assigns a course or a learning path, so the
// employee sees it in their bell without the admin composing anything.

export async function notifyCourseAssigned(
  companyId: string,
  createdBy: string | null,
  createdByName: string,
  courseId: string,
  courseName: string,
  employeeIds: string[],
  dueAt: string | null
): Promise<void> {
  if (employeeIds.length === 0) return;
  const deadlineText = dueAt ? ` Complete by ${formatDeadline(dueAt)}.` : '';
  const notification = await repo.createNotification(companyId, createdBy, {
    ...defaultNotificationForm,
    type: 'course_assigned',
    title: 'New course assigned',
    message: `You've been assigned "${courseName}".${deadlineText}`,
    audience_type: 'employee',
    course_id: courseId,
    created_by_name: createdByName,
  });
  await sendNotificationNow(notification, employeeIds);
}

export async function notifyLearningPathAssigned(
  companyId: string,
  createdBy: string | null,
  createdByName: string,
  pathName: string,
  employeeIds: string[],
  dueAt: string | null
): Promise<void> {
  if (employeeIds.length === 0) return;
  const deadlineText = dueAt ? ` Complete by ${formatDeadline(dueAt)}.` : '';
  const notification = await repo.createNotification(companyId, createdBy, {
    ...defaultNotificationForm,
    type: 'learning_path_assigned',
    title: 'New learning path assigned',
    message: `You've been assigned the "${pathName}" learning path.${deadlineText}`,
    audience_type: 'employee',
    created_by_name: createdByName,
  });
  await sendNotificationNow(notification, employeeIds);
}
