# ADR 0004: Notification delivery

- Status: Accepted for implementation; live sender and scheduler setup pending.
- Date: 2026-10-20

## Context

The product needs durable in-app alerts and optional email without allowing an email-provider outage to suppress the in-app alert. Delivery must not expose addresses, provider keys, or service-role credentials to the browser. Duplicate jobs and transient provider errors need bounded, recoverable handling.

## Decision

- Persist the in-app notification first. A database trigger creates one email outbox row only when the account opted in and the Auth email is confirmed.
- Store no destination address in the outbox; the server worker looks up the current confirmed Auth address at send time.
- Use Resend as the initial transactional email adapter. Send from a verified sender and use the outbox UUID as the provider idempotency key.
- Claim at most 20 jobs at a time with row locks and `SKIP LOCKED`. Retry transient errors with bounded backoff, stop after five attempts, and retain a bounded error code for operations.
- Protect the Edge Function with Supabase JWT verification and a separate high-entropy worker header secret. Keep the legacy service-role credential and Resend key server-side only.
- Do not enable the sender until a scheduler, verified sender, secrets, delivery checks, and queue monitoring are configured.

## Consequences

- Supabase Auth email confirmation is the verified destination check. Disabling an account preference stops future queueing; queued work also checks the current preference before sending.
- Provider idempotency protects retries after ambiguous network outcomes. Retry, opt-out, and RLS behavior still require local and deployed integration tests.
- Scheduler choice remains deployment-specific. Admin UI, alerting, and dead-letter recovery tooling remain follow-up work.
