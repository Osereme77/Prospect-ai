-- Apply profile, lead, evidence, and score writes as one RLS-checked transaction.
create or replace function public.sync_workspace(
  p_profile jsonb,
  p_leads jsonb,
  p_evidence jsonb,
  p_scores jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
begin
  if v_owner is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if p_profile is not null and pg_catalog.jsonb_typeof(p_profile) <> 'object' then
    raise exception 'profile must be a JSON object' using errcode = '22023';
  end if;
  if p_leads is null or pg_catalog.jsonb_typeof(p_leads) <> 'array' or pg_catalog.jsonb_array_length(p_leads) > 500 then
    raise exception 'leads must be an array of at most 500 records' using errcode = '22023';
  end if;
  if p_evidence is null or pg_catalog.jsonb_typeof(p_evidence) <> 'array' or pg_catalog.jsonb_array_length(p_evidence) > 5000 then
    raise exception 'evidence must be an array of at most 5000 records' using errcode = '22023';
  end if;
  if p_scores is null or pg_catalog.jsonb_typeof(p_scores) <> 'array' or pg_catalog.jsonb_array_length(p_scores) > 500 then
    raise exception 'scores must be an array of at most 500 records' using errcode = '22023';
  end if;

  if p_profile is not null then
    if pg_catalog.jsonb_typeof(p_profile->'skills') not in ('array', 'null')
      or pg_catalog.jsonb_typeof(p_profile->'services') not in ('array', 'null')
      or pg_catalog.jsonb_typeof(p_profile->'markets') not in ('array', 'null')
      or pg_catalog.jsonb_typeof(p_profile->'portfolioLinks') not in ('array', 'null') then
      raise exception 'profile list fields must be arrays' using errcode = '22023';
    end if;
    insert into public.profiles (
      id, display_name, headline, skills, services, markets, portfolio_links,
      experience_summary, notification_threshold, email_notifications_enabled, updated_at
    ) values (
      v_owner,
      coalesce(p_profile->>'name', ''),
      coalesce(p_profile->>'role', ''),
      coalesce(array(select pg_catalog.jsonb_array_elements_text(coalesce(p_profile->'skills', '[]'::jsonb))), '{}'::text[]),
      coalesce(array(select pg_catalog.jsonb_array_elements_text(coalesce(p_profile->'services', '[]'::jsonb))), '{}'::text[]),
      coalesce(array(select pg_catalog.jsonb_array_elements_text(coalesce(p_profile->'markets', '[]'::jsonb))), '{}'::text[]),
      coalesce(array(select pg_catalog.jsonb_array_elements_text(coalesce(p_profile->'portfolioLinks', '[]'::jsonb))), '{}'::text[]),
      coalesce(p_profile->>'experienceSummary', ''),
      coalesce((p_profile->>'notificationThreshold')::smallint, 65),
      coalesce((p_profile->>'emailNotificationsEnabled')::boolean, false),
      now()
    )
    on conflict (id) do update set
      display_name = excluded.display_name,
      headline = excluded.headline,
      skills = excluded.skills,
      services = excluded.services,
      markets = excluded.markets,
      portfolio_links = excluded.portfolio_links,
      experience_summary = excluded.experience_summary,
      notification_threshold = excluded.notification_threshold,
      email_notifications_enabled = excluded.email_notifications_enabled,
      updated_at = now();
  end if;

  insert into public.leads (
    id, owner_id, kind, title, organization, source_url, location, summary, status,
    budget_signal, contact_availability, follow_up_at, notes, duplicate_of, source_label,
    source_id, search_run_id, tags, research_gaps, posted_label, score, score_reason, updated_at
  )
  select
    item.id, v_owner, item.kind::public.lead_kind, item.title, item.organization,
    item.source_url, item.location, item.summary, item.status::public.lead_status,
    item.budget_signal, coalesce(item.contact_availability, 'unknown'), item.follow_up_at,
    coalesce(item.notes, ''), item.duplicate_of, coalesce(item.source_label, 'Saved prospect'),
    item.source_id, item.search_run_id, coalesce(item.tags, '{}'::text[]),
    coalesce(item.research_gaps, '{}'::text[]), coalesce(item.posted_label, 'Saved prospect'),
    coalesce(item.score, 50), coalesce(item.score_reason, 'Score not calculated yet.'), now()
  from pg_catalog.jsonb_to_recordset(p_leads) as item(
    id uuid, kind text, title text, organization text, source_url text, location text,
    summary text, status text, budget_signal text, contact_availability text,
    follow_up_at date, notes text, duplicate_of uuid, source_label text,
    source_id uuid, search_run_id uuid, tags text[], research_gaps text[],
    posted_label text, score smallint, score_reason text
  )
  on conflict (id) do update set
    kind = excluded.kind,
    title = excluded.title,
    organization = excluded.organization,
    source_url = excluded.source_url,
    location = excluded.location,
    summary = excluded.summary,
    status = excluded.status,
    budget_signal = excluded.budget_signal,
    contact_availability = excluded.contact_availability,
    follow_up_at = excluded.follow_up_at,
    notes = excluded.notes,
    duplicate_of = excluded.duplicate_of,
    source_label = excluded.source_label,
    source_id = excluded.source_id,
    search_run_id = excluded.search_run_id,
    tags = excluded.tags,
    research_gaps = excluded.research_gaps,
    posted_label = excluded.posted_label,
    score = excluded.score,
    score_reason = excluded.score_reason,
    updated_at = now();

  insert into public.lead_evidence (
    lead_id, owner_id, source_url, claim, observed_at, evidence_type,
    verification_status, reviewed_at
  )
  select
    item.lead_id, v_owner, item.source_url, item.claim, item.observed_at,
    item.evidence_type, item.verification_status, item.reviewed_at
  from pg_catalog.jsonb_to_recordset(p_evidence) as item(
    lead_id uuid, source_url text, claim text, observed_at timestamptz,
    evidence_type text, verification_status text, reviewed_at timestamptz
  )
  on conflict (lead_id, source_url, claim) do update set
    observed_at = excluded.observed_at,
    evidence_type = excluded.evidence_type,
    verification_status = excluded.verification_status,
    reviewed_at = excluded.reviewed_at;

  insert into public.lead_scores (
    lead_id, owner_id, score, relevance, need_evidence, budget_signals,
    freshness, source_confidence, explanation, scoring_version
  )
  select
    item.lead_id, v_owner, item.score, item.relevance, item.need_evidence,
    item.budget_signals, item.freshness, item.source_confidence,
    coalesce(item.explanation, '{}'::jsonb), coalesce(item.scoring_version, 'v1')
  from pg_catalog.jsonb_to_recordset(p_scores) as item(
    lead_id uuid, score smallint, relevance smallint, need_evidence smallint,
    budget_signals smallint, freshness smallint, source_confidence smallint,
    explanation jsonb, scoring_version text
  )
  on conflict (lead_id, scoring_version, score, relevance, need_evidence,
    budget_signals, freshness, source_confidence) do nothing;

  delete from public.leads as saved
  where saved.owner_id = v_owner
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_leads) as desired(id uuid)
      where desired.id = saved.id
    );

  return true;
end;
$$;

revoke all on function public.sync_workspace(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.sync_workspace(jsonb, jsonb, jsonb, jsonb) to authenticated;
