-- Persist research gaps so missing information is visible instead of inferred.
alter table public.leads
  add column if not exists research_gaps text[] not null default '{}';
