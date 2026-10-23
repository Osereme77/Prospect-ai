# Remy Prospect AI — Implementation Plan

**Status:** Implementation in progress; see [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for delivered code and open live-service gates.
**Baseline:** Product Requirements Document v1.0  
**Repository:** Prospect-ai, with implementation work on the ui-test branch  
**Current state (2026-10-23):** The core React/Supabase application, fifteen versioned migrations, authenticated discovery and scheduled-discovery functions, Resend notification worker, phase documentation, and CI workflow are implemented on `ui-test`. Migrations 001–015 and all three Edge Functions are deployed to development project `pugvqkytxutnfucisurl`; migration 015 adds audit events for discovery source creation, approval changes, admin changes, and removal. GitHub Actions run [39910602647](https://github.com/Osereme77/Prospect-ai/actions/runs/39910602647) passed verify, all three browser E2E tests, database reset/lint, and all 59 pgTAP assertions for the new migration. Run [39924849368](https://github.com/Osereme77/Prospect-ai/actions/runs/39924849368) passed all three jobs for commit `799f578`, including the confirmation-resend E2E. The sign-in screen supports account-agnostic confirmation resend. Password reset requests return to `/?auth=recovery`, and changing a password requires both a valid Supabase session and its `PASSWORD_RECOVERY` event. GitHub Actions run [39936237495](https://github.com/Osereme77/Prospect-ai/actions/runs/39936237495) passed verify, E2E, and database jobs for commit `54caf60`. A read-only production catalog query confirms the migration 015 trigger/function are installed, anonymous execution is denied, and the authenticated Admin RPC remains callable. Migration 012 adds an authenticated transactional workspace-save RPC. Migration 013 adds service-only daily Remote OK claims, leases, quota reservation, bounded retries, and atomic persistence. Migration 014 adds the service-only scheduled-worker heartbeat and admin-only health view. The scheduled function and email worker are deployed with JWT verification. Remote OK is enabled for the approved development account with a 100-request monthly cap and the `ui-test` CORS origin verified; scheduled discovery remains off without a scheduler secret, cron, or account opt-in. The initial account was provisioned through the Supabase dashboard and its audited Super Admin bootstrap was verified. Hosted sign-in, recovery, and cloud workflows still need owner-side verification after a fresh email confirmation and Netlify redeploy. Brave storage approval, email delivery setup, scheduled runs, and production release checks remain open.

Latest branch update: `ui-test` commit `aa8f7e8` includes the recovery-flow and CI stabilization changes. GitHub Actions run [39956251674](https://github.com/Osereme77/Prospect-ai/actions/runs/39956251674) passed verify, E2E, and database jobs. Owner confirms hosted password reset, sign-in, and lead create/retrieve/delete. Remote OK approval was restored after the hosted account was found to have no source row; one live search is still needed. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for current evidence and remaining gates.

## 1. Objective and delivery principles

Build a responsive, single-owner-first web application that finds relevant paid software work, researches potential client businesses, ranks leads with explainable evidence, and keeps follow-up organized. Active opportunities and proactive business prospecting have equal priority.

The implementation should preserve these product constraints throughout delivery:

- Start with a useful free-first operating model and do not commit to paid providers or subscriptions without the owner's decision.
- Collect only permitted public information; retain original source URLs and timestamps.
- Distinguish verified facts, hypotheses, and missing information. Never invent budgets, contact details, hiring intent, or requirements.
- Do not bypass authentication, paywalls, CAPTCHAs, anti-bot controls, or source terms.
- Keep applications, messages, and external outreach under the owner's control. The MVP does not auto-apply or send unsolicited outreach.
- Make search, AI, email, and scheduler integrations optional behind clear provider boundaries. Manual import and rule-based scoring must remain useful when providers are unavailable.
- Enforce authentication and authorization in server and database policy layers, not only in the interface.

## 2. Phased implementation

### Phase 0 — Scope, decisions to validate, and delivery baseline

**Purpose:** Turn the PRD into an implementation backlog with measurable acceptance checks before building.

**Work:**

- Create a traceability matrix mapping each PRD requirement to a feature, data model area, and verification check.
- Confirm the owner's service profile fields: services, skills, portfolio links, experience summary, and target markets.
- Define normalized lead types for active opportunities and proactive company prospects, including which fields can be unknown.
- Set MVP source policy: which sources are explicitly permitted, how source terms and quotas are recorded, and which sources begin disabled pending review.
- Convert the PRD's non-objectives into explicit exclusions: automatic applications, outbound prospecting messages, private contact extraction, paid integrations without approval, and scraping that violates terms.
- Establish repository conventions, branch/PR workflow, environment separation, issue labels, release notes, and a decision log.
- Prioritize acceptance criteria into must-have, should-have, and deferred items without weakening security or evidence requirements.

**Deliverables:** MVP backlog, requirement traceability matrix, initial risk register, branch/review conventions, and a short list of decisions needing owner input.

**Exit gate:** Every MVP requirement has an owner, a planned phase, and an observable acceptance check. Open decisions that could block schema or provider work are recorded.

### Phase 1 — Product UX and design system

**Purpose:** Define a coherent, accessible interface before implementing screens.

**Work:**

- Map the main user journeys: sign-in and recovery; first-time profile setup; dashboard review; opportunity discovery; company research; lead detail and evidence review; status and follow-up updates; notification preferences; source and job monitoring.
- Create low-fidelity flows and screen layouts for desktop and mobile. Cover dashboard, opportunity list, lead detail, research/evidence, notifications, profile/services, search settings, security settings, and admin operations.
- Define design tokens for typography, spacing, layout widths, responsive breakpoints, colors, borders, elevation, focus rings, and motion. Use semantic colors for lead status, score bands, source health, and errors.
- Choose readable type sizes, strong contrast, keyboard focus visibility, accessible labels, and screen-reader names. Target WCAG 2.2 AA practices where applicable.
- Specify responsive behavior for navigation, filters, lead tables, score/evidence panels, dialogs, and notification review. Avoid horizontal overflow on phones.
- Define reusable components and their states: buttons, fields, selects, searchable filters, badges, score display, evidence cards, lead rows/cards, tables, pagination, empty states, loading skeletons, inline errors, confirmation dialogs, toasts, and accessible navigation.
- Define content patterns for uncertainty: “unknown,” “unverified,” “hypothesis,” “last checked,” and source attribution. Do not use visual treatments that imply certainty without evidence.
- Document interaction rules for destructive or external actions, but keep outreach actions manual and explicit.

**Deliverables:** UX flows, responsive wireframes, token sheet, component inventory, accessibility notes, and reviewed designs for the core journeys.

**Exit gate:** The owner can review a realistic click-through or annotated screen set and agree on the primary navigation, lead review experience, mobile behavior, and evidence presentation.

### Phase 2 — Architecture and technical decisions

**Purpose:** Resolve the system boundaries and provider choices before those choices become expensive to change.

**Proposed baseline from the PRD:**

- Frontend: React, TypeScript, and Vite.
- Authentication and data: Supabase Auth and PostgreSQL with Row Level Security.
- Server-side work: Supabase Edge Functions or another verified server-side execution environment.
- Discovery: provider interface with the permitted Remote OK public feed for remote job opportunities; Brave Search is a gated candidate for company prospecting because persistent storage requires separate written rights. Manual URL import remains available.
- AI: optional provider adapter with validated structured output and a rule-based fallback.
- Email: transactional provider adapter, with Resend as a candidate.
- Source control and delivery: GitHub and a suitable free-tier frontend host, subject to current capability and quota checks.

**Decisions and work:**

- Draw the component and data-flow architecture: browser, auth, database, server functions, scheduler, source adapters, research/scoring, notification dispatcher, and administrative monitoring.
- Record Architecture Decision Records for frontend routing/state, Supabase usage, role model, source interface, scheduled execution, AI abstraction, email/outbox, deployment environments, and logging/monitoring.
- Verify provider terms, authentication requirements, permitted use, quotas, pricing, geographic availability, and scheduled-job limits before enabling each integration. Do not assume a free tier supports reliable schedules.
- Define data ownership and tenant boundaries for the initial personal account while preserving a safe path to additional users later.
- Define the trusted bootstrap process for the initial Super Admin. Do not expose a public privilege-escalation route or allow users to change their own roles.
- Specify server-only secret handling, environment variable names, rotation procedure, and local development setup. Service-role keys and provider secrets must never reach the browser bundle.
- Design the job execution model: per-source execution identity, locks, idempotency keys, bounded retries with backoff, run history, quotas, and recovery behavior.
- Define a normalized provider contract for leads, evidence, errors, quota state, and attribution.
- Threat-model URL fetching, SSRF/private-network access, open redirects, malicious page content and prompt injection, XSS, cross-user access, role escalation, secret exposure, duplicate notifications, and log privacy.
- Create an initial entity-relationship diagram and migration plan before finalizing database tables.

**Deliverables:** Context/container diagrams, data-flow and threat diagrams, ADRs, provider evaluation notes, environment plan, and reviewed schema outline.

**Exit gate:** Every integration has a permitted-use and cost/limit decision; the deployment target can support required server-side work; security boundaries and scheduler/idempotency strategy are documented.

### Phase 3 — Application foundation and secure account layer

**Purpose:** Establish a reliable, protected application base that later features can reuse.

**Work:**

- Set up the React/TypeScript/Vite application structure, formatting/lint/type checks, environment validation, route organization, and build pipeline.
- Add the design tokens and shared component primitives from Phase 1, with examples or a component reference page.
- Configure separate development, preview, and production Supabase projects or environments. Keep secrets out of source control.
- Add versioned database migrations and initial tables for profiles, user roles, sources, search runs, leads, evidence, scores, notifications, outreach logs, and audit logs. Add optional support tables only when needed.
- Implement Supabase Auth sign-up/provisioning, sign-in, sign-out, password reset, email verification behavior, protected routes, and session expiry/revocation behavior.
- Implement server-enforced roles for Super Admin, Admin, and User; provision the initial owner through the documented trusted bootstrap process.
- Add Row Level Security policies and least-privilege database access. Test policies against unauthenticated, owner, ordinary user, Admin, and Super Admin scenarios.
- Add profile and service configuration screens, input validation, safe URL validation, and notification preferences.
- Define structured application errors, safe user-facing messages, and redacted operational logs.

**Deliverables:** Running app shell, auth flows, initial schema/migrations, role bootstrap instructions, RLS policies, and environment setup guide.

**Exit gate:** The owner can authenticate, recover access, reach protected routes, and configure a profile. Unauthorized and cross-user data access are denied by database/server policies.

### Phase 4 — Lead workspace and design-system implementation

**Purpose:** Make the product useful for manually imported leads before automation is available.

**Work:**

- Build the responsive application shell and navigation for dashboard, opportunities, companies, research, notifications, settings, and admin routes.
- Implement searchable, filterable lead lists with service, country/region, opportunity type, score, date, source, budget knowledge, contact availability, status, and unread filters.
- Implement opportunity and company detail views showing description, normalized fields, source link, evidence, research summary, score components, uncertainty, and next recommended action.
- Add manual URL/detail import, safe URL validation, duplicate detection, and a clear path for importing when external search is unavailable.
- Implement lead status transitions from New through Reviewed, Shortlisted, Contacted, Applied, Replied, Interviewing, Won/Lost, and Dismissed.
- Add private notes, follow-up dates, outcome tracking, duplicate linking, original-source navigation, and permitted export.
- Build dashboard metrics from stored records, not demo values: total/new/high-scoring leads, work in progress, replies/interviews, wins/losses, recent activity, and source health.
- Add clear empty, loading, stale-data, permission-denied, and recoverable-error states.
- Keep notification review and lead scoring usable on narrow mobile screens.

**Deliverables:** Working lead workspace using manual/sample data, responsive shell, and accessible core workflows.

**Exit gate:** The owner can manually create/import, review, filter, update, follow up, and export a lead without any discovery or AI provider configured.

### Phase 5 — Discovery framework and permitted sources

**Purpose:** Add repeatable discovery without coupling the product to one provider or violating source rules.

**Work:**

- Implement a common discovery-source interface and source registry with name, type, permissions/terms reference, enabled state, quota/limits, configuration, and last success/failure.
- Implement an initial public search adapter only after the Phase 2 terms and quota review. Add permitted public feeds or documented APIs incrementally.
- Generate editable search terms and exclusions from configured services, skills, job types, regions, and target markets.
- Keep active opportunity discovery and proactive business prospecting balanced by default, with configurable allocation.
- Normalize provider results into a common lead format; validate required fields, URLs, timestamps, and source attribution.
- Deduplicate using provider IDs where available, normalized URLs, stable fingerprints, and meaningful-change checks. Preserve history when records change.
- Implement manual run controls, scheduled runs, source-specific locks, bounded retries, quota caps, run identifiers, and persistent run history.
- Ensure a failure from one source does not stop other sources and does not corrupt existing leads.
- Add source health, last success, result counts, errors, and retry status to the admin view.
- Preserve manual import and display clear limitations when no API is configured or a quota is reached.

**Deliverables:** At least one real permitted source, balanced discovery runs, normalization/deduplication, schedule controls, and source monitoring.

**Exit gate:** A source produces real, attributable leads; repeated runs do not create uncontrolled duplicates; scheduled work runs with the browser closed; source failures are visible and isolated.

### Phase 6 — Research, evidence, and explainable scoring

**Purpose:** Turn discovered leads into evidence-backed, prioritized opportunities without fabricating facts.

**Work:**

- Implement company identification and public website review where access is permitted. Store observations with source URL, timestamp, evidence type, and confidence.
- Identify public business contact channels only when permitted. Mark details verified, unverified, or missing; do not infer private contact data.
- Keep direct observations separate from AI-generated summaries and hypotheses.
- Add a research adapter that receives bounded, relevant public text and returns schema-validated structured output. Treat external page content as untrusted input and guard against prompt injection.
- Redact unnecessary personal data before optional model calls. Track model usage and allow the AI provider to remain disabled.
- Implement deterministic fallback research/scoring so core lead management works without paid AI.
- Implement the PRD score from 0 to 100 using the initial weights: relevance 35%, evidence of need 25%, budget signals 15%, freshness 15%, and source confidence 10%.
- Show each component score, supporting evidence links, missing information, confidence caveats, score/rules version, and recommended next step.
- Treat unknown budget as unknown rather than a zero-value or automatic disqualification. Keep the default notification threshold at 65/100 and allow configuration.
- Recalculate scores when relevant evidence or scoring rules change, retaining useful score history.

**Deliverables:** Research/evidence pipeline, rule and optional AI adapters, score engine, score explanations, and versioned scoring records.

**Exit gate:** A lead can be researched and scored with linked evidence; the user can inspect why it ranked as it did; missing or uncertain information is explicit; scoring works without a paid model.

### Phase 7 — Notifications, administration, and operational controls

**Purpose:** Alert the owner reliably while keeping external communication in their hands.

**Work:**

- Implement persistent in-app notifications for qualifying leads, with read, unread, dismiss, and unread-count behavior.
- Add an email outbox/queue with idempotency keys, delivery status, bounded retries, backoff, and failure visibility.
- Support simultaneous in-app and email notification; email failure must not remove or suppress the dashboard notification.
- Add independent channel preferences, verified destination checks, configurable thresholds, duplicate prevention, and notification content with lead title, company, score explanation, and original source link.
- Do not send applications, cold outreach, or unsolicited messages from the MVP.
- Build Admin and Super Admin views for source configuration, run history, job retries, notification status, usage/quota monitoring, and audit logs.
- Enforce privilege checks on the server and database for every administrative operation. The interface hiding a control is not a security boundary.
- Log security-sensitive role and configuration changes without logging credentials, authentication tokens, or unnecessary personal information.
- Document account recovery and owner recovery procedures.

**Deliverables:** Reliable dashboard/email alert flows, administrative source/job controls, usage visibility, and auditable privileged actions.

**Exit gate:** A qualifying lead creates one persistent dashboard alert and, when configured, one email alert. Retries do not duplicate alerts; email failures are visible and recoverable.

### Phase 8 — Verification, security hardening, and usability review

**Purpose:** Demonstrate that the product meets its acceptance criteria and is safe to use.

**Verification work planned for implementation:**

- Unit checks for normalization, URL canonicalization, deduplication, score weights, thresholds, search-term generation, notification eligibility, configuration validation, and status transitions.
- Integration checks for authentication, migrations, RLS, source adapters, scheduled execution, retries, outbox delivery, and model structured-output validation.
- Security checks for unauthenticated access, cross-user records, role escalation, secret leakage, SSRF/private network attempts, unsafe redirects, malicious external content, XSS, and rate limits.
- End-to-end checks for sign-in/recovery; service setup; manual and discovered lead creation; evidence and score display; notification delivery; status/follow-up tracking; and mobile flows.
- Accessibility review for labels, keyboard navigation, focus states, contrast, screen-reader support, and error/loading announcements.
- Performance review for ordinary mobile connections, pagination, database indexes, and asynchronous long-running work.
- Verify actual integrations and environment configuration; do not substitute simulated success for the acceptance criteria.
- Record known limitations, source coverage, provider costs/quotas, and operational recovery steps.

**Deliverables:** Acceptance checklist with evidence, test results, security review notes, accessibility findings, and a prioritized defect list.

**Exit gate:** Critical acceptance criteria pass, no unresolved critical/high security issues remain, data isolation is demonstrated, and known limitations are documented.

### Phase 9 — Deployment, alpha, beta, and MVP release

**Purpose:** Roll out safely, verify real-world lead quality, and expand only when evidence supports it.

**Work:**

- Verify the chosen host and Supabase plan support required authentication callbacks, server-side functions, secrets, schedules, quotas, and regional availability.
- Configure preview and production environments, domain/redirect settings, secrets, migration order, backups, and rollback procedures.
- Deploy an internal alpha with manual import first. Validate auth, RLS, research, scoring, and notification behavior using a small set of real permitted opportunities.
- Run a personal beta with approved sources enabled gradually. Track lead quality, duplicate rate, source failures, evidence completeness, notification usefulness, and actual operating cost.
- Establish monitoring for scheduled-run success, source health, queue age, email delivery, quota consumption, error rates, and database growth.
- Provide a privacy/data-retention and lead-deletion process, and document how to disable a source or integration quickly.
- Release the MVP only after real source use, recovery procedures, and acceptance evidence are reviewed.
- Use the first month to establish baselines before setting numerical targets. Do not promise a number of leads, contracts, or revenue.

**Deliverables:** Deployed alpha/beta/MVP, environment and rollback documentation, operations dashboard, baseline metrics, and release notes.

**Exit gate:** The owner can use the deployed app from a phone and laptop, scheduled discovery works without an open browser, production integrations are verified, and free-tier limits and remaining risks are documented.

## 3. Indicative sequencing

The PRD estimates roughly seven to eight weeks of focused solo development. Treat this as a planning estimate, not a commitment; provider access, source restrictions, debugging, and free-tier scheduler limits can change it.

| Indicative window | Main work |
| --- | --- |
| Week 1 | Scope and traceability; design system and core screen flows; architecture decisions and provider feasibility |
| Week 2 | App foundation, authentication, initial schema, role bootstrap, RLS, and lead workspace skeleton |
| Weeks 3–4 | Manual lead workflows, source registry, permitted discovery adapter, normalization, deduplication, and scheduling |
| Week 5 | Research/evidence pipeline, rule-based scoring, optional AI adapter, and score explanations |
| Week 6 | In-app/email notifications, outbox retries, admin monitoring, and audit trails |
| Weeks 7–8 | Security, accessibility, integration/end-to-end verification, deployment, alpha/beta, and launch hardening |

## 4. Cross-cutting definition of done

A feature is done only when:

- Its user flow is responsive, keyboard-usable, and includes loading, empty, error, and success states.
- Data access is validated at the server/database boundary and cannot expose another user's records.
- External data preserves source, timestamp, and uncertainty; no unsupported claim is presented as fact.
- Provider failure, missing credentials, and quota exhaustion have a useful fallback and visible status.
- Long-running or retried operations are bounded, idempotent, observable, and safe to repeat.
- Secrets and unnecessary personal data are absent from client bundles, logs, and audit metadata.
- Relevant acceptance checks and known limitations are recorded.

## 5. Decisions to close before implementation

1. Approve the visual direction, color system, typography, and mobile navigation.
2. Confirm the initial service/skill profile and required lead fields.
3. Approve the first permitted discovery sources after their terms and quotas are reviewed.
4. Verify scheduler support on the selected hosting plan before choosing the job mechanism.
5. Decide whether AI research is enabled for the MVP or deferred behind rule-based research.
6. Confirm email provider, sender verification, and operational-notification requirements.
7. Confirm initial owner provisioning and recovery steps for the Super Admin account.
8. Approve data retention, lead deletion, export, and any applicable privacy/direct-marketing review.

See [README.md](README.md) for the project overview and [the PRD](DOCS/PROSPECT%20PRD.pdf) for the full requirements baseline.
