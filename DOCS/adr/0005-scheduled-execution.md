# ADR 0005: Scheduled execution and job recovery

- Status: Deferred pending hosting and Supabase capability review.
- Date: 2026-10-20

## Context

Discovery currently runs from an authenticated user action. The email Edge Function can claim a bounded batch from the outbox, but no scheduler is configured. The product must work with the browser closed for recurring discovery and email delivery, while provider limits, idempotency, retries, and free-tier limits remain observable.

## Decision

Do not configure recurring jobs until the owner selects a hosting plan and its current scheduler limits are verified. The implementation baseline is a server-side schedule invoking bounded, authenticated handlers. Every scheduled handler must have a stable job key, a lock or claim operation, a bounded batch/time limit, persistent run status, retry policy, and an operator-visible recovery path. A missed or duplicated invocation must be safe to retry.

Discovery does not yet have a service-role scheduled handler. The current `discover` function requires a user session, owner approval, and a per-run idempotency key; do not call it from a public cron job or weaken its user checks to make scheduling convenient. A separate privileged coordinator requires its own threat model, source eligibility rules, quota reservation, and audit trail before implementation.

## Options considered

- Supabase Cron/pg_cron: close to the data and suitable for invoking an Edge Function, subject to project plan, extension, and current limits.
- Hosting-provider cron: simple deployment coupling, subject to plan limits, timeout, and secret-management review.
- GitHub Actions schedule: useful for maintenance jobs but less suitable as the production scheduler until repository secrets, reliability, retries, and availability are reviewed.

## Consequences

- Email delivery remains inactive until a verified sender, secrets, and a scheduler are configured and tested.
- Recurring discovery remains disabled; manual intake and authenticated on-demand discovery remain available.
- Queue age, retry exhaustion, stale locks, run failure, and monthly quota need monitoring and a recovery runbook before alpha.

## Acceptance evidence

Record the selected scheduler, plan limits, failure/duplicate-invocation results, browser-closed run, recovery procedure, and operational alerts in the implementation status after deployment.
