# PRD implementation traceability

The PDF PRD remains the product authority. This matrix links its MVP requirements to the current implementation and the evidence needed to close them. A link to code alone is not a passing acceptance check; runtime evidence is required for the release gates.

| PRD requirement | Current implementation | Acceptance evidence still required |
|---|---|---|
| Responsive, authenticated workspace | `src/App.tsx`, `src/AuthGate.tsx`, `src/styles.css`; keyboard focus indicators and reduced-motion support | Browser walkthrough at phone, tablet, and desktop widths; keyboard and screen-reader review. |
| Sign-up, sign-in, verification, password recovery, sign-out | `src/AuthGate.tsx`; user provisioning trigger in `supabase/migrations/202610200001_initial_schema.sql` | Deploy and test against a real Supabase project, including email callbacks and expired/revoked sessions. |
| Private user-owned leads/profile | `src/lib/repository.ts`; profiles/leads RLS policies in the migration; cloud write errors preserve last-confirmed UI data and expose retry | Automated RLS isolation checks with two accounts and unauthenticated requests. |
| Manual opportunity and company intake | Add-prospect dialog and validation in `src/App.tsx`; local/cloud repository adapters | Test required fields, URL rejection, duplicate URL, save failure, and deletion against local and cloud modes. |
| Evidence provenance and uncertainty labels | Source-backed evidence form, canonical URL validation, owner-review state, and observation/review timestamps in lead detail; `lead_evidence` table | Verify evidence source/status/timestamps survive create/update/reload in a deployed project; review accuracy and uncertainty labels. |
| Opportunity and company pipeline lifecycle | `LeadStatus`, status/location/score/source/service/budget/recency/unread filters, search, notes, due-date follow-up metric/editor, canonical duplicate link, filtered CSV export; `leads` table | Exercise every status transition, follow-up behavior, duplicate linking, download/round-trip export, and concurrent updates. |
| Service profile and target-market preferences | Settings include skills, services, markets, portfolio links, experience summary, and score threshold; local storage plus additive profile migration | Verify URL validation and profile persistence in local and deployed cloud environments. |
| Explainable fit score; unknown budget is not disqualifying | `src/lib/scoring.ts`, score detail UI, `lead_scores` history table | Unit tests pass locally; verify persisted history and representative scoring against reviewed real examples. |
| Search history, idempotency, normalized results | `supabase/functions/discover/index.ts`; `search_runs` and serialized monthly reservation schema | Deploy function, configure a permitted provider, verify quota and duplicate behavior, and test source/provider failures. |
| Balanced active opportunities and company prospecting | Discovery UI has type and market selectors; manual intake supports both kinds | Validate representative query templates and relevance for both streams. |
| Persistent in-app and optional email notifications | Local/cloud notifications, unread count, mark-read, dismiss, threshold preference, and lead-match alerts; `notifications` and `outbox` tables. | Verify alert thresholds and RLS in a deployed project; implement verified-destination email worker, retry delivery, channel independence, and preferences. |
| Admin source/run/usage/audit controls | Roles and audit/outbox schema only | Admin UI, privileged Edge Function checks, run controls, audit event writing, and operational alerting. |
| No automatic applications or unsolicited outreach | No submission or messaging action exists in the UI or functions | Regression review before release. |
| Free-first, no surprise provider charges | Search disabled by default; monthly limit must be configured; account must opt in by setting `BRAVE_SEARCH_ENABLED=true` | Verify current provider terms/pricing and quota behavior before setting any provider secret or enabling searches. |
| Deployable alpha/beta/MVP | Setup instructions and a GitHub Actions quality workflow | Real environment secrets, migration/function deployment, hosting, backups, rollback, alpha/beta evidence, and release approval. |

## Known risks and controls

| Risk | Control in place | Remaining control |
|---|---|---|
| Cross-account data access | Owner-scoped RLS on profiles, leads, evidence, scores, runs, and notifications. | Test policies against multiple accounts and review deployed grants/policies. |
| Unapproved API spend | Brave search is disabled unless a server-side enable flag, API key, and positive monthly cap are all configured; reservation is serialized per owner. | Keep disabled until the owner has reviewed terms/cost and chosen a cap. |
| Misleading search snippets | UI marks excerpts unverified and requires review; no application/outreach action. | Research/evidence review workflow and source policy registry. |
| Duplicate leads | URL tracking-parameter normalization in the UI and owner-scoped unique source URL index. | More robust canonicalization and duplicate linking for equivalent pages. |
| Failed cloud load | Cloud mode blocks workspace edits until account data loads; retry/sign-out state. | Verify migration/schema mismatch, offline, and session-expiry UX. |
| Email or scheduler failure | Provider boundary and outbox/run schema designed. | Implement delivery worker, scheduling, retries, idempotency, monitoring, and recovery runbook. |
