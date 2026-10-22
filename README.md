# Remy Prospect AI

Remy Prospect AI is a personal, evidence-led workspace for finding and managing software work. It supports active opportunity tracking and company prospecting for a developer serving Nigeria and international markets.

## Current implementation

- Responsive overview, opportunities, companies, research, notifications, and settings screens.
- Manually add opportunities or companies with public source URLs, notes, evidence labels, tags, location, and pipeline status.
- Review a bounded public-page excerpt locally to extract unverified need, budget, and timing observations; show missing fields explicitly and keep the excerpt out of AI services.
- Search and filter the pipeline by status, score, and location; export filtered records as CSV; inspect evidence and score rationale; and keep private notes and follow-up dates.
- Edit skills, services, target markets, portfolio links, experience summary, and the notification threshold. Browser mode persists the profile in local storage; Supabase mode syncs it to the account profile.
- Supabase PostgreSQL migration for profiles, roles, sources, runs, leads, evidence, explainable score history, notifications, email outbox, and audit logs with row-level security.
- Fit-score contract uses relevance (35%), evidence of need (25%), budget signals (15%), freshness (15%), and source confidence (10%). Unknown budgets remain unknown and must not be treated as zero fit.

The primary preview target is the Netlify branch deploy for `ui-test`; it keeps the production branch unchanged. The owner has confirmed the preview is available at `https://ui-test--jobsremyai.netlify.app`. If it is missing from Netlify's Deploys list, open **Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts → Configure**, select **Let me add individual branches**, add `ui-test`, and save.

The Netlify site uses `netlify.toml` to build with `npm run build`, publish `dist`, and route application paths to the SPA entry point. The current production address is `https://jobsremyai.netlify.app`; the preview is `https://ui-test--jobsremyai.netlify.app`. Netlify does not read the local `.env.local` file. To enable Supabase Auth and cloud sync there, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Project configuration → Environment variables**, with the **Builds** scope and the intended deploy context. Then trigger a new deploy; environment changes do not update an existing bundle. The app sends sign-up and password-recovery links back to the current page origin, so add both `https://ui-test--jobsremyai.netlify.app/**` and `https://jobsremyai.netlify.app/**` to Supabase Auth's allowed redirect URLs. Set Supabase Auth's site URL to the intended primary hosted origin. Use only the publishable key in these browser build variables; never put a secret/service-role key or provider credential in a `VITE_*` variable. Keep the Netlify site on the development Supabase project until separate production credentials and redirect settings are prepared. See [Netlify environment variable setup](https://docs.netlify.com/build/environment-variables/get-started/).

**Sample records are illustrative synthetic examples.** Their `example.com` URLs are placeholders, not real opportunities. Replace or remove them before making decisions based on the data.

Supabase Auth and cloud sync are implemented for configured projects; the Auth email and redirect settings still need to be checked for each environment. Automated discovery remains disabled until the owner reviews the source terms, approves it in Settings, and a server operator enables its flag and cap. Remote page fetching, external AI research, scheduled jobs, and email delivery are not active. The app does not claim to have run discovery. There is no automatic job application or unsolicited outreach.

## Run locally

Requirements: Node.js 22.18+ and npm.

```sh
npm install
npm run dev
```

The app runs in local browser-storage mode by default. Local data stays in that browser and is not synced or backed up. Do not put provider keys in `VITE_*` variables or in browser storage.

To use Supabase Auth/cloud mode, copy `.env.example` to `.env.local`, fill in the project URL and publishable key, then restart Vite. Apply all versioned migrations first; cloud mode will stop at a setup error if its schema is unavailable. See the [design system](DOCS/DESIGN_SYSTEM.md) for the visual tokens, layout, component states, and accessibility baseline.

## Backend setup

1. Create a Supabase project and install the Supabase CLI. Authenticate once with `npm exec supabase -- login`; the one-time browser code is private and should not be shared.
2. Link the project and apply the versioned database migrations:

   ```sh
   npm exec supabase -- link --project-ref YOUR_PROJECT_REF
   npm exec supabase -- db push --dry-run
   npm exec supabase -- db push
   ```

3. Configure authentication email settings and provision the owner role using the trusted process in [DOCS/OWNER_BOOTSTRAP.md](DOCS/OWNER_BOOTSTRAP.md); do not let users self-assign admin roles.
4. Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable key. The frontend uses Auth and RLS; put only the publishable key in this file, never a secret/service-role key.
5. Deploy the discovery function with `npm exec supabase -- functions deploy discover`. Set `APP_ORIGIN`, `REMOTE_OK_ENABLED=false`, and `REMOTE_OK_MONTHLY_LIMIT` as Supabase Function secrets. Remote OK uses its free public JSON feed without a provider key; it is opportunity-only, filters search terms locally, shows a follow link to Remote OK, and keeps direct links to original job posts. Review the [feed FAQ](https://remoteok.com/faq) and [terms](https://remoteok.com/legal). Company search through Brave remains disabled until separate written storage rights are confirmed; review [Brave pricing](https://brave.com/search/api/) and [API terms](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service). Account approval and monthly caps are enforced in addition to server-side enable flags.
6. To enable optional email alerts, verify a sender domain with Resend, set `RESEND_API_KEY`, `EMAIL_FROM`, and a high-entropy `OUTBOX_WORKER_SECRET` as Supabase Edge Function secrets, then deploy `dispatch-notification-email`. Configure a scheduler to invoke it with project service-role authorization and the worker secret. Keep both credentials server-side; use the owner-verified Auth email as the destination. Do not enable delivery until a test message, opt-out, and retry have been checked. See [ADR 0004](DOCS/adr/0004-notification-delivery.md).

Without Supabase values the app uses local browser storage. With Supabase values, it requires an authenticated account and syncs leads/profile/evidence through owner-scoped RLS. Apply all versioned migrations before cloud mode can load data.

## Product safety and data handling

- Respect source terms, privacy requirements, quotas, and access restrictions. Do not bypass paywalls, logins, CAPTCHAs, or anti-bot controls.
- Save original public URLs and distinguish observed evidence from hypotheses and missing information.
- Never invent contact details, budgets, requirements, or hiring intent.
- User review is required before any external contact; application submission and unsolicited outreach are not automated.
- External requests and provider credentials belong on trusted server-side functions. Provider adapters use fixed endpoints, and public URL validation rejects local/private hosts and alternate loopback notation. Remote page fetching remains disabled; any future fetcher must add DNS-aware SSRF checks, safe redirect handling, bounded responses, rate limits, audit events, idempotency, retries, and per-user quotas before enabling automated intake.

## Quality checks

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the phased delivery plan and [DOCS/PROSPECT PRD.pdf](DOCS/PROSPECT%20PRD.pdf) for the full product requirements.
See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for what is implemented and which account-specific setup steps remain.
See [DOCS/ARCHITECTURE.md](DOCS/ARCHITECTURE.md) for the architecture diagram, data model, environment boundaries, and deferred integrations.
See [DOCS/UX_FLOWS.md](DOCS/UX_FLOWS.md) for the main journeys, low-fidelity layouts, and owner review checklist.
See [DOCS/OPERATIONS_RUNBOOK.md](DOCS/OPERATIONS_RUNBOOK.md) for current discovery/email triage and recovery procedures.

## Database security checks

After installing the Supabase CLI and applying the migrations to the local Supabase stack, run the two-account RLS and privilege-escalation regression test:

```sh
supabase start
supabase db reset
supabase test db
```

The SQL test creates disposable Auth users and rolls the transaction back. It is not a substitute for verifying the deployed project and account configuration.
