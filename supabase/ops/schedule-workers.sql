-- Install only after the required function secrets are configured and the
-- pg_cron, pg_net, and Vault extensions are enabled in the target project.
-- This schedules bounded workers; per-account opt-ins still control all work.
--
-- Required Vault names:
--   prospect_ai_project_url          e.g. https://<project-ref>.supabase.co
--   prospect_ai_service_role_key    exact server-side SUPABASE_SERVICE_ROLE_KEY
--   prospect_ai_outbox_worker_secret exact OUTBOX_WORKER_SECRET Edge Function secret
--   prospect_ai_discovery_secret    exact SCHEDULED_DISCOVERY_SECRET Edge Function secret

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'prospect_ai_project_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'prospect_ai_service_role_key')
    or not exists (select 1 from vault.decrypted_secrets where name = 'prospect_ai_outbox_worker_secret')
    or not exists (select 1 from vault.decrypted_secrets where name = 'prospect_ai_discovery_secret') then
    raise exception 'Create all four required Vault secrets before installing worker schedules';
  end if;
end;
$$;

-- Process eligible opted-in email alerts every five minutes.
select cron.schedule(
  'prospect-ai-email-outbox',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'prospect_ai_project_url')
        || '/functions/v1/dispatch-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'prospect_ai_service_role_key'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'prospect_ai_service_role_key'),
        'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'prospect_ai_outbox_worker_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $$
);

-- Run once daily at 13:00 UTC. Only sources explicitly opted into scheduling
-- in Settings are claimed by the handler.
select cron.schedule(
  'prospect-ai-scheduled-discovery',
  '0 13 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'prospect_ai_project_url')
        || '/functions/v1/scheduled-discovery',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'prospect_ai_service_role_key'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'prospect_ai_service_role_key'),
        'x-scheduler-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'prospect_ai_discovery_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $$
);
