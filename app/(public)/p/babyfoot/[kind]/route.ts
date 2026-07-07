// Affiches baby-foot imprimables (QR vers l'inscription). Documents HTML AUTONOMES
// (hors shell app) : /p/babyfoot/inscriptions | amical | officiel.
// Modèle : app/(public)/p/welcome/route.ts.

import { BABYFOOT } from "@/lib/config/babyfoot";

export const dynamic = "force-dynamic";

const VARIANTS: Record<string, { emoji: string; title: string; sub: string; cta: string; accent: string }> = {
  inscriptions: {
    emoji: "🎮", title: "Les inscriptions sont ouvertes !",
    sub: `Tournoi Baby-foot CanalCup — ${BABYFOOT.eventLabel}`,
    cta: "Scanne pour inscrire ton binôme", accent: "#f5d90a",
  },
  amical: {
    emoji: "🎯", title: "Journée amicale baby-foot",
    sub: `${BABYFOOT.friendlyLabel} — entraînement, pas de points, juste fun`,
    cta: "Scanne pour dire que tu joues", accent: "#38bdf8",
  },
  officiel: {
    emoji: "🏆", title: "Tournoi officiel aujourd'hui !",
    sub: `${BABYFOOT.eventLabel} — des points CanalCup à gagner`,
    cta: "Scanne pour t'inscrire / voir le tableau", accent: "#f5d90a",
  },
};

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const v = VARIANTS[kind] ?? VARIANTS.inscriptions;
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const target = `${origin}/babyfoot/register`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&data=${encodeURIComponent(target)}`;

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${v.title}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',system-ui,sans-serif; background:#0a0a0a; color:#fff; min-height:100vh;
    display:flex; align-items:center; justify-content:center; padding:6vw; text-align:center; }
  .poster { max-width:760px; }
  .emoji { font-size:120px; line-height:1; margin-bottom:24px; }
  h1 { font-size:56px; font-weight:900; line-height:1.05; letter-spacing:-0.02em; }
  .sub { font-size:26px; color:#a3a3a3; margin-top:18px; }
  .qr { margin:44px auto 20px; background:#fff; padding:20px; border-radius:24px; width:min(60vw,420px); }
  .qr img { width:100%; display:block; }
  .cta { font-size:28px; font-weight:800; color:${v.accent}; }
  .brand { margin-top:36px; font-size:20px; color:#666; letter-spacing:0.3em; text-transform:uppercase; }
  @media print { body { background:#fff; color:#000; } .sub{color:#444} }
</style></head>
<body><div class="poster">
  <div class="emoji">${v.emoji}</div>
  <h1>${v.title}</h1>
  <p class="sub">${v.sub}</p>
  <div class="qr"><img src="${qr}" alt="QR inscription baby-foot" /></div>
  <p class="cta">${v.cta}</p>
  <p class="brand">Canal Cup 2026</p>
</div></body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
