-- Performance Tracker — the 6 tracked metrics (F2F, Site Visits, Revisits,
-- Calls, Connected, Talk time) were fixed, named columns: an admin could
-- retune their NUMBERS (min_f2f etc., already editable) but could not
-- turn one off ("delete" it) or add a genuinely new SCORED metric of
-- their own — pt_custom_fields already let them add a field, but it was
-- wired to be purely decorative (tracked, never counted toward Score or
-- the minimum-criteria gate).
--
-- This adds:
--   1. An enabled/disabled flag per core metric — the admin's "delete"
--      for one they don't use. Disabled metrics drop out of Score,
--      Achievement %, and the minimum-criteria check; existing historical
--      data is untouched (this only changes how NEW reports are scored).
--   2. counts_toward_score / score_weight / min_threshold on
--      pt_custom_fields — the admin's "add": opting a custom field into
--      the same scoring machinery the 6 core metrics use, rather than
--      inventing a parallel system.
-- Bookings has no enabled flag — it's the one outcome metric every real
-- estate sales flow cares about regardless of activity mix, so it always
-- counts.

alter table pt_settings
  add column f2f_enabled boolean not null default true,
  add column sv_enabled boolean not null default true,
  add column revisit_enabled boolean not null default true,
  add column calls_enabled boolean not null default true,
  add column conn_enabled boolean not null default true,
  add column talk_enabled boolean not null default true;

alter table pt_custom_fields
  add column counts_toward_score boolean not null default false,
  add column score_weight numeric not null default 0,
  add column min_threshold numeric;

create or replace function pt_reports_compute_score() returns trigger
language plpgsql security definer
as $$
declare
  v_settings pt_settings%rowtype;
  v_commit pt_commitments%rowtype;
  v_sum numeric := 0;
  v_n int := 0;
  v_score numeric := 0;
  v_min_ok boolean := true;
  v_field record;
  v_value numeric;
begin
  select * into v_settings from pt_settings where company_id = new.company_id;
  if not found then
    insert into pt_settings (company_id) values (new.company_id)
    on conflict (company_id) do nothing;
    select * into v_settings from pt_settings where company_id = new.company_id;
  end if;

  if v_settings.f2f_enabled then v_score := v_score + new.f2f_done * v_settings.score_f2f; end if;
  if v_settings.sv_enabled then v_score := v_score + new.sv_done * v_settings.score_sv; end if;
  if v_settings.revisit_enabled then v_score := v_score + new.revisit_done * v_settings.score_revisit; end if;
  v_score := v_score + new.bookings * v_settings.score_booking;
  if v_settings.conn_enabled then v_score := v_score + new.conn_done * v_settings.score_conn; end if;
  if v_settings.talk_enabled then v_score := v_score + floor(new.talk_done / 5.0) * v_settings.score_talk_per5; end if;

  select * into v_commit from pt_commitments where employee_id = new.employee_id and work_date = new.work_date;

  if found then
    if v_settings.f2f_enabled and v_commit.f2f_planned > 0 then
      v_sum := v_sum + least((new.f2f_done::numeric / v_commit.f2f_planned) * 100, 150);
      v_n := v_n + 1;
    end if;
    if v_settings.sv_enabled and v_commit.sv_planned > 0 then
      v_sum := v_sum + least((new.sv_done::numeric / v_commit.sv_planned) * 100, 150);
      v_n := v_n + 1;
    end if;
    if v_settings.calls_enabled and v_commit.calls_planned > 0 then
      v_sum := v_sum + least((new.calls_done::numeric / v_commit.calls_planned) * 100, 150);
      v_n := v_n + 1;
    end if;
  end if;

  v_min_ok := true;
  if v_settings.f2f_enabled and new.f2f_done < v_settings.min_f2f then v_min_ok := false; end if;
  if v_settings.sv_enabled and new.sv_done < v_settings.min_sv then v_min_ok := false; end if;
  if v_settings.revisit_enabled and new.revisit_done < v_settings.min_revisit then v_min_ok := false; end if;
  if v_settings.calls_enabled and new.calls_done < v_settings.min_calls then v_min_ok := false; end if;
  if v_settings.conn_enabled and new.conn_done < v_settings.min_conn then v_min_ok := false; end if;
  if v_settings.talk_enabled and new.talk_done < v_settings.min_talk then v_min_ok := false; end if;

  for v_field in
    select field_key, score_weight, min_threshold
    from pt_custom_fields
    where company_id = new.company_id and is_active and applies_evening and counts_toward_score
  loop
    v_value := coalesce((new.custom_values ->> v_field.field_key)::numeric, 0);
    v_score := v_score + v_value * v_field.score_weight;
    if v_field.min_threshold is not null and v_value < v_field.min_threshold then
      v_min_ok := false;
    end if;
  end loop;

  new.score := v_score;
  new.achievement_pct := case when v_n > 0 then round(v_sum / v_n, 1) else null end;
  new.min_criteria_met := v_min_ok;

  new.submitted_at := coalesce(new.submitted_at, now());
  return new;
end;
$$;
