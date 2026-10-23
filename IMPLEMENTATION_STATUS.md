# Implementation status

This file records current code and the remaining acceptance work against [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Core integration code is present, but a phase is complete only when its exit gate has evidence.

| Phase | Present in branch | Remaining before the plan's exit gate |
|---|---|---|
| 0. Scope and traceability | PRD traceability and risk register in [DOCS/IMPLEMENTATION_TRACEABILITY.md](DOCS/IMPLEMENTATION_TRACEABILITY.md); known owner and provider decisions documented. | Owner review of service profile/source policy decisions; refine acceptance criteria with real source choices. |
| 1. UX and design system | [UX flows and low-fidelity layouts](DOCS/UX_FLOWS.md) records the core journeys and desktop/phone page structures. [Design-system reference](DOCS/DESIGN_SYSTEM.md) records semantic tokens, responsive rules, component states, uncertainty language, and accessibility baseline. Core surfaces, navigation, buttons, status colors, and focus rings consume `src/styles/tokens.css`; regression checks enforce 4.5:1 contrast for semantic normal-text pairs. Three stylesheet audits replaced 46 pale neutral text declarations with the accessible `--color-text-muted` token while preserving semantic status colors. Custom dialogs manage initial focus, keep Tab navigation inside, support Escape, and restore focus to the opener. The mobile navigation exposes expanded state, moves focus into the drawer, returns focus to its toggle, becomes inert while closed on small screens, and closes on Escape. | Owner review of visual direction and human click-through, mobile, keyboard, and screen-reader review; audit remaining legacy component colors and screen-specific states. |
| 2. Architecture decisions | [Architecture map](DOCS/ARCHITECTURE.md) records trust boundaries, data model, and environments. ADRs 0001–0007 cover app/data, provider/cost, ownership/scoring, verified email delivery, scheduled execution, optional AI research, and deployment/logging. Netlify is selected for frontend hosting; Supabase Cron is the preferred scheduler based on current limits. Owner confirms the `ui-test` Netlify preview is available; production remains on `main`. | Verify the preview's built Supabase configuration and hosted sign-in; prepare a separate production Supabase environment and confirm its project plan and permitted-source policy before scheduling or enabling providers. |
| 3. Secure foundation | Supabase Auth UI for sign-up, sign-in, verification, reset, update, and sign-out; user provisioning trigger; owner-scoped RLS; migration-derived TypeScript schema for cloud queries; guarded cloud load; trusted owner role bootstrap and recovery runbook in [OWNER_BOOTSTRAP.md](DOCS/OWNER_BOOTSTRAP.md). Migrations 001–014 are applied to project `pugvqkytxutnfucisurl`, and local/remote migration history is aligned. The dashboard-created initial account's audited Super Admin bootstrap was verified. CI pgTAP covers anonymous denial and owner isolation. | Verify preview Auth redirects/email; test recovery and session expiry; exercise two real users against the deployed project and review grants/policies. |
| 4. Lead workspace | Manual intake, public URL validation/canonical dedupe, searchable/filterable pipelines (status, score, location, source, service/tag, budget knowledge, public contact availability, recency, unread alert), local persistence with user-visible quota/security error handling that preserves the last successfully saved state, Supabase lead/profile/evidence sync with pending-change retry on failure, status lifecycle, notes, due follow-up metrics, duplicate linking, confirmed lead deletion with linked evidence/score/alert/outbox cascades in cloud mode, formula-safe filtered CSV export, and profile fields for skills, services, markets, portfolio links, and experience. Dashboard totals, new leads, strong-fit leads, work in progress, replies/interviews, wins/losses, recent leads, and source health are derived from saved workspace data. Migration `202610200010_contact_availability.sql` is applied and adds the owner-reviewed public-channel state without storing contact details. Migration `202610200012_sync_workspace.sql` adds an atomic, RLS-checked profile/lead/evidence/score save path. | Verify hosted authenticated create/retrieve/deletion, cloud failure/retry and export round-trip; browser review of filters, metrics, and mobile layout. |
| 5. Discovery | Authenticated Edge Function with provider interface for Brave and Remote OK; Remote OK public job feed normalization, local query filtering, per-account term approval, visible feed attribution and original job links, separate owner/provider monthly caps, source/run attribution, and source removal that deletes associated leads/evidence/scores/notifications. The updated `discover` and `scheduled-discovery` functions are deployed to the development project. Migration 013 adds service-only database leases, quota reservation, bounded retries, and atomic persistence; per-account schedule opt-in defaults off. Remote OK is opportunity-only; Brave company search remains gated on written storage rights. | Configure a secret-backed operator scheduler only after plan review; exercise an opted-in browser-closed run, quota boundaries, lease expiry/backoff, update/removal behavior, and representative job quality. Both providers remain disabled by default. |
| 6. Research and scoring | Rule-based score with PRD weights, neutral unknown-budget value, visible component breakdown, source-linked evidence entry, observation/review timestamps, verified/unverified review state, score-history persistence, and deterministic public-page excerpt review with bounded inputs, source links, explicit research gaps, and injection-focused tests. The frontend consumes scoring and query helpers from the Edge Function shared-module directory, keeping the same rules available for server-side jobs. Page text stays local; no AI provider is called. Migration `202610200005_research_gaps.sql` is applied with the full migration set. | Review extracted claims against real pages; decide whether to add a validated AI adapter after privacy/cost review. |
| 7. Notifications and operations | Persistent local/cloud unread count, mark-read/dismiss, configurable threshold, qualifying lead alerts, email opt-in tied to a verified Auth email, transactional outbox trigger, idempotent Resend worker, bounded retries, and delivery state. Migrations 007–009 add admin-only operational reads, audited source controls and retries, and atomic quotas; migration 011 adds email queue health and migration 014 adds aggregate scheduled-worker heartbeat, both visible only to admins. Migration 014 is applied to development and the updated worker is deployed `ACTIVE` with JWT verification. The worker records invocation status and bounded counts; the Admin view warns when no run completed, a run is stuck/failed, or the daily schedule has gone stale. The worker now accepts both `RESEND_API_KEY` and the previously saved `Resend_Api` server secret name. | Configure a verified sender, outbox worker secret and scheduler; verify live delivery/retries/opt-out and two-user RLS. Activate scheduled discovery only after provider terms and plan review; verify browser-closed runs and alert response. Add any additional required audit writers. |
| 8. Verification | The local Node suite passes 47/47 checks. The sign-in shell now lazy-loads the workspace and admin code; production build entry bundle is 443.83 KB with no chunk-size warning. GitHub Actions run [39877753785](https://github.com/Osereme77/Prospect-ai/actions/runs/39877753785) passed verify, all three Playwright E2E tests, database reset/lint, and all 55 pgTAP assertions. | Complete hosted Auth/cloud creation and retrieval, recovery/session expiry, export round-trip, two-user live isolation, mobile/accessibility review, and a real permitted-source run. The CI database is isolated; it is not a substitute for testing with two deployed accounts. Local Windows Playwright run timed out while the dev server remained on the workspace-loading fallback; use the passing CI E2E result as current browser-test evidence. |
| 9. Release | Local setup, Supabase migration/function instructions, environment example, guarded provider enablement, and a data-retention/deletion procedure in [the operations runbook](DOCS/OPERATIONS_RUNBOOK.md). No automatic workspace-record expiration or self-service Auth account deletion is implemented; these limits and the trusted-admin process are documented. | Create/configure production accounts and secrets, deploy hosting/functions, backups/rollback, execute alpha/beta gates, review privacy/source policy, and verify real permitted source use. |

No live Supabase, Brave, Resend, or hosting secret values are stored in the repository. The development Supabase project is linked and migrations 001–014 are applied; `.env.local` contains the Supabase public project URL and publishable key. Both discovery Edge Functions are deployed with source flags remaining off by default. The scheduled function has no scheduler secret or cron configured. Keep service-role and provider secrets in managed server-side secrets. Remote OK requires owner terms approval in Settings and server enable/cap configuration; Brave discovery also requires express written storage rights. Email delivery remains inactive until a verified sender, correctly named server secrets, and scheduler are configured.

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

## 2026-10-22 scheduled Remote OK implementation

- Added an explicit per-account daily opt-in in Settings. It requires prior terms review and provider approval and defaults off.
- Added migration 013 with service-role-only batch claiming, three-minute leases, capped exponential backoff, owner/source/run validation, strict Remote OK URL and score-field checks, deduplicated atomic lead/evidence/score/alert persistence, and a quota reservation through the existing atomic account/provider caps.
- Added the `scheduled-discovery` Edge Function. It requires both the service-role bearer token and a separate scheduler secret, checks the global provider flag/cap, claims at most three accounts, records aggregate-only completion, and does not return profile or lead data. A unit test verifies bounded Remote OK-only output and reuses the existing explainable scorer.
- `npm test` passed 44/44 and `npm run build` passed. The local CLI cannot write its telemetry file outside the workspace, so database verification was completed in GitHub Actions instead.
- GitHub Actions run [39833006502](https://github.com/Osereme77/Prospect-ai/actions/runs/39833006502) passed frontend verification and all three browser E2E tests, but migration lint found an ambiguous PL/pgSQL `source_id` reference in the claim RPC. Renaming the returned field to `claimed_source_id` cleared migration lint. Run [39834810851](https://github.com/Osereme77/Prospect-ai/actions/runs/39834810851) ran all 51 pgTAP assertions and found a stale queue-health expectation: the scheduled lead correctly enqueues a third opted-in email. The assertion now expects three.

## 2026-10-22 scheduled discovery CI and development deployment

- GitHub Actions run [39835578459](https://github.com/Osereme77/Prospect-ai/actions/runs/39835578459) passed frontend verification, all three Playwright E2E tests, local database reset, migration lint, and all 51 pgTAP assertions.
- Confirmed the linked project is `pugvqkytxutnfucisurl`; the dry run showed only migration 013 pending. Applied `202610200013_scheduled_discovery.sql` and rechecked that migrations 001–013 match remotely.
- Deployed `scheduled-discovery` to the development Supabase project; Supabase reports it `ACTIVE` with `verify_jwt=true`. It remains dormant: no `SCHEDULED_DISCOVERY_SECRET`, cron job, or provider enablement was configured. No live browser-closed source run has been claimed or tested.
- Commits `80feddf`, `f11be5f`, and `e0ad2e2` are on `ui-test`; no push targeted `main`.

## 2026-10-22 hosted runtime access check

- The public production URL `https://jobsremyai.netlify.app` currently opens in local browser-storage mode with synthetic sample prospects and no sign-in gate. It does not verify the current authenticated/cloud build.
- The `ui-test` URL redirects to Netlify's “This site is private” Team Protection screen and requires an invited Netlify account. The branch preview could not be used to verify hosted Auth or cloud lead creation/retrieval.
- No Netlify access setting was changed. Removing Team Protection would expose the preview publicly; decide whether to make the preview public or keep it restricted and invite the intended reviewers. After access is resolved, repeat hosted sign-in, lead create/retrieve, and two-user isolation checks.
- `npm test` passes 43/43; `npm run build` passes with the existing 524.88 KB chunk warning. A full rendered screen-reader and visual review still requires owner acceptance.

## 2026-10-22 final neutral-label contrast pass

- Replaced three remaining pale neutral text declarations with `--color-text-muted` and added them to the regression check. Accent and semantic status colors remain unchanged.

## 2026-10-22 managed provider secret inventory

- Listed names only from the linked project's Supabase secret store; no secret values were read or printed. `BRAVE_SEARCH_API_KEY` is present. At that inventory, the Resend key was stored under `Resend_Api`; the worker now supports that legacy name as a fallback to `RESEND_API_KEY`. `EMAIL_FROM` and `OUTBOX_WORKER_SECRET` were not present, and no scheduler was verified. Email delivery remains inactive until sender and worker configuration are complete.

## 2026-10-22 development Auth readiness

- The public Supabase Auth settings endpoint is reachable; email sign-up is enabled and email autoconfirm is off. The public response does not expose the site URL or redirect allowlist, so those hosted settings remain unverified.
- This was a point-in-time check before the owner created the account through the Supabase dashboard; it is superseded by the aggregate verification below.
- A live catalog check confirmed row-level security is enabled on `audit_logs`, `lead_evidence`, `lead_scores`, `leads`, `notifications`, `outbox`, `profiles`, `search_runs`, and `user_roles`. This catalog check does not replace cross-user data isolation acceptance using real accounts.

## 2026-10-22 current-state reconciliation

- Read-only aggregate query against the linked development database reports one Auth user, one `user_roles` row, and one `super_admin` role. This supersedes the earlier zero-user note; it does not verify hosted sign-in, email confirmation, or two-user isolation.
- Current local verification: `npm test` passes 44/44; `npm run build` passes. Vite reports the existing 525.65 KB JavaScript chunk warning.
- The `ui-test` preview's hosted Auth remains unverified. `AuthGate` renders the local workspace when the built frontend lacks `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`; Netlify's signed-out session prevented inspection of the branch build environment during this check. No deployment or access setting was changed.

## 2026-10-22 scheduled worker heartbeat

- Added migration 014 with a service-role-only aggregate heartbeat table and RPCs, plus an admin-only read RPC. The Admin view warns about never-completed, stuck, failed, and 36-hour-stale scheduled discovery. No lead, profile, email, or provider payload is written to heartbeat data.
- Local checks: `npm test` passed 47/47; `npm run build` passed with the existing 528.29 KB chunk warning. GitHub Actions run [39841968298](https://github.com/Osereme77/Prospect-ai/actions/runs/39841968298) passed frontend verification, all three Playwright E2E tests, and migration reset/lint/55 pgTAP assertions.
- Applied migration 014 to linked development project `pugvqkytxutnfucisurl` after CI database success. A live catalog check confirms RLS is enabled, anonymous read/write and write RPC access are denied, `service_role` can record, and authenticated clients can call the admin-gated read RPC. Deployed scheduled-discovery function version 2 is `ACTIVE` with JWT verification enabled. Scheduler secret, provider enablement, and cron remain unset; no scheduled source run occurred.

## 2026-10-23 bundle loading and verification

- `AuthGate` lazy-loads the workspace after the sign-in decision, and the Admin operations view loads only when opened. The workspace and Admin code are separate chunks; the production entry bundle is 443.83 KB (127.04 KB gzip), down from 528.75 KB, with no Vite chunk-size warning.
- `npm test` passed 47/47; `npm run build` passed. GitHub Actions run [39877753785](https://github.com/Osereme77/Prospect-ai/actions/runs/39877753785) passed the verify, E2E, and database jobs, including all 55 pgTAP assertions.
- A separate local Windows Playwright run failed with page setup/navigation timeouts and a persistent “Loading workspace…” fallback. Trace network snapshots show HTTP 200 responses for the app modules. Do not count that local run as passing; the matching pushed commit's Linux CI E2E job passed.

## 2026-10-23 hosted endpoint check

- A read-only request to `https://jobsremyai.netlify.app/` returned HTTP 200. Inspecting its published JavaScript confirmed it contains the workspace UI but not the linked Supabase project URL or sign-in UI; that production deployment is still serving local browser-storage mode.
- The `ui-test` URL `https://ui-test--jobsremyai.netlify.app/` returned HTTP 401 to an unauthenticated request, consistent with Netlify Team Protection. Its built Auth configuration and authenticated lead workflow remain unverified until checked from the owner's permitted Netlify session.
- No deployment settings or protection controls were changed. No Netlify CLI, site ID, or access token is available in this workspace.
- The `ui-test` branch now rejects a Netlify build when the Supabase URL or publishable/legacy anon key is absent, so a future misconfigured deploy fails visibly instead of silently publishing browser-local mode. This guard has not modified the already deployed production site; a future production deploy must also receive its own intended Auth configuration.

## 2026-10-23 ui-test Auth deployment follow-up

- Fixed the Netlify guard's Vite config typecheck issue by avoiding an undeclared Node `process` type. Commit `fd6d4a2` is on `ui-test`; GitHub Actions run [39883677077](https://github.com/Osereme77/Prospect-ai/actions/runs/39883677077) passed verify, all three Playwright E2E checks, database reset/lint, and pgTAP.
- The corresponding Netlify branch deploy failed intentionally at the new Auth configuration guard. Its resolved build environment lists `VITE_SUPABASE_URL`, but not `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`. The owner confirms the key already exists in Netlify, so the remaining question is whether that existing entry is available to branch-deploy builds; do not create a duplicate or change the key value.
- Netlify's documented edit flow is Project configuration → Environment variables → filter for the key → expand it → Options → Edit. The existing value needs the **Builds** scope and the `branch-deploy` context (or the specific `ui-test` branch context); save and rebuild for changes to take effect. See [Netlify's environment variable guide](https://docs.netlify.com/build/environment-variables/get-started/).
- The code deploy for `fd6d4a2` failed at the Auth configuration guard. A later documentation-only commit, `12dfbf0`, is on `ui-test`; GitHub Actions run [39892658178](https://github.com/Osereme77/Prospect-ai/actions/runs/39892658178) completed successfully for verify, E2E, and database jobs. No Netlify result for that documentation-only deploy has been observed. Hosted sign-in/cloud lead acceptance remains unverified. Once the existing key entry is available to `ui-test` branch builds, rebuild and verify the sign-in view and cloud workflow. Do not weaken the Auth gate to permit browser-local mode on the hosted preview.

## 2026-10-23 provider terms and deployment documentation review

- Rechecked the primary Remote OK FAQ/terms and Brave Search pricing, billing help, and Search API terms. The Remote OK feed FAQ describes the public JSON feed as free and requests prominent credit plus original job links; the UI provides those links. Brave's currently listed Search tier costs $5 per 1,000 requests, includes $5 monthly credits, and requires payment details to activate; the default terms prohibit storing/caching Search Results except transiently. Brave persistence therefore remains disabled pending separate written storage rights and owner cost approval.
- Corrected the architecture and scheduler ADR to state that scheduled discovery is deployed to development but dormant until operator setup, and clarified that live email deployment/configuration remains unverified. The README and provider ADR now document the current Brave price and retention restriction.

## 2026-10-23 Netlify deployment follow-up

- The owner reports completing the Netlify deployment. A read-only signed-out request to `https://ui-test--jobsremyai.netlify.app/` returned HTTP 401, consistent with Netlify Team Protection. The current deployment therefore cannot be inspected anonymously.
- Local browser access is disabled in this workspace, so the deployed sign-in screen, Auth redirect, and authenticated cloud lead workflow remain unverified. No environment values or access settings were changed. Continue verification from the owner's permitted Netlify session; do not infer successful hosted Auth solely from a successful deploy.
- The repository remains on `ui-test`; production stays on `main` pending acceptance and release approval.

## 2026-10-23 Resend secret compatibility

- Updated the server-side email worker to read the canonical `RESEND_API_KEY` or the `Resend_Api` secret name previously found in the Supabase secret inventory. The key stays server-side and is not returned in function responses or logs.
- Added a unit check for legacy alias resolution, canonical-name precedence, and missing-key behavior. Email remains inactive until a verified sender, `OUTBOX_WORKER_SECRET`, and scheduler are configured.
