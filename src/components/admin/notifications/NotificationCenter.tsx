// src/components/admin/notifications/NotificationCenter.tsx
//
// Professional Notification Center. There is no notification table,
// service, or repository anywhere in this app (the only trace is an
// empty `src/modules/notifications` folder) — confirmed before writing
// anything here. Per instructions, the notification records themselves
// are kept as temporary, session-local UI state (nothing fake is
// persisted; this resets on reload).
//
// Everything that IS real is reused as-is, to target real recipients and
// real course context, exactly like the Enrollment / Learning Path
// modules:
//   companyService, branchService, departmentService, roleService,
//   employeeRoleService, employeeService — full audience targeting
//   courseService                        — course context for
//                                          course/assignment/assessment
//                                          notification types
//   enrollmentService                    — real enrollment data used to
//                                          auto-suggest recipients when a
//                                          course is selected
//   session.getCurrentUser()             — stamps who created each
//                                          notification
//
// No repository/service/database changes.

import { useEffect, useMemo, useState } from 'react';

import { loadCompanies } from '../../../services/company/companyService';
import { branchService } from '../../../services/branch/branchService';
import { departmentService } from '../../../services/department/departmentService';
import { loadRoles } from '../../../services/role/roleService';
import { loadEmployeeRoles } from '../../../services/employeeRole/employeeRoleService';
import { employeeService } from '../../../services/employee/employeeService';
import { loadCourses } from '../../../services/course/courseService';
import { loadEnrollments } from '../../../services/enrollment/enrollmentService';
import { getCurrentUser } from '../../../services/auth/session';

import type { Company } from '../../../types/company';
import type { Branch } from '../../../types/branch';
import type { Department } from '../../../types/department';
import type { Role } from '../../../types/role';
import type { EmployeeRole } from '../../../types/employeeRole';
import type { Employee } from '../../../types/employee';
import type { Course } from '../../../types/course';
import type { Enrollment } from '../../../types/enrollment';

// ─────────────────────────────────────────────────────────────────────────────
// Notification domain — session-local only, no backend exists for this yet
// ─────────────────────────────────────────────────────────────────────────────

type NotificationType =
  | 'course_assigned' | 'course_completed' | 'assignment_assigned' | 'assignment_due_reminder'
  | 'assignment_submitted' | 'assessment_scheduled' | 'assessment_reminder' | 'assessment_result'
  | 'certificate_issued' | 'enrollment' | 'learning_path_assigned' | 'license_expiry'
  | 'subscription_reminder' | 'system_notification' | 'announcement';

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'course_assigned',        label: 'Course Assigned' },
  { value: 'course_completed',       label: 'Course Completed' },
  { value: 'assignment_assigned',    label: 'Assignment Assigned' },
  { value: 'assignment_due_reminder', label: 'Assignment Due Reminder' },
  { value: 'assignment_submitted',   label: 'Assignment Submitted' },
  { value: 'assessment_scheduled',   label: 'Assessment Scheduled' },
  { value: 'assessment_reminder',    label: 'Assessment Reminder' },
  { value: 'assessment_result',      label: 'Assessment Result' },
  { value: 'certificate_issued',     label: 'Certificate Issued' },
  { value: 'enrollment',             label: 'Enrollment' },
  { value: 'learning_path_assigned', label: 'Learning Path Assigned' },
  { value: 'license_expiry',         label: 'License Expiry' },
  { value: 'subscription_reminder',  label: 'Subscription Reminder' },
  { value: 'system_notification',    label: 'System Notification' },
  { value: 'announcement',           label: 'Announcement' },
];

const TYPE_LABEL: Record<NotificationType, string> = Object.fromEntries(
  NOTIFICATION_TYPES.map((t) => [t.value, t.label])
) as Record<NotificationType, string>;

type Priority = 'low' | 'normal' | 'high' | 'urgent';
type AudienceType = 'company' | 'branch' | 'department' | 'role' | 'employee';
type NotificationStatus = 'draft' | 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled';

interface DeliveryChannels {
  inApp: boolean;
  email: boolean;
  sms:   boolean;
  push:  boolean;
}

interface RecipientRecord {
  employeeId:     string;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  readStatus:     'unread' | 'read';
  sentDate:       string | null;
  readDate:       string | null;
}

interface NotificationRecord {
  id:               string;
  type:             NotificationType;
  title:            string;
  message:          string;
  priority:         Priority;
  audienceType:     AudienceType;
  audienceTargetId: string;
  courseId:         string;
  channels:         DeliveryChannels;
  scheduleDate:     string;
  scheduleTime:     string;
  expiryDate:       string;
  status:           NotificationStatus;
  createdBy:        string;
  createdDate:      string;
  recipients:       RecipientRecord[];
}

