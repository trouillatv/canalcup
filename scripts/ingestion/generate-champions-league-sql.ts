// Lot 3A (Tâche #28) — étape 2/3 : à partir des deux instantanés déjà pris
// (fetch fournisseur réel + lecture CANAL Sports fraîche), calcule un plan
// (create/update par table) ET génère le SQL idempotent correspondant.
//
// N'ACCÈDE À AUCUNE base — prend en entrée deux fichiers JSON déjà produits
// (lecture seule fournisseur via scripts/ingestion/fetch-champions-league.ts,
// lecture seule CANAL Sports via execute_sql). Écrit le rapport sur stdout et
// le SQL dans le fichier indiqué en 2e argument.
//
// Idempotent par construction : chaque table est upsertée via
// ON CONFLICT (source, external_id) — sauf `competitions`, dont l'identité
// côté CANAL Sports est le slug (déjà seedé en Lot 1), pas le provider.

import { readFileSync, writeFileSync } from "node:fs";
import { computeStageOrder } from "../../lib/ingestion/football-stage-order.ts";

function sqlStr(v: string | null | undefined): string {
  if (v === null || v === undefined) return "null";
  return `'${v.replace(/'/g, "''")}'`;
}
function sqlNum(v: number | null | undefined): string {
  return v === null || v === undefined ? "null" : String(v);
}
function sqlJsonb(obj: Record<string, unknown>): string {
  return `${sqlStr(JSON.stringify(obj))}::jsonb`;
}

const fetchedPath = process.argv[2];
const baselinePath = process.argv[3];
const sqlOutPath = process.argv[4];
if (!fetchedPath || !baselinePath || !sqlOutPath) {
  throw new Error("usage: generate-champions-league-sql.ts <fetched.json> <baseline.json> <out.sql>");
}

const fetched = JSON.parse(readFileSync(fetchedPath, "utf-8"));
const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));

// --- Garde-fou drift : la lecture CANAL Sports doit encore être fraîche ---
if (baseline.existing_participants_count !== 0 || baseline.existing_events_count !== 0 || baseline.existing_event_participants_count !== 0) {
  throw new Error(
    `[generate-champions-league-sql] baseline non vide (participants=${baseline.existing_participants_count}, ` +
      `events=${baseline.existing_events_count}, event_participants=${baseline.existing_event_participants_count}) — ` +
      "ce script suppose un premier import (0/0/0) ; relire l'état courant avant de continuer."
  );
}
if (!baseline.competition || baseline.competition.slug !== "uefa-champions-league") {
  throw new Error("[generate-champions-league-sql] competition seed 'uefa-champions-league' introuvable dans la baseline — abandon.");
}
if (!Array.isArray(baseline.seasons) || baseline.seasons.some((s: any) => s.label === fetched.season.label)) {
  throw new Error(
    "[generate-champions-league-sql] la baseline contient déjà une saison de label " +
      `"${fetched.season.label}" — ce script ne sait gérer qu'un premier import de cette saison, abandon.`
  );
}

const participants = fetched.participants as {
  source: string; external_id: string; type: string; name: string; short_name?: string; country?: string; logo_url?: string;
}[];
const events = fetched.events as {
  source: string; external_id: string; season_external_id: string; starts_at: string; status: string;
  stage?: string; matchday?: number; participants: { participant_external_id: string; role?: string }[];
  result?: { home_score: number; away_score: number };
}[];

const stageOrder = computeStageOrder(events);
const stagesWithoutOrder = events.filter((e) => e.stage && !stageOrder.has(e.stage));

const lines: string[] = [];
lines.push("-- Lot 3A — ingestion réelle Ligue des Champions 2026/27 (football-data.org).");
lines.push(`-- Généré le ${fetched.fetched_at}. Voir docs/dry-runs/lot3a-*.`);
lines.push("-- Idempotent : chaque INSERT est un ON CONFLICT DO UPDATE, sûr à rejouer.");
lines.push("begin;");
lines.push("");

