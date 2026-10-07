-- Thin shapes (roads, corridors) were almost impossible to hit: a road such as "Pataudi Road" is drawn only
-- ~1.2 percent wide, i.e. about 4 pixels on a phone, so a correct tap landed just beside it and showed "wrong".
-- Circles already get a +1 point touch allowance; rectangles and polygons now get the same idea — a tap
-- within 1.3 percentage points of the shape's edge counts as on it. When a tap qualifies for more than one
-- zone, the zone it is closest to (inside beats near) is the one that counts.
-- Both hit-test functions (live quiz, exam grading, and the per-tap right/wrong reveal) are rebuilt on one core.

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
  best_idx int := null;
  best numeric := null;
  excess numeric;
  tol numeric;
  dx numeric; dy numeric; len2 numeric; t numeric; d numeric;
begin
  if p_zones is null or jsonb_typeof(p_zones) <> 'array' then
    return null;
  end if;

  for z in select * from jsonb_array_elements(p_zones) loop
    shape := z->>'shape';
    excess := null;
    if shape = 'circle' then
      tol := 1;
      excess := greatest(sqrt(power(p_x - (z->>'x')::numeric, 2) + power(p_y - (z->>'y')::numeric, 2)) - (z->>'r')::numeric, 0);
    elsif shape = 'rect' then
      tol := 1.3;
      dx := greatest((z->>'x')::numeric - p_x, 0, p_x - ((z->>'x')::numeric + (z->>'w')::numeric));
      dy := greatest((z->>'y')::numeric - p_y, 0, p_y - ((z->>'y')::numeric + (z->>'h')::numeric));
      excess := sqrt(dx * dx + dy * dy);
    elsif shape = 'poly' then
      tol := 1.3;
      pts := z->'points';
      n := coalesce(jsonb_array_length(pts), 0);
      if n >= 3 then
        inside := false;
        d := null;
        j := n - 1;
        for i in 0 .. n - 1 loop
          xi := (pts->i->>0)::numeric; yi := (pts->i->>1)::numeric;
          xj := (pts->j->>0)::numeric; yj := (pts->j->>1)::numeric;
          if ((yi > p_y) <> (yj > p_y)) and (p_x < (xj - xi) * (p_y - yi) / (yj - yi) + xi) then
            inside := not inside;
          end if;
          -- distance from the tap to the edge (j -> i)
          dx := xi - xj; dy := yi - yj;
          len2 := dx * dx + dy * dy;
          if len2 = 0 then
            t := 0;
          else
            t := least(greatest(((p_x - xj) * dx + (p_y - yj) * dy) / len2, 0), 1);
          end if;
          t := sqrt(power(p_x - (xj + t * dx), 2) + power(p_y - (yj + t * dy), 2));
          if d is null or t < d then d := t; end if;
          j := i;
        end loop;
        excess := case when inside then 0 else d end;
      end if;
    end if;

    if excess is not null and excess <= tol and (best is null or excess < best) then
      best := excess;
      best_idx := idx;
    end if;
    idx := idx + 1;
  end loop;

  return best_idx;
end;
$function$;

create or replace function hotspot_zone_hit(p_zones jsonb, p_x numeric, p_y numeric)
returns boolean
language sql
immutable
set search_path = public
as $function$
  select hotspot_zone_index_hit(p_zones, p_x, p_y) is not null;
$function$;
