// src/types/notification.ts

export type NotificationType =
  | 'course_assigned' | 'course_completed' | 'assignment_assigned' | 'assignment_due_reminder'
  | 'assignment_submitted' | 'assessment_scheduled' | 'assessment_reminder' | 'assessment_result'
  | 'certificate_issued' | 'enrollment' | 'learning_path_assigned' | 'license_expiry'
  | 'subscription_reminder' | 'system_notification' | 'announcement';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationAudienceType = 'company' | 'branch' | 'department' | 'designation' | 'role' | 'employee';

export type NotificationStatus = 'draft' | 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export type DeliveryStatus = 'pending' | 'delivered' | 'failed';
export type ReadStatus = 'unread' | 'read';

export interface Notification {
  id: string;
  company_id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  audience_type: NotificationAudienceType;
  audience_target_id: string | null;
  course_id: string | null;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_sms: boolean;
  channel_push: boolean;
  schedule_date: string | null;
  schedule_time: string | null;
  expiry_date: string | null;
  status: NotificationStatus;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export type NotificationForm = Omit<Notification, 'id' | 'company_id' | 'created_by' | 'created_at' | 'updated_at'>;

export const defaultNotificationForm: NotificationForm = {
  type: 'announcement',
  title: '',
  message: '',
  priority: 'normal',
  audience_type: 'company',
  audience_target_id: null,
  course_id: null,
  channel_in_app: true,
  channel_email: false,
  channel_sms: false,
  channel_push: false,
  schedule_date: null,
  schedule_time: null,
  expiry_date: null,
  status: 'draft',
  created_by_name: '',
};

export interface NotificationRecipient {
  id: string;
  notification_id: string;
  company_id: string;
  employee_id: string;
  delivery_status: DeliveryStatus;
  read_status: ReadStatus;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

// A notification joined with the current employee's own recipient row —
// what the employee-facing bell/feed actually renders.
export interface EmployeeNotification {
  notification: Notification;
  recipient: NotificationRecipient;
}
