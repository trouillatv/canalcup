// /final — URL stable et partageable du palmarès (projetable le jour de la
// remise des prix).
//
// Accessible seulement quand la compétition est CLOSE : exposer la cérémonie
// pendant le tournoi spoilerait un classement encore mouvant. Exception pour
// les organisateurs, qui doivent pouvoir relire la page AVANT de basculer le
// drapeau — sinon la seule façon de la vérifier serait de clôturer pour de vrai.

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ClosingCeremony } from "@/components/final/ClosingCeremony";
import { getEventStatus } from "@/lib/event/status";
import { isAdminUser } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Palmarès — Canal Cup 2026",
  description: "Les classements officiels de la Canal Cup 2026",
};

// Vitrine de données settlées : rien ne bouge plus, mais on garde un revalidate
// court pour que la page suive une éventuelle correction orga.
export const revalidate = 60;

export default async function FinalPage() {
  const status = await getEventStatus();
  if (status !== "closed") {
    const isOrga = await isAdminUser();
    if (!isOrga) redirect("/");
  }
  return <ClosingCeremony />;
}
