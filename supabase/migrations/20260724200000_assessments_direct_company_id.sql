-- Project "Test" sections author an Assessment with no lesson_id (they
-- aren't attached to any course/lesson). assessment_company_id() previously
-- derived the owning company ONLY via lesson -> module -> course, so a
-- null lesson_id made the join return nothing, RLS saw NULL != company,
-- and every insert was rejected with 42501 ("new row violates row-level
-- security policy"). This is why "Save Section" silently did nothing for
-- Test sections.
--
-- Fix: give assessments a direct, nullable company_id for the
-- lesson-less case, and teach assessment_company_id() to fall back to it
-- when there's no lesson to walk through.

alter table assessments add column if not exists company_id uuid references companies(id) on delete cascade;

create or replace function public.assessment_company_id(p_assessment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select c.company_id
      from assessments a
      join lessons l on l.id = a.lesson_id
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      where a.id = p_assessment_id
    ),
    (select a.company_id from assessments a where a.id = p_assessment_id)
  )
$$;
