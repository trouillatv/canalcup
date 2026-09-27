// Tests unitaires — modèle de force synthétique (Lot 3C).

import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_TEAMS } from "./calendar.ts";
import {
  buildTeamStrengths,
  buildFavoriPerception,
  buildExpertPerception,
  expectedGoals,
  perceivedFavorite,
  PUBLIC_PERCEPTION_NOISE_STD_DEV_FAVORI,
  PUBLIC_PERCEPTION_NOISE_STD_DEV_EXPERT,
} from "./team-strength.ts";

test("buildTeamStrengths: une entrée par équipe", () => {
  const strengths = buildTeamStrengths(ALL_TEAMS, 42);
  assert.equal(strengths.size, ALL_TEAMS.length);
  for (const team of ALL_TEAMS) assert.ok(strengths.has(team));
});

test("buildTeamStrengths: déterministe pour un même seed", () => {
  const a = buildTeamStrengths(ALL_TEAMS, 42);
  const b = buildTeamStrengths(ALL_TEAMS, 42);
  for (const team of ALL_TEAMS) {
    assert.equal(a.get(team)!.attack, b.get(team)!.attack);
    assert.equal(a.get(team)!.defense, b.get(team)!.defense);
  }
});

test("buildTeamStrengths: seeds différents => forces différentes", () => {
  const a = buildTeamStrengths(ALL_TEAMS, 42);
  const b = buildTeamStrengths(ALL_TEAMS, 43);
  const anyDifferent = ALL_TEAMS.some((t) => a.get(t)!.attack !== b.get(t)!.attack);
  assert.ok(anyDifferent);
});

test("expectedGoals: lambdas strictement positifs pour toute paire d'équipes", () => {
  const strengths = buildTeamStrengths(ALL_TEAMS, 42);
  for (let i = 0; i < 5; i++) {
    const home = ALL_TEAMS[i];
    const away = ALL_TEAMS[i + 1];
    const { home: lh, away: la } = expectedGoals(strengths, home, away);
    assert.ok(lh > 0 && Number.isFinite(lh));
    assert.ok(la > 0 && Number.isFinite(la));
  }
});

test("expectedGoals: équipe inconnue lève une exception explicite", () => {
  const strengths = buildTeamStrengths(ALL_TEAMS, 42);
  assert.throws(() => expectedGoals(strengths, "Équipe Fantôme", ALL_TEAMS[0]));
});

test("perceivedFavorite: cohérent avec expectedGoals (lambda le plus élevé gagne)", () => {
  const strengths = buildTeamStrengths(ALL_TEAMS, 42);
  const perception = buildFavoriPerception(strengths, 42);
  const home = ALL_TEAMS[0];
  const away = ALL_TEAMS[1];
  const { home: lh, away: la } = expectedGoals(perception, home, away);
  const favorite = perceivedFavorite(perception, home, away);
  assert.equal(favorite, lh >= la ? "home" : "away");
});

test("perception favori/expert : dérivées de la même force réelle mais jamais identiques (bruit indépendant)", () => {
  const strengths = buildTeamStrengths(ALL_TEAMS, 42);
  const favori = buildFavoriPerception(strengths, 42);
  const expert = buildExpertPerception(strengths, 42);
  const anyDifferent = ALL_TEAMS.some((t) => favori.get(t)!.attack !== expert.get(t)!.attack);
  assert.ok(anyDifferent);
});

test("l'expert a un bruit de perception strictement plus faible que favori (mieux informé, jamais voyant)", () => {
  assert.ok(PUBLIC_PERCEPTION_NOISE_STD_DEV_EXPERT < PUBLIC_PERCEPTION_NOISE_STD_DEV_FAVORI);
});

test("perception publique : déterministe pour un même seed", () => {
  const strengths = buildTeamStrengths(ALL_TEAMS, 42);
  const a = buildFavoriPerception(strengths, 42);
  const b = buildFavoriPerception(strengths, 42);
  for (const team of ALL_TEAMS) {
    assert.equal(a.get(team)!.attack, b.get(team)!.attack);
    assert.equal(a.get(team)!.defense, b.get(team)!.defense);
  }
});
