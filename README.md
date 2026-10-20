# Remy Prospect AI

Remy Prospect AI is a personal opportunity discovery and prospect research platform for an AI-assisted developer seeking paid software work.

The product is intended to find relevant freelance projects, job listings, hiring announcements, and businesses that may need development services in Nigeria and international markets. It gathers public evidence, researches prospects, explains a 0–100 fit score, and keeps opportunities organized in a searchable pipeline.

## Planned MVP

- Discover active software opportunities and research potential client businesses, with both strategies receiving equal priority.
- Import an opportunity manually by URL when automated discovery is unavailable or unsuitable.
- Keep original source links and distinguish verified facts from hypotheses or unknown details.
- Match opportunities against the owner's services, skills, and portfolio, with explainable scoring.
- Track lead status, notes, follow-up dates, and outcomes.
- Send persistent in-app notifications and optional email alerts. The initial notification threshold is 65/100.
- Work as a responsive web application on phones and laptops, with a free-first operating target.

## Planned technology

The requirements document proposes React, TypeScript, and Vite for the frontend, with Supabase Auth and PostgreSQL for authentication and data. Provider integrations for public search, AI research, email, and scheduled jobs should remain modular and optional, with useful rule-based and manual fallbacks.

## Product guardrails

- Respect source terms, privacy requirements, quotas, and access restrictions.
- Do not bypass paywalls, authentication, CAPTCHAs, or anti-bot controls.
- Do not invent contact details, budgets, hiring intent, or other facts; preserve evidence links and label uncertainty.
- The MVP does not automatically apply for jobs or send unsolicited outreach. The owner controls external contact.
- Keep provider credentials server-side and enforce authorization in server and database policies.

## Project status

This repository currently contains the product requirements document. Application implementation has not started.

See [DOCS/PROSPECT PRD.pdf](DOCS/PROSPECT%20PRD.pdf) for the full requirements, data model, security expectations, acceptance criteria, and phased roadmap.
