---
name: work-next
description: Execute exactly one GitHub AI-READY CANAL Sports issue through the project delivery workflow, produce evidence, mark it REVIEW-READY, and stop.
---

# work-next

Use this skill when Vincent asks Codex to work the next GitHub issue.

## Preconditions

- Repository is inspected.
- GitHub CLI is available or an equivalent GitHub connector is available.
- Worktree dirtiness is understood; never revert unrelated changes.

## Workflow

1. Find one issue labeled `AI-READY`.
2. Verify no issue is already labeled `AI-WORKING`.
3. Read the Delivery Contract from the issue.
4. Classify or confirm mode: FAST, STANDARD, or PRODUCT.
5. Inspect the repo and authoritative docs.
6. Report contradictions before coding.
7. Move exactly one issue to `AI-WORKING`.
8. Implement only the requested slice.
9. Produce the requested evidence.
10. Run tests/types/build as appropriate.
11. Commit and push scoped changes only.
12. Comment the issue with:
    - SHA;
    - summary;
    - tests;
    - evidence;
    - deviations;
    - `REVIEW_READY`.
13. Replace `AI-WORKING` with `REVIEW-READY`.
14. Stop.

## Hard rules

- Never take a second issue automatically.
- Never run a migration, Supabase write, provider fetch, scraping, or legacy route swap without explicit checkpoint.
- Never expose SOURCE credentials to the browser.
- Never invent sports data.
- Keep evidence out of Git unless it is intentionally committed documentation.
