do $$
declare
  v_rec record;
begin
  for v_rec in
    select company_name, logo, login_logo_url, app_icon_url, favicon
    from companies
    where id = 'b259bfa8-bf5b-464f-b9a5-008d00efa1e4'
  loop
    raise notice 'name=% logo=% login_logo=% app_icon=% favicon=%', v_rec.company_name, v_rec.logo, v_rec.login_logo_url, v_rec.app_icon_url, v_rec.favicon;
  end loop;
end $$;
