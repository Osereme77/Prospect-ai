-- Keep profile enhancements additive so already-provisioned environments can upgrade safely.
alter table public.profiles
  add column if not exists portfolio_links text[] not null default '{}',
  add column if not exists experience_summary text not null default '';
