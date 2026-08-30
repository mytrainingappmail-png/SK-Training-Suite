-- Public read of a survey's appearance settings (option colors/font
-- size) — survey_settings itself has no anon policy (admin-only, same
-- as quiz_settings), so the taking page needs its own narrow,
-- security-definer window into just these two display values, resolved
-- by access_code the same way get_survey_by_code is.

create or replace function get_survey_public_settings(p_access_code text)
returns table (option_font_size int, option_colors jsonb)
language sql stable security definer set search_path = public
as $$
  select coalesce(ss.option_font_size, 16), coalesce(ss.option_colors, '[]'::jsonb)
  from surveys s
  left join survey_settings ss on ss.company_id = s.company_id
  where s.access_code = lower(p_access_code) and s.status = 'published' and (s.closes_at is null or s.closes_at > now());
$$;

grant execute on function get_survey_public_settings(text) to anon, authenticated;
