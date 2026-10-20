# ADR 0007: Deployment environments and operational logging

- Status: Pending owner selection and current plan-capability review.
- Date: 2026-10-20

## Context

The repository has a Vite frontend and Supabase migrations/functions, but no hosting provider, production environment, custom domain, backup plan, or managed alerting target has been selected. A Supabase project exists for development; that does not establish production readiness or justify placing preview and production data in the same project.

## Decision

Keep deployment target and production environment unselected until the owner reviews current plan limits, region, authentication callback support, function secrets, scheduler support, backups, and cost. Use separate development, preview, and production configuration when the selected services support it. Never use a service-role or provider secret in a `VITE_*` variable.

Operational logs must be structured and redacted. Do not log passwords, access/refresh tokens, API keys, full auth headers, raw page text, or unnecessary personal data. Use opaque request/run IDs and bounded error codes. Database audit events are reserved for privileged changes and must contain only the actor, action, entity, timestamp, and minimal non-secret metadata.

## Options considered

- Static frontend host plus Supabase: a natural fit for the current architecture; verify free-tier build, custom-domain, environment, function, and cron limits before choosing.
- Combined application platform: may simplify deploys but must still support the required Auth, Postgres/RLS, Edge Function secrets, migrations, and job execution.
- Self-hosting: gives control but adds patching, backups, monitoring, and on-call burden that is not justified for the first owner-only release.

## Consequences

- `ui-test` is the review/staging branch; do not merge to `main` before the owner's release gate.
- Cloud migrations and provider functions are not considered deployed until verified against the actual project.
- Alpha requires backup/restore proof, rollback instructions, auth redirect validation, secret rotation guidance, and a method to disable providers quickly.
