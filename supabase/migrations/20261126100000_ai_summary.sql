-- AI Summary: an employee can ask for a short summary of long reading content (a section, a part, a lesson). The summary's length
-- follows the length of the article. A summary is made ONCE per text + language and kept (content_summaries), so the same text is
-- never sent to the AI twice - for any employee or any company that holds an identical copy. The table is only ever touched by the
-- server (row level security on, no policies). The feature is an add-on module, so it can be switched off per company and put
-- behind a paid plan later (Admin -> company modules); it is ON by default for now.

create table if not exists public.content_summaries (
  id uuid primary key default gen_random_uuid(),
  content_hash text not null,
  lang text not null check (lang in ('english', 'hinglish')),
  summary text not null,
  source_words integer not null default 0,
  summary_words integer not null default 0,
  created_at timestamptz not null default now(),
  unique (content_hash, lang)
);

alter table public.content_summaries enable row level security;

insert into public.app_modules (key, label, description, category, is_addon, default_enabled, display_order)
values ('ai_summary', 'AI Summary', 'Employees can get a short summary of long reading content (the summary is as long as the article needs) - ready to be a paid add-on.', 'Add-ons', true, true, 140)
on conflict (key) do nothing;
