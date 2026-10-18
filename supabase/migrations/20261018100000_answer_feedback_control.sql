-- Answer feedback control: the trainer decides whether trainees are told "right / wrong" the moment they answer.
--
-- Until now every Live Quiz answer was answered with right/wrong, the correct option, the points and the explanation at
-- once, and exams followed one company-wide switch. Now:
--   quizzes.reveal_answers        : this quiz / exam's own choice (null = follow the company default)
--   quiz_settings.quiz_reveal_answers : company default for Live Quizzes (exams keep exam_reveal_answers)
--   quiz_sessions.reveal_answers  : frozen when a live session is launched, like exam_sessions.reveal_answers already is
-- The hiding is enforced in the database, not just on the screen: with answers hidden the submit functions return no
-- right/wrong flag, no answer key, no points and no explanation, and a trainee can no longer read their own graded rows
-- until the session has ended. Scoring, rankings, live control and the end-of-quiz review are unchanged.

alter table quizzes add column if not exists reveal_answers boolean;
alter table quiz_settings add column if not exists quiz_reveal_answers boolean not null default true;
alter table quiz_sessions add column if not exists reveal_answers boolean not null default true;

-- A trainee may read their own graded answers only while answers are shown, or once the session is over.
create or replace function quiz_answers_open_to_player(p_session_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.reveal_answers or s.phase = 'ended' from quiz_sessions s where s.id = p_session_id), false);
$$;

drop policy if exists quiz_answers_visible on quiz_answers;
create policy quiz_answers_visible on quiz_answers for select using (
  quiz_session_company_id(session_id) = current_quiz_admin_company_id()
  or (is_my_quiz_participant(participant_id) and quiz_answers_open_to_player(session_id))
);