function newNotificationDraft(actorName: string): NotificationRecord {
  return {
    id: `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'announcement',
    title: '',
    message: '',
    priority: 'normal',
    audienceType: 'employee',
    audienceTargetId: '',
    courseId: '',
    channels: { inApp: true, email: false, sms: false, push: false },
    scheduleDate: '',
    scheduleTime: '',
    expiryDate: '',
    status: 'draft',
    createdBy: actorName,
    createdDate: new Date().toISOString(),
    recipients: [],
  };
}

const STATUS_LABEL: Record<NotificationStatus, string> = {
  draft: 'Draft', scheduled: 'Scheduled', sent: 'Sent', delivered: 'Delivered', failed: 'Failed', cancelled: 'Cancelled',
};
const STATUS_STYLES: Record<NotificationStatus, string> = {
  draft:     'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  scheduled: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  sent:      'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  failed:    'bg-red-50 text-red-700 ring-1 ring-red-200',
  cancelled: 'bg-slate-100 text-slate-400 ring-1 ring-slate-200',
};

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-700',
};

// ─────────────────────────────────────────────────────────────────────────────
// Icons + shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
function IconTrash({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}
function IconDuplicate({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.29 48.29 0 0 1 1.927-.184" />
    </svg>
  );
}

function PrimaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function AccentButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function DangerButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled} className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition disabled:opacity-40 ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}>
      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: NotificationStatus }) {
  return <span className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>{STATUS_LABEL[status]}</span>;
}
function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[priority]}`}>{PRIORITY_LABEL[priority]}</span>;
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load data</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel,
}: { title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mb-5 text-sm text-slate-500">{message}</p>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <DangerButton onClick={onConfirm}><IconTrash /> {confirmLabel}</DangerButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main NotificationCenter
// ─────────────────────────────────────────────────────────────────────────────

function NotificationCenter() {
  const user = getCurrentUser();
  const actorName = user ? `${user.firstName} ${user.lastName}`.trim() : 'System';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employeeRoles, setEmployeeRoles] = useState<EmployeeRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | NotificationStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | NotificationType>('all');

  const [activeId, setActiveId] = useState('');
  const [editing, setEditing] = useState(false);
  const [formDraft, setFormDraft] = useState<NotificationRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotificationRecord | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([
      loadCompanies(), branchService.getAll(), departmentService.getAll(), loadRoles(),
      loadEmployeeRoles(), employeeService.getAll(), loadCourses(), loadEnrollments(),
    ])
      .then(([companyRows, branchRows, departmentRows, roleRows, employeeRoleRows, employeeRows, courseRows, enrollmentRows]) => {
        setCompanies(companyRows);
        setBranches(branchRows);
        setDepartments(departmentRows);
        setRoles(roleRows);
        setEmployeeRoles(employeeRoleRows);
        setEmployees(employeeRows);
        setCourses(courseRows);
        setEnrollments(enrollmentRows);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleIdsByEmployee = useMemo(() => {
    const map = new Map<string, Set<string>>();
    employeeRoles.filter((er) => er.active).forEach((er) => {
      const set = map.get(er.employee_id) ?? new Set<string>();
      set.add(er.role_id);
      map.set(er.employee_id, set);
    });
    return map;
  }, [employeeRoles]);

  function resolveRecipients(audienceType: AudienceType, targetId: string): Employee[] {
    if (!targetId) return [];
    if (audienceType === 'employee') return employees.filter((e) => e.id === targetId);
    if (audienceType === 'company') return employees.filter((e) => e.company_id === targetId);
    if (audienceType === 'branch') return employees.filter((e) => e.branch_id === targetId);
    if (audienceType === 'department') return employees.filter((e) => e.department_id === targetId);
    if (audienceType === 'role') return employees.filter((e) => roleIdsByEmployee.get(e.id)?.has(targetId));
    return [];
  }

  function courseEnrolledEmployeeIds(courseId: string): Set<string> {
    return new Set(enrollments.filter((e) => e.course_id === courseId).map((e) => e.employee_id));
  }

  // ── Create / Edit / Duplicate / Delete ──────────────────────────────────────

  function openCreate() {
    setFormDraft(newNotificationDraft(actorName));
    setEditing(true);
    setActiveId('');
  }

  function openEdit(n: NotificationRecord) {
    setFormDraft({ ...n });
    setEditing(true);
    setActiveId(n.id);
  }

  function openDuplicate(n: NotificationRecord) {
    const copy: NotificationRecord = {
      ...n,
      id: `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${n.title} (Copy)`,
      status: 'draft',
      createdBy: actorName,
      createdDate: new Date().toISOString(),
      recipients: [],
    };
    setNotifications((prev) => [copy, ...prev]);
    setActiveId(copy.id);
    setEditing(false);
    showToast('Notification duplicated');
  }

  function updateFormDraft(patch: Partial<NotificationRecord>) {
    setFormDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function buildRecipients(n: NotificationRecord): RecipientRecord[] {
    let targets = resolveRecipients(n.audienceType, n.audienceTargetId);
    if (n.courseId) {
      const enrolledIds = courseEnrolledEmployeeIds(n.courseId);
      targets = targets.filter((e) => enrolledIds.has(e.id));
    }
    return targets.map((e) => ({
      employeeId: e.id,
      deliveryStatus: 'pending',
      readStatus: 'unread',
      sentDate: null,
      readDate: null,
    }));
  }

  function handleSaveForm() {
    if (!formDraft || !formDraft.title.trim()) return;
    const recipients = buildRecipients(formDraft);
    const saved: NotificationRecord = { ...formDraft, recipients };
    setNotifications((prev) => {
      const exists = prev.some((n) => n.id === saved.id);
      return exists ? prev.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...prev];
    });
    setEditing(false);
    setActiveId(saved.id);
    showToast('Notification saved');
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setNotifications((prev) => prev.filter((n) => n.id !== deleteTarget.id));
    if (activeId === deleteTarget.id) setActiveId('');
    setDeleteTarget(null);
    showToast('Notification deleted');
  }

  // ── Lifecycle actions ────────────────────────────────────────────────────────

  function updateNotification(id: string, patch: Partial<NotificationRecord>) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function handleSchedule(n: NotificationRecord) {
    if (!n.scheduleDate) { showToast('Set a schedule date first.'); return; }
    updateNotification(n.id, { status: 'scheduled', recipients: n.recipients.length ? n.recipients : buildRecipients(n) });
    showToast('Notification scheduled');
  }

  function handleSendNow(n: NotificationRecord) {
    const now = new Date().toISOString();
    const recipients = (n.recipients.length ? n.recipients : buildRecipients(n)).map((r) => ({
      ...r, deliveryStatus: 'delivered' as const, sentDate: now,
    }));
    updateNotification(n.id, { status: recipients.length > 0 ? 'delivered' : 'sent', recipients });
    showToast('Notification sent');
  }

  function handleCancel(n: NotificationRecord) {
    updateNotification(n.id, { status: 'cancelled' });
    showToast('Notification cancelled');
  }

  function handleMarkFailed(n: NotificationRecord) {
    const recipients = n.recipients.map((r) => ({ ...r, deliveryStatus: 'failed' as const }));
    updateNotification(n.id, { status: 'failed', recipients });
    showToast('Marked as failed');
  }

  function toggleRecipientRead(notificationId: string, employeeId: string) {
    setNotifications((prev) => prev.map((n) => {
      if (n.id !== notificationId) return n;
      return {
        ...n,
        recipients: n.recipients.map((r) => r.employeeId === employeeId
          ? { ...r, readStatus: r.readStatus === 'read' ? 'unread' : 'read', readDate: r.readStatus === 'read' ? null : new Date().toISOString() }
          : r),
      };
    }));
  }

  // ── Filtering / summary ──────────────────────────────────────────────────────

  const searchTerm = search.trim().toLowerCase();

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (searchTerm && !n.title.toLowerCase().includes(searchTerm) && !n.message.toLowerCase().includes(searchTerm)) return false;
      if (statusFilter !== 'all' && n.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, searchTerm, statusFilter, priorityFilter, typeFilter]);

  const topSummary = useMemo(() => {
    let unread = 0, read = 0;
    notifications.forEach((n) => n.recipients.forEach((r) => (r.readStatus === 'read' ? (read += 1) : (unread += 1))));
    return {
      total: notifications.length,
      unread,
      read,
      scheduled: notifications.filter((n) => n.status === 'scheduled').length,
      failed: notifications.filter((n) => n.status === 'failed').length,
    };
  }, [notifications]);

  const activeNotification = notifications.find((n) => n.id === activeId) ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard label="Total Notifications" value={topSummary.total} accent="border-slate-200" />
        <SummaryCard label="Unread" value={topSummary.unread} accent="border-blue-200" />
        <SummaryCard label="Read" value={topSummary.read} accent="border-emerald-200" />
        <SummaryCard label="Scheduled" value={topSummary.scheduled} accent="border-amber-200" />
        <SummaryCard label="Failed" value={topSummary.failed} accent="border-red-200" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">

        {/* LEFT PANEL */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">Notifications</p>
            <PrimaryButton onClick={openCreate} className="px-2.5 py-1.5 text-xs"><IconPlus className="h-3.5 w-3.5" /> Create</PrimaryButton>
          </div>

          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notifications…" className={`${INPUT_CLS} mb-2`} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | NotificationStatus)} className={`${INPUT_CLS} mb-2`}>
            <option value="all">All Statuses</option>
            {(Object.keys(STATUS_LABEL) as NotificationStatus[]).map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as 'all' | Priority)} className={`${INPUT_CLS} mb-2`}>
            <option value="all">All Priorities</option>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (<option key={p} value={p}>{PRIORITY_LABEL[p]}</option>))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | NotificationType)} className={`${INPUT_CLS} mb-3`}>
            <option value="all">All Types</option>
            {NOTIFICATION_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>

          {filteredNotifications.length === 0 ? (
            <EmptyState message="No notifications match these filters." />
          ) : (
            <div className="max-h-[480px] space-y-1 overflow-y-auto">
              {filteredNotifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setActiveId(n.id); setEditing(false); }}
                  className={`flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition ${activeId === n.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{n.title || 'Untitled'}</span>
                    <StatusBadge status={n.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs text-slate-400">{TYPE_LABEL[n.type]}</span>
                    <PriorityBadge priority={n.priority} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CENTER */}
        <div className="space-y-6">
          {editing && formDraft ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-slate-800">{notifications.some((n) => n.id === formDraft.id) ? 'Edit Notification' : 'Create Notification'}</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Title"><input value={formDraft.title} onChange={(e) => updateFormDraft({ title: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Type">
                  <select value={formDraft.type} onChange={(e) => updateFormDraft({ type: e.target.value as NotificationType })} className={INPUT_CLS}>
                    {NOTIFICATION_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select value={formDraft.priority} onChange={(e) => updateFormDraft({ priority: e.target.value as Priority })} className={INPUT_CLS}>
                    {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (<option key={p} value={p}>{PRIORITY_LABEL[p]}</option>))}
                  </select>
                </Field>
                <Field label="Related Course (optional)">
                  <select value={formDraft.courseId} onChange={(e) => updateFormDraft({ courseId: e.target.value })} className={INPUT_CLS}>
                    <option value="">None</option>
                    {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
                  </select>
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Message">
                  <textarea value={formDraft.message} onChange={(e) => updateFormDraft({ message: e.target.value })} rows={3} className={`${INPUT_CLS} resize-none`} />
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Audience">
                  <select value={formDraft.audienceType} onChange={(e) => updateFormDraft({ audienceType: e.target.value as AudienceType, audienceTargetId: '' })} className={INPUT_CLS}>
                    <option value="company">Company</option>
                    <option value="branch">Branch</option>
                    <option value="department">Department</option>
                    <option value="role">Role</option>
                    <option value="employee">Employee</option>
                  </select>
                </Field>
                <Field label={formDraft.audienceType[0].toUpperCase() + formDraft.audienceType.slice(1)}>
                  <select value={formDraft.audienceTargetId} onChange={(e) => updateFormDraft({ audienceTargetId: e.target.value })} className={INPUT_CLS}>
                    <option value="">Select…</option>
                    {formDraft.audienceType === 'company' && companies.map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
                    {formDraft.audienceType === 'branch' && branches.map((b) => (<option key={b.id} value={b.id}>{b.branch_name}</option>))}
                    {formDraft.audienceType === 'department' && departments.map((d) => (<option key={d.id} value={d.id}>{d.department_name}</option>))}
                    {formDraft.audienceType === 'role' && roles.map((r) => (<option key={r.id} value={r.id}>{r.role_name}</option>))}
                    {formDraft.audienceType === 'employee' && employees.map((e) => (<option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>))}
                  </select>
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Schedule Date"><input type="date" value={formDraft.scheduleDate} onChange={(e) => updateFormDraft({ scheduleDate: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Schedule Time"><input type="time" value={formDraft.scheduleTime} onChange={(e) => updateFormDraft({ scheduleTime: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Expiry Date"><input type="date" value={formDraft.expiryDate} onChange={(e) => updateFormDraft({ expiryDate: e.target.value })} className={INPUT_CLS} /></Field>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-slate-500">Delivery Channels</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="text-sm text-slate-700">In App</span>
                    <Toggle on={formDraft.channels.inApp} onChange={() => updateFormDraft({ channels: { ...formDraft.channels, inApp: !formDraft.channels.inApp } })} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="text-sm text-slate-700">Email</span>
                    <Toggle on={formDraft.channels.email} onChange={() => updateFormDraft({ channels: { ...formDraft.channels, email: !formDraft.channels.email } })} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 opacity-60">
                    <span className="text-sm text-slate-700">SMS <span className="text-[10px] text-slate-400">(future)</span></span>
                    <Toggle on={formDraft.channels.sms} onChange={() => updateFormDraft({ channels: { ...formDraft.channels, sms: !formDraft.channels.sms } })} disabled />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 opacity-60">
                    <span className="text-sm text-slate-700">Push <span className="text-[10px] text-slate-400">(future)</span></span>
                    <Toggle on={formDraft.channels.push} onChange={() => updateFormDraft({ channels: { ...formDraft.channels, push: !formDraft.channels.push } })} disabled />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <PrimaryButton onClick={handleSaveForm} disabled={!formDraft.title.trim()}>Save</PrimaryButton>
                <SecondaryButton onClick={() => setEditing(false)}>Cancel</SecondaryButton>
              </div>
            </div>
          ) : !activeNotification ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <EmptyState message="Select a notification, or create a new one." />
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-800">{activeNotification.title}</h3>
                      <PriorityBadge priority={activeNotification.priority} />
                    </div>
                    <p className="text-xs text-slate-400">{TYPE_LABEL[activeNotification.type]} · Created by {activeNotification.createdBy}</p>
                  </div>
                  <StatusBadge status={activeNotification.status} />
                </div>
                <p className="mb-4 text-sm text-slate-600">{activeNotification.message}</p>

                <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  {activeNotification.channels.inApp && <span className="rounded-full bg-slate-100 px-2.5 py-1">In App</span>}
                  {activeNotification.channels.email && <span className="rounded-full bg-slate-100 px-2.5 py-1">Email</span>}
                  {activeNotification.channels.sms && <span className="rounded-full bg-slate-100 px-2.5 py-1">SMS</span>}
                  {activeNotification.channels.push && <span className="rounded-full bg-slate-100 px-2.5 py-1">Push</span>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => openEdit(activeNotification)}>Edit</SecondaryButton>
                  <SecondaryButton onClick={() => openDuplicate(activeNotification)}><IconDuplicate /> Duplicate</SecondaryButton>
                  <SecondaryButton onClick={() => handleSchedule(activeNotification)}>Schedule</SecondaryButton>
                  <AccentButton onClick={() => handleSendNow(activeNotification)}>Send Now</AccentButton>
                  <SecondaryButton onClick={() => handleCancel(activeNotification)}>Cancel</SecondaryButton>
                  <SecondaryButton onClick={() => handleMarkFailed(activeNotification)}>Mark Failed</SecondaryButton>
                  <DangerButton onClick={() => setDeleteTarget(activeNotification)}><IconTrash /> Delete</DangerButton>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Notification History</h3>
                {activeNotification.recipients.length === 0 ? (
                  <EmptyState message="No recipients yet — schedule or send this notification." />
                ) : (
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="pb-2 pr-3">Recipient</th>
                          <th className="pb-2 pr-3">Delivery Status</th>
                          <th className="pb-2 pr-3">Read Status</th>
                          <th className="pb-2 pr-3">Sent Date</th>
                          <th className="pb-2">Read Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeNotification.recipients.map((r) => {
                          const emp = employees.find((e) => e.id === r.employeeId);
                          return (
                            <tr key={r.employeeId}>
                              <td className="py-2 pr-3 font-medium text-slate-700">{emp ? `${emp.first_name} ${emp.last_name}` : r.employeeId}</td>
                              <td className="py-2 pr-3 text-slate-500 capitalize">{r.deliveryStatus}</td>
                              <td className="py-2 pr-3">
                                <button onClick={() => toggleRecipientRead(activeNotification.id, r.employeeId)} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.readStatus === 'read' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {r.readStatus === 'read' ? 'Read' : 'Unread'}
                                </button>
                              </td>
                              <td className="py-2 pr-3 text-slate-500">{r.sentDate ? new Date(r.sentDate).toLocaleString() : '—'}</td>
                              <td className="py-2 text-slate-500">{r.readDate ? new Date(r.readDate).toLocaleString() : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Notification"
          message={`Delete "${deleteTarget.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;