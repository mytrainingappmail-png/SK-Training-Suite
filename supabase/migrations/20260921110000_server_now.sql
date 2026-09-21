-- The database's own clock, for any screen that runs a countdown. A
-- browser's Date.now() can be minutes off (wrong device clock/timezone);
-- comparing a server-stamped deadline against it makes a timer end early,
-- late, or instantly. Clients measure the offset once and correct for it.
create or replace function server_now()
returns timestamptz
language sql
stable
set search_path = public
as $$ select now(); $$;

grant execute on function server_now() to anon, authenticated;
