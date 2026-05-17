import { notFound } from "next/navigation";
import { getWCTeamBySlug, allWCTeamSlugs } from "@/lib/football/wc-teams";
import { WCTeamFiche } from "@/components/teams/WCTeamFiche";

export function generateStaticParams() {
  return allWCTeamSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = getWCTeamBySlug(slug);
  return { title: team ? `${team.name} — Canal Cup 2026` : "Sélection — Canal Cup 2026" };
}

export default async function WCTeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = getWCTeamBySlug(slug);
  if (!team) notFound();
  return <WCTeamFiche team={team} />;
}
