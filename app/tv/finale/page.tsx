import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLeaderboard, getIndividualLeaderboard } from "@/lib/data/teams";
import { getServiceLeaderboard } from "@/lib/data/users";
import { getActiveOfficialTournament, getEntries, getMatches, getAwards } from "@/lib/data/babyfoot";
import { FinalCeremonyTv, type CeremonyTvData } from "@/components/tv/FinalCeremonyTv";

export const metadata: Metadata = {
  title: "Canal Cup 2026 | Cérémonie finale",
  description: "La cérémonie de clôture de la Canal Cup 2026.",
};

export const revalidate = 60;

export default async function FinaleTvPage() {
  const admin = createAdminClient();
  const [teams, individuals, services, tournament, counts] = await Promise.all([
    getLeaderboard(),
    getIndividualLeaderboard(),
    getServiceLeaderboard(),
    getActiveOfficialTournament(admin),
    Promise.all([
      admin.from("matches").select("id", { count: "exact", head: true }).eq("is_settled", true),
      admin.from("predictions").select("id", { count: "exact", head: true }),
      admin.from("quiz_session").select("id", { count: "exact", head: true }).eq("status", "finished"),
      admin.from("users").select("id", { count: "exact", head: true }),
      admin.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]),
  ]);

  const [entries, matches, awards] = tournament
    ? await Promise.all([getEntries(admin, tournament.id), getMatches(admin, tournament.id), getAwards(admin, tournament.id)])
    : [[], [], []];

  const labelByEntry = new Map(entries.map((entry) => [entry.id, entry.label]));
  const pointsByEntry = new Map<string, number>();
  for (const award of awards) pointsByEntry.set(award.entry_id, (pointsByEntry.get(award.entry_id) ?? 0) + award.points);

  const data: CeremonyTvData = {
    teams: teams.map((row) => ({ name: row.team.name, points: row.total, rank: row.rank })),
    players: individuals.filter((row) => row.total > 0).sort((a, b) => b.total - a.total).map((row, index) => ({
      name: row.display_name ?? "Joueur", points: row.total, rank: index + 1,
    })),
    pronostics: individuals.filter((row) => row.pronos > 0).sort((a, b) => b.pronos - a.pronos).map((row, index) => ({
      name: row.display_name ?? "Joueur", points: row.pronos, rank: index + 1,
    })),
    quiz: individuals.filter((row) => row.quiz > 0).sort((a, b) => b.quiz - a.quiz).map((row, index) => ({
      name: row.display_name ?? "Joueur", points: row.quiz, rank: index + 1,
    })),
    services: services.map((row) => ({ name: row.service.name, points: row.average, rank: row.rank })),
    babyfoot: entries.filter((entry) => entry.final_rank).sort((a, b) => (a.final_rank ?? 99) - (b.final_rank ?? 99)).map((entry) => ({
      name: entry.label, points: pointsByEntry.get(entry.id) ?? 0, rank: entry.final_rank ?? 99,
    })),
    bracket: matches.filter((match) => ["semi", "third", "final"].includes(match.phase ?? "")).map((match) => ({
      phase: match.phase ?? "final", a: labelByEntry.get(match.entry_a_id ?? "") ?? "À venir", b: labelByEntry.get(match.entry_b_id ?? "") ?? "À venir",
      scoreA: match.score_a ?? null, scoreB: match.score_b ?? null,
    })),
    stats: {
      matches: counts[0].count ?? 0, pronostics: counts[1].count ?? 0, quiz: counts[2].count ?? 0,
      participants: counts[3].count ?? 0, services: counts[4].count ?? 0, babyfoot: matches.length,
    },
  };

  return <FinalCeremonyTv data={data} />;
}
