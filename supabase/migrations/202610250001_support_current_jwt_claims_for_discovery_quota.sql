-- Supabase projects may expose JWT claims through the aggregate GUC
-- request.jwt.claims instead of the legacy per-claim GUC. Accept both forms
-- while keeping discovery quota reservations restricted to service_role.
create or replace function public.reserve_discovery_slot(
  p_owner uuid,
  p_run_id uuid,
  p_owner_monthly_limit integer,
  p_global_monthly_limit integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  owner_count integer;
  global_count integer;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_owner is null
     or p_owner_monthly_limit < 1 or p_owner_monthly_limit > 10000
     or p_global_monthly_limit < 1 or p_global_monthly_limit > 1000000 then
    return false;
  end if;
  if not exists(
    select 1 from public.search_runs r
    where r.id=p_run_id and r.owner_id=p_owner and r.status='queued'
  ) then return false; end if;
  if exists(select 1 from public.discovery_reservations where run_id=p_run_id) then return true; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('discovery:global', 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('discovery:owner:' || p_owner::text, 0));

  select count(*) into owner_count from public.discovery_reservations r
  where r.owner_id=p_owner and r.reserved_at >= pg_catalog.date_trunc('month', now());
  if owner_count >= p_owner_monthly_limit then return false; end if;

  select count(*) into global_count from public.discovery_reservations r
  where r.reserved_at >= pg_catalog.date_trunc('month', now());
  if global_count >= p_global_monthly_limit then return false; end if;

  insert into public.discovery_reservations(run_id,owner_id) values(p_run_id,p_owner);
  return true;
end;
$$;

revoke all on function public.reserve_discovery_slot(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_discovery_slot(uuid, uuid, integer, integer) to service_role;
