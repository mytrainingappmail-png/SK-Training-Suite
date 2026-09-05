-- Calling App: finer-grained authority + automation for the Master Sheet.
--
--   1. can_manage_master_sheet — a NEW permission, separate from is_admin,
--      so an admin can hand "upload/distribute/recall leads" authority to
--      a Team Leader (or anyone) without also giving them Settings access
--      (dispositions/custom fields), which stays is_admin-only.
--   2. calling_app_settings — one row per company: an on/off switch for
--      auto-distribution plus its batch size.
--   3. calling_app_notifications — a small in-app inbox scoped to this
--      module's own identity (calling_app_admins), separate from the LMS
--      notifications table, since a dedicated-login admin has no LMS
--      session to receive one through. recipient_admin_id = NULL means
--      "authority broadcast" — visible to anyone who can manage the
--      Master Sheet, not just one person.
--   4. recall_calling_app_contacts() — an RPC (not a raw client UPDATE)
--      so "who's allowed to pull leads back from an agent" is enforced in
--      one place, matching the existing accept/decline_calling_app_handoff
--      convention.
--   5. auto_distribute_after_call() trigger — fires the moment an agent's
--      queue (attempt_count = 0 contacts) hits zero. Reuses the exact same
--      "not yet worked" definition EmployeeDistributionSummary.pending
--      already uses, so this and the existing "Who Has Been Given How
--      Much" table always agree on what "pending" means.
--   6. calling_app_batch_performance — a view exposing per-batch (same
--      assigned_to + assigned_at = one distribution event, manual or
--      auto) completion timing, for judging how fast an agent works
--      through what they're given.

alter table calling_app_admins add column if not exists can_manage_master_sheet boolean not null default false;

create table if not exists calling_app_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  auto_distribute_enabled boolean not null default false,
  auto_distribute_batch_size int not null default 50 check (auto_distribute_batch_size > 0),
  updated_at timestamptz not null default now()
);

create table if not exists calling_app_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  recipient_admin_id uuid references calling_app_admins(id) on delete cascade,
  kind text not null check (kind in ('leads_assigned', 'pool_empty')),
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_calling_app_notifications_recipient on calling_app_notifications (recipient_admin_id, created_at desc);
create index if not exists idx_calling_app_notifications_company on calling_app_notifications (company_id, created_at desc);

-- ── Permission helper ────────────────────────────────────────────────────

create or replace function current_calling_app_can_manage_master_sheet() returns boolean
language sql stable security definer set search_path = public
as $$
  select current_calling_app_is_admin()
    or coalesce((select can_manage_master_sheet from calling_app_admins where id = current_calling_app_admin_id()), false);
$$;

-- ── RLS ───────────────────────────────────────────────────────────────

alter table calling_app_settings enable row level security;
alter table calling_app_notifications enable row level security;

drop policy if exists calling_app_settings_select on calling_app_settings;
create policy calling_app_settings_select on calling_app_settings for select
  using (company_id = current_calling_app_company_id());
drop policy if exists calling_app_settings_write on calling_app_settings;
create policy calling_app_settings_write on calling_app_settings for all
  using (company_id = current_calling_app_company_id() and current_calling_app_can_manage_master_sheet())
  with check (company_id = current_calling_app_company_id() and current_calling_app_can_manage_master_sheet());

-- A recipient sees their own notifications; anyone who can manage the
-- Master Sheet also sees every "authority broadcast" row (recipient_admin_id
-- is null) for their company — a shared alert inbox, not a personal one.
drop policy if exists calling_app_notifications_select on calling_app_notifications;
create policy calling_app_notifications_select on calling_app_notifications for select
  using (
    company_id = current_calling_app_company_id()
    and (recipient_admin_id = current_calling_app_admin_id()
         or (recipient_admin_id is null and current_calling_app_can_manage_master_sheet()))
  );
drop policy if exists calling_app_notifications_insert on calling_app_notifications;
create policy calling_app_notifications_insert on calling_app_notifications for insert
  with check (company_id = current_calling_app_company_id() and current_calling_app_can_manage_master_sheet());
drop policy if exists calling_app_notifications_update on calling_app_notifications;
create policy calling_app_notifications_update on calling_app_notifications for update
  using (
    company_id = current_calling_app_company_id()
    and (recipient_admin_id = current_calling_app_admin_id()
         or (recipient_admin_id is null and current_calling_app_can_manage_master_sheet()))
  )
  with check (
    company_id = current_calling_app_company_id()
    and (recipient_admin_id = current_calling_app_admin_id()
         or (recipient_admin_id is null and current_calling_app_can_manage_master_sheet()))
  );

-- Extend contacts access: a master-sheet manager needs to see/update
-- EVERY contact (to distribute and recall), same as an is_admin already
-- could — this is additive, nothing existing loses access.
drop policy if exists calling_app_contacts_select on calling_app_contacts;
create policy calling_app_contacts_select on calling_app_contacts for select
  using (company_id = current_calling_app_company_id()
    and (current_calling_app_is_admin() or current_calling_app_can_manage_master_sheet() or assigned_to = current_calling_app_admin_id()));