lines.push("-- Garde-fou pré-écriture : la cible doit toujours être vide pour cette source/saison.");
lines.push("do $guard$");
lines.push("declare");
lines.push("  v_participants int; v_events int; v_event_participants int; v_season int;");
lines.push("begin");
lines.push(`  select count(*) into v_participants from public.participants where source = ${sqlStr(fetched.source)};`);
lines.push(`  select count(*) into v_events from public.events where source = ${sqlStr(fetched.source)};`);
lines.push(`  select count(*) into v_event_participants from public.event_participants ep join public.events e on e.id = ep.event_id where e.source = ${sqlStr(fetched.source)};`);
lines.push(`  select count(*) into v_season from public.seasons where label = ${sqlStr(fetched.season.label)};`);
lines.push("  if v_participants <> 0 or v_events <> 0 or v_event_participants <> 0 or v_season <> 0 then");
lines.push("    raise exception 'ABORT ingestion CL: cible non vide (participants=%, events=%, event_participants=%, season=%) — attendu 0/0/0/0', v_participants, v_events, v_event_participants, v_season;");
lines.push("  end if;");
lines.push("end $guard$;");
lines.push("");

lines.push("-- 1. Compétition — backfill source/external_id sur la ligne déjà seedée (Lot 1), identité = slug.");
lines.push("insert into public.competitions (sport_id, slug, name, source, external_id, metadata)");
lines.push(
  `select s.id, ${sqlStr("uefa-champions-league")}, ${sqlStr(fetched.competition.name)}, ${sqlStr(fetched.competition.source)}, ` +
  `${sqlStr(fetched.competition.external_id)}, ${sqlJsonb(fetched.competition.metadata ?? {})} from public.sports s where s.slug = ${sqlStr("football")}`
);
lines.push("on conflict (sport_id, slug) do update set");
lines.push("  source = excluded.source, external_id = excluded.external_id, metadata = excluded.metadata, name = excluded.name;");
lines.push("");

lines.push("-- 2. Saison réelle 2026/27 (nouvelle ligne — la saison seedée 2025-2026 reste un placeholder inutilisé).");
lines.push("insert into public.seasons (competition_id, label, starts_at, ends_at, source, external_id)");
lines.push(
  `select c.id, ${sqlStr(fetched.season.label)}, ${sqlStr(fetched.season.starts_at)}::timestamptz, ${sqlStr(fetched.season.ends_at)}::timestamptz, ` +
  `${sqlStr(fetched.season.source)}, ${sqlStr(fetched.season.external_id)} from public.competitions c where c.slug = ${sqlStr("uefa-champions-league")}`
);
lines.push("on conflict (source, external_id) do update set");
lines.push("  starts_at = excluded.starts_at, ends_at = excluded.ends_at, label = excluded.label;");
lines.push("");

lines.push(`-- 3. Participants (${participants.length}) — équipes de la phase de championnat.`);
lines.push("insert into public.participants (sport_id, type, name, short_name, country, source, external_id, metadata) values");
lines.push(
  participants
    .map((p, i) => {
      const metadata = p.logo_url ? sqlJsonb({ logo_url: p.logo_url }) : "'{}'::jsonb";
      return `  ((select id from public.sports where slug = 'football'), ${sqlStr(p.type)}, ${sqlStr(p.name)}, ${sqlStr(p.short_name)}, ${sqlStr(p.country)}, ${sqlStr(p.source)}, ${sqlStr(p.external_id)}, ${metadata})${i === participants.length - 1 ? "" : ","}`;
    })
    .join("\n")
);
lines.push("on conflict (source, external_id) do update set");
lines.push("  name = excluded.name, short_name = excluded.short_name, country = excluded.country, metadata = excluded.metadata;");
lines.push("");

lines.push(`-- 4. Events (${events.length}) — season_id résolu par jointure (source, external_id), aucun UUID en dur.`);
lines.push("-- leg reste NULL : non exposé par football-data.org sur les données observées (aucun match à élimination directe pour l'instant) — non fabriqué, voir docs/dry-runs/lot3a-report-2026-09-25.md.");
lines.push("with src(external_id, starts_at, status, stage, stage_order, matchday, result) as (values");
lines.push(
  events
    .map((e, i) => {
      const stageOrd = e.stage ? stageOrder.get(e.stage) ?? null : null;
      const result = e.result ? sqlJsonb({ home_score: e.result.home_score, away_score: e.result.away_score }) : "'{}'::jsonb";
      return `  (${sqlStr(e.external_id)}, ${sqlStr(e.starts_at)}::timestamptz, ${sqlStr(e.status)}, ${sqlStr(e.stage)}, ${sqlNum(stageOrd)}, ${sqlNum(e.matchday)}, ${result})${i === events.length - 1 ? "" : ","}`;
    })
    .join("\n")
);
lines.push(")");
lines.push("insert into public.events (season_id, starts_at, status, stage, stage_order, matchday, leg, source, external_id, last_synced_at, result)");
lines.push(`select se.id, src.starts_at, src.status, src.stage, src.stage_order, src.matchday, null, ${sqlStr(fetched.source)}, src.external_id, now(), src.result`);
lines.push("from src");
lines.push(`join public.seasons se on se.source = ${sqlStr(fetched.source)} and se.external_id = ${sqlStr(fetched.season.external_id)}`);
lines.push("on conflict (source, external_id) do update set");
lines.push("  starts_at = excluded.starts_at, status = excluded.status, stage = excluded.stage, stage_order = excluded.stage_order,");
lines.push("  matchday = excluded.matchday, last_synced_at = excluded.last_synced_at, result = excluded.result;");
lines.push("");

