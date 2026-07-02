// /api/admin/quiz/session — pilotage live show côté organisateur (Vincent).
//
// Le rythme s'enchaîne TOUT SEUL (cf. /api/quiz/session) : l'organisateur ne
// clique plus à chaque étape. Sa seule commande de rythme est PAUSE / REPRENDRE.
//
//  - POST { action: "start" }   → crée session, question 1 (countdown)
//  - POST { action: "pause" }   → fige le quiz (l'organisateur commente / attend)
//  - POST { action: "resume" }  → reprend exactement où on s'était arrêté
//  - POST { action: "next" }    → saute à la question suivante (filet de secours)
//  - POST { action: "end" }     → ended_at=now, status='finished' (grand reveal)
//  - POST { action: "reset" }   → end active + DELETE ALL quiz_answers
//
// Toutes les opérations sont protégées par x-admin-secret (cf. /quiz-control).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";
import { advanceQuizSession, futureStartedAt, listQuestionIds, pickRandomQuestionIds } from "@/lib/quiz/session";
import { isLiveOpen, QUIZ_CHAMPIONSHIP } from "@/lib/config/quiz-championship";
import { QUIZ_LIVE_QUESTION_COUNT } from "@/lib/scoring";

// La télécommande /quiz-control s'authentifie par le PIN TV (qu'elle a déjà pour
// l'accès), envoyé dans l'en-tête x-tv-pin. On l'accepte pour les commandes de
// RYTHME (start/pause/resume/next/end) → n'importe quel organisateur avec le PIN
// peut lancer/piloter, sans être admin global. Le reset (destructif) reste admin.
function tvPinOk(req: Request): boolean {
  const expected = process.env.TV_PIN ?? "";
  if (!expected) return true; // dev sans PIN configuré
  return (req.headers.get("x-tv-pin") ?? "") === expected;
}

async function guard(req: Request, action: string): Promise<boolean> {
  if (await isAdminRequest(req)) return true;
  if (action === "reset") return false; // destructif → réservé aux vrais admins
  return tvPinOk(req);
}

const ACTIONS = ["start", "pause", "resume", "next", "end", "reset", "extend"] as const;

export async function POST(req: Request) {
  let body: { action?: string; force?: boolean; count?: number };
  try { body = await req.json(); } catch { body = {}; }
  const action = body.action;
  if (!action || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return NextResponse.json(
      { error: `action requise (${ACTIONS.join("|")})` },
      { status: 400 }
    );
  }
  if (!(await guard(req, action))) {
    return NextResponse.json({ error: "Non autorisé (PIN ou compte admin requis)." }, { status: 401 });
  }

  const supabase = createAdminClient();

  if (action === "start") {
    // 🔒 Verrou d'ouverture : impossible de démarrer le Live avant l'heure
    // officielle (vendredi 3 juillet 11h30, heure NC). `force: true` permet une
    // répétition volontaire de l'organisateur.
    if (!isLiveOpen() && body.force !== true) {
      return NextResponse.json(
        { error: `🔒 Le Quiz Live ouvre le ${QUIZ_CHAMPIONSHIP.liveOpenLabel}. Démarrage impossible avant.` },
        { status: 403 }
      );
    }
    // Tirage aléatoire d'un sous-ensemble (60 par défaut) — on ne pose pas TOUTES
    // les questions, et l'ordre change à chaque quiz.
    const chosen = await pickRandomQuestionIds(supabase, QUIZ_LIVE_QUESTION_COUNT);
    if (chosen.length === 0) {
      return NextResponse.json({ error: "Aucune question quiz en base." }, { status: 400 });
    }
    await supabase
      .from("quiz_session")
      .update({ ended_at: new Date().toISOString(), status: "finished" })
      .is("ended_at", null);
    const { data, error } = await supabase
      .from("quiz_session")
      .insert({
        current_question_id: chosen[0],
        question_index: 0,
        question_ids: chosen,
        started_at: futureStartedAt(),
        status: "question",
        stage: "question",
        paused_at: null,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, session: data, total: chosen.length });
  }

  // ➕ Ajouter N questions à la session en cours (l'organisateur prolonge le quiz).
  // On pioche parmi les questions PAS encore dans la liste (pas de doublon).
  if (action === "extend") {
    const n = Math.max(1, Math.min(50, Math.round(body.count ?? 10)));
    const { data: session } = await supabase
      .from("quiz_session")
      .select("id, question_ids")
      .is("ended_at", null)
      .maybeSingle();
    if (!session) return NextResponse.json({ error: "Pas de session active." }, { status: 400 });
    const current = (session.question_ids as string[] | null) ?? (await listQuestionIds(supabase));
    const used = new Set(current);
    const pool = (await listQuestionIds(supabase)).filter((id) => !used.has(id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const added = pool.slice(0, n);
    if (!added.length) {
      return NextResponse.json({ ok: true, added: 0, total: current.length, note: "Plus de question disponible." });
    }
    const next = [...current, ...added];
    await supabase.from("quiz_session").update({ question_ids: next }).eq("id", session.id);
    return NextResponse.json({ ok: true, added: added.length, total: next.length });
  }

  if (action === "end") {
    await supabase
      .from("quiz_session")
      .update({ ended_at: new Date().toISOString(), status: "finished" })
      .is("ended_at", null);
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    // Championnat : on NE vide PLUS tout l'historique — seulement les réponses
    // de la session la plus récente (la session de test/en cours). Le cumul des
    // quiz précédents est préservé.
    const { data: recent } = await supabase
      .from("quiz_session")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await supabase
      .from("quiz_session")
      .update({ ended_at: new Date().toISOString(), status: "finished" })
      .is("ended_at", null);
    if (recent?.id) {
      const { error } = await supabase
        .from("quiz_answers")
        .delete()
        .eq("quiz_session_id", recent.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // pause / resume / next : on a besoin de la session active.
  const { data: session } = await supabase
    .from("quiz_session")
    .select("id, question_index, current_question_id, started_at, paused_at")
    .is("ended_at", null)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "Pas de session active." }, { status: 400 });
  }

  if (action === "pause") {
    if (session.paused_at) return NextResponse.json({ ok: true, paused: true }); // déjà en pause
    const { data } = await supabase
      .from("quiz_session")
      .update({ paused_at: new Date().toISOString() })
      .eq("id", session.id)
      .select("*")
      .single();
    return NextResponse.json({ ok: true, paused: true, session: data });
  }

  if (action === "resume") {
    if (!session.paused_at) return NextResponse.json({ ok: true, paused: false }); // pas en pause
    // On décale started_at de la durée de pause → le chrono reprend pile où il
    // s'était figé (le reste du cycle, time-derived, suit automatiquement).
    const pausedMs = Date.now() - new Date(session.paused_at).getTime();
    const newStarted = new Date(new Date(session.started_at).getTime() + pausedMs).toISOString();
    const { data } = await supabase
      .from("quiz_session")
      .update({ started_at: newStarted, paused_at: null })
      .eq("id", session.id)
      .select("*")
      .single();
    return NextResponse.json({ ok: true, paused: false, session: data });
  }

  // next = saut direct à la question suivante (filet de secours organisateur).
  const r = await advanceQuizSession(
    supabase,
    session.id,
    session.question_index ?? 0,
    session.current_question_id ?? null
  );
  return NextResponse.json({ ok: true, ...r });
}
