---
name: visual-review
description: Review a CANAL Sports UI slice in the real application across responsive states and interactions, producing visual evidence and product acceptance findings.
---

# visual-review

Use this skill for PRODUCT UI slices or when Vincent asks for a visual review.

## Goal

Review the real CANAL Sports application, not only the code.

## Checks

Inspect relevant states and viewports:

- 390px mobile;
- 768px tablet;
- 1280px desktop;
- 1920px wide desktop.

Check:

- above the fold;
- after scroll;
- primary interaction;
- navigation;
- sticky elements;
- drawers/sheets;
- loading/empty/error/success states when affected;
- focus and keyboard visibility;
- console errors;
- network behavior when architecture-sensitive;
- overflow, overlap, layout shifts;
- motion and `prefers-reduced-motion` behavior when relevant.

## Evidence

Store local artifacts under `.ai-evidence/` unless the Delivery Contract says otherwise.

For important UI, provide screenshots for desktop and mobile at minimum. Use video only when motion, scrolling, or gesture interaction is part of Product Acceptance.

## Output

Report findings in three groups:

1. Bloquant
2. Irritant important
3. Polish

Keep the report concise and tied to visible evidence.
