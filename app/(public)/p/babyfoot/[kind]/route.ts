// 2 affiches A3 PERMANENTES du tournoi baby-foot, à imprimer et laisser au mur
// toute la période d'inscription. Très visuelles, peu de texte, gros QR Code,
// identité CanalCup. Tout l'ÉVOLUTIF (inscrits, favoris, tirage, résultats) vit
// sur les écrans TV / l'app, jamais sur les affiches.
//   /p/babyfoot/1  → « Formez votre binôme »
//   /p/babyfoot/2  → « Qui sera le champion ? »
// Documents HTML autonomes (hors shell app), imprimables A3.

import { BABYFOOT, championMaxPoints } from "@/lib/config/babyfoot";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const target = `${origin}/babyfoot/register`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=24&data=${encodeURIComponent(target)}`;

  const body =
    kind === "2"
      ? `
      <div class="hero">🏆</div>
      <h1>QUI SERA LE<br/><span class="y">CHAMPION</span> ?</h1>
      <ul class="feats">
        <li>⚽ Tableau en direct</li>
        <li>📺 Écrans TV toute la journée</li>
        <li>📸 Photos du tournoi</li>
        <li>🎉 Ambiance CanalCup</li>
      </ul>
      <div class="qr"><img src="${qr}" alt="QR inscription" /><p>Inscription en binôme</p></div>
      <p class="foot">Rendez-vous le <b>${BABYFOOT.eventLabel}</b>.</p>`
      : `
      <div class="hero">🏓</div>
      <h1>TOURNOI BABY-FOOT<br/><span class="y">CANALCUP</span></h1>
      <p class="tag">Formez votre binôme et relevez le défi&nbsp;!</p>
      <ul class="feats">
        <li>📅 <b>${BABYFOOT.eventLabel}</b></li>
        <li>👥 Équipes de <b>2</b> obligatoires</li>
        <li>🏆 Jusqu'à <b>${championMaxPoints()} points</b> CanalCup à gagner</li>
        <li>🔥 Le tournoi qui peut tout changer</li>
      </ul>
      <div class="qr"><img src="${qr}" alt="QR inscription" /><p>📱 Scannez pour inscrire votre binôme</p></div>
      <p class="foot">Inscriptions ouvertes jusqu'au <b>${BABYFOOT.eventLabel}</b>.</p>`;

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Affiche Baby-foot CanalCup</title>
<style>
  @page { size: A3 portrait; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { background:#0a0a0a; }
  .poster {
    width:100%; min-height:100vh; background:
      radial-gradient(120% 80% at 50% -10%, rgba(245,217,10,.18), transparent 60%), #0a0a0a;
    color:#fff; font-family:'Inter',system-ui,sans-serif; text-align:center;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:3vh; padding:6vh 8vw; border:14px solid #f5d90a;
  }
  .hero { font-size:22vh; line-height:1; }
  h1 { font-size:8.5vh; font-weight:900; letter-spacing:-.02em; line-height:1.02; }
  .y { color:#f5d90a; }
  .tag { font-size:4vh; font-weight:800; color:#e5e5e5; }
  .feats { list-style:none; display:flex; flex-direction:column; gap:1.6vh; font-size:3.4vh; font-weight:600; }
  .feats b { color:#f5d90a; }
  .qr { background:#fff; padding:2.4vh; border-radius:24px; }
  .qr img { width:34vh; height:34vh; display:block; }
  .qr p { color:#0a0a0a; font-weight:900; font-size:2.6vh; margin-top:1.4vh; }
  .foot { font-size:2.8vh; color:#a3a3a3; }
  .foot b { color:#fff; }
  @media print { .poster { min-height:auto; height:100vh; } }
</style></head>
<body><div class="poster">${body}</div></body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
