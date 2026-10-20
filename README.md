# Remy Prospect AI

Remy Prospect AI is a personal, evidence-led workspace for finding and managing software work. It supports active opportunity tracking and company prospecting for a developer serving Nigeria and international markets.

## Current implementation

- Responsive overview, opportunities, companies, research, notifications, and settings screens.
- Manually add opportunities or companies with public source URLs, notes, evidence labels, tags, location, and pipeline status.
- Search and filter the pipeline by status, score, and location; export filtered records as CSV; inspect evidence and score rationale; and keep private notes and follow-up dates.
- Edit skills, services, target markets, portfolio links, experience summary, and the notification threshold. Browser mode persists the profile in local storage; Supabase mode syncs it to the account profile.
- Supabase PostgreSQL migration for profiles, roles, sources, runs, leads, evidence, explainable score history, notifications, email outbox, and audit logs with row-level security.
- Fit-score contract uses relevance (35%), evidence of need (25%), budget signals (15%), freshness (15%), and source confidence (10%). Unknown budgets remain unknown and must not be treated as zero fit.

**Sample records are illustrative synthetic examples.** Their `example.com` URLs are placeholders, not real opportunities. Replace or remove them before making decisions based on the data.

Automated search, external AI research, scheduled jobs, authentication, and email delivery are not live until their server-side services and secrets are configured. The app calls this out in the UI; it does not claim to have run discovery. There is no automatic job application or unsolicited outreach.

## Run locally

Requirements: Node.js 22.18+ and npm.

```sh
npm install
npm run dev
```

The app runs in local browser-storage mode by default. Local data stays in that browser and is not synced or backed up. Do not put provider keys in `VITE_*` variables or in browser storage.

To use Supabase Auth/cloud mode, copy `.env.example` to `.env.local`, fill in the project URL and anon/publishable key, then restart Vite. Apply all versioned migrations first; cloud mode will stop at a setup error if its schema is unavailable.

## Backend setup

1. Create a Supabase project and install the Supabase CLI.
2. Link the project and apply the versioned database migrations:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Configure authentication email settings and provision the owner role using the trusted process in [DOCS/OWNER_BOOTSTRAP.md](DOCS/OWNER_BOOTSTRAP.md); do not let users self-assign admin roles.
4. Copy `.env.example` to `.env.local` and set the Supabase project URL and anon/publishable key. The frontend uses Auth and RLS; no service-role secret belongs in this file.
5. Deploy the discovery function and set `APP_ORIGIN`, `BRAVE_SEARCH_API_KEY`, `BRAVE_SEARCH_MONTHLY_LIMIT`, `BRAVE_SEARCH_ENABLED=false`, and `BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED=false` as Supabase Function secrets. The function has an atomic per-user monthly request cap. Search stays disabled until both owner-level approval and server-side provider approval are set. Because the app stores result titles, URLs, and snippets, enable storage only with a Brave plan that explicitly grants storage rights; the API terms prohibit storing results without those rights. Review [Brave pricing](https://brave.com/search/api/) and the [Search API terms](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service) before enabling.
6. Add a verified permitted source policy before discovery use. Configure email and deploy other Edge Functions only after choosing those providers and reviewing their price and terms.

Without Supabase values the app uses local browser storage. With Supabase values, it requires an authenticated account and syncs leads/profile/evidence through owner-scoped RLS. Apply all versioned migrations before cloud mode can load data.

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
See [DOCS/ARCHITECTURE.md](DOCS/ARCHITECTURE.md) for the architecture diagram, data model, environment boundaries, and deferred integrations.

## Database security checks

After installing the Supabase CLI and applying the migrations to the local Supabase stack, run the two-account RLS and privilege-escalation regression test:

```sh
supabase start
supabase db reset
supabase test db
```

The SQL test creates disposable Auth users and rolls the transaction back. It is not a substitute for verifying the deployed project and account configuration.
