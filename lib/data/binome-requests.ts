import { createAdminClient } from "@/lib/supabase/admin";
import type { FootballLevel } from "@/lib/supabase/types";

// Demandes "Demander en binôme" d'un utilisateur (envoyées + reçues), pour
// la page /binomes et le bloc "Demandes reçues" de /profile.
//
// Client ADMIN (cross-RLS) comme le reste de l'annuaire binômes. Les
// informations exposées restent volontairement minimales (nom, service,
// niveau foot) — pas de points ni d'activité (cf. lib/data/binomes.ts).

export interface SentPartnerRequest {
  id: string;
  target_user_id: string;
  target_name: string;
  proposed_team_name: string | null;
  status: string;
  created_at: string;
}

export interface ReceivedPartnerRequest {
  id: string;
  requester_user_id: string;
  requester_name: string;
  requester_service: string | null;
  requester_level: FootballLevel | null;
  proposed_team_name: string | null;
  status: string;
  created_at: string;
}

export interface MyPartnerRequests {
  sent: SentPartnerRequest[];
  received: ReceivedPartnerRequest[];
}

/**
 * Demandes pending d'un user (les deux sens). Au passage, on EXPIRE
 * paresseusement les demandes pending dont un des deux participants a
 * désormais une équipe (team_id) : ça matérialise la règle produit "si l'un
 * rejoint une équipe avant acceptation, la demande devient expirée" sans
 * toucher aux endpoints d'équipe existants.
 */
export async function getMyPartnerRequests(userId: string): Promise<MyPartnerRequests> {
  try {
    const admin = createAdminClient();

    const { data: rows } = await admin
      .from("team_partner_requests")
      .select(
        "id, requester_user_id, target_user_id, proposed_team_name, status, created_at"
      )
      .or(`requester_user_id.eq.${userId},target_user_id.eq.${userId}`)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const pending = rows ?? [];
    if (pending.length === 0) return { sent: [], received: [] };

    // Charger les profils des autres participants pour l'affichage + détecter
    // ceux qui ont rejoint une équipe entre-temps (expiry paresseux).
    const otherIds = new Set<string>();
    for (const r of pending) {
      otherIds.add(r.requester_user_id);
      otherIds.add(r.target_user_id);
    }
    const { data: profiles } = await admin
      .from("users")
      .select("id, display_name, name, service_id, football_level, team_id")
      .in("id", [...otherIds]);
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Expiry : toute demande pending où l'un des deux a déjà une équipe.
    const toExpire: string[] = [];
    const stillPending = pending.filter((r) => {
      const reqHasTeam = !!profMap.get(r.requester_user_id)?.team_id;
      const tgtHasTeam = !!profMap.get(r.target_user_id)?.team_id;
      if (reqHasTeam || tgtHasTeam) {
        toExpire.push(r.id);
        return false;
      }
      return true;
    });
    if (toExpire.length > 0) {
      await admin
        .from("team_partner_requests")
        .update({ status: "expired", decided_at: new Date().toISOString() })
        .in("id", toExpire);
    }

    const nameOf = (id: string) => {
      const p = profMap.get(id);
      return (p?.display_name ?? p?.name ?? "—") as string;
    };

    const sent: SentPartnerRequest[] = stillPending
      .filter((r) => r.requester_user_id === userId)
      .map((r) => ({
        id: r.id,
        target_user_id: r.target_user_id,
        target_name: nameOf(r.target_user_id),
        proposed_team_name: r.proposed_team_name,
        status: r.status,
        created_at: r.created_at,
      }));

    const received: ReceivedPartnerRequest[] = stillPending
      .filter((r) => r.target_user_id === userId)
      .map((r) => {
        const p = profMap.get(r.requester_user_id);
        return {
          id: r.id,
          requester_user_id: r.requester_user_id,
          requester_name: nameOf(r.requester_user_id),
          requester_service: p?.service_id ?? null,
          requester_level: (p?.football_level as FootballLevel | null) ?? null,
          proposed_team_name: r.proposed_team_name,
          status: r.status,
          created_at: r.created_at,
        };
      });

    return { sent, received };
  } catch {
    return { sent: [], received: [] };
  }
}
