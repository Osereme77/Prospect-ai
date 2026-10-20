-- Record whether the owner has reviewed each source-backed observation.
alter table public.lead_evidence
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_evidence_verification_status_check'
      and conrelid = 'public.lead_evidence'::regclass
  ) then
    alter table public.lead_evidence
      add constraint lead_evidence_verification_status_check
      check (verification_status in ('unverified','verified'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_evidence_reviewed_at_consistency_check'
      and conrelid = 'public.lead_evidence'::regclass
  ) then
    alter table public.lead_evidence
      add constraint lead_evidence_reviewed_at_consistency_check
      check ((verification_status = 'unverified' and reviewed_at is null)
          or (verification_status = 'verified' and reviewed_at is not null));
  end if;
end $$;
