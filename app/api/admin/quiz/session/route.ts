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
import { advanceQuizSession, futureStartedAt, listQuestionIds } from "@/lib/quiz/session";

async function guard(req: Request): Promise<boolean> {
  return await isAdminRequest(req);
}

const ACTIONS = ["start", "pause", "resume", "next", "end", "reset"] as const;

export async function POST(req: Request) {
  if (!(await guard(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string };
  try { body = await req.json(); } catch { body = {}; }
  const action = body.action;
  if (!action || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return NextResponse.json(
      { error: `action requise (${ACTIONS.join("|")})` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (action === "start") {
    const ids = await listQuestionIds(supabase);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Aucune question quiz en base." }, { status: 400 });
    }
    await supabase
      .from("quiz_session")
      .update({ ended_at: new Date().toISOString(), status: "finished" })
      .is("ended_at", null);
    const { data, error } = await supabase
      .from("quiz_session")
      .insert({
        current_question_id: ids[0],
        question_index: 0,
        started_at: futureStartedAt(),
        status: "question",
        stage: "question",
        paused_at: null,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, session: data, total: ids.length });
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
