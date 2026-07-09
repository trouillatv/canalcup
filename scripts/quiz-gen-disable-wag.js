// Génère supabase/migration_quiz_disable_wag_jokes.sql : ajoute la colonne
// `disabled` à quiz_questions et passe à true les 13 blagues WAG (par ID exact).
// N'applique RIEN — écrit juste le .sql (à passer ensuite à migrate.js --file).
//   node scripts/quiz-gen-disable-wag.js
const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((l) => {
    const [k, ...v] = l.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const strip = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const JOKE_MARKERS = [
  "mercato d'hiver",
  "oublie l'anniversaire de sa femme",
  "rate un penalty en finale, que fait sa femme",
  "point commun entre un joueur de football professionnel et son epouse",
  "plus difficile pour la femme d'un joueur transfere en angleterre",
  "difference entre une faute sifflee par un arbitre homme et une arbitre femme",
  "pire moment pour un footballeur professionnel lors d'une session shopping",
  "part en 'mise au vert'",
  "demande de passer l'aspirateur",
  "role crucial d'une wag pendant la coupe du monde",
  "regard noir de sa femme en tribune",
  "pire cauchemar d'une femme de joueur de football lors de la ceremonie du ballon d'or",
  "accessoire indispensable de la femme d'un joueur qui vient de signer dans un club en siberie",
].map(strip);

(async () => {
  const { data: qs } = await sb.from("quiz_questions").select("id, question");
  const matched = qs.filter((q) => JOKE_MARKERS.some((m) => strip(q.question).includes(m)));
  if (matched.length !== 13) {
    console.error(`⚠️ ${matched.length} correspondances (attendu 13). Abandon.`);
    process.exit(1);
  }
  const ids = matched.map((q) => `  '${q.id}'`).join(",\n");
  const comments = matched.map((q) => `--   ${q.question.replace(/\s+/g, " ").slice(0, 90)}`).join("\n");
  const sql = `-- Retire du jeu les 13 blagues à stéréotypes sur les « femmes de footballeur »
-- (WAGs). On NE supprime PAS les lignes (les scores du Quiz #1 référencent
-- certaines via quiz_answers) : on les marque disabled=true et le tirage /
-- le mode Solo les ignorent. Réversible : disabled=false pour réactiver.
-- Les questions factuelles (arbitres femmes, mariages réels) restent actives.
--
-- Questions désactivées :
${comments}

alter table public.quiz_questions
  add column if not exists disabled boolean not null default false;

update public.quiz_questions
  set disabled = true
  where id in (
${ids}
  );
`;
  const out = path.join(__dirname, "../supabase/migration_quiz_disable_wag_jokes.sql");
  fs.writeFileSync(out, sql, "utf8");
  console.log(`✅ Migration écrite (${matched.length} IDs) : ${out}`);
})();
