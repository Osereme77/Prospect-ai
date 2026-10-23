-- Preserve an audit record for account source approvals and privileged source
-- changes without copying provider secrets or arbitrary source configuration.
create function public.audit_discovery_source_change()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_source_id uuid;
  v_provider text;
  v_enabled boolean;
  v_config jsonb;
  v_action text;
begin
  -- Maintenance performed outside a user session is not attributed to a user.
  if v_actor is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then
    v_source_id := old.id;
    v_provider := old.name;
    v_enabled := old.enabled;
    v_config := old.config;
    v_action := 'discovery_source.deleted';
  elsif tg_op = 'INSERT' then
    v_source_id := new.id;
    v_provider := new.name;
    v_enabled := new.enabled;
    v_config := new.config;
    v_action := 'discovery_source.created';
  else
    v_source_id := new.id;
    v_provider := new.name;
    v_enabled := new.enabled;
    v_config := new.config;
    v_action := 'discovery_source.updated';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    v_action,
    'discovery_source',
    v_source_id,
    pg_catalog.jsonb_build_object(
      'provider', pg_catalog.left(v_provider, 80),
      'enabled', v_enabled,
      'terms_reviewed', nullif(v_config->>'terms_reviewed_at', '') is not null,
      'storage_rights_confirmed', nullif(v_config->>'storage_rights_confirmed_at', '') is not null,
      'scheduled_enabled', v_config->>'scheduled_enabled' = 'true'
    )
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.audit_discovery_source_change() from public, anon, authenticated;

create trigger audit_discovery_source_changes
after insert or update or delete on public.discovery_sources
for each row execute function public.audit_discovery_source_change();

-- The trigger is the single audit writer for this mutation, avoiding duplicate
-- rows when the same source is changed through the Admin RPC.
create or replace function public.admin_set_discovery_source_enabled(p_id uuid, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  update public.discovery_sources
  set enabled = p_enabled, updated_at = now()
  where id = p_id and enabled is distinct from p_enabled;

  return found;
end;
$$;

revoke all on function public.admin_set_discovery_source_enabled(uuid, boolean) from public, anon;
grant execute on function public.admin_set_discovery_source_enabled(uuid, boolean) to authenticated;
