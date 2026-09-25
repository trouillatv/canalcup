// Preflight final (lecture seule) avant import Lot 2B — Tâche #26.
//
// Reprend la même classification que dry-run-org-memberships.ts, mais relit
// Canal Cup à neuf (pour détecter toute dérive depuis le dry-run du
// 2026-09-25) et applique par-dessus les arbitrages explicites donnés par
// l'utilisateur sur les 5 cas non CREATE_READY :
//
//  - EXCLUDED (pas importés du tout) :
//      wendykumar@hotmail.fr        (doublon suspecté avec wendykumar@canal-plus.com)
//      sylvie.tambunan@canal-plus.cim (coquille de domaine suspectée, en attente)
//      trouillatv@gmail.com          (identité à créer proprement côté CANAL Sports, pas depuis Canal Cup)
//  - IMPORT_USER_NO_MEMBERSHIP (compte créé, aucune organisation) :
//      gabrielle.milin@canal-plus.com
//      wendykumar@canal-plus.com
//
// Tout cas non CREATE_READY qui ne correspond à AUCUN de ces 5 emails est
// classé NEEDS_ARBITRATION et bloque l'import de cette ligne — pas de
// décision silencieuse sur une donnée apparue après le dry-run.
//
// LECTURE SEULE : n'écrit rien dans Canal Cup (client bloqué en écriture par
// lib/supabase/legacy.ts) ni dans CANAL Sports (ce script n'importe aucun
// client CANAL Sports du tout).

import { existsSync, readFileSync } from "node:fs";
import { createLegacyReadOnlyClient } from "../../lib/supabase/legacy.ts";

function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

type LegacyService = {
  id: string;
  name: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
};

type LegacyUser = {
  id: string;
  auth_id: string | null;
  email: string | null;
  name: string | null;
  display_name: string | null;
  user_slug: string | null;
  service_id: string | null;
  football_level: string | null;
  team_id: string | null;
  team_role: string | null;
  timezone: string | null;
  onboarding_step: number | null;
  profile_completed: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type Status = "CREATE_READY" | "CREATE_WITH_WARNING" | "REJECT" | "NEEDS_DECISION";

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string | null): { normalized: string | null; valid: boolean } {
  if (!raw) return { normalized: null, valid: false };
  const normalized = raw.trim().toLowerCase();
  return { normalized, valid: EMAIL_RE.test(normalized) };
}

// Arbitrages explicites de l'utilisateur (2026-09-25), par email normalisé.
const EXCLUDED_EMAILS = new Set([
  "wendykumar@hotmail.fr",
  "sylvie.tambunan@canal-plus.cim",
  "trouillatv@gmail.com",
  "vincent.trouillat@canal-plus.com",
]);
const FORCE_NO_MEMBERSHIP_EMAILS = new Set([
  "gabrielle.milin@canal-plus.com",
  "wendykumar@canal-plus.com",
]);

// Snapshot connu au moment du dry-run (2026-09-25) — sert à détecter toute dérive.
const KNOWN_SERVICE_SLUGS = new Set([
  "si", "crc", "boutique", "ventes-directes", "marketing",
  "comptabilite", "technique", "direction", "commerce", "autre",
]);
const KNOWN_USER_COUNT = 49;
const KNOWN_SERVICE_COUNT = 10;

