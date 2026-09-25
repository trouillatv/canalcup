// Dry-run — mapping Canal Cup (services + users) vers CANAL Sports
// (organizations + memberships), Tâche #25.
//
// LECTURE SEULE. N'écrit rien, ni dans Canal Cup (client bloqué en
// écriture par lib/supabase/legacy.ts) ni dans CANAL Sports (ce script
// n'importe aucun client d'écriture CANAL Sports du tout).
//
// N'importe volontairement PAS allowlist_users (décision actée dans
// docs/supabase-architecture-p2.md) : c'est un mécanisme d'accès/rôle
// propre à Canal Cup (auto-inscription par domaine, rôle plat "user/
// admin/super_admin"), distinct du rôle organisationnel memberships.role.
//
// Règle appliquée partout dans ce script : ne jamais déduire une
// information absente de la source. Un champ manquant reste manquant, un
// parent_id reste NULL si rien dans la source ne le justifie, un rôle
// "manager" n'est jamais inféré faute de signal source.

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

  // Colonnes inattendues (pas dans le schéma documenté) — signalées, pas ignorées.
  const KNOWN_SERVICE_COLS = new Set(["id", "name", "is_active", "sort_order", "created_at"]);
  const KNOWN_USER_COLS = new Set([
    "id", "auth_id", "email", "name", "display_name", "user_slug", "service_id",
    "football_level", "team_id", "team_role", "timezone", "onboarding_step",
    "profile_completed", "created_at", "updated_at",
  ]);
  const unexpectedServiceCols = new Set<string>();
  for (const row of services) for (const k of Object.keys(row)) if (!KNOWN_SERVICE_COLS.has(k)) unexpectedServiceCols.add(k);
  const unexpectedUserCols = new Set<string>();
  for (const row of users) for (const k of Object.keys(row)) if (!KNOWN_USER_COLS.has(k)) unexpectedUserCols.add(k);

  // --- 1. Organisations candidates (à partir de services) ---

  const nameCount = new Map<string, number>();
  for (const s of services) {
    const key = (s.name ?? "").trim().toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }
  const slugCount = new Map<string, number>();
  for (const s of services) {
    if (!s.name) continue;
    const slug = slugify(s.name);
    slugCount.set(slug, (slugCount.get(slug) ?? 0) + 1);
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
      reasons.push("name absent ou vide en source — aucune organisation exploitable sans nom");
      return {
        legacy_id: s.id, proposed_slug: null, name: s.name, type: "service", parent_id: null,
        is_active: s.is_active, sort_order: s.sort_order, status, reasons,
      };
    }

    const nameKey = s.name.trim().toLowerCase();
    if ((nameCount.get(nameKey) ?? 0) > 1) {
      status = "NEEDS_DECISION";
      reasons.push(`nom en doublon exact avec ${(nameCount.get(nameKey) ?? 1) - 1} autre(s) ligne(s) services — fusionner ou garder distinct ?`);
    }

    const slug = slugify(s.name);
    if ((slugCount.get(slug) ?? 0) > 1 && status !== "NEEDS_DECISION") {
      status = "NEEDS_DECISION";
      reasons.push(`slug généré "${slug}" en collision avec une autre ligne services (noms différents, forme slug identique)`);
    }

    if (s.is_active === false && status === "CREATE_READY") {
      status = "CREATE_WITH_WARNING";
      reasons.push("is_active = false côté Canal Cup — organisation créable mais possiblement obsolète, à confirmer");
    }

    return {
      legacy_id: s.id, proposed_slug: slug, name: s.name, type: "service", parent_id: null,
      is_active: s.is_active, sort_order: s.sort_order, status, reasons,
    };
  });

  const orgById = new Map(services.map((s) => [s.id, s]));
  const orgCandidateById = new Map(orgCandidates.map((o) => [o.legacy_id, o]));

  // --- 2. Doublons de personnes (avant classification individuelle) ---

  const byEmail = new Map<string, LegacyUser[]>();
  for (const u of users) {
    const { normalized } = normalizeEmail(u.email);
    if (!normalized) continue;
    if (!byEmail.has(normalized)) byEmail.set(normalized, []);
    byEmail.get(normalized)!.push(u);
  }
  const duplicateEmailGroups = [...byEmail.entries()].filter(([, rows]) => rows.length > 1);

  const bySimilarIdentity = new Map<string, LegacyUser[]>();
  for (const u of users) {
    const nameKey = (u.display_name ?? u.name ?? "").trim().toLowerCase();
    if (!nameKey) continue;
    const key = `${nameKey}::${u.service_id ?? "none"}`;
    if (!bySimilarIdentity.has(key)) bySimilarIdentity.set(key, []);
    bySimilarIdentity.get(key)!.push(u);
  }
  const possibleSamePerson = [...bySimilarIdentity.entries()].filter(
    ([, rows]) => rows.length > 1 && new Set(rows.map((r) => normalizeEmail(r.email).normalized)).size > 1
  );

  // --- 3. Classification par utilisateur ---

  type UserRow = {
    legacy_id: string;
    source_identity: string;
    email_raw: string | null;
    email_normalized: string | null;
    proposed_organization_slug: string | null;
    proposed_organization_name: string | null;
    proposed_role: "member";
    is_primary: boolean;
    status: Status;
    reasons: string[];
  };

  const emailUsedFor = new Map<string, string[]>(); // normalized email -> [legacy user ids] déjà "réservés" CREATE_READY

  const userRows: UserRow[] = users.map((u) => {
    const reasons: string[] = [];
    let status: Status = "CREATE_READY";
    const sourceIdentity = u.display_name || u.name || "(nom absent)";
    const { normalized: emailNorm, valid: emailValid } = normalizeEmail(u.email);

    if (!u.email || u.email.trim() === "") {
      status = "REJECT";
      reasons.push("email absent en source — CANAL Sports exige un email (NOT NULL, UNIQUE), aucune identité créable sans deviner une adresse");
    } else if (!emailValid) {
      status = "REJECT";
      reasons.push(`email présent mais de forme invalide ("${u.email}") — non corrigé automatiquement, ne pas déduire la bonne adresse`);
    }

    if (!u.display_name && !u.name) {
      status = "REJECT";
      reasons.push("ni display_name ni name en source — CANAL Sports exige un name (NOT NULL)");
    }

    if (emailNorm && emailValid && (byEmail.get(emailNorm)?.length ?? 0) > 1) {
      status = "NEEDS_DECISION";
      reasons.push(`email "${emailNorm}" partagé par ${byEmail.get(emailNorm)!.length} lignes source — doublon à arbitrer, aucune fusion automatique`);
    }

    // Domaine requis pour se connecter à CANAL Sports (lib/auth/email-domain.ts) : canal-plus.com.
    // Un email syntaxiquement valide mais hors de ce domaine est signalé tel quel, jamais corrigé
    // automatiquement (peut être un vrai collaborateur externe, ou une coquille dans la source).
    const REQUIRED_DOMAIN = "canal-plus.com";
    if (emailNorm && emailValid && !emailNorm.endsWith(`@${REQUIRED_DOMAIN}`)) {
      status = "NEEDS_DECISION";
      reasons.push(
        `domaine email "${emailNorm.split("@")[1]}" différent du domaine requis "${REQUIRED_DOMAIN}" (lib/auth/email-domain.ts) — ` +
          "possible coquille source ou collaborateur externe légitime, non corrigé automatiquement"
      );
    }

    // Organisation proposée
    let orgSlug: string | null = null;
    let orgName: string | null = null;
    if (!u.service_id) {
      if (status === "CREATE_READY") status = "CREATE_WITH_WARNING";
      reasons.push("service_id absent en source — aucune organisation proposée, utilisateur importable sans membership");
    } else {
      const svc = orgById.get(u.service_id);
      const orgCandidate = orgCandidateById.get(u.service_id);
      if (!svc || !orgCandidate) {
        if (status === "CREATE_READY") status = "CREATE_WITH_WARNING";
        reasons.push(`service_id "${u.service_id}" ne correspond à aucune ligne services connue — service inconnu/incohérent, aucune organisation proposée`);
      } else {
        orgSlug = orgCandidate.proposed_slug;
        orgName = orgCandidate.name;
        if (orgCandidate.status === "REJECT") {
          status = "NEEDS_DECISION";
          reasons.push(`organisation cible "${orgName}" elle-même REJECT (voir services) — membership impossible tant que l'organisation n'est pas résolue`);
        } else if (orgCandidate.status === "NEEDS_DECISION") {
          if (status === "CREATE_READY") status = "NEEDS_DECISION";
          reasons.push(`organisation cible "${orgName}" elle-même NEEDS_DECISION (voir services) — membership dépend de l'arbitrage du doublon de service`);
        } else if (orgCandidate.status === "CREATE_WITH_WARNING") {
          if (status === "CREATE_READY") status = "CREATE_WITH_WARNING";
          reasons.push(`organisation cible "${orgName}" inactive côté Canal Cup (is_active=false)`);
        }
      }
    }

    if (status === "REJECT") {
      orgSlug = null;
      orgName = null;
    }

    return {
      legacy_id: u.id,
      source_identity: sourceIdentity,
      email_raw: u.email,
      email_normalized: emailNorm,
      proposed_organization_slug: orgSlug,
      proposed_organization_name: orgName,
      proposed_role: "member",
      // Une seule appartenance possible par construction (service_id est une FK simple côté Canal Cup) :
      // is_primary=true dès qu'une organisation est proposée, false sinon.
      is_primary: status !== "REJECT" && orgSlug !== null,
      status,
      reasons,
    };
  });

  // --- 4. Résumé quantifié ---

  function tally(rows: { status: Status }[]) {
    return {
      CREATE_READY: rows.filter((r) => r.status === "CREATE_READY").length,
      CREATE_WITH_WARNING: rows.filter((r) => r.status === "CREATE_WITH_WARNING").length,
      REJECT: rows.filter((r) => r.status === "REJECT").length,
      NEEDS_DECISION: rows.filter((r) => r.status === "NEEDS_DECISION").length,
      total: rows.length,
    };
  }

  const userTally = tally(userRows);
  const orgTally = tally(orgCandidates);

  // --- Sortie ---

  const out = {
    generated_at_note: "voir created_at des lignes source, ce script ne timestampe pas lui-même",
    unexpected_columns: {
      services: [...unexpectedServiceCols],
      users: [...unexpectedUserCols],
    },
    organizations: orgCandidates,
    users: userRows,
    duplicate_email_groups: duplicateEmailGroups.map(([email, rows]) => ({
      email,
      legacy_ids: rows.map((r) => r.id),
    })),
    possible_same_person_different_email: possibleSamePerson.map(([key, rows]) => ({
      key,
      rows: rows.map((r) => ({ id: r.id, email: r.email, name: r.display_name || r.name })),
    })),
    users_without_exploitable_service: userRows
      .filter((r) => r.proposed_organization_slug === null && r.status !== "REJECT")
      .map((r) => ({ id: r.legacy_id, identity: r.source_identity })),
    multi_org_candidates_note:
      "Aucun proposé : service_id est une FK simple (une seule valeur par utilisateur) côté Canal Cup, " +
      "aucun signal source ne permet d'attribuer plusieurs organisations à une même personne sans deviner.",
    unrepresentable_in_new_model: [
      "team_id / team_role (concept binôme babyfoot, aucun équivalent organizations/memberships)",
      "football_level (couplé au jeu WC2026 ; la colonne existe encore côté CANAL Sports users mais pour un usage futur distinct, pas repris depuis Canal Cup dans ce lot)",
      "user_slug (généré à l'origine pour Canal Cup, à régénérer proprement côté CANAL Sports plutôt que copié)",
      "onboarding_step / profile_completed (état d'un onboarding Canal Cup qui n'existe plus dans sa forme actuelle)",
      "allowlist_users.role (user/admin/super_admin) : mécanisme d'accès global Canal Cup, explicitement hors de ce lot — pas mappé vers memberships.role (member/manager), qui est un rôle organisationnel, pas un rôle d'administration applicative",
    ],
    tally: { users: userTally, organizations: orgTally },
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
