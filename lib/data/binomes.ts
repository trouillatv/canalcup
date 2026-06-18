import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminEmails } from "@/lib/data/roles";
import { selectAll } from "@/lib/data/select-all";
import type { FootballLevel } from "@/lib/supabase/types";

// Annuaire "Trouver un binôme" — sert UNIQUEMENT à former les équipes pendant
// la phase de lancement : qui est déjà en équipe, qui cherche encore.
//
// RGPD / RH : volontairement PAS de points individuels, ni de dernière
// connexion, ni d'historique d'activité. On expose le minimum utile à la
// constitution des binômes (service, niveau foot, statut équipe). L'email
// n'est jamais AFFICHÉ — il est renvoyé pour permettre une action "copier
// l'email" côté client, sans le mettre à l'écran.

export interface BinomeEntry {
  user_id: string;
  display_name: string;
  full_name: string | null; // "Prénom Nom" déduit du login prenom.nom (aide à se reconnaître)
  email: string; // jamais affiché — sert au bouton "copier l'email"
  service_id: string | null;
  service_name: string | null;
  football_level: FootballLevel | null;
  team_id: string | null;
  team_name: string | null;
  is_captain: boolean;
  has_pending_request: boolean;
}

export interface BinomeServiceGroup {
  id: string;
  name: string;
  sort_order: number;
}

export interface BinomeDirectory {
  entries: BinomeEntry[];
  services: BinomeServiceGroup[];
}

// Déduit "Prénom Nom" depuis le login (partie locale de l'email : prenom.nom).
// On n'affiche jamais l'email lui-même — seulement le nom reconstitué, qui aide
// les gens à se reconnaître entre collègues. Retourne null si le format ne s'y
// prête pas (pas de point dans la partie locale).
function nameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  if (!local.includes(".")) return null;
  const cap = (s: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
  const name = local
    .split(".")
    .filter(Boolean)
    .map((part) => part.split("-").map(cap).join("-")) // gère "anne-marie"
    .join(" ")
    .trim();
  return name || null;
}

/**
 * Annuaire des participants inscrits, pour la page /binomes.
 * Client ADMIN : on lit l'ensemble des participants (cross-RLS), comme les
 * autres annuaires/classements. Les admins (organisateurs) sont exclus.
 */
export async function getBinomeDirectory(): Promise<BinomeDirectory> {
  try {
    const supabase = createAdminClient();

    const [services, users, teams, memberships, pendingReqs, adminEmails] = await Promise.all([
      selectAll<{ id: string; name: string; sort_order: number | null; is_active: boolean }>(
        supabase, "services", "id, name, sort_order, is_active"
      ),
      selectAll<{
        id: string; display_name: string | null; name: string | null; email: string | null;
        service_id: string | null; football_level: string | null; team_id: string | null;
        profile_completed: boolean | null;
      }>(supabase, "users", "id, display_name, name, email, service_id, football_level, team_id, profile_completed"),
      selectAll<{ id: string; name: string }>(supabase, "teams", "id, name"),
      selectAll<{ user_id: string; team_id: string; role: string | null; is_primary: boolean | null }>(
        supabase, "team_memberships", "user_id, team_id, role, is_primary"
      ),
      selectAll<{ user_id: string; status: string | null }>(
        supabase, "team_join_requests", "user_id, status"
      ),
      getAdminEmails(),
    ]);

    const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

    // Rôle de l'utilisateur sur SON équipe principale (binôme = 1 équipe).
    // On privilégie le membership primaire ; à défaut, n'importe lequel.
    const captainOf = new Set<string>();
    const primaryTeam = new Map<string, string>(); // user_id → team_id principal
    for (const m of memberships ?? []) {
      if (m.is_primary) primaryTeam.set(m.user_id, m.team_id);
      else if (!primaryTeam.has(m.user_id)) primaryTeam.set(m.user_id, m.team_id);
    }
    for (const m of memberships ?? []) {
      const primary = primaryTeam.get(m.user_id);
      if (m.role === "captain" && m.team_id === primary) captainOf.add(m.user_id);
    }

    const pending = new Set(
      (pendingReqs ?? []).filter((r) => r.status === "pending").map((r) => r.user_id)
    );

    const entries: BinomeEntry[] = (users ?? [])
      .filter((u) => {
        // Participants identifiés et inscrits ; on exclut les organisateurs.
        if (!u.profile_completed) return false;
        if (adminEmails.has((u.email ?? "").toLowerCase())) return false;
        return !!(u.display_name ?? u.name);
      })
      .map((u) => {
        // team_id (miroir de l'équipe principale) fait foi pour le statut.
        const teamId = u.team_id ?? primaryTeam.get(u.id) ?? null;
        return {
          user_id: u.id,
          display_name: (u.display_name ?? u.name ?? "—") as string,
          full_name: nameFromEmail(u.email),
          email: u.email ?? "",
          service_id: u.service_id,
          service_name: null, // rempli plus bas via la map services
          football_level: (u.football_level as FootballLevel | null) ?? null,
          team_id: teamId,
          team_name: teamId ? teamName.get(teamId) ?? null : null,
          is_captain: captainOf.has(u.id),
          has_pending_request: pending.has(u.id),
        } satisfies BinomeEntry;
      });

    const svcName = new Map((services ?? []).map((s) => [s.id, s.name]));
    for (const e of entries) {
      e.service_name = e.service_id ? svcName.get(e.service_id) ?? null : null;
    }

    // Tri : cherche un binôme d'abord (les plus "actionnables"), puis par nom.
    entries.sort((a, b) => {
      const aLooking = a.team_id ? 1 : 0;
      const bLooking = b.team_id ? 1 : 0;
      if (aLooking !== bLooking) return aLooking - bLooking;
      return (a.full_name ?? a.display_name).localeCompare(b.full_name ?? b.display_name, "fr");
    });

    const serviceGroups: BinomeServiceGroup[] = (services ?? [])
      .filter((s) => s.is_active)
      .map((s) => ({ id: s.id, name: s.name, sort_order: s.sort_order ?? 999 }))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "fr"));

    return { entries, services: serviceGroups };
  } catch {
    return { entries: [], services: [] };
  }
}
