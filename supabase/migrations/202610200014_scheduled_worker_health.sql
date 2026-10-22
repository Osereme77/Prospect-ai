-- Store only aggregate scheduler heartbeat data for operator monitoring.
create table public.scheduled_worker_health (
  worker text primary key check (worker = 'scheduled-discovery'),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text check (last_status in ('running','succeeded','failed','skipped')),
  last_error_code text check (last_error_code is null or length(last_error_code) <= 80),
  last_claimed smallint not null default 0 check (last_claimed between 0 and 3),
  last_completed smallint not null default 0 check (last_completed between 0 and 3),
  last_failed smallint not null default 0 check (last_failed between 0 and 3)
);

alter table public.scheduled_worker_health enable row level security;
revoke all on public.scheduled_worker_health from public, anon, authenticated;
grant select, insert, update on public.scheduled_worker_health to service_role;

insert into public.scheduled_worker_health(worker) values ('scheduled-discovery');

create function public.record_scheduled_worker_health(
  p_status text,
  p_claimed integer default 0,
  p_completed integer default 0,
  p_failed integer default 0,
  p_error_code text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('running','succeeded','failed','skipped')
     or p_claimed is null or p_claimed not between 0 and 3
     or p_completed is null or p_completed not between 0 and 3
     or p_failed is null or p_failed not between 0 and 3
     or (p_status = 'running' and (p_claimed <> 0 or p_completed <> 0 or p_failed <> 0)) then
    raise exception 'invalid scheduled worker health' using errcode = '22023';
  end if;

  insert into public.scheduled_worker_health(
    worker,last_started_at,last_finished_at,last_status,last_error_code,
    last_claimed,last_completed,last_failed
  ) values (
    'scheduled-discovery',
    case when p_status = 'running' then now() else null end,
    case when p_status = 'running' then null else now() end,
    p_status,left(p_error_code,80),p_claimed,p_completed,p_failed
  )
  on conflict (worker) do update set
    last_started_at = case when p_status = 'running' then now() else scheduled_worker_health.last_started_at end,
    last_finished_at = case when p_status = 'running' then scheduled_worker_health.last_finished_at else now() end,
    last_status = p_status,
    last_error_code = left(p_error_code,80),
    last_claimed = p_claimed,
    last_completed = p_completed,
    last_failed = p_failed;
  return true;
end;
$$;

revoke all on function public.record_scheduled_worker_health(text,integer,integer,integer,text) from public, anon, authenticated;
grant execute on function public.record_scheduled_worker_health(text,integer,integer,integer,text) to service_role;

create function public.admin_scheduled_worker_health()
returns table(
  worker text,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text,
  last_error_code text,
  last_claimed smallint,
  last_completed smallint,
  last_failed smallint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  return query
  select h.worker,h.last_started_at,h.last_finished_at,h.last_status,h.last_error_code,
         h.last_claimed,h.last_completed,h.last_failed
  from public.scheduled_worker_health h;
end;
$$;

revoke all on function public.admin_scheduled_worker_health() from public, anon;
grant execute on function public.admin_scheduled_worker_health() to authenticated;
