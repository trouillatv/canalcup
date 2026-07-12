-- Fix Jet Lag inopérant (2026-07-12)
-- ─────────────────────────────────────────────────────────────────────────────
-- Le joker « Retard d'Avion » a été renommé « Jet Lag » côté code : l'effet
-- inséré est désormais effect_type='jet_lag' (lib/jokers/service.ts). Mais la
-- contrainte CHECK de joker_effects n'autorisait que l'ancien 'flight_delay'.
-- Conséquence : chaque insert d'effet jet_lag était rejeté (23514) SANS que
-- l'erreur soit vérifiée → aucun effet enregistré → resolveJetLagForMatch ne
-- trouvait rien au settlement → le Jet Lag ne faisait RIEN, pour tout le monde.
--
-- On ajoute 'jet_lag' aux valeurs autorisées (on conserve 'flight_delay' pour
-- ne pas casser d'éventuelles lignes historiques).
alter table public.joker_effects drop constraint if exists joker_effects_effect_type_check;
alter table public.joker_effects add constraint joker_effects_effect_type_check
  check (effect_type in ('red_card_block','fog','flight_delay','var_window','spy','jet_lag'));
