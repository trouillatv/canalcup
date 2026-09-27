// Orchestrateur Monte-Carlo — Lot 3C, checklist point 2/3/4.
//
// Une "réplication" = un tirage indépendant d'une saison complète (journée 1
// réelle fixe + journées 2-8 simulées) ; à l'intérieur de chaque réplication,
// chaque profil est instancié `usersPerProfile` fois, chacune avec son
// propre flux rng dérivé (aucun partage d'état entre joueurs). Les forces
// d'équipe et les perceptions publiques sont tirées une seule fois (fixes
// pour toute la simulation, voir team-strength.ts) — seule la saison varie
// d'une réplication à l'autre, plus le pronostic de chaque joueur.
//
// Aucune écriture Supabase, aucune dépendance réseau : tout est local et
// déterministe à partir de `baseSeed`.

import { createRng, deriveSeed, sampleBernoulli } from "./rng.ts";
import { CALENDAR, ALL_TEAMS, type CalendarFixture } from "./calendar.ts";
import {
  buildTeamStrengths,
  buildFavoriPerception,
  buildExpertPerception,
  type TeamStrengths,
  type PublicPerception,
} from "./team-strength.ts";
import { generateSeason, type GeneratedFixture } from "./season-generator.ts";
import { PROFILES, PROFILE_KEYS, type ProfileKey } from "./profiles.ts";
import { computeExactScoreFacts } from "../predictions/scorers.ts";
import type { ScoringScheme, MatchFacts, PointBreakdown } from "./scoring-schemes.ts";
import { applyScheme } from "./scoring-schemes.ts";
import {
  summarize,
  pointSourceShare,
  exactFrequency,
  discrimination,
  tieRate,
  survivalAboveThreshold,
  type SummaryStats,
  type PointShare,
  type Discrimination,
} from "./metrics.ts";

export type SimulationConfig = {
  baseSeed: number;
  replications: number;
  usersPerProfile: number;
  absenceRates: number[]; // ex: [0, 0.05, 0.10, 0.20]
  schemes: ScoringScheme[];
};

export type ProfileAbsenceReport = {
  absenceRate: number;
  summary: SummaryStats;
  survivalAboveOverallMedian: number;
};

export type SchemeProfileReport = {
  profile: ProfileKey;
  perAbsenceRate: ProfileAbsenceReport[];
  pointShare: PointShare; // à 0% d'absence
  exactFrequency: number; // indépendant du barème, mais reporté par barème pour lisibilité
};

export type SchemeReport = {
  scheme: ScoringScheme;
  perProfile: SchemeProfileReport[];
  overallMedianAtZeroAbsence: number;
  discriminationExpertVsAleatoire: Discrimination;
  tieRateAtZeroAbsence: number;
};

export type SimulationReport = {
  config: SimulationConfig;
  matchdays: number[];
  perScheme: SchemeReport[];
};

type UserAggregate = {
  profile: ProfileKey;
  facts: MatchFacts[]; // alignées sur l'ordre de `season`
  matchdayOf: number[]; // matchdayOf[i] = journée de facts[i]
};

function matchdaysOf(calendar: CalendarFixture[]): number[] {
  return Array.from(new Set(calendar.map((f) => f.matchday))).sort((a, b) => a - b);
}

function simulateUser(
  profile: ProfileKey,
  season: GeneratedFixture[],
  favoriPerception: PublicPerception,
  expertPerception: PublicPerception,
  userSeed: number
): UserAggregate {
  const rng = createRng(userSeed);
  const facts: MatchFacts[] = [];
  const matchdayOf: number[] = [];
  for (const fixture of season) {
    const payload = PROFILES[profile](
      { home: fixture.home, away: fixture.away },
      { rng, favoriPerception, expertPerception }
    );
    facts.push(computeExactScoreFacts(payload, fixture.result));
    matchdayOf.push(fixture.matchday);
  }
  return { profile, facts, matchdayOf };
}

function missedMatchdaySet(matchdays: number[], rate: number, absenceSeed: number): Set<number> {
  const rng = createRng(absenceSeed);
  const missed = new Set<number>();
  for (const md of matchdays) {
    if (rate > 0 && sampleBernoulli(rng, rate)) missed.add(md);
  }
  return missed;
}

function totalForNonMissed(breakdowns: PointBreakdown[], matchdayOf: number[], missed: Set<number>): number {
  let total = 0;
  for (let i = 0; i < breakdowns.length; i++) {
    if (missed.has(matchdayOf[i])) continue;
    total += breakdowns[i].total;
  }
  return total;
}

