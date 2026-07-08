import fs from "fs"; import path from "path";
const p = path.join(process.cwd(), ".env.local");
if (fs.existsSync(p)) for (const l of fs.readFileSync(p, "utf8").split("\n")) { const [k, ...v] = l.split("="); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim(); }
/* eslint-disable @typescript-eslint/no-explicit-any */
// Vide le test : supprime binomes/matchs/points du tournoi ACTIF et remet l'etat
// de depart (inscriptions rouvertes, 0 binome).
(async () => {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { getActiveOfficialTournament } = await import("@/lib/data/babyfoot");
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  if (!t) { console.log("Pas de tournoi actif."); return; }
  const tid = t.id;
  await admin.from("babyfoot_awards").delete().eq("tournament_id", tid);
  await admin.from("babyfoot_matches").delete().eq("tournament_id", tid);
  await admin.from("babyfoot_entries").delete().eq("tournament_id", tid); // cascade -> availability
  await admin.from("babyfoot_tournaments").update({ status: "registration", registration_open: true }).eq("id", tid);
  const { count } = await admin.from("babyfoot_entries").select("id", { count: "exact", head: true }).eq("tournament_id", tid);
  console.log(`✅ Test vide. ${t.name} : ${count ?? 0} binome, statut = registration, inscriptions rouvertes.`);
})();
