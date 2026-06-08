import { notFound } from "next/navigation";
import { allWCTeamSlugs } from "@/lib/football/wc-teams";
import { getFootballTeamDashboard } from "@/lib/data/football-team";
import { TeamDashboard } from "@/components/football/TeamDashboard";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return allWCTeamSlugs().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getFootballTeamDashboard(id);
  const name = data?.wcTeam.name ?? "Sélection";
  return {
    title: `${name} — Coupe du Monde 2026 · Canal Cup`,
    description: `Fiche, classement de groupe, résultats et stats de la sélection ${name} à la Coupe du Monde 2026.`,
  };
}

export default async function FootballTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getFootballTeamDashboard(id);
  if (!data) notFound();
  return <TeamDashboard data={data} />;
}
