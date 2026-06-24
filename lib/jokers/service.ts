// ─────────────────────────────────────────────────────────────────────────────
//  Service Jokers — logique métier (serveur uniquement, createAdminClient).
//  Garde-fous anti-acharnement centralisés ici. Toute mutation passe par ce
//  module pour garantir la traçabilité (joker_plays / joker_effects + feed).
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import {
  JOKER_CATALOG,
  type JokerType,
  type JokerEffectType,
  OFFENSIVE_JOKER_COOLDOWN_DAYS,
  CASINO_OUTCOMES,
  casinoWeights,
  SPY_MAX_MATCHES,
  KAMIKAZE_MIN_STAKE,
  KAMIKAZE_MAX_STAKE,
} from "@/lib/jokers/catalog";
import type { JokerEffect, JokerPlay, JokerWallet } from "@/lib/supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PlayResult {
  ok: boolean;
  error?: string;
  play?: JokerPlay;
  /** Message public (chambrage) à afficher dans le live / TV chaos. */
  publicMessage?: string;
  /** Données utiles au front (ex. résultat Casino). */
  data?: Record<string, unknown>;
}

// ── Expiration paresseuse des effets à fenêtre temporelle ────────────────────
export async function expireStaleEffects(admin: Admin = createAdminClient()): Promise<void> {
  const nowIso = new Date().toISOString();
  await admin
    .from("joker_effects")
    .update({ status: "expired" })
    .eq("status", "active")
    .not("ends_at", "is", null)
    .lt("ends_at", nowIso);
}

// ── Lectures ─────────────────────────────────────────────────────────────────
export async function getWallet(userId: string): Promise<JokerWallet[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("joker_wallets")
    .select("*")
    .eq("user_id", userId)
    .order("joker_type");
  return (data ?? []) as JokerWallet[];
}

