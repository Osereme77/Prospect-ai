# ADR 0002: Discovery boundary and provider cost controls

- Status: Accepted for the initial adapter; enabling a provider requires a separate owner choice.
- Date: 2026-10-20

## Context

Discovery must preserve public source links, avoid prohibited access, remain useful through manual entry, and not create an unapproved recurring or per-request bill.

## Decision

- The first code adapter uses Brave Web Search behind an authenticated Edge Function.
- The adapter returns normalized title, URL, and excerpt only; it does not fetch result pages or apply to jobs.
- Automated searches remain disabled unless a server-side API key, `BRAVE_SEARCH_ENABLED=true`, and positive `BRAVE_SEARCH_MONTHLY_LIMIT` are configured.
- The application retains titles, URLs, and snippets as lead/evidence records. Brave's Search API terms prohibit storing Search Results unless the selected plan explicitly grants storage rights. Enablement therefore also requires a separate server-side `BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED=true` guard and per-account terms, pricing, and storage-rights confirmations.
- A database reservation function serializes each user's monthly quota allocation before a provider request.
- Search results are unverified leads; the browser preserves excerpts as unverified evidence and expects human review.

## Consequences

- Manual entry and local pipeline tracking work without the provider.
- Provider terms, pricing, storage rights, and source suitability must be reviewed before enabling it. See [the official Search API terms](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service) and [pricing](https://brave.com/search/api/).
- Provider quotas, scheduled runs, page research, and source registry controls remain future work.
