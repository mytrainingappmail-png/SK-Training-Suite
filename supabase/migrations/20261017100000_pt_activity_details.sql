-- Performance Tracker: optional ACTIVITY DETAILS behind the daily numbers.
--
-- The morning plan and the evening report only ever stored COUNTS (2 F2F, 1 site visit, 1 booking...). A manager
-- could not see WHICH project, at what time, with which client. This adds, all optional and never blocking a submit:
--   pt_commitments.plan_details     : planned meetings  { f2f:[{project,time,client,mobile,note}], sv:[...], revisit:[...] }
--   pt_reports.activity_details     : what happened     { f2f:[{...,status:'done'|'missed',planned:bool,planned_as}], sv, revisit,
--                                                          bookings:[{client,mobile,project,unit,amount,note}],
--                                                          calling:{prospects,note} }
-- The counts, the scoring trigger and every existing report are untouched — details only sit beside them.
-- Admin control (pt_settings): switch details on/off, which boxes employees see, whether the project list is offered,
-- and who may read other people's details.

alter table pt_commitments add column if not exists plan_details jsonb not null default '{}'::jsonb;
alter table pt_reports add column if not exists activity_details jsonb not null default '{}'::jsonb;

alter table pt_settings add column if not exists details_enabled boolean not null default true;
alter table pt_settings add column if not exists details_ask_time boolean not null default true;
alter table pt_settings add column if not exists details_ask_client boolean not null default true;
alter table pt_settings add column if not exists details_ask_mobile boolean not null default false;
alter table pt_settings add column if not exists details_ask_writeup boolean not null default true;
alter table pt_settings add column if not exists details_use_projects boolean not null default true;
alter table pt_settings add column if not exists details_visibility text not null default 'managers';

do $$ begin
  alter table pt_settings add constraint pt_settings_details_visibility_check check (details_visibility in ('managers', 'team'));
exception when duplicate_object then null; end $$;