CREATE OR REPLACE FUNCTION public.create_exam_session(p_quiz_id uuid, p_duration_seconds integer, p_start_in_seconds integer DEFAULT NULL::integer, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS SETOF exam_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_quiz record;
  v_opens timestamptz;
  v_pin text;
  v_row exam_sessions;
  v_reveal boolean;
  v_fb_seconds integer;
  v_fb_size text;
  i int;
begin
  select qz.company_id, qz.mode, qz.status, qz.reveal_answers into v_quiz from quizzes qz where qz.id = p_quiz_id;
  if v_quiz.company_id is null or v_quiz.company_id <> current_quiz_admin_company_id() or not current_quiz_admin_can_edit() then
    raise exception 'Exam not found or not authorized.';
  end if;
  if v_quiz.mode <> 'exam' then raise exception 'This is a Live Quiz, not an exam.'; end if;
  if v_quiz.status <> 'published' then raise exception 'Publish the exam before starting it.'; end if;
  if not quiz_module_enabled_for_company(v_quiz.company_id) then raise exception 'Live Quiz is not enabled for this company.'; end if;
  if not exists (select 1 from quiz_questions q where q.quiz_id = p_quiz_id and not q.is_hidden) then
    raise exception 'This exam has no visible questions.';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 60 or p_duration_seconds > 86400 then
    raise exception 'Duration must be between 1 minute and 24 hours.';
  end if;

  v_opens := case
    when p_start_at is not null then greatest(p_start_at, now())
    when p_start_in_seconds is not null and p_start_in_seconds > 0 then now() + make_interval(secs => p_start_in_seconds)
    else now()
  end;
  if v_opens > now() + interval '30 days' then raise exception 'Start time is too far ahead.'; end if;

  -- Freeze this exam's answer-reveal behaviour now, from ITS company's settings,
  -- so a later settings change never alters an exam already scheduled/running.
  select coalesce(s.exam_reveal_answers, true), coalesce(s.exam_hotspot_feedback_seconds, 3), coalesce(s.exam_hotspot_feedback_size, 'small')
    into v_reveal, v_fb_seconds, v_fb_size
  from (select 1) one left join quiz_settings s on s.company_id = v_quiz.company_id;

  -- This exam's own choice (set in the exam builder) wins over the company default.
  if v_quiz.reveal_answers is not null then v_reveal := v_quiz.reveal_answers; end if;

  for i in 1 .. 8 loop
    v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    begin
      insert into exam_sessions (quiz_id, company_id, host_admin_id, pin, duration_seconds, opens_at, deadline_at,
                                 reveal_answers, hotspot_feedback_seconds, hotspot_feedback_size)
      values (p_quiz_id, v_quiz.company_id,
        (select qa.id from quiz_admins qa where qa.auth_user_id = auth.uid() limit 1),
        v_pin, p_duration_seconds, v_opens, v_opens + make_interval(secs => p_duration_seconds),
        coalesce(v_reveal, true), coalesce(v_fb_seconds, 3), coalesce(v_fb_size, 'small'))
      returning * into v_row;
      return next v_row;
      return;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'Could not allocate a unique PIN. Please try again.';
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(p_session_id uuid, p_question_id uuid, p_option_id uuid, p_response_time_ms integer)
 RETURNS TABLE(is_correct boolean, correct_option_id uuid, points_awarded integer, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_correct boolean := false;
  v_correct_option uuid;
  v_marks int;
  v_max_timer int;
  v_points int := 0;
  v_phase text;
  v_company_id uuid;
  v_explanation text;
  v_started timestamptz;
  v_elapsed_ms int;
  v_reveal boolean;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id, question_started_at, reveal_answers into v_phase, v_company_id, v_started, v_reveal from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  -- Only the question currently on screen for THIS participant can be answered
  -- (previously any question id was accepted and its answer key returned).
  if p_question_id is distinct from quiz_current_question_id(p_session_id, v_participant_id) then
    raise exception 'That question is not the current one.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  if p_option_id is not null and not exists (
    select 1 from quiz_question_options qo where qo.id = p_option_id and qo.question_id = p_question_id
  ) then
    raise exception 'That option does not belong to this question.';
  end if;

  select qo.id into v_correct_option from quiz_question_options qo
  where qo.question_id = p_question_id and qo.is_correct = true limit 1;

  if p_option_id is not null and p_option_id = v_correct_option then
    v_correct := true;
  end if;

  select qq.marks, coalesce((select q2.timer_seconds from quiz_questions q2 join quiz_sessions s2 on s2.id = p_session_id where q2.id = s2.question_order[s2.current_question_index + 1]), qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

  -- Timing comes from the server clock (question_started_at is shifted on resume,
  -- so pauses are accounted for). The browser's figure is only trusted where it is
  -- plausible: never lower than server time minus network slack, never negative.
  v_elapsed_ms := case when v_started is null then null
    else least(2000000000, (extract(epoch from (now() - v_started)) * 1000)::bigint)::int end;
  if v_elapsed_ms is not null and v_elapsed_ms > v_max_timer * 1000 + 3000 then
    raise exception 'Time is up for this question.';
  end if;
  p_response_time_ms := least(v_max_timer * 1000, greatest(coalesce(p_response_time_ms, 0), coalesce(v_elapsed_ms, 0) - 1500, 0));

  if v_correct then
    v_points := v_marks * 1000 + greatest(0, round((1 - (p_response_time_ms::numeric / (v_max_timer * 1000))) * 500))::int;
  end if;

  insert into quiz_answers (session_id, participant_id, question_id, selected_option_id, is_correct, response_time_ms)
  values (p_session_id, v_participant_id, p_question_id, p_option_id, v_correct, p_response_time_ms)
  on conflict (participant_id, question_id) do nothing;

  if found then
    update quiz_participants
    set score = score + v_points,
        correct_count = correct_count + (case when v_correct then 1 else 0 end),
        total_response_time_ms = total_response_time_ms + p_response_time_ms
    where id = v_participant_id;
  end if;

  -- With answers hidden the browser is told nothing about right or wrong (no flag, no answer key, no points, no explanation).
  return query select
    case when v_reveal then v_correct end,
    case when v_reveal then v_correct_option end,
    case when v_reveal then v_points else 0 end,
    case when v_reveal then v_explanation end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_quiz_hotspot_answer(p_session_id uuid, p_question_id uuid, p_click_x numeric, p_click_y numeric, p_response_time_ms integer)
 RETURNS TABLE(is_correct boolean, target_x numeric, target_y numeric, target_radius numeric, points_awarded integer, explanation text, hotspot_zones jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_correct boolean := false;
  v_target_x numeric;
  v_target_y numeric;
  v_target_radius numeric;
  v_zones jsonb;
  v_marks int;
  v_max_timer int;
  v_points int := 0;
  v_phase text;
  v_company_id uuid;
  v_explanation text;
  v_started timestamptz;
  v_elapsed_ms int;
  v_reveal boolean;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id, question_started_at, reveal_answers into v_phase, v_company_id, v_started, v_reveal from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  -- Only the question currently on screen for THIS participant can be answered
  -- (previously any question id was accepted and its answer key returned).
  if p_question_id is distinct from quiz_current_question_id(p_session_id, v_participant_id) then
    raise exception 'That question is not the current one.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select qq.target_x, qq.target_y, coalesce(qq.target_radius, 6), qq.hotspot_zones, qq.marks,
    coalesce((select q2.timer_seconds from quiz_questions q2 join quiz_sessions s2 on s2.id = p_session_id where q2.id = s2.question_order[s2.current_question_index + 1]), qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_target_x, v_target_y, v_target_radius, v_zones, v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

  v_elapsed_ms := case when v_started is null then null
    else least(2000000000, (extract(epoch from (now() - v_started)) * 1000)::bigint)::int end;
  if v_elapsed_ms is not null and v_elapsed_ms > v_max_timer * 1000 + 3000 then
    raise exception 'Time is up for this question.';
  end if;
  p_response_time_ms := least(v_max_timer * 1000, greatest(coalesce(p_response_time_ms, 0), coalesce(v_elapsed_ms, 0) - 1500, 0));

  if p_click_x is not null and p_click_y is not null then
    if v_zones is not null and jsonb_typeof(v_zones) = 'array' and jsonb_array_length(v_zones) > 0 then
      v_correct := hotspot_zone_hit(v_zones, p_click_x, p_click_y);
    elsif v_target_x is not null and v_target_y is not null then
      v_correct := sqrt(power(p_click_x - v_target_x, 2) + power(p_click_y - v_target_y, 2)) <= v_target_radius;
    end if;
  end if;

  if v_correct then
    v_points := v_marks * 1000 + greatest(0, round((1 - (p_response_time_ms::numeric / (v_max_timer * 1000))) * 500))::int;
  end if;

  insert into quiz_answers (session_id, participant_id, question_id, click_x, click_y, is_correct, response_time_ms)
  values (p_session_id, v_participant_id, p_question_id, p_click_x, p_click_y, v_correct, p_response_time_ms)
  on conflict (participant_id, question_id) do nothing;

  if found then
    update quiz_participants
    set score = score + v_points,
        correct_count = correct_count + (case when v_correct then 1 else 0 end),
        total_response_time_ms = total_response_time_ms + p_response_time_ms
    where id = v_participant_id;
  end if;

  -- With answers hidden nothing about the correct spot leaves the database.
  return query select
    case when v_reveal then v_correct end,
    case when v_reveal then v_target_x end,
    case when v_reveal then v_target_y end,
    case when v_reveal then v_target_radius end,
    case when v_reveal then v_points else 0 end,
    case when v_reveal then v_explanation end,
    case when v_reveal then v_zones end;
end;
$function$;

-- Help Center
insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Showing or Hiding Right / Wrong While Trainees Answer', 8, 'reveal, right, wrong, instant feedback, hide answers, results, exam, live quiz, answer key',
$art$<p>You decide whether a trainee is told <strong>right or wrong</strong> the moment they answer, or only when the results come out.</p>
<h2>Where to set it</h2>
<ul>
<li><strong>For one quiz or exam:</strong> open it in the builder and use <em>Tell players / candidates right / wrong while they answer</em> — Follow my default, Show immediately, or Hide.</li>
<li><strong>Your default for Live Quizzes:</strong> Quiz Settings → Appearance → <em>Tell players right / wrong the moment they answer</em>.</li>
<li><strong>Your default for exams:</strong> Exams page → <em>Instant Answer Feedback</em>.</li>
</ul>
<h2>What hidden means</h2>
<p>The screen only says the answer was recorded — nothing about right or wrong, points, the correct option or the explanation. It is also not sent to the phone, so it cannot be found by looking behind the screen. Scores, rankings and the final review work exactly as before.</p>
<p>The choice is frozen when you launch the quiz or start the exam, so changing a setting later never alters one that is already running.</p>$art$
where not exists (select 1 from help_articles where title = 'Showing or Hiding Right / Wrong While Trainees Answer');
