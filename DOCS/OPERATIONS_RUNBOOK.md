# Operations and recovery runbook

This runbook describes the current development implementation. It is not evidence that a production scheduler, email sender, or alerting service has been configured. Keep recurring discovery and email disabled until the hosting plan, provider terms, credentials, and recovery path have been reviewed.

## Development discovery state (2026-10-23)

- The owner's written approval for Remote OK was recorded. The development project's `discover` function is enabled for this free public feed with a 100-request monthly provider cap; the account source is enabled with a matching cap and an audited maintenance record. The function CORS allowlist contains only localhost and `https://ui-test--jobsremyai.netlify.app`; its preview-origin preflight returned HTTP 200. The account-level audit trigger cannot attribute this setup to an authenticated session, so the maintenance audit entry has a null actor.
- Remote OK's [feed FAQ](https://remoteok.com/faq) says its feeds are free and asks aggregators to credit Remote OK and link each original post. The app displays the attribution and preserves the original post URL.
- This configuration does not prove discovery works end to end. Hosted sign-in has failed, so an authenticated on-demand run has not been verified. Do not claim results until a real run appears in **Recent search runs**.
- Scheduled discovery remains off. There is no scheduler secret or private scheduler, and the account-level scheduled opt-in is false. Do not enable cron as part of this provider approval.

## Stop provider activity

1. To stop future discovery globally, set the relevant Edge Function secret to `REMOTE_OK_ENABLED=false` and/or `BRAVE_SEARCH_ENABLED=false`. The server rejects disabled providers before making a request.
2. An admin can pause an individual registered source in **Admin → Discovery sources**. An owner can also disable their source approval in **Settings**. These controls are separate from the global server flags.
3. To stop email delivery, disable the scheduler invocation if one has been configured. The worker fails closed when `OUTBOX_WORKER_SECRET`, both Resend key names (`RESEND_API_KEY` and the backward-compatible `Resend_Api`), or `EMAIL_FROM` is missing.
4. If a secret may have been exposed, rotate it in Supabase and in the invoking scheduler. Do not paste secrets into issue reports, chat, browser code, or database logs.

## Triage a discovery run

Open **Admin → Recent search runs** and inspect the status and bounded error summary. Current Edge Function responses use these codes:

| Code | Meaning | Recovery |
|---|---|---|
| `provider_not_configured_or_disabled` | Global provider flag, key, or monthly cap is missing or disabled. | Check server-side secrets and keep the source off until terms, storage rights, and caps are approved. |
| `source_not_approved_by_owner` | The account has not saved current terms approval and, for Brave, storage-rights confirmation. | The owner reviews the terms and saves approval in Settings. |
| `monthly_limit_reached` | The account or provider-wide reservation cap has been reached. | Review usage and the configured limits; do not bypass or reset usage to force a request. |
| `provider_error` | The provider request failed, timed out, or returned an unsuccessful response. | Check provider availability and request limits, then let the owner retry manually after the cause is resolved. |
| `quota_check_failed` | The server-side quota reservation failed. | Keep discovery paused, inspect the database/function configuration, and retry only after the reservation path is healthy. |

Requests reserve quota before calling a provider. A failed provider request does not automatically refund that reservation. A retry is a new user-initiated request with its own idempotency key. The `discover` function requires an authenticated user and must not be called by a public cron job.

## Triage email delivery

