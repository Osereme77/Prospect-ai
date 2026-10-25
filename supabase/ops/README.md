# Supabase worker setup

The Edge Functions are designed to fail closed. The email and scheduled discovery workers do not run until their server secrets and private schedules are configured. Keep all of these values out of `.env.local`, `VITE_*`, browser storage, and Git.

## 1. Function secrets

In Supabase Dashboard → Edge Functions → Secrets for the linked project, set:

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | Existing Resend key. The worker also accepts the existing `Resend_Api` name. |
| `EMAIL_FROM` | Test only: `onboarding@resend.dev`. Resend permits this sender only to the email address on your Resend account. This app sends to the opted-in, confirmed Supabase Auth user's address, so test delivery works only when those addresses are the same. For general delivery, use a sender address on a domain Resend shows as verified, such as `Remy Prospect AI <alerts@your-verified-domain>`. |
| `OUTBOX_WORKER_SECRET` | A new high-entropy random value; also saved under the matching Vault name below. |
| `SCHEDULED_DISCOVERY_SECRET` | A separate high-entropy random value; also saved under the matching Vault name below. |
| `REMOTE_OK_ENABLED` | `true` only while the approved public feed is intended to be available. |
| `REMOTE_OK_MONTHLY_LIMIT` | Global monthly request cap, no greater than the approved account cap. |

Brave Search remains disabled until the separate written rights needed to retain its results are in place. Do not set `BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED=true` without that agreement.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the Edge Functions by Supabase. Never put the service-role key in a frontend variable.

## 2. Private Cron schedules

1. In Database → Extensions, enable `pg_cron`, `pg_net`, and `supabase_vault` if they are not already enabled.
2. In Database → Vault, create these four secrets. Store the exact service-role key that Supabase injects as `SUPABASE_SERVICE_ROLE_KEY`; the other two worker values must exactly match their Edge Function secrets.

   - `prospect_ai_project_url`
   - `prospect_ai_service_role_key`
   - `prospect_ai_outbox_worker_secret`
   - `prospect_ai_discovery_secret`

3. Run [`schedule-workers.sql`](schedule-workers.sql) in the SQL Editor for the same project. It creates an email worker every five minutes and a discovery worker once a day at 13:00 UTC. The script is safe to rerun: Cron updates jobs that already use these names.
4. Confirm both jobs are active in Integrations → Cron. Check Edge Function logs and Admin → Operations after the first invocations.
5. In Settings, separately enable Remote OK and its daily schedule for the account. The scheduled worker only claims opted-in sources and remains bounded by the owner/global monthly caps.

The SQL script sends the service-role JWT in `Authorization`, which is required by the functions' enabled JWT gateway check and is independently checked by the handlers. Keep the Vault entries restricted to trusted project operators.

## 3. Deploy and verify

After applying any pending migrations, deploy these functions to the intended Supabase project:

```powershell
supabase functions deploy discover
supabase functions deploy dispatch-notification-email
supabase functions deploy scheduled-discovery
```

Verify in order: authenticated manual Remote OK search; saved and deduplicated lead; an opted-in verified email alert delivered to the account owner; scheduler heartbeat and a scheduled result after opting in. Admin → Operations shows bounded discovery error codes, email queue status, and scheduler health. Do not activate production until each acceptance check is confirmed.
