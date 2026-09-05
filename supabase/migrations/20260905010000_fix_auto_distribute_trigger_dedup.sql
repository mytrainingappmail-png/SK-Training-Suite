-- The auto-distribute trigger was FOR EACH ROW: for a multi-row UPDATE
-- (several of one agent's contacts crossing attempt_count 0 -> >0 in the
-- SAME statement — logCall() itself never does this, but a bulk update
-- could), Postgres fires an AFTER ROW trigger once the WHOLE statement's
-- changes are already applied to the heap, so every one of those row
-- firings independently sees "remaining = 0" and each tries to top the
-- agent up — duplicating the batch and the notification. Rebuilt as a
-- single FOR EACH STATEMENT trigger with transition tables: it collects
-- every (company, agent) pair that had a genuine 0 -> >0 transition and
-- processes each pair exactly once per statement, no matter how many of
-- their rows changed together.

drop trigger if exists trg_auto_distribute_after_call on calling_app_contacts;
drop function if exists auto_distribute_after_call();

create or replace function auto_distribute_after_call() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_pair record;
  v_enabled boolean;
  v_batch_size int;
  v_remaining int;
  v_contact_ids uuid[];
  v_found int;
  v_agent_name text;
begin
  for v_pair in
    select distinct n.company_id, n.assigned_to
    from new_table n
    join old_table o on o.id = n.id
    where o.attempt_count = 0 and n.attempt_count > 0 and n.assigned_to is not null
  loop
    select auto_distribute_enabled, auto_distribute_batch_size
      into v_enabled, v_batch_size
    from calling_app_settings where company_id = v_pair.company_id;

    if not coalesce(v_enabled, false) then
      continue;
    end if;

    select count(*) into v_remaining
    from calling_app_contacts
    where company_id = v_pair.company_id and assigned_to = v_pair.assigned_to and attempt_count = 0;

    if v_remaining > 0 then
      continue;
    end if;

    select array_agg(id) into v_contact_ids
    from (
      select id from calling_app_contacts
      where company_id = v_pair.company_id and assigned_to is null
      order by created_at asc
      limit greatest(coalesce(v_batch_size, 50), 1)
      for update skip locked
    ) sub;

    v_found := coalesce(array_length(v_contact_ids, 1), 0);

    if v_found > 0 then
      update calling_app_contacts
      set assigned_to = v_pair.assigned_to, assigned_by = null, assigned_at = now()
      where id = any(v_contact_ids);

      insert into calling_app_notifications (company_id, recipient_admin_id, kind, message)
      values (v_pair.company_id, v_pair.assigned_to, 'leads_assigned',
        format('%s new lead(s) auto-assigned to you — your previous batch is complete.', v_found));
    end if;

    if v_found < coalesce(v_batch_size, 50) then
      select display_name into v_agent_name from calling_app_admins where id = v_pair.assigned_to;
      insert into calling_app_notifications (company_id, recipient_admin_id, kind, message)
      values (v_pair.company_id, null, 'pool_empty',
        case when v_found = 0
          then format('Master Sheet is empty — %s just finished their batch and got no new leads. Upload more data.', coalesce(v_agent_name, 'an agent'))
          else format('Master Sheet is running low — %s could only be given %s of %s requested leads. Upload more data soon.', coalesce(v_agent_name, 'an agent'), v_found, coalesce(v_batch_size, 50))
        end);
    end if;
  end loop;

  return null;
end;
$$;

create trigger trg_auto_distribute_after_call
  after update on calling_app_contacts
  referencing old table as old_table new table as new_table
  for each statement
  execute function auto_distribute_after_call();
