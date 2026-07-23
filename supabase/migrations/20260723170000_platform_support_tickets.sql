-- ============================================================================
-- PLATFORM SUPPORT TICKETS
--
-- Extends support_tickets with a second audience: a client company's own
-- admin raising a billing/subscription/platform-level issue TO the platform
-- operator (the company running this SaaS — companies.is_platform_operator,
-- see 20260722130000_platform_operator_scoping.sql), rather than an
-- employee raising an issue to their OWN company's admin (audience='internal',
-- the existing, already-shipped behaviour — completely unchanged here).
--
-- Cross-company access for 'platform' rows needs RLS beyond the simple
-- `company_id = current_employee_company_id()` convention: the operator
-- must be able to read/update platform tickets raised BY OTHER companies.
-- raiser_name / raiser_company_name are snapshotted as plain text at
-- creation time (same convention as notifications.created_by_name /
-- email_templates.created_by_name elsewhere in this schema) so the
-- operator's inbox never needs a cross-company join into employees/companies
-- (which stay strictly company-scoped) just to render who raised a ticket.
-- ============================================================================

alter table support_tickets add column if not exists audience text not null default 'internal' check (audience in ('internal','platform'));
alter table support_tickets add column if not exists raiser_name text not null default '';
alter table support_tickets add column if not exists raiser_company_name text not null default '';

drop policy if exists support_tickets_company_scoped on support_tickets;

create policy support_tickets_select on support_tickets
  for select using (
    company_id = current_employee_company_id()
    or (audience = 'platform' and current_company_is_platform_operator())
  );

create policy support_tickets_insert on support_tickets
  for insert with check (company_id = current_employee_company_id());

create policy support_tickets_update on support_tickets
  for update using (
    company_id = current_employee_company_id()
    or (audience = 'platform' and current_company_is_platform_operator())
  ) with check (
    company_id = current_employee_company_id()
    or (audience = 'platform' and current_company_is_platform_operator())
  );

create policy support_tickets_delete on support_tickets
  for delete using (company_id = current_employee_company_id());

drop policy if exists support_ticket_messages_company_scoped on support_ticket_messages;

create policy support_ticket_messages_select on support_ticket_messages
  for select using (
    company_id = current_employee_company_id()
    or exists (
      select 1 from support_tickets t
      where t.id = support_ticket_messages.ticket_id
        and t.audience = 'platform'
        and current_company_is_platform_operator()
    )
  );

create policy support_ticket_messages_insert on support_ticket_messages
  for insert with check (
    company_id = current_employee_company_id()
    or exists (
      select 1 from support_tickets t
      where t.id = support_ticket_messages.ticket_id
        and t.audience = 'platform'
        and current_company_is_platform_operator()
    )
  );

create policy support_ticket_messages_update on support_ticket_messages
  for update using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

create policy support_ticket_messages_delete on support_ticket_messages
  for delete using (company_id = current_employee_company_id());

-- ============================================================================
-- Directory + cross-company notification helpers — each is self-authorizing
-- against the ticket itself (never accepts a free-form target company_id
-- from the caller), so no caller can spoof a notification into an
-- unrelated company's feed.
-- ============================================================================

