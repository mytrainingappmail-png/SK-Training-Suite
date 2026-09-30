-- Small circle zones (the tightly-clustered NH8 chowks on the 16-landmark
-- map — IFFCO Chowk, Shankar Chowk, Rajiv Chowk etc. — are drawn at just
-- r=2 percent) are genuinely hard to tap precisely even zoomed in, and a
-- trainee reported scoring almost nothing despite carefully tapping each
-- real landmark. Standard mobile UX practice is a touch target larger than
-- its visual size; this adds a fixed +1 percentage-point tolerance to
-- circle hit-testing only (rect/poly are already large, hand-drawn areas —
-- no tolerance risk of swallowing a genuinely separate nearby zone there).
-- Applied to both hit-test functions so Live Quiz and Exam hotspot
-- grading — and the live per-tap reveal check — all agree.

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
      if sqrt(power(p_x - (z->>'x')::numeric, 2) + power(p_y - (z->>'y')::numeric, 2)) <= (z->>'r')::numeric + 1 then
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

create or replace function hotspot_zone_index_hit(p_zones jsonb, p_x numeric, p_y numeric)
returns int
language plpgsql
immutable
set search_path = public
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
  idx int := 0;
begin
  if p_zones is null or jsonb_typeof(p_zones) <> 'array' then
    return null;
  end if;

  for z in select * from jsonb_array_elements(p_zones) loop
    shape := z->>'shape';
    if shape = 'circle' then
      if sqrt(power(p_x - (z->>'x')::numeric, 2) + power(p_y - (z->>'y')::numeric, 2)) <= (z->>'r')::numeric + 1 then
        return idx;
      end if;
    elsif shape = 'rect' then
      if p_x >= (z->>'x')::numeric and p_x <= (z->>'x')::numeric + (z->>'w')::numeric
         and p_y >= (z->>'y')::numeric and p_y <= (z->>'y')::numeric + (z->>'h')::numeric then
        return idx;
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
          return idx;
        end if;
      end if;
    end if;
    idx := idx + 1;
  end loop;

  return null;
end;
$function$;