1. Open **Admin → Notification delivery** and inspect status, attempt count, and the bounded `last_error_code`.
2. The worker accepts only server-to-server `POST` requests carrying `x-worker-secret`. It claims at most 20 outbox rows per invocation. Never call it from browser code or expose its secret to the frontend.
3. Delivery requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, either `RESEND_API_KEY` or the backward-compatible `Resend_Api`, `EMAIL_FROM`, and `OUTBOX_WORKER_SECRET`. The existing development key is stored as `Resend_Api`; do not add another key under a duplicate name. Verify a sender domain you control with Resend, then use a sender address on that domain for `EMAIL_FROM`. The recipient is looked up from Supabase Auth and is sent mail only when the profile has opted in and the address is verified.
4. A `sending` row locked for more than 15 minutes can be reclaimed by the next worker invocation. Automatic delivery is bounded to five attempts. Provider timeouts, HTTP 5xx, and HTTP 429 responses are retried; most other HTTP 4xx responses are terminal. Resend requests reuse the outbox idempotency key.
5. Fix the sender, account, or provider problem before retrying. An admin can use **Retry** on a failed row; the database function audits the action, resets the attempt counter, and preserves the original notification/idempotency identity. Do not retry an unverified or opted-out recipient; those rows are terminal until the owner resolves eligibility.
6. If repeated failures occur, stop the scheduler, correct the cause, then resume it and watch the next bounded batch in **Admin**. The Admin page warns when the oldest queued item has waited at least 15 minutes, a sending lock is stale, or deliveries have failed. These checks run when an administrator opens or refreshes the page; no external scheduler heartbeat or out-of-band alert is configured.

## Scheduled discovery heartbeat

The `scheduled-discovery` Edge Function writes only aggregate start/finish status, bounded claimed/completed/failed counts, and a fixed error code to the service-only `scheduled_worker_health` table. Migrations 014 and the updated function are deployed to development. Admins read this through `admin_scheduled_worker_health()`; ordinary authenticated users and anonymous clients cannot read or write the table. The Admin screen warns when no run has completed, a run remains active for 15 minutes, a run failed, or no run completed in 36 hours. A recent heartbeat confirms that the endpoint ran; it does not establish source permission, data quality, or provider success for every claimed account. The operator scheduler is not configured; migration and function deployment alone do not activate it.

## Data retention and lead deletion

- There is no automatic expiration for workspace leads, evidence, scores, notifications, or audit history. The owner deletes records when they are no longer needed.
- To remove one prospect, open its details and choose **Delete prospect**. Confirm the prompt. In browser-local mode this removes the prospect and linked local alerts from that browser. In cloud mode the owner-scoped workspace transaction removes the lead; database foreign keys cascade its evidence, score history, linked notifications, and queued email jobs. Confirm the modal closes and the lead is absent before treating deletion as complete. If a cloud save fails, the app keeps the prior displayed record and reports that a retry is needed.
- To remove all results from one discovery source, use **Settings → Remove source and stored results**. The app disables the source first, then deletes its associated leads and linked records before removing the source configuration.
- The app does not currently provide self-service Auth account deletion. Account removal must be handled by a trusted project administrator after confirming the request and any required export. Deleting the Auth account cascades its owner-scoped workspace data; audit rows preserve the event shape with a null actor reference. Do not manually delete rows from `auth.users` or application tables with ad hoc SQL.
- A filtered CSV export covers lead fields only; it is not a full account archive and does not include private evidence history, notifications, credentials, or audit logs.

## Database and deployment safety

- The GitHub database job creates an isolated local Supabase stack, runs `supabase db reset --local`, lints it, and then runs pgTAP. Never substitute a linked/production target for a local reset.
- A schema or pgTAP failure blocks release. Use the detailed GitHub Actions step log or its `supabase-db-test-log` artifact; do not treat migration lint alone as proof that RLS tests pass.
- Before changing a live project, verify the linked project reference, review the migration diff, confirm a recent backup, and follow the owner bootstrap/recovery process in [OWNER_BOOTSTRAP.md](OWNER_BOOTSTRAP.md). Never edit `supabase_migrations.schema_migrations` by hand to make histories appear aligned.
- Production recovery is not ready until the owner has selected a host and plan, documented backups and restore, verified Auth redirects, and tested the scheduler and email worker with the browser closed.

## Related decisions

- [ADR 0004: notification delivery](adr/0004-notification-delivery.md)
- [ADR 0005: scheduled execution and job recovery](adr/0005-scheduled-execution.md)
- [ADR 0007: deployment environments and operational logging](adr/0007-deployment-and-operations.md)
