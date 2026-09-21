-- Hotspot questions: more than one correct area, and shapes other than a
-- circle. A road or an "area" (New Gurgaon, Golf Course Road) isn't a
-- point, and a landmark can reasonably be tapped in more than one place.
--
-- hotspot_zones is a JSON array; each zone is one of
--   {"shape":"circle","x":..,"y":..,"r":..}
--   {"shape":"rect","x":..,"y":..,"w":..,"h":..}        (x,y = top-left)
--   {"shape":"poly","points":[[x,y],[x,y],...]}
-- all in the same 0-100 "percent of the image" space the old single
-- target_x/target_y/target_radius already used. A tap inside ANY zone is
-- correct. When hotspot_zones is null/empty the old single circle is still
-- honoured, so every existing question keeps working untouched.
alter table quiz_questions add column if not exists hotspot_zones jsonb;

create or replace function hotspot_zone_hit(p_zones jsonb, p_x numeric, p_y numeric)
returns boolean
language plpgsql
immutable
as $function$
declare
  z jsonb;
  pts jsonb;
  n int;
  i int;
  j int;
  inside boolean;
  xi numeric; yi numeric; xj numeric; yj numeric;
  shape text;
begin
  if p_zones is null or jsonb_typeof(p_zones) <> 'array' then
    return false;
  end if;

  for z in select * from jsonb_array_elements(p_zones) loop
    shape := z->>'shape';
    if shape = 'circle' then
      if sqrt(power(p_x - (z->>'x')::numeric, 2) + power(p_y - (z->>'y')::numeric, 2)) <= (z->>'r')::numeric then
        return true;
      end if;
    elsif shape = 'rect' then
      if p_x >= (z->>'x')::numeric and p_x <= (z->>'x')::numeric + (z->>'w')::numeric
         and p_y >= (z->>'y')::numeric and p_y <= (z->>'y')::numeric + (z->>'h')::numeric then
        return true;
      end if;
    elsif shape = 'poly' then
      pts := z->'points';
      n := coalesce(jsonb_array_length(pts), 0);
      if n >= 3 then
        inside := false;
        j := n - 1;
        for i in 0 .. n - 1 loop
          xi := (pts->i->>0)::numeric; yi := (pts->i->>1)::numeric;
          xj := (pts->j->>0)::numeric; yj := (pts->j->>1)::numeric;
          if ((yi > p_y) <> (yj > p_y)) and (p_x < (xj - xi) * (p_y - yi) / (yj - yi) + xi) then
            inside := not inside;
          end if;
          j := i;
        end loop;
        if inside then
          return true;
        end if;
      end if;
    end if;
  end loop;

  return false;
end;
$function$;

-- Return signature gains hotspot_zones, which CREATE OR REPLACE can't do in place.
drop function if exists submit_quiz_hotspot_answer(uuid, uuid, numeric, numeric, integer);

create or replace function submit_quiz_hotspot_answer(p_session_id uuid, p_question_id uuid, p_click_x numeric, p_click_y numeric, p_response_time_ms integer)
returns table(is_correct boolean, target_x numeric, target_y numeric, target_radius numeric, points_awarded integer, explanation text, hotspot_zones jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id into v_phase, v_company_id from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select qq.target_x, qq.target_y, coalesce(qq.target_radius, 6), qq.hotspot_zones, qq.marks,
    coalesce(qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_target_x, v_target_y, v_target_radius, v_zones, v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

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

  return query select v_correct, v_target_x, v_target_y, v_target_radius, v_points, v_explanation, v_zones;
end;
$function$;

drop function if exists get_my_answer_review(uuid);

create or replace function get_my_answer_review(p_session_id uuid)
returns table(question_index integer, question_text text, explanation text, type text, option_id uuid, option_text text, is_correct boolean, was_chosen boolean, image_url text, target_x numeric, target_y numeric, target_radius numeric, click_x numeric, click_y numeric, hotspot_is_correct boolean, hotspot_zones jsonb)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_participant_id uuid;
  v_phase text;
  v_quiz_id uuid;
begin
  select qp.id into v_participant_id from quiz_participants qp
  where qp.session_id = p_session_id and qp.auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, quiz_id into v_phase, v_quiz_id from quiz_sessions where id = p_session_id;
  if v_phase <> 'ended' then
    raise exception 'Review is only available after the quiz ends.';
  end if;

  return query
  select qq.display_order, qq.question_text, qq.explanation, qq.type,
    qo.id, qo.option_text, qo.is_correct,
    (qa.selected_option_id = qo.id),
    qq.image_url, qq.target_x, qq.target_y, qq.target_radius,
    qa.click_x, qa.click_y, qa.is_correct, qq.hotspot_zones
  from quiz_questions qq
  left join quiz_question_options qo on qo.question_id = qq.id
  left join quiz_answers qa on qa.question_id = qq.id and qa.participant_id = v_participant_id
  where qq.quiz_id = v_quiz_id and not qq.is_hidden
  order by qq.display_order, qo.display_order;
end;
$function$;
