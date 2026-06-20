// ─────────────────────────────────────────────────────────────────────────────
//  « Le Saviez-vous ? » du centre du match — SERVEUR.
//  Discipline Canal Cup : AUCUNE génération IA à l'affichage (coût ~0, stable).
//  3 cartes max, déterministes par match (donc cohérentes d'un rechargement à
//  l'autre), construites depuis :
//   • football_facts (bibliothèque pré-générée/curée, status='approved')   ← stocké
//   • wc-teams.json (effectif, âge moyen, joueur le plus capé)             ← dérivé
//   • matches (forme récente sur nos matchs trackés)                       ← dérivé
//   • predictions (🎯 stat Canal Cup, masquée avant le coup d'envoi)       ← dérivé live
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWCTeamByName } from "@/lib/football/wc-teams";
import { toFrench } from "@/lib/football/team-names";

export interface MatchFactCard {
  type: "canalcup" | "equipe" | "forme" | "worldcup" | "general" | "histoire" | "joueur";
  emoji: string;
  title: string;
  content: string;
}

const EMOJI: Record<MatchFactCard["type"], string> = {
  canalcup: "🎯", equipe: "⚽", forme: "📊", worldcup: "🌎", general: "📖", histoire: "📖", joueur: "👀",
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const seedOf = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);

type Supa = ReturnType<typeof createAdminClient>;

// ── ⚽ Équipe (dérivé wc-teams.json) ──────────────────────────────────────────
function teamFact(teamName: string): MatchFactCard | null {
  const t = getWCTeamByName(teamName);
  if (!t) return null;
  const ages = t.players.map((p) => p.age).filter((a): a is number => a != null);
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;
  const capped = t.players
    .filter((p) => p.caps != null)
    .sort((a, b) => (b.caps ?? 0) - (a.caps ?? 0))[0];
  const bits: string[] = [];
  if (t.squadValue) bits.push(`effectif estimé à ${t.squadValue}`);
  if (avgAge) bits.push(`âge moyen ${avgAge} ans`);
  if (capped?.caps) bits.push(`joueur le plus capé : ${capped.name} (${capped.caps} sél.)`);
  if (!bits.length) return null;
  return { type: "equipe", emoji: EMOJI.equipe, title: t.name, content: cap(bits.join(" · ")) + "." };
}

// ── 📊 Forme récente (dérivé matches trackés) ─────────────────────────────────
async function formFact(supabase: Supa, teamName: string): Promise<MatchFactCard | null> {
  const [{ data: asA }, { data: asB }] = await Promise.all([
    supabase.from("matches").select("score_a, score_b, starts_at").eq("team_a", teamName).eq("status", "finished"),
    supabase.from("matches").select("score_a, score_b, starts_at").eq("team_b", teamName).eq("status", "finished"),
  ]);
  type M = { score_a: number | null; score_b: number | null; starts_at: string; home: boolean };
  const all: M[] = [
    ...((asA ?? []) as Omit<M, "home">[]).map((m) => ({ ...m, home: true })),
    ...((asB ?? []) as Omit<M, "home">[]).map((m) => ({ ...m, home: false })),
  ]
    .filter((m) => m.score_a != null && m.score_b != null)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
    .slice(0, 5);
  if (all.length < 2) return null;

  // Résultat du point de vue de l'équipe : V / N / D.
  const letters = all.map((m) => {
    const me = m.home ? m.score_a! : m.score_b!;
    const opp = m.home ? m.score_b! : m.score_a!;
    return me > opp ? "V" : me < opp ? "D" : "N";
  });
  // Série en cours (sans défaite) depuis le plus récent.
  let unbeaten = 0;
  for (const l of letters) { if (l === "D") break; unbeaten++; }
  const t = getWCTeamByName(teamName);
  const name = t?.name ?? teamName;
  const content =
    unbeaten >= 2
      ? `${name} reste sur ${unbeaten} match${unbeaten > 1 ? "s" : ""} sans défaite (matchs Canal Cup trackés).`
      : `Forme récente de ${name} : ${letters.join(" ")} (matchs Canal Cup trackés).`;
  return { type: "forme", emoji: EMOJI.forme, title: "Forme récente", content };
}

