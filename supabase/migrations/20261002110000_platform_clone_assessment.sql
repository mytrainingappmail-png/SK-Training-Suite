-- Content Distribution: send a TEST together with the content it belongs to.
--
-- Until now, when the owner pushed a course / induction day / project to a customer, the test
-- inside it was left behind (the copy kept an empty "test" slot). This lets the owner's push copy
-- the whole test — its settings, questions and answers — into the customer's own workspace.
--
-- Only the platform owner can call it. Customers get their own independent copy.

create or replace function public.platform_clone_assessment(p_source uuid, p_target_company uuid, p_lesson uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid := gen_random_uuid();
  v_question record;
  v_new_question uuid;
begin
  if not public.current_company_is_platform_operator() then
    raise exception 'Only the platform owner can send tests to other companies.';
  end if;
  if not exists (select 1 from companies where id = p_target_company) then
    raise exception 'Target company not found.';
  end if;

  insert into assessments
    select r.*
    from assessments a
    cross join lateral jsonb_populate_record(null::assessments, to_jsonb(a) || jsonb_build_object(
      'id', v_new,
      'company_id', p_target_company,
      'lesson_id', p_lesson,
      'assessment_code', 'T-' || upper(substr(md5(gen_random_uuid()::text), 1, 12)),
      'created_at', now(), 'updated_at', now())) r
    where a.id = p_source;
  if not found then
    raise exception 'Test not found.';
  end if;

  for v_question in select * from question_bank where assessment_id = p_source order by display_order loop
    v_new_question := gen_random_uuid();
    insert into question_bank
      select r.* from jsonb_populate_record(null::question_bank, to_jsonb(v_question) || jsonb_build_object(
        'id', v_new_question,
        'assessment_id', v_new,
        'question_code', 'q-' || substr(md5(gen_random_uuid()::text), 1, 12),
        'created_at', now(), 'updated_at', now())) r;
    insert into question_options
      select r.* from question_options o
      cross join lateral jsonb_populate_record(null::question_options, to_jsonb(o) || jsonb_build_object(
        'id', gen_random_uuid(), 'question_id', v_new_question, 'created_at', now())) r
      where o.question_id = v_question.id;
  end loop;

  return v_new;
end;
$$;

revoke all on function public.platform_clone_assessment(uuid, uuid, uuid) from public, anon;
grant execute on function public.platform_clone_assessment(uuid, uuid, uuid) to authenticated;
