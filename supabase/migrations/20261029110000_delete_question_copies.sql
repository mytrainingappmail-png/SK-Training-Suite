-- Deleting a question that also lives in other tests: the trainer may choose to delete it from those tests too.
-- Same rules as sync_question_copies: only a quiz admin who can edit, only this company's tests, and a test that is running or
-- scheduled right now is left alone (reported with deleted = false).
create or replace function delete_question_copies(p_exclude_quiz uuid, p_origin_uids uuid[])
returns table (
  r_quiz_id uuid,
  r_title text,
  r_code text,
  r_deleted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := current_quiz_admin_company_id();
  c record;
begin
  if v_company is null or not current_quiz_admin_can_edit() then
    raise exception 'You are not allowed to delete questions.';
  end if;
  if p_exclude_quiz is not null and not exists (select 1 from quizzes z where z.id = p_exclude_quiz and z.company_id = v_company) then
    raise exception 'Test not found.';
  end if;

  for c in
    select q.id as qid, z.id as zid, z.title as ztitle, z.code as zcode
    from quiz_questions q
    join quizzes z on z.id = q.quiz_id
    where q.origin_uid = any (p_origin_uids)
      and z.company_id = v_company
      and (p_exclude_quiz is null or z.id <> p_exclude_quiz)
    order by z.code
  loop
    if quiz_is_in_use(c.zid) then
      return query select c.zid, c.ztitle, c.zcode, false;
      continue;
    end if;
    delete from quiz_questions where id = c.qid;
    return query select c.zid, c.ztitle, c.zcode, true;
  end loop;
end;
$$;

grant execute on function delete_question_copies(uuid, uuid[]) to authenticated;
