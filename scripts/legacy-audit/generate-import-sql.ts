// Génère le SQL d'import Lot 2B (Tâche #27) à partir d'une lecture fraîche de
// Canal Cup, en réappliquant EXACTEMENT la même classification + les mêmes
// arbitrages explicites que preflight-import-org-memberships.ts.
//
// LECTURE SEULE sur Canal Cup. N'écrit rien nulle part — imprime du SQL sur
// stdout, à relire avant de le soumettre à apply_migration (CANAL Sports).

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

type LegacyService = { id: string; name: string | null; is_active: boolean | null; sort_order: number | null };
type LegacyUser = {
  id: string; email: string | null; name: string | null; display_name: string | null;
  service_id: string | null; timezone: string | null;
};

function slugify(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeEmail(raw: string | null): string | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  return EMAIL_RE.test(n) ? n : null;
}
function sqlStr(v: string | null): string {
  if (v === null) return "null";
  return `'${v.replace(/'/g, "''")}'`;
}

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

async function main() {
  const legacy = createLegacyReadOnlyClient();

  const { data: servicesRaw, error: servicesError } = await legacy
    .from("services").select("id,name,is_active,sort_order").order("sort_order", { ascending: true });
  if (servicesError) throw new Error(`services: ${servicesError.message}`);
  const services = (servicesRaw ?? []) as LegacyService[];
  if (services.length !== 10) throw new Error(`services drift: ${services.length} rows, expected 10 — aborting SQL generation`);

  const { data: usersRaw, error: usersError } = await legacy
    .from("users").select("id,email,name,display_name,service_id,timezone").order("created_at", { ascending: true });
  if (usersError) throw new Error(`users: ${usersError.message}`);
  const users = (usersRaw ?? []) as LegacyUser[];
  if (users.length !== 49) throw new Error(`users drift: ${users.length} rows, expected 49 — aborting SQL generation`);

  const orgBySvcId = new Map(services.map((s) => [s.id, { slug: slugify(s.name ?? ""), name: s.name! }]));

  const orgRows = services.map((s) => ({ slug: slugify(s.name ?? ""), name: s.name!, sort_order: s.sort_order }));

  const withMembership: { email: string; name: string; display_name: string | null; timezone: string | null; org_slug: string }[] = [];
  const noMembership: { email: string; name: string; display_name: string | null; timezone: string | null }[] = [];
  const excluded: string[] = [];

  for (const u of users) {
    const email = normalizeEmail(u.email);
    if (!email) throw new Error(`user ${u.id} has no valid email at generation time — aborting (should have been caught by preflight)`);
    if (EXCLUDED_EMAILS.has(email)) { excluded.push(email); continue; }

    const name = (u.display_name || u.name)!;
    if (!name) throw new Error(`user ${u.id} has no name/display_name — aborting`);
    const display_name = u.display_name ?? null;
    const timezone = u.timezone ?? null;

    if (FORCE_NO_MEMBERSHIP_EMAILS.has(email)) {
      noMembership.push({ email, name, display_name, timezone });
      continue;
    }
    const org = u.service_id ? orgBySvcId.get(u.service_id) : undefined;
    if (!org) {
      // Cohérent avec le preflight : service_id absent/inconnu -> sans membership.
      noMembership.push({ email, name, display_name, timezone });
      continue;
    }
    withMembership.push({ email, name, display_name, timezone, org_slug: org.slug });
  }

  if (orgRows.length !== 10) throw new Error(`orgRows count ${orgRows.length} != 10`);
  if (withMembership.length !== 43) throw new Error(`withMembership count ${withMembership.length} != 43 — aborting, do not generate mismatched SQL`);
  if (noMembership.length !== 2) throw new Error(`noMembership count ${noMembership.length} != 2 — aborting`);
  if (excluded.length !== 4) throw new Error(`excluded count ${excluded.length} != 4 — aborting`);

  const allUsers = [...withMembership, ...noMembership];
  if (allUsers.length !== 45) throw new Error(`allUsers count ${allUsers.length} != 45 — aborting`);

  const lines: string[] = [];
  lines.push("-- Lot 2B — import réel (Tâche #27). Généré depuis Canal Cup en lecture seule.");
  lines.push("-- 10 organizations, 45 users, 43 memberships. Voir docs/dry-runs/lot2b-preflight-import-2026-09-25.json.");
  lines.push("begin;");
  lines.push("");
  lines.push("-- Garde-fou : refuse l'import si la cible n'est plus vide ou si une collision existe déjà.");
  lines.push("do $guard$");
  lines.push("declare");
  lines.push("  v_existing_orgs int;");
  lines.push("  v_existing_users int;");
  lines.push("  v_slug_collisions int;");
  lines.push("  v_email_collisions int;");
  lines.push("begin");
  lines.push("  select count(*) into v_existing_orgs from public.organizations;");
  lines.push("  select count(*) into v_existing_users from public.users;");
  lines.push(`  select count(*) into v_slug_collisions from public.organizations where slug = any(array[${orgRows.map((o) => sqlStr(o.slug)).join(",")}]);`);
  lines.push(`  select count(*) into v_email_collisions from public.users where lower(email) = any(array[${allUsers.map((u) => sqlStr(u.email)).join(",")}]);`);
  lines.push("  if v_existing_orgs <> 0 or v_existing_users <> 0 then");
  lines.push("    raise exception 'ABORT import: organizations/users non vides (org=%, users=%) — attendu 0/0', v_existing_orgs, v_existing_users;");
  lines.push("  end if;");
  lines.push("  if v_slug_collisions <> 0 then");
  lines.push("    raise exception 'ABORT import: % collision(s) de slug organizations détectée(s)', v_slug_collisions;");
  lines.push("  end if;");
  lines.push("  if v_email_collisions <> 0 then");
  lines.push("    raise exception 'ABORT import: % collision(s) d''email users détectée(s)', v_email_collisions;");
  lines.push("  end if;");
  lines.push("end $guard$;");
  lines.push("");
  lines.push("-- 1. Organisations (10)");
  lines.push("insert into public.organizations (type, slug, name, parent_id, metadata) values");
  lines.push(
    orgRows.map((o, i) => `  ('service', ${sqlStr(o.slug)}, ${sqlStr(o.name)}, null, '{}'::jsonb)${i === orgRows.length - 1 ? ";" : ","}`).join("\n")
  );
  lines.push("");
  lines.push("-- 2. Utilisateurs (45 : 43 avec membership + 2 sans)");
  lines.push("insert into public.users (email, name, display_name, timezone) values");
  lines.push(
    allUsers
      .map((u, i) => {
        const tz = u.timezone ? sqlStr(u.timezone) : "default";
        return `  (${sqlStr(u.email)}, ${sqlStr(u.name)}, ${sqlStr(u.display_name)}, ${tz})${i === allUsers.length - 1 ? ";" : ","}`;
      })
      .join("\n")
  );
  lines.push("");
  lines.push("-- 3. Memberships (43) — jointure par email/slug, pas d'UUID en dur");
  lines.push("with target(email, slug) as (values");
  lines.push(
    withMembership.map((u, i) => `  (${sqlStr(u.email)}, ${sqlStr(u.org_slug)})${i === withMembership.length - 1 ? "" : ","}`).join("\n")
  );
  lines.push(")");
  lines.push("insert into public.memberships (user_id, organization_id, role, is_primary)");
  lines.push("select usr.id, org.id, 'member', true");
  lines.push("from target t");
  lines.push("join public.users usr on usr.email = t.email");
  lines.push("join public.organizations org on org.slug = t.slug;");
  lines.push("");
  lines.push("-- Garde-fou final : totaux exacts avant commit, sinon rollback.");
  lines.push("do $post$");
  lines.push("declare");
  lines.push("  v_orgs int; v_users int; v_memberships int;");
  lines.push("begin");
  lines.push("  select count(*) into v_orgs from public.organizations;");
  lines.push("  select count(*) into v_users from public.users;");
  lines.push("  select count(*) into v_memberships from public.memberships;");
  lines.push("  if v_orgs <> 10 or v_users <> 45 or v_memberships <> 43 then");
  lines.push("    raise exception 'ABORT import: totaux inattendus après écriture — organizations=%, users=%, memberships=% (attendu 10/45/43)', v_orgs, v_users, v_memberships;");
  lines.push("  end if;");
  lines.push("end $post$;");
  lines.push("");
  lines.push("commit;");

  console.log(lines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
