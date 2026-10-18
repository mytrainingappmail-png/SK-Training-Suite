-- "Move ahead": a trainer can let players press Next as soon as they have answered, instead of everyone waiting for the host.
--
-- Everything about the host stays as it is: the host's question, timer, auto-advance, the safety-net heartbeat, pause / resume,
-- leaderboard and results. Only a player who has pressed Next is on their own, later question — and they are never pulled
-- backwards or left behind: a player is always on the LATER of "the host's question" and "my own question", and the database
-- is the only clock (the browser's clock never decides anything).
--
--   quizzes.allow_early_next              : this quiz's choice (null = follow the company default)
--   quiz_settings.quiz_allow_early_next   : company default (off)
--   quiz_sessions.allow_early_next        : frozen when the quiz is launched
--   quiz_participants.my_index / my_q_started_at : where a player who moved ahead is, and when they got there
-- With the option off nothing changes: every function below returns exactly what it returned before.

alter table quizzes add column if not exists allow_early_next boolean;
alter table quiz_settings add column if not exists quiz_allow_early_next boolean not null default false;
alter table quiz_sessions add column if not exists allow_early_next boolean not null default false;
alter table quiz_participants add column if not exists my_index integer;
alter table quiz_participants add column if not exists my_q_started_at timestamptz;

-- Where is THIS player in the quiz? Normally on the host's question. With "move ahead" switched on, a player who pressed
-- Next is on their own (later) question — with their own start time — until the host's question catches up with them.
-- When the option is off, or the player never moved ahead, this is exactly the host's question and start time.
create or replace function quiz_effective_position(p_session_id uuid, p_participant_id uuid)
returns table (idx int, started_at timestamptz, ahead boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_idx int; v_started timestamptz; v_allow boolean; v_my int; v_my_started timestamptz;
begin
  select s.current_question_index, s.question_started_at, s.allow_early_next into v_idx, v_started, v_allow
  from quiz_sessions s where s.id = p_session_id;
  if not found then return; end if;
  if v_allow then
    select p.my_index, p.my_q_started_at into v_my, v_my_started
    from quiz_participants p where p.id = p_participant_id and p.session_id = p_session_id;
    if v_my is not null and v_my >= v_idx then
      return query select v_my, v_my_started, (v_my > v_idx);
      return;
    end if;
  end if;
  return query select v_idx, v_started, false;
end $$;

CREATE OR REPLACE FUNCTION public.quiz_current_question_id(p_session_id uuid, p_participant_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_quiz uuid;
  v_idx int;
  v_order uuid[];
  v_shuffle boolean;
  v_qid uuid;
begin
  select quiz_id, current_question_index, question_order into v_quiz, v_idx, v_order
  from quiz_sessions where id = p_session_id and phase = 'question';
  if v_quiz is null then return null; end if;
  select e.idx into v_idx from quiz_effective_position(p_session_id, p_participant_id) e;

  select coalesce(shuffle_questions_per_participant, false) into v_shuffle from quizzes where id = v_quiz;

  if v_shuffle then
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz and not qq.is_hidden
    order by md5(qq.id::text || p_participant_id::text)
    offset v_idx limit 1;
  elsif v_order is not null and v_idx < array_length(v_order, 1) then
    v_qid := v_order[v_idx + 1];
  else
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz and not qq.is_hidden order by qq.display_order limit 1 offset v_idx;
  end if;
  return v_qid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_quiz_question(p_session_id uuid)
 RETURNS TABLE(question_id uuid, question_text text, type text, timer_seconds integer, question_index integer, total_questions integer, option_id uuid, option_text text, option_order integer, image_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_quiz_id uuid;
  v_company_id uuid;
  v_idx int;
  v_qid uuid;
  v_order uuid[];
  v_shuffle_options boolean;
  v_shuffle_per_participant boolean;
begin
  select id into v_participant_id
  from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select quiz_id, company_id, current_question_index, question_order
    into v_quiz_id, v_company_id, v_idx, v_order
  from quiz_sessions where id = p_session_id and phase = 'question';
  if v_quiz_id is null then
    return;
  end if;
  select e.idx into v_idx from quiz_effective_position(p_session_id, v_participant_id) e;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select shuffle_options, coalesce(shuffle_questions_per_participant, false)
    into v_shuffle_options, v_shuffle_per_participant
  from quizzes where id = v_quiz_id;

  if v_shuffle_per_participant then
    -- Same technique already used for per-participant option shuffling —
    -- a stable hash of (question id, participant id) as the sort key gives
    -- each participant their own consistent-across-refreshes but
    -- different-from-everyone-else ordering of the same question set.
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz_id and not qq.is_hidden
    order by md5(qq.id::text || v_participant_id::text)
    offset v_idx limit 1;
  elsif v_order is not null and v_idx < array_length(v_order, 1) then
    v_qid := v_order[v_idx + 1]; -- postgres arrays are 1-indexed
  else
    -- Defensive fallback only — the client always builds question_order
    -- pre-filtered to visible questions at launch, so this path is not
    -- expected to run in practice, but stays consistent if it ever does.
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz_id and not qq.is_hidden order by qq.display_order limit 1 offset v_idx;
  end if;

  if v_qid is null then
    return;
  end if;

  return query
  select
    qq.id, qq.question_text, qq.type, coalesce((select q2.timer_seconds from quiz_questions q2 where q2.id = v_order[v_idx + 1]), qq.timer_seconds, qz.default_timer_seconds),
    v_idx, coalesce(array_length(v_order, 1), (select count(*) from quiz_questions where quiz_id = v_quiz_id and not is_hidden)::int),
    qo.id, qo.option_text,
    (case when v_shuffle_options
      then row_number() over (order by md5(qo.id::text || v_participant_id::text))
      else row_number() over (order by qo.display_order)
    end)::int as option_order,
    qq.image_url
  from quiz_questions qq
  join quizzes qz on qz.id = qq.quiz_id
  left join quiz_question_options qo on qo.question_id = qq.id
  where qq.id = v_qid
  order by option_order;
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
  v_eff_idx int;
  v_elapsed_ms int;
  v_reveal boolean;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id, question_started_at, reveal_answers into v_phase, v_company_id, v_started, v_reveal from quiz_sessions where id = p_session_id;
  -- the question and start time that apply to THIS player (the host's, unless they moved ahead)
  select e.idx, e.started_at into v_eff_idx, v_started from quiz_effective_position(p_session_id, v_participant_id) e;
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

  select qq.marks, coalesce((select q2.timer_seconds from quiz_questions q2 join quiz_sessions s2 on s2.id = p_session_id where q2.id = s2.question_order[v_eff_idx + 1]), qq.timer_seconds, qz.default_timer_seconds), qq.explanation
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
  v_eff_idx int;
  v_elapsed_ms int;
  v_reveal boolean;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id, question_started_at, reveal_answers into v_phase, v_company_id, v_started, v_reveal from quiz_sessions where id = p_session_id;
  -- the question and start time that apply to THIS player (the host's, unless they moved ahead)
  select e.idx, e.started_at into v_eff_idx, v_started from quiz_effective_position(p_session_id, v_participant_id) e;
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
    coalesce((select q2.timer_seconds from quiz_questions q2 join quiz_sessions s2 on s2.id = p_session_id where q2.id = s2.question_order[v_eff_idx + 1]), qq.timer_seconds, qz.default_timer_seconds), qq.explanation
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

CREATE OR REPLACE FUNCTION public.resume_quiz_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_paused_at timestamptz;
  v_started_at timestamptz;
begin
  select paused_at, question_started_at into v_paused_at, v_started_at
  from quiz_sessions
  where id = p_session_id
    and company_id = current_quiz_admin_company_id()
    and current_quiz_admin_can_edit();

  if not found then
    raise exception 'Session not found or not authorized.';
  end if;

  update quiz_sessions
  set phase = 'question',
      -- Shift the question's start point forward by exactly how long the
      -- pause lasted, so whatever time was left when paused is still left
      -- now — not "already expired" (the old bug) and not "reset to the
      -- full timer" (unfair to whoever already used some of it).
      question_started_at = case
        when v_paused_at is not null and v_started_at is not null
          then v_started_at + (now() - v_paused_at)
        else v_started_at
      end,
      paused_at = null
  where id = p_session_id;

  -- A player who moved ahead has their own question clock: the pause must not eat their time either.
  if v_paused_at is not null then
    update quiz_participants
    set my_q_started_at = my_q_started_at + (now() - v_paused_at)
    where session_id = p_session_id and my_index is not null and my_q_started_at is not null;
  end if;
end;
$function$;

-- Where am I? (for the player's screen)
create or replace function get_my_quiz_position(p_session_id uuid)
returns table (question_index int, started_at timestamptz, ahead boolean, finished boolean, total_questions int, allow_early_next boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_pid uuid; v_allow boolean; v_order uuid[]; v_quiz uuid; v_host int; v_total int; v_idx int; v_started timestamptz;
begin
  select id into v_pid from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid();
  if v_pid is null then raise exception 'Not a participant in this session.'; end if;
  select s.allow_early_next, s.question_order, s.quiz_id, s.current_question_index into v_allow, v_order, v_quiz, v_host
  from quiz_sessions s where s.id = p_session_id;
  select e.idx, e.started_at into v_idx, v_started from quiz_effective_position(p_session_id, v_pid) e;
  v_total := coalesce(array_length(v_order, 1), (select count(*) from quiz_questions q where q.quiz_id = v_quiz and not q.is_hidden)::int);
  return query select v_idx, v_started, (coalesce(v_allow, false) and v_idx > v_host), v_idx >= v_total, v_total, coalesce(v_allow, false);
end $$;

-- "Next": move ME to the next question. Only allowed once I have answered the current one (or its time is up), never while the
-- quiz is paused or I am paused, and a second tap on the same question changes nothing.
create or replace function quiz_move_ahead(p_session_id uuid, p_from_index int default null)
returns table (question_index int, started_at timestamptz, finished boolean, moved boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_stopped timestamptz; v_phase text; v_allow boolean; v_order uuid[]; v_quiz uuid;
  v_idx int; v_started timestamptz; v_total int; v_qid uuid; v_timer int; v_answered boolean;
begin
  select p.id, p.stopped_at into v_pid, v_stopped
  from quiz_participants p where p.session_id = p_session_id and p.auth_user_id = auth.uid() for update;
  if v_pid is null then raise exception 'Not a participant in this session.'; end if;

  select s.phase, s.allow_early_next, s.question_order, s.quiz_id into v_phase, v_allow, v_order, v_quiz
  from quiz_sessions s where s.id = p_session_id;
  if not coalesce(v_allow, false) then raise exception 'Moving ahead is not switched on for this quiz.'; end if;
  if v_phase <> 'question' then raise exception 'The quiz is not running right now.'; end if;
  if v_stopped is not null then raise exception 'The host has paused you. Please wait — you can play again when they resume you.'; end if;

  v_total := coalesce(array_length(v_order, 1), 0);
  select e.idx, e.started_at into v_idx, v_started from quiz_effective_position(p_session_id, v_pid) e;

  -- a stale or double tap: report where the player is, change nothing
  if (p_from_index is not null and p_from_index <> v_idx) or v_idx >= v_total then
    return query select v_idx, v_started, v_idx >= v_total, false;
    return;
  end if;

  v_qid := quiz_current_question_id(p_session_id, v_pid);
  v_answered := v_qid is not null and exists (select 1 from quiz_answers a where a.participant_id = v_pid and a.question_id = v_qid);
  select coalesce(
           (select q2.timer_seconds from quiz_questions q2 where q2.id = v_order[v_idx + 1]),
           (select qq.timer_seconds from quiz_questions qq where qq.id = v_qid),
           (select qz.default_timer_seconds from quizzes qz where qz.id = v_quiz), 30)
    into v_timer;
  if not v_answered and not (v_started is not null and now() >= v_started + make_interval(secs => v_timer)) then
    raise exception 'Answer this question first.';
  end if;

  update quiz_participants
  set my_index = v_idx + 1,
      my_q_started_at = case when v_idx + 1 >= v_total then null else now() end
  where id = v_pid;

  select e.idx, e.started_at into v_idx, v_started from quiz_effective_position(p_session_id, v_pid) e;
  return query select v_idx, v_started, v_idx >= v_total, true;
end $$;

revoke all on function get_my_quiz_position(uuid) from public, anon;
grant execute on function get_my_quiz_position(uuid) to authenticated;
revoke all on function quiz_move_ahead(uuid, int) from public, anon;
grant execute on function quiz_move_ahead(uuid, int) to authenticated;
revoke all on function quiz_effective_position(uuid, uuid) from public, anon;
grant execute on function quiz_effective_position(uuid, uuid) to authenticated;

-- Help Center
insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Letting Players Move Ahead When They Finish Early', 9, 'next, move ahead, early, self paced, faster, skip waiting, live quiz, host',
$art$<p>Normally every player waits for the host to move to the next question. You can let players <strong>move ahead on their own</strong> as soon as they have answered.</p>
<h2>Where to switch it on</h2>
<ul>
<li><strong>For one quiz:</strong> open it in the builder → <em>Let players move ahead when they finish early</em> → Follow my default / Allow / Do not allow.</li>
<li><strong>Your default:</strong> Quiz Settings → Appearance → <em>Let players move ahead when they finish early</em> (off to begin with).</li>
</ul>
<p>The choice is frozen when you launch the quiz.</p>
<h2>What happens</h2>
<ul>
<li>After answering, a player sees a <strong>Next question →</strong> button. Pressing it moves only that player; the next question gets its own full timer.</li>
<li>Your host screen, timer, leaderboard and results work exactly as before. You also see how many players are ahead.</li>
<li>Nobody gets stuck: a player who does not press Next is moved on when your question moves on, and pausing the quiz pauses everyone's timer, including players who are ahead.</li>
<li>A player who finishes every question sees “waiting for the others” until you end the quiz or the last question's time runs out.</li>
</ul>
<p>Players who move ahead see upcoming questions earlier than the room, so use it for practice and training quizzes rather than strict tests.</p>$art$
where not exists (select 1 from help_articles where title = 'Letting Players Move Ahead When They Finish Early');
