# ADR 0005: Scheduled execution and job recovery

- Status: Supabase Cron is the preferred scheduler, pending owner confirmation of the project plan and operational setup.
- Date: 2026-10-20

## Context

Discovery currently runs from an authenticated user action. The email Edge Function can claim a bounded batch from the outbox, but no scheduler is configured. The product must work with the browser closed for recurring discovery and email delivery, while provider limits, idempotency, retries, and free-tier limits remain observable.

## Decision

Use Supabase Cron (`pg_cron` with `pg_net`) as the preferred scheduler because it runs beside the Supabase database and can invoke Edge Functions. Store invocation credentials in Supabase Vault and keep Edge Function JWT verification enabled. Do not create schedules until the owner confirms the project plan, service limits, and deployment settings.

The implementation baseline is a server-side schedule invoking bounded, authenticated handlers. Every scheduled handler must have a stable job key, a lock or claim operation, a bounded batch/time limit, persistent run status, retry policy, and an operator-visible recovery path. A missed or duplicated invocation must be safe to retry.

The authenticated `discover` function requires a user session, owner approval, and a per-run idempotency key; do not call it from a public cron job or weaken its user checks to make scheduling convenient. A separate `scheduled-discovery` coordinator now handles only explicitly opted-in Remote OK sources. It has service-role-only claim, finish, and persistence RPCs; bounded batch and result sizes; atomic monthly quota reservation; URL validation; run records; deduplication; and capped backoff. It remains inactive until migration/function deployment, server secrets, a verified operator cron, and an end-to-end browser-closed run are completed.

## Platform capability review (2026-10-22)

- [Supabase Cron](https://supabase.com/docs/guides/cron) uses `pg_cron` and can run SQL or call Edge Functions through `pg_net`; Supabase recommends no more than eight concurrent jobs and a job duration below ten minutes. [Hosted Edge Functions](https://supabase.com/docs/guides/functions/limits) have a 150-second wall-clock limit on the Free plan, so each scheduled handler must remain bounded and return promptly.
- [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/) have a 30-second limit and run only for published deploys, not branch deploys or Deploy Previews. They are unsuitable for operating scheduled work while `ui-test` remains a preview branch.
- Supabase's current [pricing page](https://supabase.com/pricing) lists 500,000 monthly Edge Function invocations on Free and notes that Free projects can pause after one week of inactivity. The Cron pages do not specify a separate Cron charge or confirm plan availability for this project; verify the project's dashboard plan before activation.
- The email worker claims at most 20 rows and fails closed without server-side secrets. A five-minute Supabase Cron interval is a candidate after the sender and worker are verified. Scheduled discovery claims at most three sources per invocation; each source is due daily after success and uses 1-hour, 4-hour, then 24-hour failure backoff. The endpoint requires both the service-role bearer token and a separate high-entropy scheduler secret. Do not configure Cron until the project's plan, secrets, deployed migrations/function, and recovery path are verified.

## Options considered

- Supabase Cron/pg_cron: preferred for this architecture, subject to the project's plan, extension availability, and secret setup.
- Hosting-provider cron: rejected for now because Netlify schedules run only from published deploys and have a 30-second limit.
- GitHub Actions schedule: useful for maintenance jobs but less suitable as the production scheduler until repository secrets, reliability, retries, and availability are reviewed.

## Consequences

- Email delivery remains inactive until a verified sender, secrets, and a scheduler are configured and tested.
- Recurring discovery code is present but remains disabled until operator configuration and hosted acceptance. Manual intake and authenticated on-demand discovery remain available.
- Queue age, retry exhaustion, stale locks, run failure, and monthly quota need monitoring and a recovery runbook before alpha.

## Acceptance evidence

Record the selected scheduler, plan limits, failure/duplicate-invocation results, browser-closed run, recovery procedure, and operational alerts in the implementation status after deployment. Until then, do not describe recurring discovery as active.
