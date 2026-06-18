// /binomes — "Trouver un binôme".
//
// Annuaire d'inscription (PAS un classement déguisé) : aider les participants
// à voir qui est déjà en équipe, qui cherche encore, et faciliter la
// constitution des binômes Canal Cup. Volontairement sans points individuels
// (cf. lib/data/binomes.ts pour le rationnel RGPD / RH).
//
// Cette page est surtout utile pendant la phase de lancement ; elle pourra
// disparaître de la nav une fois les équipes stabilisées.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBinomeDirectory } from "@/lib/data/binomes";
import { getMyPartnerRequests } from "@/lib/data/binome-requests";
import { BinomeDirectory } from "@/components/binomes/BinomeDirectory";

export const dynamic = "force-dynamic";

export default async function BinomesPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/");

  const { data: me } = await supabase
    .from("users")
    .select("id, display_name, name, team_id")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  const directory = await getBinomeDirectory();
  const requests = me
    ? await getMyPartnerRequests(me.id)
    : { sent: [], received: [] };

  // Statut du viewer pour le bandeau d'actions (sans équipe / déjà en équipe).
  const myEntry = me ? directory.entries.find((e) => e.user_id === me.id) ?? null : null;

  return (
    <BinomeDirectory
      entries={directory.entries}
      services={directory.services}
      myUserId={me?.id ?? null}
      myTeamName={myEntry?.team_name ?? null}
      myInTeam={!!myEntry?.team_id}
      initialSent={requests.sent}
      initialReceived={requests.received}
    />
  );
}