-- Returns the platform operator's SUPER_ADMIN/ADMIN/HR contact directory —
-- used client-side purely to know where to send the real (Resend) email
-- for a new platform ticket. Broadly grantable: it only ever reveals the
-- one operator's own support contacts, equivalent to a published "contact
-- us" address.
create or replace function get_platform_operator_admins()
returns table (id uuid, first_name text, last_name text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operator_company_id uuid;
begin
  select c.id into v_operator_company_id from companies c where c.is_platform_operator = true limit 1;
  if v_operator_company_id is null then
    return;
  end if;

  return query
    select distinct e.id, e.first_name, e.last_name, e.email
    from employees e
    join employee_roles er on er.employee_id = e.id and er.active = true
    join roles r on r.id = er.role_id
    where e.company_id = v_operator_company_id
      and e.active = true
      and r.role_code in ('SUPER_ADMIN','ADMIN','HR');
end;
$$;

grant execute on function get_platform_operator_admins() to authenticated;

-- Notifies the platform operator's admins (in-app) that a new platform
-- ticket was raised. Self-authorizing: only works for a ticket that is
-- audience='platform' AND belongs to the CALLER's own company — a caller
-- can never trigger this for someone else's ticket.
create or replace function notify_operator_of_platform_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket support_tickets%rowtype;
  v_operator_company_id uuid;
  v_notification_id uuid;
  v_admin record;
begin
  select * into v_ticket from support_tickets
  where id = p_ticket_id
    and audience = 'platform'
    and company_id = current_employee_company_id();

  if v_ticket.id is null then
    return;
  end if;

  select c.id into v_operator_company_id from companies c where c.is_platform_operator = true limit 1;
  if v_operator_company_id is null then
    return;
  end if;

  insert into notifications (
    company_id, type, title, message, priority, audience_type,
    channel_in_app, status, created_by_name
  ) values (
    v_operator_company_id, 'ticket_created',
    'New platform support ticket: ' || v_ticket.subject,
    coalesce(nullif(v_ticket.raiser_name, ''), 'A client company') || ' at ' || coalesce(nullif(v_ticket.raiser_company_name, ''), 'a client company') ||
      ' raised a ' || v_ticket.priority || '-priority ticket: "' || v_ticket.subject || '".',
    case when v_ticket.priority in ('high','urgent') then 'high' else 'normal' end,
    'company', true, 'delivered', coalesce(nullif(v_ticket.raiser_name, ''), 'System')
  )
  returning id into v_notification_id;

  for v_admin in
    select distinct e.id as employee_id
    from employees e
    join employee_roles er on er.employee_id = e.id and er.active = true
    join roles r on r.id = er.role_id
    where e.company_id = v_operator_company_id
      and e.active = true
      and r.role_code in ('SUPER_ADMIN','ADMIN','HR')
  loop
    insert into notification_recipients (notification_id, company_id, employee_id, delivery_status, sent_at)
    values (v_notification_id, v_operator_company_id, v_admin.employee_id, 'delivered', now())
    on conflict (notification_id, employee_id) do nothing;
  end loop;
end;
$$;

grant execute on function notify_operator_of_platform_ticket(uuid) to authenticated;

-- Notifies the ticket's own raiser (in-app) that the platform operator
-- replied. Self-authorizing: only works when the CALLER is the platform
-- operator and the ticket is audience='platform' — a tenant company can
-- never trigger this for another company's ticket.
create or replace function notify_raiser_of_platform_reply(p_ticket_id uuid, p_author_name text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket support_tickets%rowtype;
  v_notification_id uuid;
begin
  if not current_company_is_platform_operator() then
    return;
  end if;

  select * into v_ticket from support_tickets where id = p_ticket_id and audience = 'platform';
  if v_ticket.id is null then
    return;
  end if;

  insert into notifications (
    company_id, type, title, message, priority, audience_type, audience_target_id,
    channel_in_app, status, created_by_name
  ) values (
    v_ticket.company_id, 'ticket_reply',
    'Reply on your platform ticket: ' || v_ticket.subject,
    p_author_name || ' replied: "' || p_message || '"',
    'normal', 'employee', v_ticket.employee_id,
    true, 'delivered', p_author_name
  )
  returning id into v_notification_id;

  insert into notification_recipients (notification_id, company_id, employee_id, delivery_status, sent_at)
  values (v_notification_id, v_ticket.company_id, v_ticket.employee_id, 'delivered', now())
  on conflict (notification_id, employee_id) do nothing;
end;
$$;

grant execute on function notify_raiser_of_platform_reply(uuid, text, text) to authenticated;
