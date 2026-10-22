# Implementation status

This file records current code and the remaining acceptance work against [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Core integration code is present, but a phase is complete only when its exit gate has evidence.

| Phase | Present in branch | Remaining before the plan's exit gate |
|---|---|---|
| 0. Scope and traceability | PRD traceability and risk register in [DOCS/IMPLEMENTATION_TRACEABILITY.md](DOCS/IMPLEMENTATION_TRACEABILITY.md); known owner and provider decisions documented. | Owner review of service profile/source policy decisions; refine acceptance criteria with real source choices. |
| 1. UX and design system | [UX flows and low-fidelity layouts](DOCS/UX_FLOWS.md) records the core journeys and desktop/phone page structures. [Design-system reference](DOCS/DESIGN_SYSTEM.md) records semantic tokens, responsive rules, component states, uncertainty language, and accessibility baseline. Core surfaces, navigation, buttons, status colors, and focus rings consume `src/styles/tokens.css`; regression checks enforce 4.5:1 contrast for semantic normal-text pairs. Two stylesheet audits replaced 43 pale neutral text declarations with the accessible `--color-text-muted` token while preserving semantic status colors. Custom dialogs manage initial focus, keep Tab navigation inside, support Escape, and restore focus to the opener. The mobile navigation exposes expanded state, moves focus into the drawer, returns focus to its toggle, becomes inert while closed on small screens, and closes on Escape. | Owner review of visual direction and human click-through, mobile, keyboard, and screen-reader review; audit remaining legacy component colors and screen-specific states. |
| 2. Architecture decisions | [Architecture map](DOCS/ARCHITECTURE.md) records trust boundaries, data model, and environments. ADRs 0001–0007 cover app/data, provider/cost, ownership/scoring, verified email delivery, scheduled execution, optional AI research, and deployment/logging. Netlify is selected for frontend hosting; Supabase Cron is the preferred scheduler based on current limits. Owner confirms the `ui-test` Netlify preview is available; production remains on `main`. | Verify the preview's built Supabase configuration and hosted sign-in; prepare a separate production Supabase environment and confirm its project plan and permitted-source policy before scheduling or enabling providers. |
| 3. Secure foundation | Supabase Auth UI for sign-up, sign-in, verification, reset, update, and sign-out; user provisioning trigger; owner-scoped RLS; migration-derived TypeScript schema for cloud queries; guarded cloud load; trusted owner role bootstrap and recovery runbook in [OWNER_BOOTSTRAP.md](DOCS/OWNER_BOOTSTRAP.md). Migrations 001–012 are applied to project `pugvqkytxutnfucisurl`, and local/remote migration history is aligned. The dashboard-created initial account's audited Super Admin bootstrap was verified. CI pgTAP covers anonymous denial and owner isolation. | Verify preview Auth redirects/email; test recovery and session expiry; exercise two real users against the deployed project and review grants/policies. |
| 4. Lead workspace | Manual intake, public URL validation/canonical dedupe, searchable/filterable pipelines (status, score, location, source, service/tag, budget knowledge, public contact availability, recency, unread alert), local persistence with user-visible quota/security error handling that preserves the last successfully saved state, Supabase lead/profile/evidence sync with pending-change retry on failure, status lifecycle, notes, due follow-up metrics, duplicate linking, formula-safe filtered CSV export, and profile fields for skills, services, markets, portfolio links, and experience. Dashboard totals, new leads, strong-fit leads, work in progress, replies/interviews, wins/losses, recent leads, and source health are derived from saved workspace data. Migration `202610200010_contact_availability.sql` is applied and adds the owner-reviewed public-channel state without storing contact details. Migration `202610200012_sync_workspace.sql` adds an atomic, RLS-checked profile/lead/evidence/score save path. | Verify hosted authenticated create/retrieve, cloud failure/retry and export round-trip; browser review of filters, metrics, and mobile layout. |
| 5. Discovery | Authenticated Edge Function with provider interface for Brave and Remote OK; Remote OK public job feed normalization, local query filtering, per-account term approval, visible feed attribution and original job links, separate owner/provider monthly caps, source/run attribution, and source removal that deletes associated leads/evidence/scores/notifications. The updated `discover` function is deployed to the development project. Remote OK is opportunity-only; Brave company search remains gated on written storage rights. | Exercise discovery after owner approval in Settings and server flag/cap configuration; confirm quota boundaries, update/removal behavior, schedule/lock/retry monitoring, and representative job quality. Both providers remain disabled by default. |
| 6. Research and scoring | Rule-based score with PRD weights, neutral unknown-budget value, visible component breakdown, source-linked evidence entry, observation/review timestamps, verified/unverified review state, score-history persistence, and deterministic public-page excerpt review with bounded inputs, source links, explicit research gaps, and injection-focused tests. The frontend consumes scoring and query helpers from the Edge Function shared-module directory, keeping the same rules available for server-side jobs. Page text stays local; no AI provider is called. Migration `202610200005_research_gaps.sql` is applied with the full migration set. | Review extracted claims against real pages; decide whether to add a validated AI adapter after privacy/cost review. |
| 7. Notifications and operations | Persistent local/cloud unread count, mark-read/dismiss, configurable threshold, qualifying lead alerts, email opt-in tied to a verified Auth email, transactional outbox trigger, idempotent Resend worker, bounded retries, and delivery state. Migrations 007–009 add admin-only operational reads, audited source controls and retries, and atomic quotas; migration 011 adds an admin-only aggregate for queued, stale-sending, and failed email jobs and is applied to development. Admins see a warning for queued jobs older than 15 minutes and stale locks without exposing recipients. The Admin screen is visible only to admin/super_admin roles. [Operations runbook](DOCS/OPERATIONS_RUNBOOK.md) documents pause, triage, retry, queue-health and database safety. | Resend key is present under the nonmatching secret name `Resend_Api`; configure the worker's `RESEND_API_KEY`, `EMAIL_FROM`, `OUTBOX_WORKER_SECRET`, and scheduler; verify queue-health reads as an admin, real delivery, retries, opt-out, and two-user RLS. Add scheduler heartbeat/alerting and any additional required audit writers. |
| 8. Verification | The local Node suite passes 42/42 checks, and the production build passes with an existing >500 KB JavaScript chunk warning. GitHub Actions run [39814731935](https://github.com/Osereme77/Prospect-ai/actions/runs/39814731935) passed frontend verification, all three Playwright browser tests, database reset/lint, and all 35 pgTAP assertions, including transactional-save rollback, anonymous denial, and cross-owner overwrite denial through the workspace RPC. | Run broader live security, accessibility, hosted-auth, export, and real-source reviews. The CI database is isolated; it is not a substitute for testing with two deployed accounts. |
| 9. Release | Local setup, Supabase migration/function instructions, environment example, and guarded provider enablement. | Create/configure project accounts and secrets, deploy hosting/functions, backups/rollback, execute alpha/beta gates, and verify real permitted source use. |

No live Supabase, Brave, Resend, or hosting secret values are stored in the repository. The development Supabase project is linked and migrations 001–012 are applied; `.env.local` contains the Supabase public project URL and publishable key. The updated discovery Edge Function is deployed with source flags remaining off by default. Keep service-role and provider secrets in managed server-side secrets. Remote OK requires owner terms approval in Settings and server enable/cap configuration; Brave discovery also requires express written storage rights. Email delivery remains inactive until a verified sender, correctly named server secrets, and scheduler are configured.

## 2026-10-22 auth recovery follow-up

- `AuthGate` now exits the session-loading state when Supabase session restoration returns an error or rejects, showing a recoverable sign-in message. An auth event takes precedence over a later `getSession()` result to avoid overwriting a refreshed session.
- Added five focused tests covering successful session restoration, recoverable lookup errors, and auth-event precedence over late success or failure.
- Verification after the change: `npm test` passed 35/35; `npm run build` passed. Vite reports the existing 524 KB JavaScript chunk-size warning.
- At that point, local Supabase execution was unavailable because the workstation had no CLI or Docker command. The CLI is now available; development migration history and queue-RPC execute grants have since been verified remotely. Local Docker-backed pgTAP remains unavailable.

## 2026-10-22 hosted Netlify inspection

- `https://jobsremyai.netlify.app` serves the application shell with HTTP 200, but its current JavaScript bundle does not contain the linked Supabase project URL or Auth screen. Local `.env.local` values have not been applied to the hosted build.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Netlify's build environment, configure the Supabase Auth site/redirect URLs for the hosted origin, and redeploy before testing hosted sign-in. The setup is documented in [README.md](README.md).

## 2026-10-22 Auth endpoint preflight

- A read-only request to the linked Supabase Auth settings endpoint succeeded using the locally configured publishable key. Email authentication and sign-up are enabled; email autoconfirm is off, so users must verify their email.
- The public settings response did not expose the site URL or redirect allowlist. The app uses the current page origin in sign-up and password-recovery links; allow both the `ui-test` preview and production origins before hosted Auth acceptance.

## 2026-10-22 CI recheck

- Historical run [39763732553](https://github.com/Osereme77/Prospect-ai/actions/runs/39763732553) exposed pgTAP failures that were fixed in a later commit; the current 25-assertion suite passes in run [39777067927](https://github.com/Osereme77/Prospect-ai/actions/runs/39777067927).

## 2026-10-22 browser workflow coverage

- Added a Playwright end-to-end test and CI job for creating a manual opportunity, saving it, and retrieving it after a page reload. The runner explicitly clears Supabase environment variables so the test covers the local browser-storage workflow without connecting to project data.
- Playwright discovers the test locally, but this managed Windows environment timed out while launching Chromium. GitHub Actions run [39769970385](https://github.com/Osereme77/Prospect-ai/actions/runs/39769970385) on `ui-test` completed the browser E2E and frontend verification jobs successfully; the database job was still running at the latest check.

## 2026-10-22 unauthenticated route coverage

- Added a Playwright browser test that starts the app with dummy Supabase configuration and verifies an unauthenticated visitor sees the sign-in screen without the private workspace. This checks the client auth gate; database authorization remains covered by pgTAP and is not proven by this browser test. GitHub Actions run [39771538460](https://github.com/Osereme77/Prospect-ai/actions/runs/39771538460) confirms both browser tests pass; database reset and lint pass, while the pgTAP step still fails.

## 2026-10-22 mobile browser check

- Added a third Playwright check for mobile navigation focus, Escape dismissal, and horizontal overflow at 375 px. Its first GitHub run showed the test kept querying the toggle by its old accessible name after the app correctly changed it from “Open navigation” to “Close navigation.” The test now locates the stable toggle element and checks its updated accessible name after Escape. CI run [39774387768](https://github.com/Osereme77/Prospect-ai/actions/runs/39774387768) confirms all three Playwright tests pass. CI uses Playwright's GitHub reporter for failure annotations.

## 2026-10-22 database failure diagnostics

- Updated the CI database step to publish the final 60 lines of pgTAP output into the run summary and emit annotations for the final 12 output lines when the test step fails. Run [39776016732](https://github.com/Osereme77/Prospect-ai/actions/runs/39776016732) identified failures 1 and 13. The tests now assert absence of visible private rows and verify the ordinary role remains unchanged, handling either privilege errors or RLS-filtered no-ops without changing policies or grants. GitHub Actions run [39777067927](https://github.com/Osereme77/Prospect-ai/actions/runs/39777067927) confirms all 25 pgTAP assertions and the full quality workflow pass. Local Docker-backed Supabase verification remains unavailable; current remote checks are recorded below.

## 2026-10-22 hosted deployment recheck

- After the user redeployed Netlify, the public site still served asset `/assets/index-auuehihc.js`, which does not contain the Supabase project URL or Auth screen. The authenticated build is not yet live at the production URL. The `main` branch remains at `40f7d5d8fc2d7ad2fbea7f639a9ab1809cd06e40`; `ui-test` has the newer implementation. Deploy a preview from `ui-test` for hosted auth verification, or move the branch to production only when ready to release.

## 2026-10-22 queue health and deployment sprint

- Added migration 011 and an admin-only aggregate queue-health RPC. Admin UI now warns for queued email older than 15 minutes, stale sending locks, and failed deliveries without exposing recipient addresses.
- Added three queue-health unit tests and two pgTAP assertions. `npm test` passes 38/38 and `npm run build` passes locally. GitHub Actions run [39781458310](https://github.com/Osereme77/Prospect-ai/actions/runs/39781458310) passes verify, browser E2E, database reset/lint, and 27 pgTAP assertions. At the time of that entry, migration 011 had not yet been applied to the hosted development project; it was applied and verified below.
- Commit `60e2185b5069a923f95da729aa65aa88c31453ee` is on `ui-test`; no changes were made to `main`.
- Netlify's production site responds with HTTP 200 but serves old bundle `/assets/index-auuehihc.js`; the conventional `ui-test--jobsremyai.netlify.app` branch URL returned 404 at the time. The owner later confirmed the `ui-test` preview was available. Preview environment and hosted authentication still require verification. Keep production on `main` until release approval.

## 2026-10-22 development migration deployment

- Read-only `supabase migration list --linked` confirmed migrations 001–010 were applied and 011 was pending. Reviewed `202610200011_admin_queue_health.sql`, then applied only that migration to the development project.
- Rechecked linked history after deployment; all eleven local migrations now match the remote project history. A live catalog query confirmed `admin_queue_health()` is `SECURITY DEFINER`, `anon` cannot execute it, and `authenticated` can. A rolled-back remote query under an ordinary authenticated test identity confirmed `public.is_admin()` is false and the RPC raises SQLSTATE `42501` (`admin role required`). Admin-session queue contents still require verification.

## 2026-10-22 transactional workspace save

- Added migration `202610200012_sync_workspace.sql`, an authenticated `SECURITY INVOKER` function that writes the profile, leads, evidence, scores, and stale-lead cleanup in one transaction under existing RLS. CI pgTAP checks anonymous denial, successful authenticated save/retrieval, rollback of earlier writes on invalid evidence, and cross-owner overwrite denial.
- Changed the cloud repository to call this function once after reading score history, preventing partial writes from deleting old leads. Added its typed RPC signature.
- `npm test` passed 42/42 and `npm run build` passed (524.88 KB JavaScript bundle warning). GitHub workflow [39806864283](https://github.com/Osereme77/Prospect-ai/actions/runs/39806864283) passed the database reset/lint/pgTAP and E2E/verify jobs. Migration 012 was applied to linked development project `pugvqkytxutnfucisurl`; a catalog check verified the function exists, authenticated can execute, and anon cannot.
- The browser-based cloud Auth/create/retrieve path and real two-user isolation are still not verified. Netlify preview config is not verified; production still serves an older bundle. No change was made to `main`.
- A direct public request to `https://ui-test--jobsremyai.netlify.app/` returned HTTP 401. This shows the preview is gated from unauthenticated requests; it does not reveal whether its build has the required Supabase variables. Production `https://jobsremyai.netlify.app/` remains reachable and serves `/assets/index-auuehihc.js`, which lacks the Auth screen and development project URL.
- Expanded the pgTAP suite from 33 to 35 assertions to cover an authenticated owner attempting to overwrite another owner's lead through `sync_workspace`. After completing the payload fixture, [GitHub Actions run 39814731935](https://github.com/Osereme77/Prospect-ai/actions/runs/39814731935) passed all 35 assertions plus frontend verification and browser E2E.

## 2026-10-22 semantic text color audit

- Replaced 21 low-contrast neutral text declarations in `src/styles.css` with the shared `--color-text-muted` token. Intentional success, caution, error, and primary link colors were left as semantic colors.
- `npm test` passed 42/42, including the normal-text WCAG AA contrast regression check. `npm run build` passed; the existing 524.88 KB JavaScript chunk warning remains.

## 2026-10-22 remaining muted text contrast audit

- Replaced 22 additional pale gray text declarations with `--color-text-muted` and added a regression check to prevent those generic muted-copy colors from returning. Semantic status colors were preserved.
- `npm test` passes 43/43; `npm run build` passes with the existing 524.88 KB chunk warning. A full rendered screen-reader and visual review still requires owner acceptance.

## 2026-10-22 managed provider secret inventory

- Listed names only from the linked project's Supabase secret store; no secret values were read or printed. `BRAVE_SEARCH_API_KEY` is present. The Resend key is stored under `Resend_Api`, but the worker reads `RESEND_API_KEY`; names are case-sensitive. `EMAIL_FROM` and `OUTBOX_WORKER_SECRET` are not present, and no scheduler has been verified. Email delivery therefore remains inactive.

## 2026-10-22 development Auth readiness

- The public Supabase Auth settings endpoint is reachable; email sign-up is enabled and email autoconfirm is off. The public response does not expose the site URL or redirect allowlist, so those hosted settings remain unverified.
- Aggregate database checks found zero Auth users and zero `user_roles` rows. The first owner must sign up and verify their email, then complete the trusted Super Admin bootstrap in [OWNER_BOOTSTRAP.md](DOCS/OWNER_BOOTSTRAP.md).
- A live catalog check confirmed row-level security is enabled on `audit_logs`, `lead_evidence`, `lead_scores`, `leads`, `notifications`, `outbox`, `profiles`, `search_runs`, and `user_roles`. This catalog check does not replace cross-user data isolation acceptance using real accounts.
