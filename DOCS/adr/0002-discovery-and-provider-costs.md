# ADR 0002: Discovery boundary and provider cost controls

- Status: Accepted for the initial adapter; enabling a provider requires a separate owner choice.
- Date: 2026-10-20

## Context

Discovery must preserve public source links, avoid prohibited access, remain useful through manual entry, and not create an unapproved recurring or per-request bill.

## Decision

- Discovery is provider-selectable behind an authenticated Edge Function. Remote OK's free public JSON job feed is the first adapter approved for implementation; Brave Search remains a gated candidate for company search.
- Remote OK returns bounded title, company, URL, and excerpt fields. Search terms are matched locally, without sending the user's query or profile to Remote OK. The adapter does not fetch job pages or apply to jobs.
- Remote OK use requires the server-side `REMOTE_OK_ENABLED=true`, a positive `REMOTE_OK_MONTHLY_LIMIT`, and per-account approval. It supports active opportunity discovery only.
- The application retains titles, URLs, and snippets as lead/evidence records. Brave's default Search API terms prohibit retaining Search Results; persistence requires separate written authorization such as an Order Form. Enablement therefore also requires a server-side `BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED=true` guard and per-account terms, pricing, and written-authorization confirmations.
- A database reservation function serializes each user's and provider-wide monthly quota allocation before a provider request.
- The app displays a follow link to Remote OK on the opportunity screen when its data is present and preserves a direct link to every original job post, as required by the [feed FAQ](https://remoteok.com/faq) and [terms](https://remoteok.com/legal).
- Search results are unverified leads; the browser preserves excerpts as unverified evidence and expects human review.

## Consequences

- Manual entry and local pipeline tracking work without the provider.
- Remote OK's FAQ describes the feed as free and requests credit plus a link to each original job post. Recheck its terms when enabling or operating the source. Brave Search retention remains prohibited by default; persistent storage requires separate written authorization. See [Brave Search API terms](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service) and [pricing](https://brave.com/search/api/).
- Provider usage has an admin aggregate by month, and admins can pause/resume registered source rows with audited RPCs. Provider quotas still depend on server-side cap configuration. A separate scheduled Remote OK coordinator is implemented with claim/lease, bounded retries, and atomic persistence; it stays dormant until the scheduler is explicitly configured and verified. Independent-source retries remain future work.
