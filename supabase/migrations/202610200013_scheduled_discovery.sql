-- Browser-closed Remote OK discovery. Owner consent is explicit in the source
-- config; provider execution remains globally disabled until an operator opts in.
create table public.scheduled_discovery_state (
  source_id uuid primary key references public.discovery_sources(id) on delete cascade,
  next_run_at timestamptz not null default now(),
  locked_until timestamptz,
  consecutive_failures smallint not null default 0 check (consecutive_failures between 0 and 3),
  last_run_at timestamptz,
  last_error_code text
);

alter table public.scheduled_discovery_state enable row level security;
revoke all on public.scheduled_discovery_state from public, anon, authenticated;
grant select, insert, update, delete on public.scheduled_discovery_state to service_role;

create function public.claim_scheduled_remote_ok_sources(p_batch_size integer default 3)
returns table (
  source_id uuid,
  owner_id uuid,
  source_config jsonb,
  skills text[],
  services text[],
  markets text[],
  notification_threshold smallint
)
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 3 then
    raise exception 'batch size must be between 1 and 3' using errcode = '22023';
  end if;

  return query
  with due as (
    select s.id
    from public.discovery_sources s
    left join public.scheduled_discovery_state state on state.source_id = s.id
    where s.owner_id is not null
      and s.name = 'Remote OK'
      and s.kind = 'public_feed'
      and s.enabled
      and s.config->>'scheduled_enabled' = 'true'
      and coalesce(s.config->>'terms_reviewed_at', '') ~ '^\d{4}-\d{2}-\d{2}T'
      and coalesce(s.config->>'monthly_limit', '') ~ '^\d{1,5}$'
      and (state.next_run_at is null or state.next_run_at <= now())
      and (state.locked_until is null or state.locked_until <= now())
    order by coalesce(state.next_run_at, '-infinity'::timestamptz), s.updated_at, s.id
    for update of s skip locked
    limit p_batch_size
  ), claimed as (
    insert into public.scheduled_discovery_state as lease(source_id, locked_until)
    select due.id, now() + interval '3 minutes' from due
    on conflict (source_id) do update set locked_until = excluded.locked_until
    returning lease.source_id
  )
  select s.id, s.owner_id, s.config, p.skills, p.services, p.markets, p.notification_threshold
  from claimed c
  join public.discovery_sources s on s.id = c.source_id
  join public.profiles p on p.id = s.owner_id;
end;
$$;

