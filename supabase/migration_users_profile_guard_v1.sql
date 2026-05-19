-- migration_users_profile_guard_v1
-- Onboarding #1 — garantir qu'un profil "complété" a bien TOUS les champs
-- obligatoires (équipe, service, niveau foot, nom/pseudo).
--
-- Contexte : l'ancien /onboarding posait profile_completed=true sans jamais
-- demander l'équipe (ni name) -> users avec team_id NULL -> impossible de
-- pronostiquer (predictions.team_id NOT NULL). Cf. fix(predictions) + le
-- nouvel /onboarding qui exige l'équipe.
--
-- Ordre IMPORTANT : (1) réparer les lignes incohérentes AVANT (2) d'ajouter
-- la contrainte, sinon ALTER ... ADD CONSTRAINT échoue sur les lignes en
-- violation.

-- 1. Renvoyer en onboarding les profils "complétés" mais incohérents.
update public.users
set profile_completed = false,
    onboarding_step = 0,
    updated_at = now()
where profile_completed = true
  and (
    team_id is null
    or service_id is null
    or football_level is null
    or coalesce(nullif(btrim(display_name), ''), nullif(btrim(name), '')) is null
  );

-- 2. Garde serveur (niveau base : impossible à contourner via client/RLS) :
--    profile_completed ne peut valoir true que si tout est renseigné.
alter table public.users drop constraint if exists users_profile_complete_chk;
alter table public.users add constraint users_profile_complete_chk check (
  profile_completed = false
  or (
    team_id is not null
    and service_id is not null
    and football_level is not null
    and coalesce(nullif(btrim(display_name), ''), nullif(btrim(name), '')) is not null
  )
);
