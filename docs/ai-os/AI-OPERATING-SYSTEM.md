# CANAL Sports AI operating system

This is the lightweight operating system for Vincent, ChatGPT, Codex, and GitHub. It complements the repository docs; it does not replace the architecture records.

Authoritative references:

- `docs/supabase-architecture-p2.md` for TARGET/SOURCE separation.
- `docs/adr/0001-multi-sport-data-model.md` for the multi-sport event core.
- `docs/adr/0003-sport-provider-abstraction.md` for provider boundaries.
- `docs/adr/0005-prediction-engine-market-types.md` for the new predictions engine.
- `docs/lot-phase0b-legacy-routes-audit.md`, `docs/lot-phase1-legacy-bridge-1-report.md`, and `docs/lot-phase2-admin-auth-audit.md` for legacy bridge and admin constraints.

## Audit snapshot

- This repo has no previous `AGENTS.md`, no `.codex/skills`, no `.mcp.json`, no `.superpowers`, and no real agent board.
- `.claude/settings.local.json` exists as local Claude permissions/history, not a durable CANAL Sports operating model.
- GitHub CLI is available and authenticated for `trouillatv/canal-sports`.
- Existing GitHub workflows are legacy/Canal Cup oriented and should not be expanded into autonomous AI execution in this version.
- Playwright is not installed/configured in this package today.
- shadcn is not configured through `components.json`, though local UI components exist.
- Existing docs are strong on architecture and legacy audits; they were missing workflow, evidence, acceptance, and handoff conventions.

## Roles

- Vincent: final product authority, final arbitration, GO / FIX_REQUIRED.
- ChatGPT: external Product Lead for product framing, UX, interaction, motion, conceptual architecture, Delivery Contracts, and review.
- Codex principal: Technical / Implementation Lead, source of truth for the real repo, implementation, tests, browser evidence, Git, and contradiction reporting.
- Codex specialists: temporary focused reviewers, used only when they reduce risk or improve quality.
- GitHub: durable bus for contracts, status, SHA, evidence, and review.

## Pipelines

### FAST

Use for bugs, copy, local style, typos, and obvious small corrections.

Flow: Vincent -> Codex -> adapted verification -> delivery.

No Product Board, no unnecessary specialist, no long contract.

### STANDARD

Use for local feature work, limited flow changes, reusable components, moderate UI, or local architecture.

Flow: Vincent or ChatGPT if useful -> short framing -> Codex -> specialist only if useful -> implementation -> adapted review.

Usually 0-1 specialist.

### PRODUCT

Use for important pages, new flows, structural redesigns, navigation, mobile experience, gamification, social, mode TV, or meaningful motion.

Flow:

```text
Vincent
-> ChatGPT Product
-> Delivery Contract
-> GitHub issue
-> Codex
-> targeted specialists if useful
-> implementation
-> real browser evidence
-> tests
-> commit/push
-> GitHub checkpoint
-> ChatGPT review
-> GO or FIX_REQUIRED
```

Usually 1-2 specialists. Three is exceptional.

## Delivery Contract

The Delivery Contract is the main handoff artifact. It consolidates the current decision so Codex does not need to reread long conversations.

Maximum structure:

```text
OBJECTIVE
CURRENT BEHAVIOR
TARGET BEHAVIOR
UX
MOTION
DATA CONTRACT
TECHNICAL CONSTRAINTS
TARGET / SOURCE BOUNDARY
OUT OF SCOPE
ACCEPTANCE
EVIDENCE
HARD STOP
```

FAST issues may use only a subset.

## GitHub workflow

Use labels plus structured issues before creating a complex Project.

Recommended labels:

- `AI-READY`
- `AI-WORKING`
- `REVIEW-READY`
- `FIX-REQUIRED`
- `DONE`

Daily command concept:

```text
/work-next
```

In Codex this maps to the project skill `.codex/skills/work-next/SKILL.md`.

Work-next rules:

1. Find one `AI-READY` issue.
2. Verify no issue is already `AI-WORKING`.
3. Read its Delivery Contract.
4. Inspect the repo.
5. Mark the issue `AI-WORKING`.
6. Work according to FAST/STANDARD/PRODUCT.
7. Produce required evidence.
8. Run tests/types/build as appropriate.
9. Commit and push only scoped changes.
10. Comment with SHA, summary, tests, evidence, deviations, and `REVIEW_READY`.
11. Stop. Never take a second issue automatically.

