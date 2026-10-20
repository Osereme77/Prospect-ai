-- Prospect AI initial schema. Apply with Supabase CLI after creating a project.
create extension if not exists pgcrypto;

create type public.lead_kind as enum ('opportunity','company');
create type public.lead_status as enum ('new','reviewed','shortlisted','contacted','applied','replied','interviewing','won','lost','dismissed');
create type public.search_run_status as enum ('queued','running','completed','partial','failed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  headline text not null default '',
  skills text[] not null default '{}',
  services text[] not null default '{}',
  markets text[] not null default '{}',
  notification_threshold smallint not null default 65 check (notification_threshold between 0 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin','super_admin')),
  created_at timestamptz not null default now()
);
create table public.discovery_sources (
  id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete cascade,
  name text not null, kind text not null check (kind in ('search_api','public_feed','manual')),
  base_url text, enabled boolean not null default false, config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.search_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.discovery_sources(id) on delete set null, status public.search_run_status not null default 'queued',
  query text not null, started_at timestamptz, finished_at timestamptz, result_count integer not null default 0,
  error_code text, error_summary text, idempotency_key text not null, created_at timestamptz not null default now(),
  unique(owner_id,idempotency_key)
);
create table public.discovery_reservations (
  run_id uuid primary key references public.search_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  reserved_at timestamptz not null default now()
);
create table public.leads (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  kind public.lead_kind not null, title text not null, organization text not null, source_url text,
  location text, summary text not null default '', status public.lead_status not null default 'new',
  budget_signal text, follow_up_at date, notes text not null default '', duplicate_of uuid references public.leads(id) on delete set null,
  source_label text not null default 'Saved prospect', tags text[] not null default '{}', posted_label text not null default 'Saved prospect',
  score smallint not null default 50 check(score between 0 and 100), score_reason text not null default 'Score not calculated yet.',
  search_run_id uuid references public.search_runs(id) on delete set null, source_id uuid references public.discovery_sources(id) on delete set null,
  discovered_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint leads_source_url_scheme check (source_url is null or source_url ~* '^https?://')
);
create index leads_owner_status_idx on public.leads(owner_id,status,created_at desc);
create index leads_owner_kind_idx on public.leads(owner_id,kind,created_at desc);
create unique index leads_owner_source_url_unique on public.leads(owner_id,lower(source_url)) where source_url is not null;
create table public.lead_evidence (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, source_url text not null,
  claim text not null, evidence_type text not null default 'public_page', observed_at timestamptz not null default now(),
  excerpt text, content_hash text, created_at timestamptz not null default now(),
  constraint evidence_source_url_scheme check (source_url ~* '^https?://')
);
create index lead_evidence_owner_lead_idx on public.lead_evidence(owner_id,lead_id,observed_at desc);
create unique index lead_evidence_deduplicate_idx on public.lead_evidence(lead_id,source_url,claim);
create table public.lead_scores (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, score smallint not null check(score between 0 and 100),
  relevance smallint not null check(relevance between 0 and 100), need_evidence smallint not null check(need_evidence between 0 and 100),
  budget_signals smallint not null check(budget_signals between 0 and 100), freshness smallint not null check(freshness between 0 and 100),
  source_confidence smallint not null check(source_confidence between 0 and 100), explanation jsonb not null default '{}'::jsonb,
  scoring_version text not null default 'v1', created_at timestamptz not null default now()
);
create index lead_scores_latest_idx on public.lead_scores(lead_id,created_at desc);
create unique index lead_scores_snapshot_unique_idx on public.lead_scores(lead_id,scoring_version,score,relevance,need_evidence,budget_signals,freshness,source_confidence);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade, kind text not null, title text not null, body text not null,
  read_at timestamptz, idempotency_key text not null, created_at timestamptz not null default now(),
  unique(owner_id,idempotency_key)
);
create index notifications_unread_idx on public.notifications(owner_id,created_at desc) where read_at is null;
create table public.outbox (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade, channel text not null check(channel in ('email')),
  status text not null default 'queued' check(status in ('queued','sending','sent','failed')),
  attempts smallint not null default 0, next_attempt_at timestamptz not null default now(), last_error_code text,
  idempotency_key text not null unique, created_at timestamptz not null default now(), sent_at timestamptz
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
  action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'name',''));
  insert into public.user_roles(user_id,role) values(new.id,'user');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.validate_lead_duplicate() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.duplicate_of is not null then
    if new.duplicate_of = new.id or not exists(select 1 from public.leads l where l.id=new.duplicate_of and l.owner_id=new.owner_id and l.duplicate_of is null) then
      raise exception 'duplicate target must be a different canonical lead owned by the same user';
    end if;
  end if;
  return new;
