# ADR 0001: Web and data platform

- Status: Accepted as the implementation baseline; production deployment not yet verified.
- Date: 2026-10-20

## Context

The PRD calls for a responsive browser workspace, Auth, durable relational data, and protected server-side provider calls. The repository initially contained product documents only. A local-first experience is useful without project credentials, but local storage must not be presented as account-backed synchronization.

## Decision

- Use React, TypeScript, and Vite for the browser application.
- Use Supabase Auth and PostgreSQL with RLS for configured cloud mode.
- Keep browser mode operational without Supabase environment variables, using local storage and explicitly synthetic example records.
- Call external providers only through Supabase Edge Functions. Never expose provider or service-role credentials in the browser.

## Consequences

- Cloud mode requires the migration and valid Supabase URL/publishable key (or legacy anon key); it blocks editing if account data cannot be loaded.
- Local browser mode is not synced, backed up, or a substitute for account security.
- Deployment, email callbacks, database policies, and multi-account isolation remain to be verified in a real Supabase project.