## Technical vs product acceptance

Technical Acceptance checks:

- code;
- TypeScript;
- lint/tests/build when relevant;
- security;
- DB/RLS/data safety;
- TARGET/SOURCE boundary;
- no fake data.

Product Acceptance checks:

- immediate comprehension;
- sport hierarchy;
- desire to interact;
- navigation;
- mobile and desktop quality;
- states;
- interaction;
- motion;
- polish;
- perceived performance;
- coherence with Programme and Match Center.

A slice can be `TECH PASS` and `PRODUCT FAIL`.

## Evidence Pack

For important PRODUCT UI, "tested visually" is not enough.

Minimum evidence depends on the slice, but can include:

- desktop screenshot;
- mobile screenshot;
- above the fold;
- after scroll;
- main interaction state;
- empty/loading/error states when affected;
- console state;
- network state when architecture-sensitive;
- short video only when motion or scroll is part of acceptance.

Local evidence artifacts should go under `.ai-evidence/`, which is ignored by Git. Long-term evidence belongs in GitHub issue comments, PR attachments, or CI artifacts.

## Golden Flows

Do not implement all flows now. Use this convention later for deterministic Playwright flows with controlled data.

Planned first flows:

1. Programme -> open next fixture -> Match Center -> context -> squads -> Pronostiquer -> back to Programme.
2. Finished match -> Match Center -> final score -> my prediction -> points -> standings.
3. Mobile -> Programme -> match -> prediction -> confirmation -> bottom navigation.

Never mutate production accidentally.

## Specialists

No project-specific subagent runtime was present in this repo at the time this document was created. Do not create fake `.claude/agents` unless the runtime explicitly supports it.

Use these specialist roles conceptually or through future supported tooling:

- Experience Designer: before visible PRODUCT work; defines IA, hierarchy, sport/event hierarchy, mobile/desktop/TV behavior, states, interaction, motion, product acceptance. Does not code.
- Sports Architecture Reviewer: maps Delivery Contract to real sports architecture, TARGET/SOURCE boundary, APIs, DB/security, migration risk, and tests. Does not turn every problem into a generic abstraction.
- Visual QA: after UI implementation; checks real app on desktop/mobile, scroll, sticky UI, sheets, states, interactions, motion, console, network, overflow, layout shifts, CANAL Sports coherence.
- DB Security Reviewer: only for DB, RLS, auth, service-role, legacy bridge, tokens, permissions, sensitive data, or admin work. Never for padding polish.

## Token and context budget

- FAST: 0 specialist by default.
- STANDARD: 0-1 specialist.
- PRODUCT: 1-2 specialists normally, 3 only for critical work.
- Use targeted inspection.
- Use existing authoritative docs and ADRs.
- Do not reread the whole repo.
- Do not paste massive logs into issue comments.
- Specialists return concise findings to Codex; no agent-to-agent debates.
- Do not repeat the full product spec in every subtask.

## TARGET / SOURCE and data safety

- TARGET ref: `yfhuqsuboqfznnpceosl`.
- SOURCE ref: `qmkbnafilhdhnsdupgzd`.
- Confirm project refs before any Supabase action.
- No DB migration or Supabase write without explicit checkpoint.
- SOURCE access is server-side only via the dedicated legacy client.
- No SOURCE service role or anon key in browser code.
- No email fallback for the identity bridge.
- Legacy admin mechanisms are temporary compatibility unless reclassified by a dedicated admin lot.
- `NEXT_PUBLIC_ADMIN_SECRET` is not an acceptable authorization mechanism.

## Data quality and providers

Provider data can be absent, partial, stale, or wrong. Preserve provenance/freshness when available. Prefer raw/provenance plus quality flags and tolerant UI over silent correction.

Do not add providers, paid APIs, or systematic scraping because a block lacks data.

## Legacy Canal Cup

Legacy is a library of value, not a migration backlog. Each module should later be judged as:

- KEEP
- ADAPT
- REDESIGN
- DROP
- NEW

No mass swap of the 119 routes and no 21-route adaptation without product decision.

## Automation boundary

This version is controlled, not fully autonomous:

- Vincent starts Codex.
- Codex handles one issue through `/work-next`.
- Codex reaches `REVIEW_READY`.
- Codex stops.

No GitHub Action running Codex, no new paid API, and no background AI worker in this version.
