# Application architecture

This document describes the implementation on `ui-test`. External services remain opt-in until their owner, terms, limits, and environment configuration are approved.

## Runtime context and trust boundaries

```mermaid
flowchart LR
  Person[Workspace owner] -->|HTTPS browser session| Web[React + TypeScript app]
  Web -->|Supabase Auth session| Auth[Supabase Auth]
  Web -->|User JWT; RLS enforced| DB[(Supabase Postgres)]
  Web -->|User JWT; bounded query| Edge[discover Edge Function]
  Edge -->|JWT verified; quota reserved| DB
  Edge -->|Server-side API key| Search[Brave Search API]
  DB -->|Opted-in + verified only| Outbox[Email outbox]
  Scheduler -->|Service authorization + worker secret| Worker[Email Edge Function]
  Worker -->|Claim, send state| Outbox
  Worker -->|Server API key| Resend[Resend]
  Web -.->|No cloud config| Local[(Browser local storage)]
```

The browser contains only the Supabase project URL and publishable key (or a legacy anon key). Secret/service-role credentials stay in managed server-side secrets. The discovery function checks the user session, requires owner terms and storage-rights consent plus a separate operator storage-rights flag, validates request bounds, reserves the lower per-user/global monthly quota, filters returned URLs, and records source/run attribution. Removing the source deletes its stored result leads and linked evidence, scores, and notifications. It does not fetch result pages or submit applications. Migration 007 adds RLS-protected operational reads for admin roles and an audited RPC to retry failed notification email; it does not grant ordinary users cross-account visibility.

## Data model

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : configures
  AUTH_USERS ||--|| USER_ROLES : assigned
  AUTH_USERS ||--o{ DISCOVERY_SOURCES : owns
  AUTH_USERS ||--o{ SEARCH_RUNS : requests
  SEARCH_RUNS ||--o{ DISCOVERY_RESERVATIONS : consumes
  SEARCH_RUNS ||--o{ LEADS : discovers
  AUTH_USERS ||--o{ LEADS : owns
  LEADS ||--o{ LEAD_EVIDENCE : supports
  LEADS ||--o{ LEAD_SCORES : records
  LEADS ||--o{ NOTIFICATIONS : alerts
  NOTIFICATIONS ||--o{ OUTBOX : queues
  AUTH_USERS ||--o{ AUDIT_LOGS : acts
```

All workspace reads and writes use owner-scoped RLS. Duplicate links must point to a canonical lead belonging to the same owner. Score snapshots are append-oriented and use a scoring version. A qualifying notification is always saved in-app; a database trigger separately queues email only when the owner opted in and their Auth email is verified. The outbox stores no recipient address. A server-only worker looks up the confirmed address, sends through Resend with a stable idempotency key, and records bounded retry/failure states. The worker and trigger are implemented but remain inactive until the migration, provider secrets, verified sender, and scheduler are configured. Audit event writers are not deployed.

## Environments and secret handling

| Environment | Frontend config | Database | Provider credentials |
| --- | --- | --- | --- |
| Local, no Supabase config | None | Browser storage, synthetic sample records | None |
| Local cloud development | `.env.local`, ignored by Git | Supabase project selected by owner | Supabase Edge Function secrets only |
| Preview/production | Host-managed public Supabase URL/key | Separate Supabase environments recommended | Managed server secrets, never `VITE_*` |

The repository has no connected cloud project, hosting environment, or secret store configured. Use additive migrations through `supabase db push`; verify backup and rollback before production changes. Trusted Super Admin provisioning and recovery steps are documented in [OWNER_BOOTSTRAP.md](OWNER_BOOTSTRAP.md). The Admin screen is gated by the database role and adds no browser-held privileged credential.

## Deferred boundaries

- Discovery is manual and Brave-only today. Owner source approval, plan storage-rights confirmation, request caps, and source-result deletion are implemented. Scheduled jobs, independent-source retries, and admin source controls are not.
- Research uses deterministic scoring and human evidence review. Page-fetching research and AI summaries are disabled.
- Email provider choice is Resend in the worker implementation. Verify the sender domain, set `RESEND_API_KEY`, `EMAIL_FROM`, and a high-entropy `OUTBOX_WORKER_SECRET` as Edge Function secrets, deploy `dispatch-notification-email`, and configure a scheduler to call it with both the project service-role authorization and `x-worker-secret`. Keep every secret out of browser variables and Git. Confirm email delivery, retry behavior, queue age, and opt-out before enabling this channel for routine use.
- The outbox RPCs accept service-role calls only; authenticated users can read only their own outbox rows. The worker sends only to the current confirmed Auth address and never accepts an email destination from the browser.
- Admin roles and an `is_admin()` database helper back an Admin screen for recent source, run, email outbox, and audit data. Only failed email outbox items can be retried; the security-definer RPC checks the caller's admin role and records the action. Role bootstrap remains a trusted owner operation and is not exposed to ordinary users.

Do not mark these integrations operational until deployment and acceptance checks are recorded in [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md).
