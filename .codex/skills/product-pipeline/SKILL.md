# product-pipeline

Use this skill when classifying a CANAL Sports request before work.

## Goal

Choose the lightest useful pipeline:

- FAST
- STANDARD
- PRODUCT

Do not over-orchestrate.

## Classification

FAST:

- obvious bug;
- microcopy;
- local style;
- typo;
- small correction with low product risk.

STANDARD:

- local feature;
- limited flow change;
- reusable component;
- moderate UI;
- local architecture.

PRODUCT:

- new important page;
- new journey;
- structural redesign;
- Programme / Match Center / Pronostics / Classements major work;
- main navigation;
- mobile experience;
- gamification;
- social/live/TV mode;
- significant motion;
- mental model change.

## Rules

- FAST uses no specialist by default.
- STANDARD uses at most one specialist when useful.
- PRODUCT normally uses one or two specialists and requires a Delivery Contract.
- Never reopen product arbitration for a validated Delivery Contract unless the repo contradicts it or it is unsafe.
- Always preserve TARGET/SOURCE boundaries and sports data truth.
