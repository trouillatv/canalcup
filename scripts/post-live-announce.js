// Publie une annonce dans le Canal Cup Live (feed_posts), sans envoyer de push.
// Utile pour faire apparaître dans le live un message déjà poussé en notif
// (les broadcasts manuels ne sont pas journalisés → texte à fournir à la main).
//
// Usage :
//   node scripts/post-live-announce.js "Titre" "Message (optionnel)"
//
// Exemple :
//   node scripts/post-live-announce.js "⏳ Plus que 24h pour voter !" "Les votes ferment jeudi à 23h59."

const fs = require("fs");
const path = require("path");
fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8").split("\n").forEach((l) => {
  const [k, ...v] = l.split("=");
  if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
});
const { createClient } = require("@supabase/supabase-js");

const title = process.argv[2];
const message = process.argv[3] ?? "";
if (!title || title.trim().length < 3) {
  console.error('Usage : node scripts/post-live-announce.js "Titre" "Message (optionnel)"');
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  const body = `📣 ${title.trim()}${message.trim() ? `\n\n${message.trim()}` : ""}`;
  const { error } = await sb.from("feed_posts").insert({
    user_id: null,
    display_name: "Canal Cup",
    type: "ambiance",         // type autorisé → s'affiche « Canal Cup » dans le live
    context_type: "announce",
    body,
    status: "visible",
  });
  if (error) { console.error("✗ Échec insertion feed_posts :", error.message); process.exit(1); }
  console.log("✅ Annonce publiée dans le Canal Cup Live :\n" + body);
})();
