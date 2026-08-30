-- Calling App Phase 2, part 2: Prospects + handoff tracking, break
-- tracking, and delegated Team Leader / Sales Head report scope.
--
-- Report scope is deliberately its own dimension from is_admin: `role`
-- controls how much of the TEAM'S data someone can see in Dashboard/
-- Reports (agent -> only self, team_leader -> self + direct reports,
-- sales_head -> self + their team leaders + those team leaders' agents),
-- while is_admin still separately controls who can manage Settings/
-- Master Sheet/access grants. A team_leader is not automatically an
-- admin, and an admin sees everyone regardless of role.
--
-- reports_to is a self-reference within calling_app_admins — kept
-- entirely inside the Calling App's own schema (no dependency on
-- employees.reporting_manager_id, which doesn't exist in this app), so
-- an org's Calling App hierarchy can differ from its formal LMS org
-- chart if needed.

alter table calling_app_admins add column if not exists role text not null default 'agent' check (role in ('agent', 'team_leader', 'sales_head'));
alter table calling_app_admins add column if not exists reports_to uuid references calling_app_admins(id) on delete set null;
alter table calling_app_admins add constraint calling_app_admins_no_self_report check (reports_to is distinct from id);

create index if not exists idx_calling_app_admins_reports_to on calling_app_admins(reports_to);

create or replace function current_calling_app_report_scope_admin_ids() returns setof uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  me_id uuid := current_calling_app_admin_id();
  me_company uuid;
  me_role text;
  me_is_admin boolean;
begin
  if me_id is null then
    return;
  end if;

  select company_id, role, is_admin into me_company, me_role, me_is_admin
    from calling_app_admins where id = me_id;

  if me_is_admin then
    return query select id from calling_app_admins where company_id = me_company;
  elsif me_role = 'sales_head' then
    return query
      select me_id
      union
      select id from calling_app_admins where reports_to = me_id
      union
      select ca.id from calling_app_admins ca
        join calling_app_admins tl on tl.id = ca.reports_to
        where tl.reports_to = me_id;
  elsif me_role = 'team_leader' then
    return query
      select me_id
      union
      select id from calling_app_admins where reports_to = me_id;
  else
    return query select me_id;
  end if;
end;
$$;

-- Extend (not replace the meaning of) the existing SELECT policies so a
-- Team Leader/Sales Head can also see their reports' contacts and call
-- logs — write access (insert/update/delete) is untouched, still
-- self-only for non-admins.
drop policy if exists calling_app_contacts_select on calling_app_contacts;
create policy calling_app_contacts_select on calling_app_contacts for select
  using (
    company_id = current_calling_app_company_id()
    and (current_calling_app_is_admin() or assigned_to in (select current_calling_app_report_scope_admin_ids()))
  );

drop policy if exists calling_app_call_logs_select on calling_app_call_logs;
create policy calling_app_call_logs_select on calling_app_call_logs for select
  using (
    company_id = current_calling_app_company_id()
    and (current_calling_app_is_admin() or admin_id in (select current_calling_app_report_scope_admin_ids()))
  );

-- ── Prospects + handoff ──────────────────────────────────────────────
-- A "prospect" is just a flag an agent puts on a contact worth
-- escalating. A handoff is a request to transfer ownership of one
-- contact to someone else — the recipient must explicitly accept before
-- assigned_to actually changes, so a contact is never silently taken
-- off someone's sheet.

alter table calling_app_contacts add column if not exists is_prospect boolean not null default false;

create table calling_app_handoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid not null references calling_app_contacts(id) on delete cascade,
  from_admin_id uuid not null references calling_app_admins(id) on delete cascade,
  to_admin_id uuid not null references calling_app_admins(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_calling_app_handoffs_contact on calling_app_handoffs(contact_id);
create index idx_calling_app_handoffs_to on calling_app_handoffs(to_admin_id, status);
create index idx_calling_app_handoffs_from on calling_app_handoffs(from_admin_id);

alter table calling_app_handoffs enable row level security;

create policy calling_app_handoffs_select on calling_app_handoffs for select
  using (
    company_id = current_calling_app_company_id()
    and (current_calling_app_is_admin() or from_admin_id = current_calling_app_admin_id() or to_admin_id = current_calling_app_admin_id())
  );

-- You can only hand off a contact you currently own.
create policy calling_app_handoffs_insert on calling_app_handoffs for insert
  with check (
    company_id = current_calling_app_company_id()
    and from_admin_id = current_calling_app_admin_id()
    and exists (select 1 from calling_app_contacts c where c.id = contact_id and c.assigned_to = current_calling_app_admin_id())
  );

-- Accept/decline goes through the RPCs below (they also move contact
-- ownership atomically); this UPDATE policy exists mainly so an admin
-- can still see/adjust a stuck handoff directly if ever needed.
create policy calling_app_handoffs_update on calling_app_handoffs for update
  using (company_id = current_calling_app_company_id() and (to_admin_id = current_calling_app_admin_id() or current_calling_app_is_admin()))
  with check (company_id = current_calling_app_company_id() and (to_admin_id = current_calling_app_admin_id() or current_calling_app_is_admin()));

-- Accepting a handoff must both resolve the handoff row AND move
-- calling_app_contacts.assigned_to to the recipient in one atomic step —
-- a plain client-side UPDATE of the contact would fail RLS anyway,
-- because until this moment the recipient does not yet own that
-- contact. security definer is what makes the transfer possible; the
-- to_admin_id check below is what keeps it safe.
create or replace function accept_calling_app_handoff(p_handoff_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare
  h record;
  me uuid := current_calling_app_admin_id();
begin
  select * into h from calling_app_handoffs where id = p_handoff_id;
  if h is null then
    raise exception 'Handoff not found.';
  end if;
  if h.to_admin_id <> me then
    raise exception 'Only the recipient can accept this handoff.';
  end if;
  if h.status <> 'pending' then
    raise exception 'This handoff has already been resolved.';
  end if;

  update calling_app_handoffs set status = 'accepted', resolved_at = now() where id = p_handoff_id;
  update calling_app_contacts set assigned_to = h.to_admin_id, assigned_by = h.from_admin_id, assigned_at = now(), updated_at = now() where id = h.contact_id;
end;
$$;

grant execute on function accept_calling_app_handoff(uuid) to authenticated;

create or replace function decline_calling_app_handoff(p_handoff_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public
as $$
declare
  h record;
  me uuid := current_calling_app_admin_id();
begin
  select * into h from calling_app_handoffs where id = p_handoff_id;
  if h is null then
    raise exception 'Handoff not found.';
  end if;
  if h.to_admin_id <> me then
    raise exception 'Only the recipient can decline this handoff.';
  end if;
  if h.status <> 'pending' then
    raise exception 'This handoff has already been resolved.';
  end if;

  update calling_app_handoffs set status = 'declined', resolved_at = now(), note = coalesce(p_reason, note) where id = p_handoff_id;
end;
$$;

grant execute on function decline_calling_app_handoff(uuid, text) to authenticated;

-- ── Break tracking ───────────────────────────────────────────────────
-- ended_at null = the break is currently in progress. The partial
-- unique index is what actually prevents someone from starting a
-- second break while one is already open, at the database level.

create table calling_app_breaks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  admin_id uuid not null references calling_app_admins(id) on delete cascade,
  break_type text not null default 'coffee' check (break_type in ('coffee', 'lunch', 'other')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index idx_calling_app_breaks_one_active on calling_app_breaks(admin_id) where ended_at is null;
create index idx_calling_app_breaks_admin on calling_app_breaks(admin_id, started_at);

alter table calling_app_breaks enable row level security;

create policy calling_app_breaks_select on calling_app_breaks for select
  using (
    company_id = current_calling_app_company_id()
    and (current_calling_app_is_admin() or admin_id in (select current_calling_app_report_scope_admin_ids()))
  );

create policy calling_app_breaks_insert on calling_app_breaks for insert
  with check (company_id = current_calling_app_company_id() and admin_id = current_calling_app_admin_id());

create policy calling_app_breaks_update on calling_app_breaks for update
  using (company_id = current_calling_app_company_id() and admin_id = current_calling_app_admin_id())
  with check (company_id = current_calling_app_company_id() and admin_id = current_calling_app_admin_id());
