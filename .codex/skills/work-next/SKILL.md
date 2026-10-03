---
name: work-next
description: Execute exactly one GitHub FIX-REQUIRED or AI-READY CANAL Sports issue through the project delivery workflow, produce evidence, mark it REVIEW-READY, and stop.
---

# work-next

Use this skill when Vincent asks Codex to work the next GitHub issue or resume a reviewed issue that needs fixes.

## Preconditions

- Repository is inspected.
- GitHub CLI is available or an equivalent GitHub connector is available.
- Worktree dirtiness is understood; never revert unrelated changes.

## Workflow

1. Check for any issue labeled `AI-WORKING`. If one exists, report it and stop; never start or resume another issue in parallel.
2. Prefer one issue labeled `FIX-REQUIRED`. Resume that issue before taking new work.
3. If no `FIX-REQUIRED` issue exists, find one issue labeled `AI-READY`.
4. If neither exists, report that there is no eligible issue and stop.
5. Read the Delivery Contract and latest review comments from the issue.
6. Classify or confirm mode: FAST, STANDARD, or PRODUCT.
7. Inspect the repo and authoritative docs.
8. Report contradictions before coding.
9. Move exactly one selected issue to `AI-WORKING`.
10. Implement only the requested slice or requested fixes.
11. Produce the required evidence.
12. Run tests/types/build as appropriate.
13. Commit and push scoped changes only.
14. Comment the issue with:
    - SHA;
    - summary;
    - tests;
    - evidence;
    - deviations;
    - `REVIEW_READY`.
15. Replace `AI-WORKING` with `REVIEW-READY`.
16. Stop.

## Hard rules

- Never take a second issue automatically.
- `FIX-REQUIRED` has priority over new `AI-READY` work.
- A PRODUCT UI issue cannot be marked `REVIEW-READY` without an evidence pack that matches the issue's interaction and motion scope.
- Static PRODUCT UI needs at least desktop and mobile screenshots.
- Interaction, scroll, sticky UI, drawer, or sheet work needs real browser scenario evidence with before/after states.
- Significant motion needs screenshots plus short video or frame sequence, Motion Contract validation, and `prefers-reduced-motion` validation.
- Never run a migration, Supabase write, provider fetch, scraping, or legacy route swap without explicit checkpoint.
- Never expose SOURCE credentials to the browser.
- Never invent sports data.
- Keep evidence out of Git unless it is intentionally committed documentation.
