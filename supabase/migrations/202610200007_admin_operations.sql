-- Admins can inspect operational state and requeue terminal email failures.
-- Every read remains RLS-protected and manual retry creates an audit event.
create policy "Admins read all discovery sources" on public.discovery_sources
  for select to authenticated using (public.is_admin());
create policy "Admins read all search runs" on public.search_runs
  for select to authenticated using (public.is_admin());
create policy "Admins read all notification outbox" on public.outbox
  for select to authenticated using (public.is_admin());

create function public.admin_retry_notification_outbox(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  selected_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  update public.outbox
  set status = 'queued', attempts = 0, next_attempt_at = now(),
      locked_at = null, last_error_code = null, sent_at = null
  where id = p_id and status = 'failed'
  returning owner_id into selected_owner;

  if selected_owner is null then return false; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'notification_outbox.requeued', 'notification_outbox', p_id,
          jsonb_build_object('owner_id', selected_owner));
  return true;
end;
$$;

revoke all on function public.admin_retry_notification_outbox(uuid) from public, anon;
grant execute on function public.admin_retry_notification_outbox(uuid) to authenticated;
