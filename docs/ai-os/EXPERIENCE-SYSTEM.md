# CANAL Sports experience system

This document defines product experience principles, not a full CSS token catalog. Keep visual implementation grounded in existing CANAL Sports components before inventing new primitives.

## Hierarchy

- Lead with the sporting event, not the database object.
- A page should quickly answer: what is happening, when, who is involved, what can I do?
- Technical/provider labels must be translated or hidden.
- Important actions should be visually obvious and reachable on mobile.

## Event surfaces

- Event heroes carry the identity of the fixture: competition, round, date/time or score, status, participants, logos, and primary action.
- Match cards are action surfaces, not static rows.
- Scores and kickoff times are high-signal elements and can use the CANAL yellow accent.
- Team identity uses logos and clear names. Use short names intentionally; ellipsis is the last resort.

## Cards and density

- Cards should be sober, sharp, and information-dense without looking administrative.
- Avoid nested cards unless a true framed tool or repeated item needs it.
- Repetition belongs in group headings when possible: date, matchday, stage, or section status.
- Empty sections should not consume premium space.

## Navigation

- Mobile/tablet: bottom navigation is acceptable when it supports thumb use.
- Desktop: primary navigation belongs in the header or another compact desktop pattern.
- Fixed navigation must never hide content.
- Active state must be clear without being loud.

## Progressive disclosure

- Use accordions, drawers, and bottom sheets when full detail would drown the main task.
- On desktop, more content can be visible by default when it improves comprehension.
- On mobile, long secondary blocks should usually start collapsed.

## States

- Loading: show structural placeholders for the content that is coming.
- Empty: be brief and useful; do not make absence feel like failure.
- Error: explain what failed and what the user can retry.
- Success: confirm the user action, then return focus to the sports loop.

## Interaction

- Hover, focus, and pressed states should make interactive surfaces obvious.
- Keyboard focus must be visible.
- Touch targets should be comfortable on mobile.
- Interactive cards should have a clear destination or action.

## Motion doctrine

Use motion to explain state change, not to decorate.

- Instant: 0-80ms for tiny state feedback.
- Fast: 120-180ms for hover, press, and simple reveals.
- Normal: 200-280ms for content transitions.
- Deliberate: 320-450ms for sheets, drawers, or major panel movement.
- Score/status transitions may be emphasized only when the change matters.
- Stagger is limited and functional.
- No permanent decorative motion.
- No bounce for its own sake.
- Always respect `prefers-reduced-motion`.

## Responsive guidance

- Validate at 390px, 768px, 1280px+, and 1920px when a visual slice is PRODUCT.
- At 390px, no logo/name/score overlap and primary CTA remains thumb-friendly.
- At 1920px, avoid the feeling of a narrow mobile app centered in empty space.
- Desktop layouts should use width intelligently without stretching cards into unreadable slabs.

## Evidence

For important PRODUCT UI, Product Acceptance requires real evidence. A claim that the UI was checked is not enough.

- Static surface: desktop screenshot and mobile screenshot.
- Interaction, scroll, sticky UI, drawer, or sheet: screenshots plus a real browser scenario and before/after states.
- Significant motion: screenshots plus short video or frame sequence, Motion Contract validation, and `prefers-reduced-motion` validation.

Screenshots alone are insufficient when interaction or motion is part of acceptance.
