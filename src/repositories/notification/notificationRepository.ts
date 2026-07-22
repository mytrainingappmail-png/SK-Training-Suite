// src/repositories/notification/notificationRepository.ts

import { supabase } from '../../lib/supabase';
import type { Notification, NotificationForm, NotificationRecipient } from '../../types/notification';

export async function loadNotifications(companyId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Notification[]) ?? [];
}

export async function createNotification(companyId: string, createdBy: string | null, form: NotificationForm): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ ...form, company_id: companyId, created_by: createdBy })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Notification;
}

export async function updateNotification(id: string, form: Partial<NotificationForm>): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ ...form, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Notification;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function loadRecipients(notificationId: string): Promise<NotificationRecipient[]> {
  const { data, error } = await supabase
    .from('notification_recipients')
    .select('*')
    .eq('notification_id', notificationId);
  if (error) throw new Error(error.message);
  return (data as NotificationRecipient[]) ?? [];
}

export async function loadAllRecipients(companyId: string): Promise<NotificationRecipient[]> {
  const { data, error } = await supabase
    .from('notification_recipients')
    .select('*')
    .eq('company_id', companyId);
  if (error) throw new Error(error.message);
  return (data as NotificationRecipient[]) ?? [];
}

export async function replaceRecipients(
  notificationId: string,
  companyId: string,
  employeeIds: string[]
): Promise<NotificationRecipient[]> {
  const { error: delErr } = await supabase.from('notification_recipients').delete().eq('notification_id', notificationId);
  if (delErr) throw new Error(delErr.message);
  if (employeeIds.length === 0) return [];
  const rows = employeeIds.map((employeeId) => ({
    notification_id: notificationId,
    company_id: companyId,
    employee_id: employeeId,
  }));
  const { data, error } = await supabase.from('notification_recipients').insert(rows).select();
  if (error) throw new Error(error.message);
  return (data as NotificationRecipient[]) ?? [];
}

export async function markRecipientsDelivered(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ delivery_status: 'delivered', sent_at: new Date().toISOString() })
    .eq('notification_id', notificationId);
  if (error) throw new Error(error.message);
}

export async function markRecipientsFailed(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ delivery_status: 'failed' })
    .eq('notification_id', notificationId);
  if (error) throw new Error(error.message);
}

export async function toggleRecipientRead(id: string, nextReadStatus: 'read' | 'unread'): Promise<void> {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ read_status: nextReadStatus, read_at: nextReadStatus === 'read' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Employee-facing feed ─────────────────────────────────────────────────────

export async function loadMyRecipientRows(employeeId: string): Promise<NotificationRecipient[]> {
  const { data, error } = await supabase
    .from('notification_recipients')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as NotificationRecipient[]) ?? [];
}

export async function loadNotificationsByIds(ids: string[]): Promise<Notification[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('notifications').select('*').in('id', ids);
  if (error) throw new Error(error.message);
  return (data as Notification[]) ?? [];
}

export async function markMyNotificationRead(recipientRowId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ read_status: 'read', read_at: new Date().toISOString() })
    .eq('id', recipientRowId);
  if (error) throw new Error(error.message);
}
