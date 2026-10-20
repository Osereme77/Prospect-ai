# ADR 0002: Discovery boundary and provider cost controls

- Status: Accepted for the initial adapter; enabling a provider requires a separate owner choice.
- Date: 2026-10-20

## Context

Discovery must preserve public source links, avoid prohibited access, remain useful through manual entry, and not create an unapproved recurring or per-request bill.

## Decision

- The first code adapter uses Brave Web Search behind an authenticated Edge Function.
- The adapter returns normalized title, URL, and excerpt only; it does not fetch result pages or apply to jobs.
- Automated searches remain disabled unless a server-side API key, `BRAVE_SEARCH_ENABLED=true`, and positive `BRAVE_SEARCH_MONTHLY_LIMIT` are configured.
- A database reservation function serializes each user's monthly quota allocation before a provider request.
- Search results are unverified leads; the browser preserves excerpts as unverified evidence and expects human review.

## Consequences

- Manual entry and local pipeline tracking work without the provider.
- Provider terms, pricing, and source suitability must be reviewed before enabling it.
- Provider quotas, scheduled runs, page research, and source registry controls remain future work.