async function main() {
  const legacy = createLegacyReadOnlyClient();

  const { data: servicesRaw, error: servicesError } = await legacy
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });
  if (servicesError) throw new Error(`services: ${servicesError.message}`);
  const services = (servicesRaw ?? []) as LegacyService[];

  const { data: usersRaw, error: usersError } = await legacy
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });
  if (usersError) throw new Error(`users: ${usersError.message}`);
  const users = (usersRaw ?? []) as LegacyUser[];

  const drift: string[] = [];
  if (services.length !== KNOWN_SERVICE_COUNT) {
    drift.push(`services: ${services.length} lignes trouvées, ${KNOWN_SERVICE_COUNT} attendues au dry-run`);
  }
  if (users.length !== KNOWN_USER_COUNT) {
    drift.push(`users: ${users.length} lignes trouvées, ${KNOWN_USER_COUNT} attendues au dry-run`);
  }

  // --- Organisations (identique à la logique du dry-run) ---

  const nameCount = new Map<string, number>();
  for (const s of services) {
    const key = (s.name ?? "").trim().toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }

  type OrgCandidate = {
    legacy_id: string;
    proposed_slug: string | null;
    name: string | null;
    type: "service";
    parent_id: null;
    is_active: boolean | null;
    sort_order: number | null;
    status: Status;
    reasons: string[];
  };

  const orgCandidates: OrgCandidate[] = services.map((s) => {
    const reasons: string[] = [];
    let status: Status = "CREATE_READY";

    if (!s.name || s.name.trim() === "") {
      status = "REJECT";
      reasons.push("name absent ou vide en source");
      return {
        legacy_id: s.id, proposed_slug: null, name: s.name, type: "service", parent_id: null,
        is_active: s.is_active, sort_order: s.sort_order, status, reasons,
      };
    }

    const nameKey = s.name.trim().toLowerCase();
    if ((nameCount.get(nameKey) ?? 0) > 1) {
      status = "NEEDS_DECISION";
      reasons.push("nom en doublon exact avec une autre ligne services");
    }

    const slug = slugify(s.name);
    if (status === "CREATE_READY" && !KNOWN_SERVICE_SLUGS.has(slug)) {
      status = "NEEDS_DECISION";
      reasons.push(`slug "${slug}" absent du set connu au dry-run — service apparu depuis, non arbitré par l'utilisateur`);
    }

    if (s.is_active === false && status === "CREATE_READY") {
      status = "CREATE_WITH_WARNING";
      reasons.push("is_active = false côté Canal Cup");
    }

    return {
      legacy_id: s.id, proposed_slug: slug, name: s.name, type: "service", parent_id: null,
      is_active: s.is_active, sort_order: s.sort_order, status, reasons,
    };
  });

  if (orgCandidates.some((o) => o.status !== "CREATE_READY")) {
    for (const o of orgCandidates.filter((o) => o.status !== "CREATE_READY")) {
      drift.push(`organisation "${o.name}" (${o.legacy_id}) non CREATE_READY au preflight: ${o.reasons.join("; ")}`);
    }
  }

  const orgById = new Map(services.map((s) => [s.id, s]));
  const orgCandidateById = new Map(orgCandidates.map((o) => [o.legacy_id, o]));

  // --- Classification utilisateurs (identique au dry-run) + arbitrage ---

  const byEmail = new Map<string, LegacyUser[]>();
  for (const u of users) {
    const { normalized } = normalizeEmail(u.email);
    if (!normalized) continue;
    if (!byEmail.has(normalized)) byEmail.set(normalized, []);
    byEmail.get(normalized)!.push(u);
  }

  type FinalAction =
    | "IMPORT_USER_WITH_MEMBERSHIP"
    | "IMPORT_USER_NO_MEMBERSHIP"
    | "EXCLUDED"
    | "NEEDS_ARBITRATION";

  type UserDecision = {
    legacy_id: string;
    source_identity: string;
    email_raw: string | null;
    email_normalized: string | null;
    dry_run_style_status: Status;
    proposed_organization_slug: string | null;
    proposed_organization_name: string | null;
    final_action: FinalAction;
    reasons: string[];
  };

  const decisions: UserDecision[] = users.map((u) => {
    const reasons: string[] = [];
    let status: Status = "CREATE_READY";
    const sourceIdentity = u.display_name || u.name || "(nom absent)";
    const { normalized: emailNorm, valid: emailValid } = normalizeEmail(u.email);

    if (!u.email || u.email.trim() === "") {
      status = "REJECT";
      reasons.push("email absent en source");
    } else if (!emailValid) {
      status = "REJECT";
      reasons.push(`email de forme invalide ("${u.email}")`);
    }
    if (!u.display_name && !u.name) {
      status = "REJECT";
      reasons.push("ni display_name ni name en source");
    }
    if (emailNorm && emailValid && (byEmail.get(emailNorm)?.length ?? 0) > 1) {
      status = "NEEDS_DECISION";
      reasons.push(`email "${emailNorm}" partagé par ${byEmail.get(emailNorm)!.length} lignes source`);
    }
    const REQUIRED_DOMAIN = "canal-plus.com";
    if (emailNorm && emailValid && !emailNorm.endsWith(`@${REQUIRED_DOMAIN}`)) {
      status = "NEEDS_DECISION";
      reasons.push(`domaine email hors "${REQUIRED_DOMAIN}"`);
    }

    let orgSlug: string | null = null;
    let orgName: string | null = null;
    if (!u.service_id) {
      if (status === "CREATE_READY") status = "CREATE_WITH_WARNING";
      reasons.push("service_id absent en source");
    } else {
      const svc = orgById.get(u.service_id);
      const orgCandidate = orgCandidateById.get(u.service_id);
      if (!svc || !orgCandidate) {
        if (status === "CREATE_READY") status = "CREATE_WITH_WARNING";
        reasons.push(`service_id "${u.service_id}" inconnu`);
      } else {
        orgSlug = orgCandidate.proposed_slug;
        orgName = orgCandidate.name;
        if (orgCandidate.status !== "CREATE_READY") {
          if (status === "CREATE_READY") status = orgCandidate.status === "REJECT" ? "NEEDS_DECISION" : orgCandidate.status;
          reasons.push(`organisation cible "${orgName}" non CREATE_READY (${orgCandidate.status})`);
        }
      }
    }
    if (status === "REJECT") { orgSlug = null; orgName = null; }

    // --- Arbitrage explicite utilisateur (2026-09-25) ---
    let finalAction: FinalAction;
    if (emailNorm && EXCLUDED_EMAILS.has(emailNorm)) {
      finalAction = "EXCLUDED";
      reasons.push("arbitrage utilisateur 2026-09-25 : exclu de cet import");
    } else if (status === "REJECT") {
      finalAction = "EXCLUDED";
      reasons.push("REJECT au dry-run — non importable");
    } else if (emailNorm && FORCE_NO_MEMBERSHIP_EMAILS.has(emailNorm)) {
      finalAction = "IMPORT_USER_NO_MEMBERSHIP";
      reasons.push("arbitrage utilisateur 2026-09-25 : importé sans membership tant que le service n'est pas connu");
      orgSlug = null;
      orgName = null;
    } else if (status === "CREATE_READY") {
      finalAction = "IMPORT_USER_WITH_MEMBERSHIP";
    } else {
      // Statut non CREATE_READY et non couvert par un arbitrage explicite :
      // dérive depuis le dry-run, ou cas que l'utilisateur n'a pas tranché.
      finalAction = "NEEDS_ARBITRATION";
      reasons.push("statut non CREATE_READY et non couvert par un arbitrage explicite du 2026-09-25 — import bloqué pour cette ligne");
    }

    return {
      legacy_id: u.id,
      source_identity: sourceIdentity,
      email_raw: u.email,
      email_normalized: emailNorm,
      dry_run_style_status: status,
      proposed_organization_slug: orgSlug,
      proposed_organization_name: orgName,
      final_action: finalAction,
      reasons,
    };
  });

  const withMembership = decisions.filter((d) => d.final_action === "IMPORT_USER_WITH_MEMBERSHIP");
  const noMembership = decisions.filter((d) => d.final_action === "IMPORT_USER_NO_MEMBERSHIP");
  const excluded = decisions.filter((d) => d.final_action === "EXCLUDED");
  const needsArbitration = decisions.filter((d) => d.final_action === "NEEDS_ARBITRATION");

  const out = {
    drift_since_dry_run: drift,
    organizations_to_create: orgCandidates
      .filter((o) => o.status === "CREATE_READY")
      .map((o) => ({ slug: o.proposed_slug, name: o.name, type: o.type, parent_id: o.parent_id, legacy_service_id: o.legacy_id })),
    users_with_membership: withMembership.map((d) => ({
      email: d.email_normalized, identity: d.source_identity, org_slug: d.proposed_organization_slug, role: "member", is_primary: true,
    })),
    users_without_membership: noMembership.map((d) => ({ email: d.email_normalized, identity: d.source_identity, reasons: d.reasons })),
    users_excluded: excluded.map((d) => ({ email: d.email_normalized, identity: d.source_identity, reasons: d.reasons })),
    users_needing_arbitration: needsArbitration.map((d) => ({ email: d.email_normalized, identity: d.source_identity, reasons: d.reasons })),
    counts: {
      organizations_to_create: orgCandidates.filter((o) => o.status === "CREATE_READY").length,
      users_created_total: withMembership.length + noMembership.length,
      users_with_membership: withMembership.length,
      users_without_membership: noMembership.length,
      memberships_to_create: withMembership.length,
      users_excluded: excluded.length,
      users_needing_arbitration: needsArbitration.length,
      source_total_users: users.length,
      source_total_services: services.length,
    },
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
