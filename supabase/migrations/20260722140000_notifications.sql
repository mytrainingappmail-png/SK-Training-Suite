-- ============================================================================
-- NOTIFICATIONS
--
-- Backs the existing (previously session-local-only) admin Notification
-- Center UI at src/components/admin/notifications/NotificationCenter.tsx,
-- and a new real-time bell/feed for employees.
--
-- notifications        — the envelope: title, message, audience selector,
--                         schedule, channels, lifecycle status.
-- notification_recipients — the resolved recipient list at send time (one
--                         row per employee actually targeted), tracking
--                         per-employee delivery + read status. Resolving
--                         audience -> concrete employees happens in the
--                         application layer (same as the existing UI
--                         already does client-side) at send time, not via
--                         a live query, so a later company/department roster
--                         change doesn't retroactively alter who a past
--                         notification was sent to.
-- ============================================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null default 'announcement',
  title text not null,
  message text not null default '',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  audience_type text not null default 'company' check (audience_type in ('company','branch','department','designation','role','employee')),
  audience_target_id uuid,
  course_id uuid references courses(id) on delete set null,
  channel_in_app boolean not null default true,
  channel_email boolean not null default false,
  channel_sms boolean not null default false,
  channel_push boolean not null default false,
  schedule_date date,
  schedule_time text,
  expiry_date date,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','delivered','failed','cancelled')),
  created_by uuid references employees(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','delivered','failed')),
  read_status text not null default 'unread' check (read_status in ('unread','read')),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, employee_id)
);

create index if not exists idx_notification_recipients_employee on notification_recipients (employee_id, read_status);
create index if not exists idx_notification_recipients_notification on notification_recipients (notification_id);
create index if not exists idx_notifications_company on notifications (company_id, created_at desc);

alter table notifications enable row level security;
create policy notifications_company_scoped on notifications
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter table notification_recipients enable row level security;
create policy notification_recipients_company_scoped on notification_recipients
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