const eventParticipantRows = events.flatMap((e) => e.participants.map((p) => ({ event_ext: e.external_id, participant_ext: p.participant_external_id, role: p.role ?? null })));
lines.push(`-- 5. Event participants (${eventParticipantRows.length}) — jointure (event, participant) par external_id.`);
lines.push("with target(event_ext, participant_ext, role) as (values");
lines.push(
  eventParticipantRows
    .map((r, i) => `  (${sqlStr(r.event_ext)}, ${sqlStr(r.participant_ext)}, ${sqlStr(r.role)})${i === eventParticipantRows.length - 1 ? "" : ","}`)
    .join("\n")
);
lines.push(")");
lines.push("insert into public.event_participants (event_id, participant_id, role)");
lines.push(`select ev.id, pa.id, target.role`);
lines.push("from target");
lines.push(`join public.events ev on ev.source = ${sqlStr(fetched.source)} and ev.external_id = target.event_ext`);
lines.push(`join public.participants pa on pa.source = ${sqlStr(fetched.source)} and pa.external_id = target.participant_ext`);
lines.push("on conflict (event_id, participant_id) do update set role = excluded.role;");
lines.push("");

lines.push("-- Garde-fou final : totaux exacts avant commit.");
lines.push("do $post$");
lines.push("declare");
lines.push("  v_participants int; v_events int; v_event_participants int;");
lines.push("begin");
lines.push(`  select count(*) into v_participants from public.participants where source = ${sqlStr(fetched.source)};`);
lines.push(`  select count(*) into v_events from public.events where source = ${sqlStr(fetched.source)};`);
lines.push(`  select count(*) into v_event_participants from public.event_participants ep join public.events e on e.id = ep.event_id where e.source = ${sqlStr(fetched.source)};`);
lines.push(`  if v_participants <> ${participants.length} or v_events <> ${events.length} or v_event_participants <> ${eventParticipantRows.length} then`);
lines.push(`    raise exception 'ABORT ingestion CL: totaux inattendus après écriture — participants=%, events=%, event_participants=% (attendu ${participants.length}/${events.length}/${eventParticipantRows.length})', v_participants, v_events, v_event_participants;`);
lines.push("  end if;");
lines.push("end $post$;");
lines.push("");
lines.push("commit;");

writeFileSync(sqlOutPath, lines.join("\n") + "\n", "utf-8");

// --- Rapport dry-run (stdout) ---
const finishedCount = events.filter((e) => e.status === "finished").length;
const scheduledCount = events.filter((e) => e.status === "scheduled").length;
console.log(JSON.stringify({
  plan: {
    competitions: { action: "update (backfill source/external_id)", count: 1, slug: "uefa-champions-league" },
    seasons: { action: "create", count: 1, label: fetched.season.label, external_id: fetched.season.external_id },
    participants: { action: "create", count: participants.length },
    events: { action: "create", count: events.length, finished: finishedCount, scheduled: scheduledCount },
    event_participants: { action: "create", count: eventParticipantRows.length },
  },
  stage_order_map: Object.fromEntries(stageOrder),
  warnings: [
    ...(stagesWithoutOrder.length > 0 ? [`${stagesWithoutOrder.length} event(s) avec un stage sans starts_at exploitable`] : []),
    "leg non renseigné (NULL) pour tous les events — football-data.org ne l'expose pas sur les données observées (phase de championnat uniquement, pas encore de tour aller/retour) ; à revérifier quand les 8es de finale seront publiés.",
    "standings (classement CL) non ingéré dans ce lot — pas de table dédiée dans le schéma actuel (hors scope Lot 1), périmètre volontairement limité à participants/events/event_participants.",
    "saison seedée 2025-2026 (Lot 1, placeholder sans source/external_id) laissée telle quelle, non supprimée — devient une ligne orpheline sans event.",
  ],
  sql_output: sqlOutPath,
}, null, 2));
