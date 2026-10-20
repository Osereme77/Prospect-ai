# Implementation status

This file records what is implemented in the current `ui-test` branch and what still needs external project configuration before it can be enabled for real user data.

| Plan phase | Delivered in this branch | Remaining work |
|---|---|---|
| 0. Scope and traceability | PRD and phased plan retained; sample data explicitly marked synthetic. | Keep acceptance criteria aligned as the product evolves. |
| 1. UX and design system | Responsive visual foundation, navigation, overview, list, detail, intake, research, notifications, and settings flows. | Product-owner review and iterative UX refinement. |
| 2. Architecture decisions | React/TypeScript/Vite frontend; local-first fallback; Supabase/Postgres/RLS design; server-side provider boundary; explainable score contract. | Record decisions as ADRs when Supabase project, hosting and provider choices are confirmed. |
| 3. Secure foundation | Supabase schema, auth user provisioning trigger, roles table, owner-scoped RLS, server-side credential rule. | Create the Supabase project, configure email/auth, bootstrap the trusted admin, review policies against the deployed project, and run database security checks. |
| 4. Lead workspace | Manual URL intake, local persistence, search, status lifecycle, detail/evidence display, notes, profile preferences, notifications view. | Authenticated cloud synchronization, exports, dedupe linking, and profile onboarding. |
| 5. Discovery | Authenticated Edge Function adapter for Brave Web Search, input limits, idempotent run record, result normalization, public URL filtering, and run failure recording. | Configure `BRAVE_SEARCH_API_KEY` and `APP_ORIGIN`; connect the frontend, add source terms/quotas and scheduled run locking/retries. The function does not save results as leads yet. |
| 6. Research and scoring | Score formula utility, score rationale fields, evidence model, and score unit tests. | Run tests; connect provider evidence extraction and persist versioned score components. |
| 7. Notifications and operations | In-app notification surface and database notification/outbox/audit schema. | Authenticated notification persistence, email provider and retry worker, admin controls and operational monitoring. |
| 8. Verification | Written setup and product guardrails; unit tests defined. | Dependency installation, automated tests, build, accessibility/security checks, migration review, and mobile browser QA. npm registry requests timed out in this environment, so checks could not run here. |
| 9. Release | Local setup and Supabase deployment steps documented. | Configure auth, deploy database/functions, set secrets, deploy hosting, and run alpha/beta acceptance gates. |

The current frontend is intentionally local mode. No live Supabase project, search provider, email provider, or hosting credentials were present in the workspace, so the UI labels those integrations as disconnected rather than implying that they are operating.