export function runSimulation(config: SimulationConfig): SimulationReport {
  const { baseSeed, replications, usersPerProfile, absenceRates, schemes } = config;
  const matchdays = matchdaysOf(CALENDAR);

  const strengths: TeamStrengths = buildTeamStrengths(ALL_TEAMS, baseSeed);
  const favoriPerception = buildFavoriPerception(strengths, baseSeed);
  const expertPerception = buildExpertPerception(strengths, baseSeed);

  // accumulators[scheme.key][profile][absenceRateIndex] = totals[]
  const totalsAcc = new Map<string, Map<ProfileKey, number[][]>>();
  // breakdownsAtZeroAbsence[scheme.key][profile] = PointBreakdown[] (tous joueurs, tous matchs joués)
  const breakdownsAtZero = new Map<string, Map<ProfileKey, PointBreakdown[]>>();
  // factsByProfile[profile] = MatchFacts[] (tous joueurs, toutes réplications, indépendant du barème)
  const factsByProfile = new Map<ProfileKey, MatchFacts[]>();
  // leaderboardPerReplication[scheme.key][r] = totaux (0% absence, tous profils
  // mêlés) DANS cette réplication uniquement — un vrai "classement" d'une
  // seule saison, pour le taux d'égalité (voir note tieRate plus bas : les
  // mêler entre réplications gonflerait artificiellement les égalités,
  // puisque ce serait comparer des saisons différentes entre elles).
  const leaderboardPerReplication = new Map<string, number[][]>();

  for (const scheme of schemes) {
    totalsAcc.set(scheme.key, new Map(PROFILE_KEYS.map((p) => [p, absenceRates.map(() => [] as number[])])));
    breakdownsAtZero.set(scheme.key, new Map(PROFILE_KEYS.map((p) => [p, [] as PointBreakdown[]])));
    leaderboardPerReplication.set(
      scheme.key,
      Array.from({ length: replications }, () => [] as number[])
    );
  }
  for (const p of PROFILE_KEYS) factsByProfile.set(p, []);

  for (let r = 0; r < replications; r++) {
    const seasonRng = createRng(deriveSeed(baseSeed, "season", r));
    const season = generateSeason(CALENDAR, strengths, seasonRng);

    for (const profile of PROFILE_KEYS) {
      for (let u = 0; u < usersPerProfile; u++) {
        const userSeed = deriveSeed(baseSeed, "user", profile, u, "rep", r);
        const user = simulateUser(profile, season, favoriPerception, expertPerception, userSeed);
        factsByProfile.get(profile)!.push(...user.facts);

        for (const scheme of schemes) {
          const breakdowns = user.facts.map((f) => applyScheme(scheme, f));

          absenceRates.forEach((rate, rateIdx) => {
            const absenceSeed = deriveSeed(baseSeed, "absence", profile, u, "rep", r, "rate", rate);
            const missed = missedMatchdaySet(matchdays, rate, absenceSeed);
            const total = totalForNonMissed(breakdowns, user.matchdayOf, missed);
            totalsAcc.get(scheme.key)!.get(profile)![rateIdx].push(total);
            if (rate === 0) {
              breakdownsAtZero.get(scheme.key)!.get(profile)!.push(...breakdowns);
              leaderboardPerReplication.get(scheme.key)![r].push(total);
            }
          });
        }
      }
    }
  }

  const perScheme: SchemeReport[] = schemes.map((scheme) => {
    const profileTotals = totalsAcc.get(scheme.key)!;
    const profileBreakdowns = breakdownsAtZero.get(scheme.key)!;

    const zeroAbsenceIdx = absenceRates.indexOf(0);
    const combinedZeroAbsencePool = PROFILE_KEYS.flatMap((p) => profileTotals.get(p)![zeroAbsenceIdx]);
    const overallMedianAtZeroAbsence = summarize(combinedZeroAbsencePool).median;
    const perReplicationTieRates = leaderboardPerReplication.get(scheme.key)!.map((board) => tieRate(board));
    const tieRateAtZeroAbsence = summarize(perReplicationTieRates).mean;

    const perProfile: SchemeProfileReport[] = PROFILE_KEYS.map((profile) => {
      const perAbsenceRate: ProfileAbsenceReport[] = absenceRates.map((rate, idx) => {
        const totals = profileTotals.get(profile)![idx];
        return {
          absenceRate: rate,
          summary: summarize(totals),
          survivalAboveOverallMedian: survivalAboveThreshold(totals, overallMedianAtZeroAbsence),
        };
      });
      return {
        profile,
        perAbsenceRate,
        pointShare: pointSourceShare(profileBreakdowns.get(profile)!),
        exactFrequency: exactFrequency(factsByProfile.get(profile)!),
      };
    });

    const expertTotals = profileTotals.get("expert_simule")![zeroAbsenceIdx];
    const aleatoireTotals = profileTotals.get("aleatoire")![zeroAbsenceIdx];

    return {
      scheme,
      perProfile,
      overallMedianAtZeroAbsence,
      discriminationExpertVsAleatoire: discrimination(expertTotals, aleatoireTotals),
      tieRateAtZeroAbsence,
    };
  });

  return { config, matchdays, perScheme };
}
