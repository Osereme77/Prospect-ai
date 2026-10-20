-- Track only whether the owner found a public contact route. This does not
-- store email addresses, phone numbers, or other contact details.
alter table public.leads
  add column contact_availability text not null default 'unknown'
  check (contact_availability in ('unknown', 'public_channel', 'not_found'));
