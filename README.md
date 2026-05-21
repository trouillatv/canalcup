# Canal Cup 2026

Plateforme RSE Canal+ Nouvelle-Calédonie pour la Coupe du Monde 2026.

## Stack
- Next.js 15 (App Router) sur Vercel
- Supabase (Postgres + Auth + RLS)
- API-Football (live scores, events, lineups) — fallback TheSportsDB
- Gemini (brief IA matinal)

## Scripts utiles

```bash
# Migrations DB
node scripts/migrate.js --file supabase/<migration>.sql

# Tester un match LIVE depuis n'importe quelle compétition
node scripts/seed-live-test-match.js

# Suivre un match en quasi-temps réel (refresh boucle, anti-quota)
node scripts/watch-match.js <match-uuid> [intervalSec=60]

# Reset password d'un user
node scripts/reset-password.js <email> <newPassword>

# Supprimer entièrement un user (auth + identities + allowlist)
node scripts/delete-auth-user.js <email>
```

## Env vars critiques
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `API_FOOTBALL_KEY` (plan Free api-football.com : 100 req/jour)
- `GEMINI_API_KEY`, `MOCK_AI=false` en prod
- `ALLOWED_EMAIL_DOMAINS=canal-plus.com` (allowlist auto par domaine)
- `ADMIN_EMAILS=trouillatv@gmail.com`
- `SUPABASE_PAT` (Management API, migrations server-side)