/** Effets actifs (non expirés) sur un joueur. */
export async function getActiveEffectsForUser(userId: string): Promise<JokerEffect[]> {
  const admin = createAdminClient();
  await expireStaleEffects(admin);
  const { data } = await admin
    .from("joker_effects")
    .select("*")
    .eq("affected_user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return (data ?? []) as JokerEffect[];
}

/** Tous les effets actifs (TV chaos / admin). */
export async function getAllActiveEffects(): Promise<JokerEffect[]> {
  const admin = createAdminClient();
  await expireStaleEffects(admin);
  const { data } = await admin
    .from("joker_effects")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return (data ?? []) as JokerEffect[];
}

/** Un effet précis est-il actif sur ce joueur (optionnellement pour un match) ? */
export async function hasActiveEffect(
  userId: string,
  effectType: JokerEffectType,
  matchId?: string
): Promise<JokerEffect | null> {
  const admin = createAdminClient();
  await expireStaleEffects(admin);
  let q = admin
    .from("joker_effects")
    .select("*")
    .eq("affected_user_id", userId)
    .eq("effect_type", effectType)
    .eq("status", "active");
  if (matchId) q = q.eq("match_id", matchId);
  const { data } = await q.limit(1).maybeSingle();
  return (data as JokerEffect | null) ?? null;
}

// ── Wallet : attribution / retrait (admin) ───────────────────────────────────
export async function grantJoker(userId: string, type: JokerType, qty = 1): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("joker_wallets")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("joker_type", type)
    .maybeSingle();

  if (existing) {
    await admin
      .from("joker_wallets")
      .update({ quantity: Math.max(0, existing.quantity + qty), updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await admin
      .from("joker_wallets")
      .insert({ user_id: userId, joker_type: type, quantity: Math.max(0, qty) });
  }
}

export async function revokeJoker(userId: string, type: JokerType, qty = 1): Promise<void> {
  await grantJoker(userId, type, -qty);
}

// ── Jouer un joker ───────────────────────────────────────────────────────────
export interface PlayParams {
  playedByUserId: string;
  type: JokerType;
  targetUserId?: string | null;
  matchId?: string | null;
  /** 💣 Kamikaze : mise du joueur (1..20 pts). Ignoré pour les autres jokers. */
  stake?: number | null;
}

export async function playJoker(params: PlayParams): Promise<PlayResult> {
  const admin = createAdminClient();
  const def = JOKER_CATALOG[params.type];
  if (!def) return { ok: false, error: "Joker inconnu." };

  // 1. Possession
  const { data: wallet } = await admin
    .from("joker_wallets")
    .select("id, quantity")
    .eq("user_id", params.playedByUserId)
    .eq("joker_type", params.type)
    .maybeSingle();
  if (!wallet || wallet.quantity < 1) {
    return { ok: false, error: `Tu n'as pas de joker ${def.name} disponible.` };
  }

  // 2. Cohérence cible / match selon le ciblage
  const needsTarget = def.targeting === "target" || def.targeting === "target_match";
  const needsMatch = def.targeting === "self_match" || def.targeting === "target_match";
  if (needsTarget && !params.targetUserId) return { ok: false, error: "Cible requise." };
  if (needsMatch && !params.matchId) return { ok: false, error: "Match requis." };
  if (needsTarget && params.targetUserId === params.playedByUserId) {
    return { ok: false, error: "Tu ne peux pas te cibler toi-même." };
  }

  // 3. Cooldown jokers offensifs (10 jours, toutes cibles confondues)
  if (def.offensive) {
    const since = new Date(Date.now() - OFFENSIVE_JOKER_COOLDOWN_DAYS * DAY_MS).toISOString();
    const { data: recent } = await admin
      .from("joker_plays")
      .select("id, joker_type, created_at")
      .eq("played_by_user_id", params.playedByUserId)
      .neq("status", "cancelled")
      .gte("created_at", since)
      .in("joker_type", offensiveTypes())
      .limit(1);
    if (recent && recent.length > 0) {
      const next = new Date(new Date(recent[0].created_at).getTime() + OFFENSIVE_JOKER_COOLDOWN_DAYS * DAY_MS);
      return {
        ok: false,
        error: `Tu as déjà joué un joker offensif récemment. Prochain disponible le ${next.toLocaleDateString("fr-FR")}.`,
      };
    }
  }

  // 4. Validation du match (timing) si nécessaire
  let match: { id: string; status: string; starts_at: string; phase: string | null } | null = null;
  if (params.matchId) {
    const { data: m } = await admin
      .from("matches")
      .select("id, status, starts_at, phase")
      .eq("id", params.matchId)
      .maybeSingle();
    if (!m) return { ok: false, error: "Match introuvable." };
    match = m;
    const started = m.status !== "upcoming" || new Date(m.starts_at) <= new Date();

    if (params.type === "carton_rouge" || params.type === "quitte_ou_double" || params.type === "kamikaze") {
      if (started) return { ok: false, error: "Match déjà commencé : trop tard." };
    }
    if (params.type === "var") {
      if (m.status === "finished") return { ok: false, error: "Match terminé : la VAR ne peut plus rien." };
    }
    // 💣 Kamikaze / 💥 Quitte ou Double : il faut un pronostic existant sur ce
    // match (sinon rien à résoudre — on évite le piège du malus sans prono).
    if (params.type === "kamikaze" || params.type === "quitte_ou_double") {
      const { data: pred } = await admin
        .from("predictions")
        .select("id")
        .eq("user_id", params.playedByUserId)
        .eq("match_id", params.matchId)
        .maybeSingle();
      if (!pred) {
        return { ok: false, error: `Fais d'abord ton pronostic sur ce match avant de jouer le ${def.name}.` };
      }
    }
    // 💣 Kamikaze : la mise doit être un entier dans [MIN, MAX].
    if (params.type === "kamikaze") {
      const stake = params.stake;
      if (!Number.isInteger(stake) || (stake as number) < KAMIKAZE_MIN_STAKE || (stake as number) > KAMIKAZE_MAX_STAKE) {
        return { ok: false, error: `Mise invalide : choisis un entier entre ${KAMIKAZE_MIN_STAKE} et ${KAMIKAZE_MAX_STAKE} pts.` };
      }
    }
  }

  // 5. Garde-fous spécifiques + incompatibilités cible
  const guard = await checkTargetGuards(admin, params, match);
  if (guard) return { ok: false, error: guard };

  // 6. Décrémente le wallet (consommation)
  await admin
    .from("joker_wallets")
    .update({ quantity: wallet.quantity - 1, updated_at: new Date().toISOString() })
    .eq("id", wallet.id);

  // 7. Crée le play + applique l'effet
  return applyJoker(admin, params);
}

function offensiveTypes(): JokerType[] {
  return (Object.values(JOKER_CATALOG).filter((d) => d.offensive).map((d) => d.type));
}

/** Tirage pondéré : renvoie un item selon ses poids (somme quelconque). */
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

async function checkTargetGuards(
  admin: Admin,
  params: PlayParams,
  match: { id: string; phase: string | null } | null
): Promise<string | null> {
  const target = params.targetUserId ?? null;

  if (params.type === "carton_rouge" && target && match) {
    // Le ciblé peut-il déjà être suspendu sur CE match ?
    const existing = await hasActiveEffect(target, "red_card_block", match.id);
    if (existing) return "Ce joueur est déjà suspendu sur ce match.";
    // Max 1 carton subi par phase de groupes.
    if ((match.phase ?? "") === "Groupe") {
      const { data: targetCards } = await admin
        .from("joker_plays")
        .select("id, match_id")
        .eq("joker_type", "carton_rouge")
        .eq("target_user_id", target)
        .neq("status", "cancelled");
      const matchIds = (targetCards ?? []).map((c) => c.match_id).filter(Boolean) as string[];
      if (matchIds.length > 0) {
        const { data: groupMatches } = await admin
          .from("matches")
          .select("id")
          .in("id", matchIds)
          .eq("phase", "Groupe");
        if ((groupMatches ?? []).length > 0) {
          return "Ce joueur a déjà reçu un Carton Rouge sur la phase de groupes.";
        }
      }
    }
  }

  // 🌫 Brouillard / ✈️ Retard d'Avion : un seul malus de verrouillage à la fois
  // sur une même cible. Les deux verrouillent la modification des pronos → pas
  // de cumul (même type OU type croisé). Il faut attendre la fin de l'effet en
  // cours avant d'en reposer un.
  if ((params.type === "brouillard" || params.type === "retard_avion") && target) {
    const fog = await hasActiveEffect(target, "fog");
    const delay = await hasActiveEffect(target, "flight_delay");
    const until = (e: JokerEffect) =>
      e.ends_at
        ? ` (fin le ${new Date(e.ends_at).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" })})`
        : "";
    if (fog) {
      return params.type === "brouillard"
        ? `Ce joueur est déjà dans le Brouillard${until(fog)}. Attends la fin de l'effet.`
        : `Ce joueur a déjà un malus actif (Brouillard)${until(fog)}. Attends qu'il se termine avant un Retard d'Avion.`;
    }
    if (delay) {
      return params.type === "retard_avion"
        ? `Ce joueur a déjà un Retard d'Avion actif${until(delay)}. Attends la fin de l'effet.`
        : `Ce joueur a déjà un malus actif (Retard d'Avion)${until(delay)}. Attends qu'il se termine avant un Brouillard.`;
    }
  }
  if (params.type === "var" && params.matchId) {
    if (await hasActiveEffect(params.playedByUserId, "var_window", params.matchId)) {
      return "Tu as déjà une VAR active sur ce match.";
    }
  }
  if (params.type === "espion") {
    if (await hasActiveEffect(params.playedByUserId, "spy")) return "Tu as déjà un Espion actif.";
  }
  return null;
}

async function applyJoker(admin: Admin, params: PlayParams): Promise<PlayResult> {
  const def = JOKER_CATALOG[params.type];
  const now = new Date();
  const endsAt = def.durationHours ? new Date(now.getTime() + def.durationHours * 60 * 60 * 1000) : null;

  // Noms pour les messages publics
  const [playerName, targetName] = await Promise.all([
    displayName(admin, params.playedByUserId),
    params.targetUserId ? displayName(admin, params.targetUserId) : Promise.resolve(null),
  ]);

  const metadata: Record<string, unknown> = {};
  let publicMessage = "";
  let playStatus = "consumed";
  let effect: { type: JokerEffectType; affected: string; endsAt: Date | null } | null = null;
  const data: Record<string, unknown> = {};

  switch (params.type) {
    case "casino": {
      // Coup de pouce aux derniers : on pondère le tirage selon la position au
      // classement individuel (lowness 0 = en tête, 1 = dernier). Import lazy
      // pour éviter tout cycle (teams n'importe pas ce module).
      let lowness = 0.5;
      try {
        const { getIndividualLeaderboard } = await import("@/lib/data/teams");
        const board = await getIndividualLeaderboard();
        const meRow = board.find((r) => r.user_id === params.playedByUserId);
        if (!meRow) lowness = 1; // pas encore classé → traité comme dernier
        else if (board.length > 1) lowness = (meRow.rank - 1) / (board.length - 1);
      } catch {
        /* fallback : pondération neutre (lowness 0.5) */
      }
      const delta = weightedPick(CASINO_OUTCOMES, casinoWeights(lowness));
      metadata.points_delta = delta;
      metadata.casino_lowness = Math.round(lowness * 100) / 100;
      data.points_delta = delta;
      publicMessage =
        delta >= 40
          ? `🎰💰 JACKPOT ! ${playerName} rafle +${delta} pts au Casino. Une légende est née.`
          : delta > 0
            ? `🎰 ${playerName} a tenté Casino : +${delta} pts. La maison perd parfois.`
            : delta === 0
              ? `🎰 ${playerName} a tenté Casino : 0 pt. Plus de peur que de mal.`
              : delta <= -25
                ? `🎰💀 RUINÉ ! ${playerName} explose au Casino : ${delta} pts. Détruit publiquement.`
                : `🎰 ${playerName} a tenté Casino : ${delta} pts. Robert recommande d'éviter les machines à sous.`;
      break;
    }
    case "quitte_ou_double": {
      // Résolu au settlement (services/scoring/settle.ts). On garde le play actif.
      playStatus = "active";
      metadata.match_id = params.matchId;
      publicMessage = `💥 ${playerName} joue Quitte ou Double sur un match. Score exact ou rien.`;
      break;
    }
    case "kamikaze": {
      // Résolu au settlement (services/scoring/settle.ts). Play actif jusque-là.
      // On mémorise la mise : score exact = +mult×mise, sinon −mise.
      playStatus = "active";
      metadata.match_id = params.matchId;
      metadata.stake = params.stake;
      publicMessage = `💣 ${playerName} mise ${params.stake} pts en Kamikaze sur un match — score EXACT ou rien. « Mais t'es fou ?! »`;
      break;
    }
    case "carton_rouge": {
      effect = { type: "red_card_block", affected: params.targetUserId!, endsAt: null };
      // Annule un éventuel prono déjà saisi par la cible sur ce match.
      if (params.matchId && params.targetUserId) {
        await admin
          .from("predictions")
          .delete()
          .eq("user_id", params.targetUserId)
          .eq("match_id", params.matchId);
      }
      publicMessage = `🚫 ${playerName} a joué Carton Rouge sur ${targetName}. Suspension pour ce match.`;
      break;
    }
    case "brouillard": {
      effect = { type: "fog", affected: params.targetUserId!, endsAt };
      publicMessage = `🌫 ${targetName} est dans le Brouillard${endsAt ? ` jusqu'à ${endsAt.toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}` : ""}.`;
      break;
    }
    case "retard_avion": {
      effect = { type: "flight_delay", affected: params.targetUserId!, endsAt };
      publicMessage = `✈️ ${targetName} a un Retard d'Avion : pronos verrouillés pendant 24 h.`;
      break;
    }
    case "espion": {
      effect = { type: "spy", affected: params.playedByUserId, endsAt };
      metadata.viewed_match_ids = [];
      publicMessage = `🕵️ ${playerName} a sorti l'Espion. Méfiance dans les rangs.`;
      break;
    }
    case "var": {
      effect = { type: "var_window", affected: params.playedByUserId, endsAt: null };
      publicMessage = `🎥 ${playerName} active la VAR : prono modifiable jusqu'à la mi-temps.`;
      break;
    }
  }

  // Insert play
  const { data: playRow, error: playErr } = await admin
    .from("joker_plays")
    .insert({
      joker_type: params.type,
      played_by_user_id: params.playedByUserId,
      target_user_id: params.targetUserId ?? null,
      match_id: params.matchId ?? null,
      status: playStatus,
      effect_starts_at: now.toISOString(),
      effect_ends_at: (effect?.endsAt ?? endsAt)?.toISOString() ?? null,
      metadata,
    })
    .select("*")
    .single();
  if (playErr || !playRow) return { ok: false, error: playErr?.message ?? "Échec de l'enregistrement." };

  // Insert effect (si applicable)
  if (effect) {
    await admin.from("joker_effects").insert({
      joker_play_id: playRow.id,
      affected_user_id: effect.affected,
      match_id: params.matchId ?? null,
      effect_type: effect.type,
      starts_at: now.toISOString(),
      ends_at: effect.endsAt?.toISOString() ?? null,
      status: "active",
      metadata: params.type === "espion" ? { viewed_match_ids: [] } : {},
    });
  }

  // Live feed (Canal Cup Live + TV chaos)
  await postJokerFeed(admin, publicMessage, playRow.id, params.playedByUserId, playerName);

  // 🚨 Notif NARRATIVE « un joker joué CONTRE toi » — uniquement si l'effet vise
  // QUELQU'UN D'AUTRE (jokers offensifs). Fire-and-forget, jamais bloquant.
  if (effect && effect.affected && effect.affected !== params.playedByUserId) {
    void (async () => {
      const { data: tu } = await admin.from("users").select("auth_id").eq("id", effect.affected).maybeSingle();
      if (!tu?.auth_id) return;
      const M: Record<string, { title: string; body: string }> = {
        red_card_block: { title: "🚨 Carton Rouge contre toi !", body: `${playerName} t'a suspendu sur un match. Aïe.` },
        fog: { title: "🌫 Brouillard sur toi", body: `${playerName} te masque les pronos des autres.` },
        flight_delay: { title: "✈️ Retard d'Avion", body: `${playerName} t'a bloqué la modif de tes pronos.` },
        var_window: { title: "🎥 VAR contre toi ?", body: `${playerName} a joué un joker qui te concerne.` },
      };
      const msg = M[effect.type] ?? { title: "🚨 Un joker joué contre toi", body: `${playerName} a utilisé un joker qui te vise.` };
      await sendPushToUser(tu.auth_id as string, { ...msg, url: "/jokers" });
    })().catch(() => {});
  }

  return { ok: true, play: playRow as JokerPlay, publicMessage, data };
}

async function displayName(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin
    .from("users")
    .select("display_name, name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name?.trim() || data?.name?.trim() || "Un joueur";
}

async function postJokerFeed(
  admin: Admin,
  body: string,
  playId: string,
  userId: string,
  displayNameStr: string
): Promise<void> {
  await admin
    .from("feed_posts")
    .insert({
      user_id: userId,
      display_name: displayNameStr,
      type: "joker",
      context_type: "joker_play",
      context_id: playId,
      body,
      status: "visible",
    })
    .then(() => {}, () => {});
}

// ── Espion : enregistre un match consulté (max 5) ────────────────────────────
export async function recordSpyView(
  userId: string,
  matchId: string
): Promise<{ ok: boolean; error?: string; remaining?: number }> {
  const admin = createAdminClient();
  const effect = await hasActiveEffect(userId, "spy");
  if (!effect) return { ok: false, error: "Aucun Espion actif." };
  const viewed = Array.isArray((effect.metadata as { viewed_match_ids?: string[] })?.viewed_match_ids)
    ? ((effect.metadata as { viewed_match_ids?: string[] }).viewed_match_ids as string[])
    : [];
  if (viewed.includes(matchId)) {
    return { ok: true, remaining: SPY_MAX_MATCHES - viewed.length };
  }
  if (viewed.length >= SPY_MAX_MATCHES) {
    return { ok: false, error: `Limite atteinte : ${SPY_MAX_MATCHES} matchs déjà consultés.` };
  }
  const next = [...viewed, matchId];
  await admin
    .from("joker_effects")
    .update({ metadata: { ...effect.metadata, viewed_match_ids: next } })
    .eq("id", effect.id);
  return { ok: true, remaining: SPY_MAX_MATCHES - next.length };
}

// ── Quitte ou Double : résolution au settlement d'un match ───────────────────
// Score exact = +25, bon vainqueur (résultat seul) = +20, raté = −10. Comme
// Kamikaze, on a besoin du score réel pour départager les 3 paliers, et on
// écrase les points du prono concerné (donc APRÈS le calcul de base).
export async function resolveQuitteOuDoubleForMatch(
  admin: Admin,
  matchId: string,
  scoreA: number,
  scoreB: number
): Promise<void> {
  const { data: plays } = await admin
    .from("joker_plays")
    .select("id, played_by_user_id")
    .eq("joker_type", "quitte_ou_double")
    .eq("match_id", matchId)
    .eq("status", "active");
  if (!plays?.length) return;

  const { QUITTE_OU_DOUBLE_EXACT, QUITTE_OU_DOUBLE_RESULT, QUITTE_OU_DOUBLE_WRONG } = await import("@/lib/jokers/catalog");
  const sign = (a: number, b: number) => (a > b ? 1 : a < b ? -1 : 0);
  const actualSign = sign(scoreA, scoreB);

  for (const play of plays) {
    const { data: pred } = await admin
      .from("predictions")
      .select("id, predicted_score_a, predicted_score_b")
      .eq("user_id", play.played_by_user_id)
      .eq("match_id", matchId)
      .maybeSingle();

    let tier: "exact" | "result" | "wrong" | "no_pred";
    let override: number | null = null;
    if (!pred || pred.predicted_score_a == null || pred.predicted_score_b == null) {
      tier = "no_pred"; // pas de prono valide → consommé sans note ni pénalité
    } else {
      const exact = pred.predicted_score_a === scoreA && pred.predicted_score_b === scoreB;
      const goodResult = sign(pred.predicted_score_a, pred.predicted_score_b) === actualSign;
      override = exact ? QUITTE_OU_DOUBLE_EXACT : goodResult ? QUITTE_OU_DOUBLE_RESULT : QUITTE_OU_DOUBLE_WRONG;
      tier = exact ? "exact" : goodResult ? "result" : "wrong";
      await admin.from("predictions").update({ points_awarded: override }).eq("id", pred.id);
    }

    await admin
      .from("joker_plays")
      .update({ status: "consumed", metadata: { resolved: true, points: override, tier } })
      .eq("id", play.id);

    const name = await displayName(admin, play.played_by_user_id);
    const msg =
      tier === "exact"
        ? `💥🎯 ${name} rafle le Quitte ou Double : score exact, +${QUITTE_OU_DOUBLE_EXACT} pts !`
        : tier === "result"
          ? `💥 ${name} assure le Quitte ou Double (bon vainqueur) : +${QUITTE_OU_DOUBLE_RESULT} pts.`
          : tier === "wrong"
            ? `💥💀 ${name} se plante au Quitte ou Double : ${QUITTE_OU_DOUBLE_WRONG} pts.`
            : `💥 ${name} avait un Quitte ou Double sans pronostic valide : sans effet.`;
    await postJokerFeed(admin, msg, play.id, play.played_by_user_id, name);
  }
}

// ── Kamikaze : résolution au settlement d'un match ───────────────────────────
// Pari à mise variable : score EXACT = +mult×mise, sinon le joueur perd sa mise
// (−mise). Écrase les points du prono concerné (comme Quitte ou Double) et poste
// le résultat dans le feed.
export async function resolveKamikazeForMatch(
  admin: Admin,
  matchId: string,
  scoreA: number,
  scoreB: number
): Promise<void> {
  const { data: plays } = await admin
    .from("joker_plays")
    .select("id, played_by_user_id, metadata")
    .eq("joker_type", "kamikaze")
    .eq("match_id", matchId)
    .eq("status", "active");
  if (!plays?.length) return;

  const { KAMIKAZE_WIN_MULTIPLIER, KAMIKAZE_MAX_STAKE } = await import("@/lib/jokers/catalog");

  for (const play of plays) {
    // Mise mémorisée au moment de jouer ; on borne par sécurité.
    const rawStake = Number((play.metadata as { stake?: unknown } | null)?.stake);
    const stake = Number.isFinite(rawStake) ? Math.max(1, Math.min(KAMIKAZE_MAX_STAKE, Math.round(rawStake))) : 0;

    const { data: pred } = await admin
      .from("predictions")
      .select("id, predicted_score_a, predicted_score_b")
      .eq("user_id", play.played_by_user_id)
      .eq("match_id", matchId)
      .maybeSingle();

    let tier: "exact" | "miss" | "no_pred";
    let override: number | null = null;
    if (!pred || pred.predicted_score_a == null || pred.predicted_score_b == null || stake <= 0) {
      tier = "no_pred"; // pas de prono/mise valide → consommé sans note ni pénalité
    } else {
      const exact = pred.predicted_score_a === scoreA && pred.predicted_score_b === scoreB;
      override = exact ? KAMIKAZE_WIN_MULTIPLIER * stake : -stake;
      tier = exact ? "exact" : "miss";
      await admin.from("predictions").update({ points_awarded: override }).eq("id", pred.id);
    }

    await admin
      .from("joker_plays")
      .update({ status: "consumed", metadata: { ...(play.metadata as object), resolved: true, points: override, tier, stake } })
      .eq("id", play.id);

    const name = await displayName(admin, play.played_by_user_id);
    const msg =
      tier === "exact"
        ? `💣🎯 ${name} a fait EXPLOSER le Kamikaze : score exact, mise ${stake} → +${override} pts !`
        : tier === "miss"
          ? `💣💀 ${name} s'est crashé au Kamikaze : ${override} pts (mise ${stake} perdue).`
          : `💣 ${name} avait un Kamikaze sans pronostic/mise valide : sans effet.`;
    await postJokerFeed(admin, msg, play.id, play.played_by_user_id, name);
  }
}