drop policy if exists calling_app_contacts_update on calling_app_contacts;
create policy calling_app_contacts_update on calling_app_contacts for update
  using (company_id = current_calling_app_company_id()
    and (current_calling_app_is_admin() or current_calling_app_can_manage_master_sheet() or assigned_to = current_calling_app_admin_id()))
  with check (company_id = current_calling_app_company_id()
    and (current_calling_app_is_admin() or current_calling_app_can_manage_master_sheet() or assigned_to = current_calling_app_admin_id()));

-- ── Recall ───────────────────────────────────────────────────────────────

-- p_only_unworked = true recalls only never-attempted leads (the common,
-- safe case — freeing up a slow-moving agent's untouched backlog); false
-- recalls EVERYTHING still assigned to them, worked or not (the "this
-- person left the company, take it all back" case). Either way the call
-- history (call logs) stays put — only assigned_to/by/at reset to null,
-- so the contact re-enters the unassigned pool exactly like a fresh
-- upload would, ready to be (re)distributed.
create or replace function recall_calling_app_contacts(p_from_admin_id uuid, p_only_unworked boolean default true)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_count int;
begin
  if not current_calling_app_can_manage_master_sheet() then
    raise exception 'Not authorized to recall contacts.';
  end if;

  v_company_id := current_calling_app_company_id();

  update calling_app_contacts
  set assigned_to = null, assigned_by = null, assigned_at = null
  where company_id = v_company_id
    and assigned_to = p_from_admin_id
    and (not p_only_unworked or attempt_count = 0);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── Auto-distribution ────────────────────────────────────────────────────

create or replace function auto_distribute_after_call() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_enabled boolean;
  v_batch_size int;
  v_remaining int;
  v_contact_ids uuid[];
  v_found int;
  v_agent_name text;
begin
  select auto_distribute_enabled, auto_distribute_batch_size
    into v_enabled, v_batch_size
  from calling_app_settings where company_id = new.company_id;

  if not coalesce(v_enabled, false) then
    return new;
  end if;

  select count(*) into v_remaining
  from calling_app_contacts
  where company_id = new.company_id and assigned_to = new.assigned_to and attempt_count = 0;

  if v_remaining > 0 then
    return new;
  end if;

  select array_agg(id) into v_contact_ids
  from (
    select id from calling_app_contacts
    where company_id = new.company_id and assigned_to is null
    order by created_at asc
    limit greatest(coalesce(v_batch_size, 50), 1)
    for update skip locked
  ) sub;

  v_found := coalesce(array_length(v_contact_ids, 1), 0);

  if v_found > 0 then
    update calling_app_contacts
    set assigned_to = new.assigned_to, assigned_by = null, assigned_at = now()
    where id = any(v_contact_ids);

    insert into calling_app_notifications (company_id, recipient_admin_id, kind, message)
    values (new.company_id, new.assigned_to, 'leads_assigned',
      format('%s new lead(s) auto-assigned to you — your previous batch is complete.', v_found));
  end if;

  if v_found < coalesce(v_batch_size, 50) then
    select display_name into v_agent_name from calling_app_admins where id = new.assigned_to;
    insert into calling_app_notifications (company_id, recipient_admin_id, kind, message)
    values (new.company_id, null, 'pool_empty',
      case when v_found = 0
        then format('Master Sheet is empty — %s just finished their batch and got no new leads. Upload more data.', coalesce(v_agent_name, 'an agent'))
        else format('Master Sheet is running low — %s could only be given %s of %s requested leads. Upload more data soon.', coalesce(v_agent_name, 'an agent'), v_found, coalesce(v_batch_size, 50))
      end);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_distribute_after_call on calling_app_contacts;
create trigger trg_auto_distribute_after_call
  after update on calling_app_contacts
  for each row
  when (old.attempt_count = 0 and new.attempt_count > 0 and new.assigned_to is not null)
  execute function auto_distribute_after_call();

-- ── Batch performance (for judging how fast an agent works through what
--    they're given) — grouped by (assigned_to, assigned_at) since every
--    distribution or auto-top-up event stamps the whole batch with one
--    shared assigned_at in a single statement, giving each batch a
--    natural, implicit identity with no new column needed. ─────────────
create or replace view calling_app_batch_performance as
select
  c.company_id,
  c.assigned_to as admin_id,
  c.assigned_at,
  count(*) as batch_size,
  count(*) filter (where c.attempt_count > 0) as worked_count,
  (count(*) filter (where c.attempt_count > 0) = count(*)) as is_complete,
  min(c.updated_at) filter (where c.attempt_count > 0) as first_worked_at,
  max(c.updated_at) filter (where c.attempt_count > 0) as last_worked_at
from calling_app_contacts c
where c.assigned_to is not null and c.assigned_at is not null
group by c.company_id, c.assigned_to, c.assigned_at;
