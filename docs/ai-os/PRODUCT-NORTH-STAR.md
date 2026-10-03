# CANAL Sports product north star

CANAL Sports is a CANAL+ sports engagement product.

It is not a SofaScore clone, an ERP, a generic sports news site, a data dashboard, or a repainted Canal Cup. Canal Cup remains a useful legacy library and historical source, not the future sports reference system.

The product loop is:

```text
SUIVRE -> COMPRENDRE -> JOUER -> VIVRE LE MATCH -> VOIR SON RESULTAT -> REVENIR
```

CANAL Sports should help collaborators:

- know what is happening and what matters;
- identify the major fixtures;
- make predictions;
- follow their results and points;
- understand the sports context before and after events;
- compare and play with colleagues;
- progressively access useful CANAL-facing sports and programming context.

## Principles

- Sport first, dashboard second.
- Interaction is useful, not decorative.
- Data must be reliable, sourced, or explicitly calculated.
- Missing data is hidden or explained honestly.
- Information appears progressively, at the moment it helps.
- The experience feels premium, calm, sharp, and CANAL Sports specific.
- Mobile-first for personal and field contexts.
- Desktop is designed as desktop, never just a stretched mobile app.
- TV surfaces can exist where collective use makes sense.
- Human decisions remain explicit for important product, admin, and data choices.

## Data truth

Never invent scores, standings, lineups, injuries, match scorers, incidents, TV broadcasts, form, stakes, or factual narrative.

Always separate:

- provider data;
- calculated data;
- editorial data;
- AI-generated data.

Season squads are season squads, not match lineups. Current scorers data is competition scorers, not a match goal timeline.

## Multi-sport stance

Champions League is the first real vertical. The core model must remain compatible with football, rugby, motorsports, and future sports.

Do not over-abstract early, but do not build foundational primitives that make a two-team football match the only possible event shape. Use the common sports/event core, then add sport-specific extensions when real needs appear.
