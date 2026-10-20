# ADR 0003: User ownership and explainable scoring

- Status: Accepted for the initial implementation; deployed policy tests pending.
- Date: 2026-10-20

## Context

The first product is single-owner-first but uses user-owned records so it can support additional accounts without changing every table. Scores must explain fit and must not treat an unknown budget as zero.

## Decision

- Every workspace record includes an owner ID; cloud access is restricted by RLS using the authenticated user ID.
- Authenticated users receive the ordinary `user` role on signup. Roles cannot be self-edited through the browser API.
- The score components use the PRD weights: relevance 35%, evidence of need 25%, budget signals 15%, freshness 15%, and source confidence 10%.
- Unknown budget is represented by a neutral component and explicitly labeled unknown; no component is a verified fact unless supported by evidence.

## Consequences

- A trusted server-side bootstrap is still needed for the first Super Admin.
- Score history schema and UI exist, but production scoring quality and RLS isolation need deployed tests.
