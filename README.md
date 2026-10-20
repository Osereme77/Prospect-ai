# Remy Prospect AI

Remy Prospect AI is a personal, evidence-led workspace for finding and managing software work. It supports active opportunity tracking and company prospecting for a developer serving Nigeria and international markets.

## Current implementation

- Responsive overview, opportunities, companies, research, notifications, and settings screens.
- Manually add opportunities or companies with public source URLs, notes, evidence labels, tags, location, and pipeline status.
- Search the local pipeline, edit a lead's status, inspect evidence and score rationale, and keep private notes.
- Edit a skills and services profile; browser data persists in local storage.
- Supabase PostgreSQL migration for profiles, roles, sources, runs, leads, evidence, explainable score history, notifications, email outbox, and audit logs with row-level security.
- Fit-score contract uses relevance (35%), evidence of need (25%), budget signals (15%), freshness (15%), and source confidence (10%). Unknown budgets remain unknown and must not be treated as zero fit.

**Sample records are illustrative synthetic examples.** Their `example.com` URLs are placeholders, not real opportunities. Replace or remove them before making decisions based on the data.

Automated search, external AI research, scheduled jobs, authentication, and email delivery are not live until their server-side services and secrets are configured. The app calls this out in the UI; it does not claim to have run discovery. There is no automatic job application or unsolicited outreach.

## Run locally

Requirements: Node.js 20+ and npm.

```sh
npm install
npm run dev
```

The app runs in local browser-storage mode by default. Local data stays in that browser and is not synced or backed up. Do not put provider keys in `VITE_*` variables or in browser storage.

## Backend setup

1. Create a Supabase project and install the Supabase CLI.
2. Link the project and apply the initial database migration:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Configure authentication email settings and the trusted initial admin role using a controlled server-side process; do not let users self-assign admin roles.
4. Implement and deploy Edge Functions for search, import URL validation/research, scoring persistence, scheduled run coordination, and email outbox delivery. Keep provider credentials in Supabase Function secrets.
5. Add authenticated Supabase client integration and owner-scoped synchronization before placing real user data in the backend.

The current browser mode does not authenticate users or sync to Supabase. `supabase/migrations/202610200001_initial_schema.sql` is the data-security foundation, not a claim that an account has already been connected.

## Product safety and data handling

- Respect source terms, privacy requirements, quotas, and access restrictions. Do not bypass paywalls, logins, CAPTCHAs, or anti-bot controls.
- Save original public URLs and distinguish observed evidence from hypotheses and missing information.
- Never invent contact details, budgets, requirements, or hiring intent.
- User review is required before any external contact; application submission and unsolicited outreach are not automated.
- External requests and provider credentials belong on trusted server-side functions. Add URL allow-list/SSRF protections, rate limits, audit events, idempotency, retries, and per-user quotas before enabling automated intake.

## Quality checks

```sh
npm test
npm run build
```

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the phased delivery plan and [DOCS/PROSPECT PRD.pdf](DOCS/PROSPECT%20PRD.pdf) for the full product requirements.
See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for what is implemented and which account-specific setup steps remain.
