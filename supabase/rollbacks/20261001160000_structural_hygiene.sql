-- Rollback for 20261001160000_structural_hygiene.sql
-- (Indexes and search_path settings are harmless and left in place.)

-- Foreign keys back to ON DELETE CASCADE
do $$
declare r record; v_def text;
begin
  for r in
    select c.conrelid::regclass::text as tbl, c.conname
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
      and ((c.conrelid = 'employees'::regclass and a.attname in ('branch_id','department_id','designation_id'))
        or (c.conrelid = 'departments'::regclass and a.attname = 'branch_id')
        or (c.conrelid = 'designations'::regclass and a.attname in ('department_id','branch_id'))
        )
  loop
    select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = r.conname and conrelid = r.tbl::regclass;
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, replace(v_def, ' DEFERRABLE INITIALLY DEFERRED', '') || ' ON DELETE CASCADE');
  end loop;
end $$;

-- Give anon execute back on the functions the migration closed
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.proname = any (array['advance_quiz_session','check_hotspot_tap','create_exam_session','end_exam_session','end_quiz_session',
        'extend_exam_session','flag_exam_tab_switch','get_current_quiz_question','get_exam_paper','get_exam_state','join_exam_session',
        'join_quiz_session','save_exam_answer','start_exam_now','start_quiz_session','submit_exam','submit_quiz_answer','submit_quiz_hotspot_answer'])
  loop execute format('grant execute on function %s to anon', r.sig); end loop;
end $$;
