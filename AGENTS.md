# CANAL Sports agent instructions

## Authority

- Vincent is the final product authority and decides GO / FIX_REQUIRED.
- ChatGPT can act as external Product Lead for product framing, UX, interaction, motion, conceptual architecture, Delivery Contracts, and review.
- Codex is the Technical / Implementation Lead: it verifies the real repository, confronts product contracts with code, implements, tests, uses browser evidence, Git, and reports contradictions.
- Specialists are temporary targeted reviewers. They do not become an autonomous team.

## Canonical architecture

- TARGET CANAL Sports Supabase ref: `yfhuqsuboqfznnpceosl`.
- SOURCE Canal Cup legacy Supabase ref: `qmkbnafilhdhnsdupgzd`.
- TARGET owns authentication, `public.users`, organizations/memberships, sports, competitions, seasons, events, event_participants, participants, players, squad_memberships, standings_snapshots, scorers, new predictions, and all new CANAL Sports business data.
- SOURCE owns historical Canal Cup legacy data/modules/storage/functions/triggers.
- TARGET authenticates. A shared server layer authorizes. SOURCE is accessed only server-side through the dedicated legacy client.
- Never build a new Programme, Match Center, or prediction engine around `SOURCE.matches`.
- The identity bridge is N SOURCE personas to 1 TARGET identity via `SOURCE.public.users.canal_sports_auth_id`. Never use email as the durable bridge.

## Working rules

- Inspect before modifying.
- Keep changes scoped to the request.
- Do not run DB migrations, Supabase writes, provider fetches, scraping, or legacy route swaps without an explicit checkpoint.
- Do not expose SOURCE credentials or service-role keys to the browser.
- Do not invent sports facts: scores, standings, lineups, injuries, scorers, incidents, TV rights, form, stakes, or editorial claims.
- Distinguish provider data, calculated data, editorial data, and AI data.
- Preserve the read-only legacy canary unless the Delivery Contract explicitly says otherwise.
- When a Delivery Contract exists, confront it with the repository, report contradictions, and do not reopen product arbitration gratuitously.
- Tests passing is Technical Acceptance only; Product Acceptance still requires real UX review and evidence when the slice is visual.

## Pipelines

- FAST: bug, copy, local style, obvious small correction. No Product Board, no specialist by default.
- STANDARD: local feature, limited flow change, moderate UI, local architecture. Use at most one specialist when useful.
- PRODUCT: important page/flow/redesign/navigation/mobile/gamification/motion. Requires a Delivery Contract, browser evidence, tests, GitHub checkpoint, and review.

Daily controlled workflow is documented in `docs/ai-os/AI-OPERATING-SYSTEM.md`.
