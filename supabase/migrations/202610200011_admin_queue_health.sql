-- Expose only aggregate email queue health to administrators.
create function public.admin_queue_health()
returns table(
  queued_count bigint,
  oldest_queued_at timestamptz,
  stale_sending_count bigint,
  failed_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where o.status = 'queued')::bigint,
    min(o.created_at) filter (where o.status = 'queued'),
    count(*) filter (
      where o.status = 'sending'
        and o.locked_at < now() - interval '15 minutes'
    )::bigint,
    count(*) filter (where o.status = 'failed')::bigint
  from public.outbox o;
end;
$$;

revoke all on function public.admin_queue_health() from public, anon;
grant execute on function public.admin_queue_health() to authenticated;
