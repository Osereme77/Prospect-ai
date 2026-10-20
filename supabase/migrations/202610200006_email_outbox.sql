-- Email notifications are opt-in, queued only for verified account addresses,
-- and dispatched by a server-side worker. The outbox never stores an address.
alter table public.profiles
  add column if not exists email_notifications_enabled boolean not null default false;
alter table public.outbox
  add column if not exists locked_at timestamptz;

create unique index if not exists outbox_notification_email_unique_idx
  on public.outbox(notification_id, channel)
  where notification_id is not null;

create function public.queue_lead_notification_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind <> 'lead_match' then return new; end if;

  insert into public.outbox(owner_id, notification_id, channel, idempotency_key)
  select new.owner_id, new.id, 'email', 'lead-alert/' || new.id::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = new.owner_id
    and p.email_notifications_enabled
    and u.email_confirmed_at is not null
  on conflict do nothing;

  return new;
end;
$$;

create trigger notifications_queue_email
  after insert on public.notifications
  for each row execute procedure public.queue_lead_notification_email();

create function public.claim_notification_outbox(p_batch_size integer default 20)
returns setof public.outbox language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  update public.outbox
  set status = 'failed', locked_at = null, last_error_code = 'delivery_attempts_exhausted'
  where status = 'sending' and locked_at < now() - interval '15 minutes' and attempts >= 5;

  return query
  with claimable as (
    select o.id
    from public.outbox o
    where ((o.status = 'queued' and o.next_attempt_at <= now())
        or (o.status = 'sending' and o.locked_at < now() - interval '15 minutes'))
      and o.attempts < 5
    order by o.next_attempt_at, o.created_at
    for update skip locked
    limit least(greatest(coalesce(p_batch_size, 20), 1), 20)
  )
  update public.outbox o
  set status = 'sending', attempts = o.attempts + 1, locked_at = now()
  from claimable c
  where o.id = c.id
  returning o.*;
end;
$$;

create function public.finish_notification_outbox(
  p_id uuid,
  p_success boolean,
  p_error_code text default null,
  p_retry_at timestamptz default null,
  p_terminal boolean default false
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  update public.outbox
  set status = case when p_success then 'sent' when p_terminal or attempts >= 5 then 'failed' else 'queued' end,
      locked_at = null,
      sent_at = case when p_success then now() else null end,
      last_error_code = case when p_success then null else left(coalesce(p_error_code, 'email_delivery_failed'), 80) end,
      next_attempt_at = case when p_success or p_terminal or attempts >= 5 then next_attempt_at else coalesce(p_retry_at, now() + interval '5 minutes') end
  where id = p_id and status = 'sending';

  return found;
end;
$$;

revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
revoke all on function public.finish_notification_outbox(uuid, boolean, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;
grant execute on function public.finish_notification_outbox(uuid, boolean, text, timestamptz, boolean) to service_role;
