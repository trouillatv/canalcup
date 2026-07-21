// Cérémonie de clôture de la Canal Cup — VITRINE STRICTEMENT EN LECTURE.
//
// Principes non négociables (spec du 2026-07-21) :
//  ❌ aucun recalcul, aucune écriture : on affiche des points DÉJÀ settlés ;
//  ❌ aucun classement fabriqué (pas de « meilleur joueur baby-foot », donnée
//     qui n'existe pas en base) ;
//  ✅ chaque classement porte son UNITÉ (Équipes / Joueurs / Binômes) — sans ça
//     on laisse croire qu'on compare des points d'équipe et des points perso,
//     qui ne sont pas la même monnaie.
//
// Composant UNIQUE monté à la fois par /final et par la home quand la
// compétition est close : zéro duplication de logique de données.

import Image from "next/image";
import { Trophy, Medal, Gift, Users, User, Handshake } from "lucide-react";
import { getLeaderboard, getIndividualLeaderboard } from "@/lib/data/teams";
import { getActiveOfficialTournament, buildPublicState } from "@/lib/data/babyfoot";
import { createAdminClient } from "@/lib/supabase/admin";
import { CeremonyConfetti } from "@/components/final/CeremonyConfetti";

type Unit = "Équipes" | "Joueurs" | "Binômes";

const UNIT_ICON = { Équipes: Users, Joueurs: User, Binômes: Handshake } as const;

function UnitBadge({ unit }: { unit: Unit }) {
  const Icon = UNIT_ICON[unit];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light">
      <Icon className="w-3 h-3" />
      {unit}
    </span>
  );
}

function SectionTitle({ title, unit }: { title: string; unit: Unit }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="canal-headline text-xl sm:text-2xl">{title}</h2>
      <UnitBadge unit={unit} />
    </div>
  );
}

type PodiumEntry = { rank: number; label: string; sub?: string | null; points: number };

const MEDAL = ["🥇", "🥈", "🥉"];
// Ordre d'AFFICHAGE (gauche → droite) : 2e · 1er · 3e.
const PODIUM_ORDER = [1, 0, 2];
// Hauteur des marches indexée par RANG (0 = 1er) — surtout pas par position,
// sinon le vainqueur se retrouve sur une marche plus basse que son dauphin.
const PODIUM_H = ["h-32", "h-24", "h-20"];

