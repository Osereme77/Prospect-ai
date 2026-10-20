-- Admin source controls are deliberately narrow: operators may pause or resume
-- a registered source, but provider credentials and owner consent stay separate.
create function public.admin_set_discovery_source_enabled(p_id uuid, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  selected_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  update public.discovery_sources
  set enabled = p_enabled, updated_at = now()
  where id = p_id and enabled is distinct from p_enabled
  returning owner_id into selected_owner;

  if not found then return false; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'discovery_source.enabled_changed', 'discovery_source', p_id,
          pg_catalog.jsonb_build_object('owner_id', selected_owner, 'enabled', p_enabled));
  return true;
end;
$$;

create function public.admin_discovery_usage()
returns table(month_start date, total_requests bigint, active_accounts bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  select pg_catalog.date_trunc('month', r.reserved_at)::date,
         count(*)::bigint,
         count(distinct r.owner_id)::bigint
  from public.discovery_reservations r
  where r.reserved_at >= pg_catalog.date_trunc('month', now()) - interval '5 months'
  group by pg_catalog.date_trunc('month', r.reserved_at)
  order by pg_catalog.date_trunc('month', r.reserved_at) desc;
end;
$$;

revoke all on function public.admin_set_discovery_source_enabled(uuid, boolean) from public, anon;
revoke all on function public.admin_discovery_usage() from public, anon;
grant execute on function public.admin_set_discovery_source_enabled(uuid, boolean) to authenticated;
grant execute on function public.admin_discovery_usage() to authenticated;
