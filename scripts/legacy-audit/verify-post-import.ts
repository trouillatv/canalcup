// Vérification post-import Lot 2B (Tâche #27) : diff strict entre l'état réel
// CANAL Sports et docs/dry-runs/lot2b-preflight-import-2026-09-25.json.
// Prend en entrée (stdin) le JSON déjà récupéré via execute_sql (memberships
// query), pour éviter une dépendance à un client Postgres direct dans ce repo.

import { readFileSync } from "node:fs";

type PreflightMembership = { email: string; org_slug: string; role: string; is_primary: boolean };
type ActualRow = { email: string; slug: string; role: string; is_primary: boolean };

const preflightPath = "docs/dry-runs/lot2b-preflight-import-2026-09-25.json";
const preflight = JSON.parse(readFileSync(preflightPath, "utf-8"));
const expected: PreflightMembership[] = preflight.users_with_membership.map((u: any) => ({
  email: u.email, org_slug: u.org_slug, role: u.role, is_primary: u.is_primary,
}));

const actualPath = process.argv[2];
if (!actualPath) throw new Error("usage: verify-post-import.ts <actual-rows.json>");
const actual: ActualRow[] = JSON.parse(readFileSync(actualPath, "utf-8"));

function key(r: { email: string; role: string; is_primary: boolean }, slug: string) {
  return `${r.email.toLowerCase()}|${slug}|${r.role}|${r.is_primary}`;
}

const expectedKeys = new Set(expected.map((r) => key(r, r.org_slug)));
const actualKeys = new Set(actual.map((r) => key(r, r.slug)));

const missing = [...expectedKeys].filter((k) => !actualKeys.has(k));
const unexpected = [...actualKeys].filter((k) => !expectedKeys.has(k));

console.log(JSON.stringify({
  expected_count: expected.length,
  actual_count: actual.length,
  missing_in_actual: missing,
  unexpected_in_actual: unexpected,
  exact_match: missing.length === 0 && unexpected.length === 0 && expected.length === actual.length,
}, null, 2));
