-- Baby-foot V2 — format "championnat global + Top 4".
--
-- Remplace poules+élim par : Phase 1 = mini-championnat (chaque binôme joue 3
-- matchs, classement unique), Top 4 → Phase 2 (demies 1v4/2v3, petite finale,
-- finale). Barème CUMULATIF (participation 5, +5/victoire de phase 1, qualif
-- demi 10, victoire demi 15, champion 20 → max 65). Ordonnancement par rotations.
--
-- Idempotente.

begin;

-- ── Format : 'league' (championnat) | 'ko' (élim. directe) ────────────────────
alter table public.babyfoot_tournaments drop constraint if exists babyfoot_tournaments_format_check;
-- Migrer la donnée AVANT d'ajouter la nouvelle contrainte.
update public.babyfoot_tournaments set format='league' where format not in ('league','ko');
alter table public.babyfoot_tournaments alter column format set default 'league';
alter table public.babyfoot_tournaments
  add constraint babyfoot_tournaments_format_check check (format in ('league','ko'));

-- ── Phase des matchs : ajoute 'league' (phase 1 = championnat) ────────────────
alter table public.babyfoot_matches drop constraint if exists babyfoot_matches_phase_check;
alter table public.babyfoot_matches
  add constraint babyfoot_matches_phase_check
  check (phase is null or phase in ('league','pool','prelim','quarter','semi','final','third','friendly'));

-- ── Rotation d'ordonnancement (regroupe les matchs joués en parallèle) ────────
alter table public.babyfoot_matches add column if not exists rotation int;

-- ── Barème CUMULATIF : plusieurs paliers possibles par binôme ─────────────────
-- Nouveaux stages : participation, phase1 (Σ victoires×5), qualified, semi_win,
-- champion. On passe donc de "1 palier/binôme" à "1 ligne par stage".
alter table public.babyfoot_awards drop constraint if exists babyfoot_awards_stage_check;
alter table public.babyfoot_awards
  add constraint babyfoot_awards_stage_check
  check (stage in ('participation','phase1','qualified','semi_win','champion'));
-- Repartir propre (l'édition 2026 est en brouillon, aucun award réel).
delete from public.babyfoot_awards;
drop index if exists public.uniq_bf_award_entry;
create unique index if not exists uniq_bf_award_entry_stage
  on public.babyfoot_awards(entry_id, stage);

commit;