end; $$;
create trigger leads_validate_duplicate before insert or update of duplicate_of,owner_id on public.leads
  for each row execute procedure public.validate_lead_duplicate();

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role in ('admin','super_admin'));
$$;
grant execute on function public.is_admin() to authenticated;

create function public.reserve_discovery_slot(p_owner uuid, p_run_id uuid, p_monthly_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null or p_owner <> (select auth.uid()) or p_monthly_limit < 1 then return false; end if;
  if not exists(select 1 from public.search_runs r where r.id=p_run_id and r.owner_id=p_owner) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));
  select count(*) into v_count from public.discovery_reservations
    where owner_id=p_owner and reserved_at >= date_trunc('month', now());
  if v_count >= p_monthly_limit then return false; end if;
  insert into public.discovery_reservations(run_id,owner_id) values(p_run_id,p_owner);
  return true;
end; $$;
grant execute on function public.reserve_discovery_slot(uuid,uuid,integer) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.discovery_sources enable row level security;
alter table public.search_runs enable row level security;
alter table public.discovery_reservations enable row level security;
alter table public.leads enable row level security;
alter table public.lead_evidence enable row level security;
alter table public.lead_scores enable row level security;
alter table public.notifications enable row level security;
alter table public.outbox enable row level security;
alter table public.audit_logs enable row level security;

create policy "Users manage own profile" on public.profiles for all to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "Users read own role" on public.user_roles for select to authenticated using(user_id=(select auth.uid()));
create policy "Users manage own sources" on public.discovery_sources for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "Users read own runs" on public.search_runs for select to authenticated using(owner_id=(select auth.uid()));
create policy "Users create own runs" on public.search_runs for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "Users update own runs" on public.search_runs for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "Users manage own leads" on public.leads for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "Users manage own evidence" on public.lead_evidence for all to authenticated
  using(owner_id=(select auth.uid()) and exists(select 1 from public.leads l where l.id=lead_id and l.owner_id=(select auth.uid())))
  with check(owner_id=(select auth.uid()) and exists(select 1 from public.leads l where l.id=lead_id and l.owner_id=(select auth.uid())));
create policy "Users read own scores" on public.lead_scores for select to authenticated using(owner_id=(select auth.uid()));
create policy "Users add own score history" on public.lead_scores for insert to authenticated
  with check(owner_id=(select auth.uid()) and exists(select 1 from public.leads l where l.id=lead_id and l.owner_id=(select auth.uid())));
create policy "Users manage own notifications" on public.notifications for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "Users read own outbox" on public.outbox for select to authenticated using(owner_id=(select auth.uid()));
create policy "Admins read audit logs" on public.audit_logs for select to authenticated using(public.is_admin());

grant select,insert,update,delete on public.profiles,public.discovery_sources,public.leads,public.lead_evidence,public.notifications to authenticated;
grant select on public.user_roles,public.search_runs,public.outbox,public.audit_logs to authenticated;
grant select,insert on public.lead_scores to authenticated;
grant insert,update on public.search_runs to authenticated;
-- Provider secrets must never be placed in discovery_sources.config. Store them as
-- Supabase Edge Function secrets and perform all external requests server-side.
