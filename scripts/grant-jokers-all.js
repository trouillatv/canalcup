// One-shot — distribue 1 joker de CHAQUE type à tous les joueurs.
//
// Rend les jokers "effectifs" : sans wallet rempli, les cartes restent
// grisées (quantity 0) côté app. La migration crée seulement le schéma,
// elle ne distribue rien.
//
// Idempotent : n'insère QUE les lignes manquantes (user_id, joker_type).
// Un wallet existant (même consommé à 0) n'est jamais écrasé → pas de
// double-attribution si on relance.
//
// Exclut les organisateurs (allowlist_users.role admin|super_admin), comme
// les classements. event_admin (animateurs) reçoit ses jokers.
//
// Usage : node scripts/grant-jokers-all.js [--dry]

const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}

const { createClient } = require("@supabase/supabase-js");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes("--dry");

if (!URL || !SERVICE) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

// Source de vérité partagée avec lib/jokers/catalog.ts
const JOKER_TYPES = [
  "casino",
  "quitte_ou_double",
  "carton_rouge",
  "brouillard",
  "espion",
  "var",
  "retard_avion",
];

const supabase = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  // 1. Organisateurs à exclure (admin | super_admin)
  const { data: adminRows, error: adminErr } = await supabase
    .from("allowlist_users")
    .select("email, role")
    .in("role", ["admin", "super_admin"]);
  if (adminErr) console.warn("⚠️  allowlist_users illisible, aucun admin exclu :", adminErr.message);
  const adminEmails = new Set((adminRows ?? []).map((r) => (r.email || "").toLowerCase()));

  // 2. Tous les joueurs
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id, display_name, name, email, profile_completed");
  if (usersErr) { console.error("Lecture users KO :", usersErr.message); process.exit(1); }

  const players = (users ?? []).filter((u) => !adminEmails.has((u.email ?? "").toLowerCase()));
  console.log(`Joueurs cibles : ${players.length} (sur ${users?.length ?? 0} comptes, ${adminEmails.size} admins exclus)`);

  // 3. Wallets déjà existants → ne pas réécraser
  const { data: wallets, error: wErr } = await supabase
    .from("joker_wallets")
    .select("user_id, joker_type, quantity");
  if (wErr) { console.error("Lecture joker_wallets KO :", wErr.message); process.exit(1); }
  const existing = new Set((wallets ?? []).map((w) => `${w.user_id}|${w.joker_type}`));
  console.log(`Wallets déjà en base : ${wallets?.length ?? 0}`);

  // 4. Construit les lignes manquantes (1 de chaque)
  const toInsert = [];
  for (const p of players) {
    for (const t of JOKER_TYPES) {
      if (!existing.has(`${p.id}|${t}`)) {
        toInsert.push({ user_id: p.id, joker_type: t, quantity: 1 });
      }
    }
  }
  console.log(`Lignes à insérer (1 par type manquant) : ${toInsert.length}`);

  if (toInsert.length === 0) { console.log("Rien à faire — tout le monde a déjà ses jokers."); return; }
  if (DRY) { console.log("[--dry] aucune écriture effectuée."); return; }

  // 5. Insert par lots de 500
  let done = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500);
    const { error } = await supabase.from("joker_wallets").insert(batch);
    if (error) { console.error(`Insert lot ${i} KO :`, error.message); process.exit(1); }
    done += batch.length;
    console.log(`  …${done}/${toInsert.length}`);
  }
  console.log(`✅ Distribution terminée : ${done} jokers attribués (${players.length} joueurs × ${JOKER_TYPES.length} types, lacunes comblées).`);
})();