create function public.finish_scheduled_remote_ok_source(
  p_source_id uuid,
  p_success boolean,
  p_error_code text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  failures smallint;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_source_id is null or p_success is null then
    raise exception 'source and result are required' using errcode = '22023';
  end if;

  update public.scheduled_discovery_state state
  set consecutive_failures = case when p_success then 0 else least(state.consecutive_failures + 1, 3) end,
      last_run_at = now(),
      last_error_code = case when p_success then null else left(coalesce(p_error_code, 'scheduled_run_failed'), 80) end,
      locked_until = null
  where state.source_id = p_source_id
  returning state.consecutive_failures into failures;

  if not found then return false; end if;
  update public.scheduled_discovery_state state
  set next_run_at = case
    when p_success or failures >= 3 then now() + interval '24 hours'
    when failures = 1 then now() + interval '1 hour'
    else now() + interval '4 hours'
  end
  where state.source_id = p_source_id;
  return true;
end;
$$;

create function public.persist_scheduled_remote_ok_results(
  p_owner uuid,
  p_source_id uuid,
  p_run_id uuid,
  p_results jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  inserted_count integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_owner is null or p_source_id is null or p_run_id is null
     or p_results is null or pg_catalog.jsonb_typeof(p_results) <> 'array'
     or pg_catalog.jsonb_array_length(p_results) > 20 then
    raise exception 'invalid scheduled result batch' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.search_runs r
    join public.discovery_sources s on s.id = r.source_id and s.owner_id = r.owner_id
    where r.id = p_run_id and r.owner_id = p_owner and r.source_id = p_source_id
      and r.status = 'running' and s.name = 'Remote OK' and s.kind = 'public_feed'
      and s.enabled and s.config->>'scheduled_enabled' = 'true'
      and coalesce(s.config->>'terms_reviewed_at', '') ~ '^\d{4}-\d{2}-\d{2}T'
      and exists (
        select 1 from public.scheduled_discovery_state state
        where state.source_id = s.id and state.locked_until > now()
      )
  ) then
    raise exception 'scheduled run is not authorized for this source' using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_results) as item(
      url text, title text, organization text, snippet text, score integer,
      score_reason text, relevance integer, need_evidence integer,
      budget_signals integer, freshness integer, source_confidence integer
    )
    where item.url is null or item.url !~* '^https://(www\.)?remoteok\.com/'
      or item.title is null or pg_catalog.length(item.title) > 300
      or item.organization is null or pg_catalog.length(item.organization) > 160
      or item.snippet is null or pg_catalog.length(item.snippet) > 700
      or item.score_reason is null or pg_catalog.length(item.score_reason) > 500
      or item.score not between 0 and 100
      or item.relevance not between 0 and 100
      or item.need_evidence not between 0 and 100
      or item.budget_signals not between 0 and 100
      or item.freshness not between 0 and 100
      or item.source_confidence not between 0 and 100
  ) then
    raise exception 'scheduled result failed validation' using errcode = '22023';
  end if;

  with input as (
    select item.*
    from pg_catalog.jsonb_to_recordset(p_results) as item(
      url text, title text, organization text, snippet text, score integer,
      score_reason text, relevance integer, need_evidence integer,
      budget_signals integer, freshness integer, source_confidence integer
    )
  ), inserted as (
    insert into public.leads (
      owner_id, kind, title, organization, source_url, location, summary, status,
      source_label, source_id, search_run_id, tags, research_gaps, posted_label,
      score, score_reason, discovered_at
    )
    select p_owner, 'opportunity', item.title, item.organization, item.url, 'Remote',
      case when item.snippet = '' then 'Public listing found; review the original post before relying on it.'
        else 'Unverified public listing excerpt. Review the original post before relying on it. ' || item.snippet end,
      'new', 'Remote OK', p_source_id, p_run_id, '{}', array['budget not verified','requirements not independently reviewed'],
      'Found by scheduled discovery', item.score, item.score_reason, now()
    from input item
    on conflict (owner_id, lower(source_url)) where source_url is not null do nothing
    returning id, owner_id, title, organization, source_url, summary, score,
      score_reason, source_id, search_run_id
  ), saved_evidence as (
    insert into public.lead_evidence(
      lead_id, owner_id, source_url, claim, evidence_type, observed_at, excerpt, verification_status
    )
    select lead.id, lead.owner_id, lead.source_url,
      'Unverified public listing: ' || left(lead.title, 300), 'public_page', now(),
      nullif(left(lead.summary, 700), ''), 'unverified'
    from inserted lead
    returning lead_id
  ), saved_scores as (
    insert into public.lead_scores(
      lead_id, owner_id, score, relevance, need_evidence, budget_signals,
      freshness, source_confidence, explanation, scoring_version
    )
    select lead.id, lead.owner_id, item.score, item.relevance, item.need_evidence,
      item.budget_signals, item.freshness, item.source_confidence,
      pg_catalog.jsonb_build_object('summary', item.score_reason), 'v1'
    from inserted lead
    join input item on item.url = lead.source_url
    on conflict (lead_id, scoring_version, score, relevance, need_evidence,
      budget_signals, freshness, source_confidence) do nothing
    returning lead_id
  ), alerts as (
    insert into public.notifications(owner_id, lead_id, kind, title, body, idempotency_key)
    select lead.owner_id, lead.id, 'lead_match', 'A new Remote OK lead matches your profile',
      left(lead.title || ' at ' || lead.organization || ' scored ' || lead.score || '/100. ' || lead.score_reason, 1200),
      'lead-alert/' || lead.id::text
    from inserted lead
    join public.profiles profile on profile.id = lead.owner_id
    where lead.score >= profile.notification_threshold
    on conflict (owner_id, idempotency_key) do nothing
    returning id
  )
  select count(*)::integer into inserted_count from inserted;

  return coalesce(inserted_count, 0);
end;
$$;

revoke all on function public.claim_scheduled_remote_ok_sources(integer) from public, anon, authenticated;
revoke all on function public.finish_scheduled_remote_ok_source(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.persist_scheduled_remote_ok_results(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_scheduled_remote_ok_sources(integer) to service_role;
grant execute on function public.finish_scheduled_remote_ok_source(uuid, boolean, text) to service_role;
grant execute on function public.persist_scheduled_remote_ok_results(uuid, uuid, uuid, jsonb) to service_role;
