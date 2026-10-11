-- Projects: "Duplicate" — a fully independent copy of a project (pages, tests, brochures included) in the SAME place:
-- the main Projects section, or the same Induction card. Same category and branch, name gets " (Copy)".
-- Built on copy_project_independent, so nothing stays linked to the original: deleting or editing either never touches the other.

create or replace function public.duplicate_project(p_project uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_src real_estate_projects%rowtype; v_new uuid;
begin
  select * into v_src from real_estate_projects where id = p_project;
  if v_src.id is null then raise exception 'Project not found.'; end if;
  -- ownership / "can this card hold projects" checks are done by copy_project_independent
  v_new := public.copy_project_independent(p_project, v_src.induction_section_id);
  update real_estate_projects
     set category_id = v_src.category_id,
         branch_id = v_src.branch_id,
         project_name = v_src.project_name || ' (Copy)'
   where id = v_new;
  return v_new;
end $$;

revoke all on function public.duplicate_project(uuid) from public, anon;
grant execute on function public.duplicate_project(uuid) to authenticated;