function Podium({ entries }: { entries: PodiumEntry[] }) {
  if (!entries.length) return null;
  const top3 = entries.slice(0, 3);
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4 mb-5">
      {PODIUM_ORDER.map((idx) => {
        const e = top3[idx];
        if (!e) return null;
        return (
          <div key={e.rank} className="flex flex-col items-center flex-1 max-w-[10rem]">
            <span className="text-2xl sm:text-3xl mb-1">{MEDAL[idx]}</span>
            <p className="text-xs sm:text-sm font-bold text-white text-center leading-tight line-clamp-2">
              {e.label}
            </p>
            {e.sub && (
              <p className="text-[10px] text-canal-gray-muted text-center line-clamp-1">{e.sub}</p>
            )}
            <div
              className={`w-full ${PODIUM_H[idx]} mt-2 rounded-t-lg flex items-start justify-center pt-2 ${
                idx === 0
                  ? "bg-canal-yellow/25 border-t-2 border-x border-canal-yellow"
                  : "bg-canal-gray-mid border-t border-x border-canal-gray-light"
              }`}
            >
              <span className="score-display text-lg sm:text-2xl">{e.points}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type RankRow = { rank: number; label: string; sub?: string | null; points: number; extra?: string };

function RankTable({ rows, entityHeader }: { rows: RankRow[]; entityHeader: string }) {
  if (!rows.length) {
    return <p className="text-sm text-canal-gray-muted italic">Aucun résultat enregistré.</p>;
  }
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm min-w-[20rem]">
        <thead>
          <tr className="text-canal-gray-muted text-[11px] uppercase tracking-wider">
            <th className="text-left font-semibold py-1 w-8">#</th>
            <th className="text-left font-semibold py-1">{entityHeader}</th>
            <th className="text-right font-semibold py-1 w-16">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.rank}-${r.label}`}
              className={`border-t border-canal-gray-light/50 ${r.rank <= 3 ? "text-white" : "text-white/80"}`}
            >
              <td className="py-1.5 tabular-nums font-bold text-canal-gray-muted">{r.rank}</td>
              <td className="py-1.5">
                <span className={r.rank <= 3 ? "font-bold" : ""}>{r.label}</span>
                {r.sub && <span className="text-canal-gray-muted text-xs"> · {r.sub}</span>}
                {r.extra && <span className="text-canal-gray-muted text-xs block">{r.extra}</span>}
              </td>
              <td className="py-1.5 text-right tabular-nums font-bold text-canal-yellow">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PHASE_LABEL: Record<string, string> = {
  pool: "Phase de poules",
  league: "Championnat",
  prelim: "Barrages",
  quarter: "Quarts de finale",
  semi: "Demi-finales",
  third: "Petite finale",
  final: "Finale",
};
const PHASE_ORDER = ["league", "pool", "prelim", "quarter", "semi", "third", "final"];

export async function ClosingCeremony() {
  // Toutes les sources sont READ-ONLY et déjà existantes. Appels directs aux
  // fonctions lib/data/* (pas de fetch HTTP interne : inutile et fragile en SSR).
  const admin = createAdminClient();
  const [teams, individuals, tournament] = await Promise.all([
    getLeaderboard(),
    getIndividualLeaderboard(),
    getActiveOfficialTournament(admin),
  ]);
  const baby = tournament ? await buildPublicState(admin, tournament.id) : null;

  // Classements JOUEURS dérivés du classement individuel déjà settlé — on ne
  // recalcule rien, on trie et on filtre les scores nuls (un joueur à 0 prono
  // n'a pas sa place dans un palmarès de pronostics).
  const pronos = individuals
    .filter((p) => p.pronos > 0)
    .sort((a, b) => b.pronos - a.pronos)
    .map((p, i) => ({
      rank: i + 1,
      label: p.display_name ?? "Joueur",
      sub: p.team_name,
      points: p.pronos,
    }));

  const quiz = individuals
    .filter((p) => p.quiz > 0)
    .sort((a, b) => b.quiz - a.quiz)
    .map((p, i) => ({
      rank: i + 1,
      label: p.display_name ?? "Joueur",
      sub: p.team_name,
      points: p.quiz,
    }));

  const general = teams.map((r) => ({
    rank: r.rank,
    label: r.team.name,
    points: r.total,
  }));

  // Classement général INDIVIDUEL. C'était l'onglet ouvert PAR DÉFAUT sur la
  // home (« 🧍 Joueurs ») : le classement que chacun regarde en premier. Une
  // cérémonie qui ne le montre pas laisse chaque joueur sans sa place perso.
  // ⚠️ Points PERSO — jamais additionnables ni comparables aux points d'équipe,
  // d'où le badge d'unité (même total, pas la même monnaie).
  const players = individuals
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((p, i) => ({
      rank: i + 1,
      label: p.display_name ?? "Joueur",
      sub: p.team_name,
      points: p.total,
    }));

  // Baby-foot : le podium officiel vient des final_rank posés à la clôture du
  // tournoi. S'il est vide (tournoi non finalisé), on n'invente rien.
  const babyPodium = (baby?.podium ?? []).map((p) => ({
    rank: p.rank,
    label: p.label,
    points: p.points,
  }));

  const pointsByEntry = new Map<string, number>();
  for (const p of baby?.podium ?? []) pointsByEntry.set(p.label, p.points);

  const babyStandings = (baby?.classement ?? []).map((r) => ({
    rank: r.rank,
    label: r.label,
    points: pointsByEntry.get(r.label) ?? 0,
    extra: `${r.played} match${r.played > 1 ? "s" : ""} · ${r.won} V · ${r.lost} D${
      r.forfeited ? " · forfait" : ""
    }`,
  }));

  const finishedMatches = (baby?.matches ?? []).filter(
    (m) => m.status === "finished" && m.score_a != null && m.score_b != null
  );
  const byPhase = PHASE_ORDER.map((phase) => ({
    phase,
    label: PHASE_LABEL[phase] ?? phase,
    matches: finishedMatches.filter((m) => (m.phase ?? "pool") === phase),
  })).filter((g) => g.matches.length > 0);

  // ── Hall of Fame — UNIQUEMENT des faits déjà en base ──────────────────────
  const hall: { title: string; who: string; detail?: string; unit: Unit }[] = [];
  // Même priorité que les sections : le joueur d'abord, l'équipe ensuite.
  if (players[0]) hall.push({ title: "Meilleur joueur Canal Cup", who: players[0].label, detail: `${players[0].points} pts`, unit: "Joueurs" });
  if (general[0]) hall.push({ title: "Champion Canal Cup", who: general[0].label, detail: `${general[0].points} pts`, unit: "Équipes" });
  if (babyPodium[0]) hall.push({ title: "Champion Baby-foot", who: babyPodium[0].label, unit: "Binômes" });
  if (babyPodium[1]) hall.push({ title: "Finaliste Baby-foot", who: babyPodium[1].label, unit: "Binômes" });
  if (babyPodium[2]) hall.push({ title: "Troisième Baby-foot", who: babyPodium[2].label, unit: "Binômes" });
  if (pronos[0]) hall.push({ title: "Vainqueur des Pronostics", who: pronos[0].label, detail: `${pronos[0].points} pts`, unit: "Joueurs" });
  if (quiz[0]) hall.push({ title: "Vainqueur des Quiz", who: quiz[0].label, detail: `${quiz[0].points} pts`, unit: "Joueurs" });

  // Dérivés sans nouvelle règle : on lit des scores déjà enregistrés.
  const widest = finishedMatches.reduce<(typeof finishedMatches)[number] | null>(
    (best, m) =>
      !best || Math.abs(m.score_a! - m.score_b!) > Math.abs(best.score_a! - best.score_b!) ? m : best,
    null
  );
  const tightest = finishedMatches.reduce<(typeof finishedMatches)[number] | null>(
    (best, m) =>
      !best || Math.abs(m.score_a! - m.score_b!) < Math.abs(best.score_a! - best.score_b!) ? m : best,
    null
  );

  const photos = baby?.photos ?? [];

  return (
    <div className="pb-24">
      <CeremonyConfetti />

      {/* ── 1. Hero de clôture ───────────────────────────────────────────── */}
      <header className="relative px-4 pt-10 pb-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-canal-yellow/10 to-transparent pointer-events-none" />
        <div className="relative">
          <Trophy className="w-14 h-14 sm:w-20 sm:h-20 text-canal-yellow mx-auto mb-4" />
          <h1 className="canal-headline text-3xl sm:text-5xl mb-3">
            La Canal Cup 2026 est terminée
          </h1>
          <p className="text-canal-yellow font-bold text-sm sm:text-lg uppercase tracking-wide">
            Les résultats sont définitifs
          </p>
          <p className="text-canal-gray-muted text-sm mt-3 max-w-md mx-auto">
            Merci à toutes et tous pour ces semaines de pronostics, de quiz, de baby-foot et de
            chambrage. Passez voir l&apos;équipe Marketing pour récupérer vos récompenses.
          </p>
        </div>
      </header>

      <div className="px-4 max-w-3xl mx-auto space-y-8">
        {/* ── 2. Classement général individuel — JOUEURS ─────────────────
            EN PREMIER, volontairement : c'est SA place que chacun vient
            chercher. Le classement par équipes vient ensuite. */}
        <section className="canal-card">
          <SectionTitle title="Classement général individuel" unit="Joueurs" />
          <Podium entries={players} />
          <RankTable rows={players} entityHeader="Joueur" />
        </section>

        {/* ── 3. Classement général — ÉQUIPES ────────────────────────────── */}
        <section className="canal-card">
          <SectionTitle title="Classement général" unit="Équipes" />
          <Podium entries={general.map((r) => ({ ...r, sub: null }))} />
          <RankTable rows={general} entityHeader="Équipe" />
        </section>

        {/* ── 4-5. Pronostics — JOUEURS ──────────────────────────────────── */}
        <section className="canal-card">
          <SectionTitle title="Pronostics" unit="Joueurs" />
          <Podium entries={pronos} />
          <RankTable rows={pronos} entityHeader="Joueur" />
        </section>

        {/* ── 6-7. Quiz — JOUEURS ────────────────────────────────────────── */}
        <section className="canal-card">
          <SectionTitle title="Quiz" unit="Joueurs" />
          <Podium entries={quiz} />
          <RankTable rows={quiz} entityHeader="Joueur" />
        </section>

        {/* ── 8. Baby-foot — BINÔMES ─────────────────────────────────────── */}
        {baby && (
          <section className="canal-card">
            <SectionTitle title="Tournoi Baby-foot" unit="Binômes" />
            <Podium entries={babyPodium} />

            {byPhase.length > 0 && (
              <div className="space-y-4 mt-4">
                {byPhase.map((g) => (
                  <div key={g.phase}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-canal-yellow mb-1.5">
                      {g.label}
                    </h3>
                    <ul className="space-y-1">
                      {g.matches.map((m) => {
                        const aWins = m.score_a! > m.score_b!;
                        return (
                          <li
                            key={m.id}
                            className="flex items-center gap-2 text-sm bg-canal-gray-mid/50 rounded-lg px-2.5 py-1.5"
                          >
                            <span className={`flex-1 text-right truncate ${aWins ? "font-bold text-white" : "text-white/60"}`}>
                              {m.labelA}
                            </span>
                            <span className="tabular-nums font-black text-canal-yellow px-1.5 whitespace-nowrap">
                              {m.score_a} – {m.score_b}
                            </span>
                            <span className={`flex-1 truncate ${!aWins ? "font-bold text-white" : "text-white/60"}`}>
                              {m.labelB}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-xs font-bold uppercase tracking-wider text-canal-yellow mt-5 mb-1.5">
              Classement final des binômes
            </h3>
            <RankTable rows={babyStandings} entityHeader="Binôme" />
          </section>
        )}

        {/* ── 9. Hall of Fame ────────────────────────────────────────────── */}
        {hall.length > 0 && (
          <section className="canal-card">
            <div className="flex items-center gap-2 mb-3">
              <Medal className="w-5 h-5 text-canal-yellow" />
              <h2 className="canal-headline text-xl sm:text-2xl">Hall of Fame</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {hall.map((h) => (
                <div
                  key={h.title}
                  className="bg-canal-gray-mid rounded-lg p-3 border border-canal-gray-light"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">
                      {h.title}
                    </p>
                    <UnitBadge unit={h.unit} />
                  </div>
                  <p className="font-bold text-white leading-tight">{h.who}</p>
                  {h.detail && <p className="text-xs text-canal-yellow">{h.detail}</p>}
                </div>
              ))}
            </div>

            {(widest || tightest) && (
              <div className="mt-3 text-xs text-canal-gray-muted space-y-1">
                {widest && (
                  <p>
                    <span className="text-white/80 font-semibold">Score le plus large :</span>{" "}
                    {widest.labelA} {widest.score_a} – {widest.score_b} {widest.labelB}
                  </p>
                )}
                {tightest && (
                  <p>
                    <span className="text-white/80 font-semibold">Match le plus serré :</span>{" "}
                    {tightest.labelA} {tightest.score_a} – {tightest.score_b} {tightest.labelB}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── 10. Récompenses ────────────────────────────────────────────── */}
        <section className="rounded-xl border-2 border-canal-yellow bg-canal-yellow/10 p-5 text-center">
          <Gift className="w-10 h-10 text-canal-yellow mx-auto mb-2" />
          <h2 className="canal-headline text-xl sm:text-2xl mb-1">Les récompenses sont prêtes !</h2>
          <p className="text-sm text-white/85">
            Les gagnants peuvent passer voir l&apos;équipe <strong className="text-canal-yellow">Marketing</strong>{" "}
            pour récupérer leurs lots.
          </p>
        </section>

        {/* ── 11. Souvenirs (lecture seule, uniquement s'il y a des photos) ─ */}
        {photos.length > 0 && (
          <section className="canal-card">
            <h2 className="canal-headline text-xl sm:text-2xl mb-3">Souvenirs</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.slice(0, 12).map((p) => (
                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-canal-gray-mid">
                  <Image
                    src={p.photo_url}
                    alt={p.caption ?? "Souvenir Canal Cup"}
                    fill
                    sizes="(max-width: 640px) 33vw, 25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-canal-gray-muted pt-2">
          🏆 Canal Cup 2026 — À l&apos;année prochaine.
        </p>
      </div>
    </div>
  );
}
