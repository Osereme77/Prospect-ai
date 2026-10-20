# ADR 0006: Optional AI research adapter

- Status: Deferred; deterministic research and scoring are the MVP baseline.
- Date: 2026-10-20

## Context

Research currently accepts a bounded public-page excerpt supplied by the owner, extracts conservative observations locally, labels the observations unverified, records the source and timestamp, and reports missing fields. The rule-based score works without a model. Sending page text to a model could improve summarization but creates privacy, prompt-injection, provider-cost, retention, and regional-processing concerns.

## Decision

Keep remote AI calls disabled. Preserve the provider interface as a future server-side adapter only after the owner reviews provider terms, data retention, cost limits, model region, and redaction needs. The deterministic path remains available if an AI provider is missing, over quota, or returns invalid output.

Any future adapter must:

- Send only bounded, relevant public text and avoid unnecessary personal data.
- Treat all page content as untrusted data, never as instructions.
- Require schema-validated output with explicit observation, hypothesis, and missing-information fields.
- Preserve evidence URL and observation time, and label generated interpretations separately from owner-reviewed facts.
- Apply a server-side spending cap and log aggregate usage without storing prompts or credentials in ordinary application logs.
- Fail closed to deterministic research when validation or provider calls fail.

## Consequences

The product does not need model credentials to provide evidence review or scoring. AI-generated summaries and claims are not available until a later reviewed ADR update and acceptance tests prove their behavior.
