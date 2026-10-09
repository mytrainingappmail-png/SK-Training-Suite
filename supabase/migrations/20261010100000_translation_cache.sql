-- Storage for the free "Read in Hinglish" button (edge function translate-hinglish).
-- translation_cache: one row per English piece, keyed by a hash of its text, so each piece is translated only once for
-- the whole platform. translation_usage: counts fresh translations per day to protect the free allowance.
-- Both are touched only by the edge function (service role) — RLS is on with no policies, so no browser can read or write them.

create table if not exists translation_cache (
  hash text primary key,
  lang text not null default 'hinglish',
  result text not null,
  created_at timestamptz not null default now()
);

create table if not exists translation_usage (
  day date primary key,
  calls int not null default 0
);

alter table translation_cache enable row level security;
alter table translation_usage enable row level security;
