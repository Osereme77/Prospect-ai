# Operations and recovery runbook

This runbook describes the current development implementation. It is not evidence that a production scheduler, email sender, or alerting service has been configured. Keep recurring discovery and email disabled until the hosting plan, provider terms, credentials, and recovery path have been reviewed.

## Stop provider activity

1. To stop future discovery globally, set the relevant Edge Function secret to `REMOTE_OK_ENABLED=false` and/or `BRAVE_SEARCH_ENABLED=false`. The server rejects disabled providers before making a request.
2. An admin can pause an individual registered source in **Admin → Discovery sources**. An owner can also disable their source approval in **Settings**. These controls are separate from the global server flags.
3. To stop email delivery, disable the scheduler invocation if one has been configured. The worker also fails closed when `OUTBOX_WORKER_SECRET`, `RESEND_API_KEY`, or `EMAIL_FROM` is missing.
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
3. Delivery requires all four server values: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `EMAIL_FROM`, plus `OUTBOX_WORKER_SECRET`. The recipient is looked up from Supabase Auth and is sent mail only when the profile has opted in and the address is verified.
4. A `sending` row locked for more than 15 minutes can be reclaimed by the next worker invocation. Automatic delivery is bounded to five attempts. Provider timeouts, HTTP 5xx, and HTTP 429 responses are retried; most other HTTP 4xx responses are terminal. Resend requests reuse the outbox idempotency key.
5. Fix the sender, account, or provider problem before retrying. An admin can use **Retry** on a failed row; the database function audits the action, resets the attempt counter, and preserves the original notification/idempotency identity. Do not retry an unverified or opted-out recipient; those rows are terminal until the owner resolves eligibility.
6. If repeated failures occur, stop the scheduler, correct the cause, then resume it and watch the next bounded batch in **Admin**. The Admin page warns when the oldest queued item has waited at least 15 minutes, a sending lock is stale, or deliveries have failed. These checks run when an administrator opens or refreshes the page; no external scheduler heartbeat or out-of-band alert is configured.

## Database and deployment safety

- The GitHub database job creates an isolated local Supabase stack, runs `supabase db reset --local`, lints it, and then runs pgTAP. Never substitute a linked/production target for a local reset.
- A schema or pgTAP failure blocks release. Use the detailed GitHub Actions step log or its `supabase-db-test-log` artifact; do not treat migration lint alone as proof that RLS tests pass.
- Before changing a live project, verify the linked project reference, review the migration diff, confirm a recent backup, and follow the owner bootstrap/recovery process in [OWNER_BOOTSTRAP.md](OWNER_BOOTSTRAP.md). Never edit `supabase_migrations.schema_migrations` by hand to make histories appear aligned.
- Production recovery is not ready until the owner has selected a host and plan, documented backups and restore, verified Auth redirects, and tested the scheduler and email worker with the browser closed.

## Related decisions

- [ADR 0004: notification delivery](adr/0004-notification-delivery.md)
- [ADR 0005: scheduled execution and job recovery](adr/0005-scheduled-execution.md)
- [ADR 0007: deployment environments and operational logging](adr/0007-deployment-and-operations.md)
