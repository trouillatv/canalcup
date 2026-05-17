---
name: project-supabase-access
description: Supabase project credentials and migration access details for Canal Cup
metadata:
  type: project
---

Supabase project ref: `qmkbnafilhdhnsdupgzd`
Management API PAT: stored in `.env.local` as `SUPABASE_PAT`
Migration script: `node scripts/migrate.js "SQL QUERY"`

**Why:** User asked all DB changes to be done programmatically, not via SQL Editor.

**How to apply:** Before adding any new table or column, use the Management API:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/qmkbnafilhdhnsdupgzd/database/query" \
  -H "Authorization: Bearer $(grep SUPABASE_PAT .env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR SQL HERE"}'
```
Or use the migrate.js script: `node scripts/migrate.js "SQL"`

**Schema applied so far:**
- `matches`: id, external_id, competition, phase, team_a, team_b, flag_a, flag_b, starts_at, channel, status, score_a, score_b, is_match_of_week, odds
- `predictions`: + predicted_score_a integer, predicted_score_b integer
- `bonus_predictions`: id, user_id, team_id, prediction_type, predicted_value, points_awarded, created_at, UNIQUE(user_id, prediction_type)