// ── 🎯 Canal Cup (dérivé predictions, masqué avant le coup d'envoi) ───────────
async function canalCupFact(
  supabase: Supa,
  matchId: string,
  match: { team_a: string; team_b: string; status: string | null; starts_at: string }
): Promise<MatchFactCard | null> {
  const { data: preds } = await supabase
    .from("predictions")
    .select("predicted_score_a, predicted_score_b")
    .eq("match_id", matchId);
  const rows = (preds ?? []).filter((p) => p.predicted_score_a != null && p.predicted_score_b != null);
  const total = rows.length;
  if (!total) return null;

  const started =
    match.status === "live" || match.status === "halftime" || match.status === "finished" ||
    new Date(match.starts_at) <= new Date();

  // Avant le coup d'envoi : on ne dévoile RIEN (cohérent avec predictions-trend,
  // pour ne pas permettre de copier). Teaser sur le nombre seulement.
  if (!started) {
    return {
      type: "canalcup", emoji: EMOJI.canalcup, title: "Pronos Canal Cup",
      content: `${total} collègue${total > 1 ? "s ont" : " a"} déjà pronostiqué ce match. Verdict au coup d'envoi !`,
    };
  }

  const teamA = toFrench(match.team_a), teamB = toFrench(match.team_b);
  let a = 0, draw = 0, b = 0;
  for (const p of rows) {
    const pa = p.predicted_score_a!, pb = p.predicted_score_b!;
    if (pa > pb) a++; else if (pb > pa) b++; else draw++;
  }
  const pct = (n: number) => Math.round((n / total) * 100);

  // Angle « personne n'a misé sur… » quand une issue est à 0 (et assez de monde).
  if (total >= 5) {
    if (a === 0 && (b > 0 || draw > 0)) return { type: "canalcup", emoji: EMOJI.canalcup, title: "Stat Canal Cup", content: `Personne n'a misé sur une victoire de ${teamA} !` };
    if (b === 0 && (a > 0 || draw > 0)) return { type: "canalcup", emoji: EMOJI.canalcup, title: "Stat Canal Cup", content: `Personne n'a misé sur une victoire de ${teamB} !` };
  }
  const best = Math.max(a, draw, b);
  const label = best === a ? `une victoire de ${teamA}` : best === b ? `une victoire de ${teamB}` : "un match nul";
  return {
    type: "canalcup", emoji: EMOJI.canalcup, title: "Stat Canal Cup",
    content: `${pct(best)} % des joueurs voient ${label}.`,
  };
}

// ── 📖 Histoire de la rencontre (football_facts scope='matchup') ──────────────
async function matchupFact(supabase: Supa, slugA: string | null, slugB: string | null, seed: number): Promise<MatchFactCard | null> {
  if (!slugA || !slugB) return null;
  const { data } = await supabase
    .from("football_facts")
    .select("content, priority")
    .eq("status", "approved")
    .eq("scope", "matchup")
    .or(`and(team_slug.eq.${slugA},team_slug_b.eq.${slugB}),and(team_slug.eq.${slugB},team_slug_b.eq.${slugA})`)
    .order("priority", { ascending: false });
  const rows = (data ?? []) as { content: string }[];
  if (!rows.length) return null;
  const f = rows[seed % rows.length]; // rotation déterministe si plusieurs
  return { type: "histoire", emoji: EMOJI.histoire, title: "Histoire de la rencontre", content: f.content };
}

// ── Bibliothèque statique (football_facts approuvés) ──────────────────────────
async function staticFacts(supabase: Supa, slugs: string[]): Promise<MatchFactCard[]> {
  const { data } = await supabase
    .from("football_facts")
    .select("scope, team_slug, theme, content, priority")
    .eq("status", "approved")
    .or(`scope.in.(general,worldcup)${slugs.length ? `,team_slug.in.(${slugs.join(",")})` : ""}`)
    .order("priority", { ascending: false });
  return ((data ?? []) as { scope: string; theme: string; content: string }[]).map((f) => ({
    type: (f.scope === "team" ? "equipe" : f.scope) as MatchFactCard["type"],
    emoji: EMOJI[(f.scope === "worldcup" ? "worldcup" : "general") as MatchFactCard["type"]] ?? "📖",
    title: f.scope === "worldcup" ? "Coupe du Monde 2026" : "Le saviez-vous",
    content: f.content,
  }));
}

// ── Assemblage : 3 cartes max, déterministe par match ─────────────────────────
export async function getMatchFacts(matchId: string): Promise<MatchFactCard[]> {
  const supabase = createAdminClient();
  const { data: match } = await supabase
    .from("matches")
    .select("team_a, team_b, status, starts_at")
    .eq("id", matchId)
    .single();
  if (!match) return [];

  const teamA = toFrench(match.team_a), teamB = toFrench(match.team_b);
  const seed = seedOf(matchId);
  const primary = seed % 2 === 0 ? teamA : teamB;
  const secondary = primary === teamA ? teamB : teamA;
  const slugA = getWCTeamByName(teamA)?.slug ?? null;
  const slugB = getWCTeamByName(teamB)?.slug ?? null;
  const slugs = [slugA, slugB].filter((s): s is string => !!s);

  const [matchup, canal, statics] = await Promise.all([
    matchupFact(supabase, slugA, slugB, seed),
    canalCupFact(supabase, matchId, match),
    staticFacts(supabase, slugs),
  ]);

  const cards: MatchFactCard[] = [];
  if (matchup) cards.push(matchup);                               // 📖 histoire de la rencontre (le plus spécifique)
  if (canal) cards.push(canal);                                   // 🎯 la pépite

  const team = teamFact(primary) ?? teamFact(secondary);          // ⚽ équipe
  if (team && cards.length < 3) cards.push(team);

  // 1 fait statique (rotation déterministe pour varier d'un match à l'autre).
  if (statics.length && cards.length < 3) {
    cards.push(statics[seed % statics.length]);
  }

  // Complète avec la forme si encore de la place.
  if (cards.length < 3) {
    const form = await formFact(supabase, primary);
    if (form) cards.push(form);
  }
  // Dernier filet : un autre fait statique distinct.
  if (cards.length < 3 && statics.length > 1) {
    const next = statics[(seed + 1) % statics.length];
    if (!cards.some((c) => c.content === next.content)) cards.push(next);
  }

  return cards.slice(0, 3);
}
