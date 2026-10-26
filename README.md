# Remy Scout

Your AI-powered assistant for discovering jobs, clients, and projects. Remy Scout is an evidence-led workspace for searching configured public sources, evaluating relevance, and organizing opportunities. Search coverage depends on enabled integrations; it does not guarantee employment, client responses, or income.

## Current implementation

- Responsive overview, opportunities, companies, research, notifications, and settings screens.
- Manually add opportunities or companies with public source URLs, notes, evidence labels, tags, location, and pipeline status.
- Review a bounded public-page excerpt locally to extract unverified need, budget, and timing observations; show missing fields explicitly and keep the excerpt out of AI services.
- Search and filter the pipeline by status, score, and location; export filtered records as CSV; inspect evidence and score rationale; and keep private notes and follow-up dates.
- Edit skills, services, target markets, portfolio links, experience summary, and the notification threshold. Browser mode persists the profile in local storage; Supabase mode syncs it to the account profile.
- Supabase PostgreSQL migration for profiles, roles, sources, runs, leads, evidence, explainable score history, notifications, email outbox, and audit logs with row-level security.
- Fit-score contract uses relevance (35%), evidence of need (25%), budget signals (15%), freshness (15%), and source confidence (10%). Unknown budgets remain unknown and must not be treated as zero fit.

The primary preview target is the Netlify branch deploy for `ui-test`; it keeps the production branch unchanged. The owner has confirmed the preview is available at `https://ui-test--jobsremyai.netlify.app`. If it is missing from Netlify's Deploys list, open **Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts → Configure**, select **Let me add individual branches**, add `ui-test`, and save.

The Netlify site uses `netlify.toml` to build with `npm run build`, publish `dist`, and route application paths to the SPA entry point. The current production address is `https://jobsremyai.netlify.app`; the preview is `https://ui-test--jobsremyai.netlify.app`. Netlify does not read the local `.env.local` file. To enable Supabase Auth and cloud sync there, open **Project configuration → Environment variables** and find `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Edit an existing variable instead of adding a duplicate. For the linked development project, the URL value is `https://pugvqkytxutnfucisurl.supabase.co`; use the Project URL from Supabase **Project Settings → API**, without quotes or a dashboard path. Each variable must include the **Builds** scope and the `branch-deploy` context (or the specific `ui-test` branch context). Save and trigger a new deploy; environment changes do not update an existing bundle. If these values are missing or malformed, visitors see the public landing page and account setup reports the configuration problem; the app does not expose an unauthenticated workspace. The app sends sign-up and password-recovery links back to the current page origin, so add both `https://ui-test--jobsremyai.netlify.app/**` and `https://jobsremyai.netlify.app/**` to Supabase Auth's allowed redirect URLs. Set Supabase Auth's site URL to the intended primary hosted origin. Use only the publishable key in these browser build variables; never put a secret/service-role key or provider credential in a `VITE_*` variable. Keep the Netlify site on the development Supabase project until separate production credentials and redirect settings are prepared. See [Netlify environment variable setup](https://docs.netlify.com/build/environment-variables/get-started/).

### Password reset email configuration

The app requests a recovery redirect to `/?auth=recovery` on the current site origin. In Supabase **Authentication → URL Configuration**, allow `https://ui-test--jobsremyai.netlify.app/**` for the branch preview. Then open **Authentication → Email Templates → Reset Password** and make the reset button link to `{{ .ConfirmationURL }}`. A custom template that links directly to `{{ .SiteURL }}` bypasses the requested recovery redirect and returns to the ordinary app screen. Save the template and request a **new** reset email; previously sent messages keep their old link. See Supabase's [email template variables](https://supabase.com/docs/guides/auth/auth-email-templates) and [redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls).

**Sample records are illustrative synthetic examples.** Their `example.com` URLs are placeholders, not real opportunities. Replace or remove them before making decisions based on the data.

Supabase Auth and cloud sync are implemented for configured projects; the Auth email and redirect settings still need to be checked for each environment. The approved Remote OK account source row is enabled on development with a 100-request account cap; the Edge Function global enable flag and cap remain unverified after the hosted request failed. The owner retried hosted discovery after the approved Remote OK source row was restored, but the UI still returned a generic failure; the server invocation and run record have not been inspected, so no successful discovery run is claimed. The once-daily Remote OK worker's migration and Edge Function are deployed, but scheduling remains off: there is no scheduler secret or private operator scheduler, and the account has not opted in. Brave discovery, remote page fetching, external AI research, and email delivery are not active. There is no automatic job application or unsolicited outreach.

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
5. Deploy the discovery function with `npm exec supabase -- functions deploy discover`. Set `APP_ALLOWED_ORIGINS` to a comma-separated list of exact browser origins (for development, include only the local app and `https://ui-test--jobsremyai.netlify.app`) and configure `REMOTE_OK_ENABLED` plus `REMOTE_OK_MONTHLY_LIMIT` as Supabase Function secrets only after the feed terms and caps are approved. Do not add the production origin until production uses its own Supabase project. The older single `APP_ORIGIN` setting remains supported. Remote OK uses its free public JSON feed without a provider key; it is opportunity-only, filters search terms locally, shows a follow link to Remote OK, and keeps direct links to original job posts. Review the [feed FAQ](https://remoteok.com/faq) and [terms](https://remoteok.com/legal). Company search through Brave remains disabled until separate written storage rights are confirmed. Brave's currently published Search plan is $5 per 1,000 requests with $5 in monthly credits; activating a plan requires payment details, so review [pricing](https://brave.com/search/api/), [billing help](https://api-dashboard.search.brave.com/documentation/resources/help-feedback), and the [API terms](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service) before enabling it. The default terms prohibit storing Search Results except for transient operation; persistent lead storage needs separate written authorization. Account approval and monthly caps are enforced in addition to server-side enable flags.
   Migration `202610200013_scheduled_discovery.sql` and the `scheduled-discovery` function are deployed to the linked development project. For another project, apply that migration and deploy the function. In development, the owner-approved Remote OK provider is enabled with a 100-request monthly server cap; its account schedule opt-in remains false. Before enabling schedules, set `SCHEDULED_DISCOVERY_SECRET` as a high-entropy server-side secret and configure a private scheduler that sends both `Authorization: Bearer <service-role-key>` and `x-scheduler-secret: <same-secret>`; store credentials in the scheduler's secret store, never in SQL source, browser code, or Git. The endpoint processes at most three opted-in accounts per invocation, reserves the existing quotas, persists only Remote OK URLs, and applies bounded backoff. Verify a browser-closed run and failure recovery before activation. See [ADR 0005](DOCS/adr/0005-scheduled-execution.md); scheduling is not enabled by deploying the function alone.
6. To enable optional email alerts, verify a sender domain you control with Resend. The worker accepts `RESEND_API_KEY` and the existing `Resend_Api` secret name; do not add a duplicate key if `Resend_Api` is already present. Add `EMAIL_FROM` using an address on the verified domain and a high-entropy `OUTBOX_WORKER_SECRET` as Supabase Edge Function secrets, then configure the scheduler. Keep credentials server-side; recipients must have opted in and have a verified Auth email. Test delivery, opt-out, and retries before enabling routine delivery. See [ADR 0004](DOCS/adr/0004-notification-delivery.md) and the [operations runbook](DOCS/OPERATIONS_RUNBOOK.md).

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
See [DOCS/RISK_REGISTER.md](DOCS/RISK_REGISTER.md) for active deployment, provider, authorization, and release risks with closure evidence.
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
