-- Each account can keep one policy/limit record per provider without storing secrets.
create unique index if not exists discovery_sources_owner_name_unique_idx
  on public.discovery_sources(owner_id, lower(name))
  where owner_id is not null;
