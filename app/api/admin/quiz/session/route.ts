// /api/admin/quiz/session — pilotage live show côté admin / présentateur.
//  - POST { action: "start" }   → crée session, question 1 (stage=question)
//  - POST { action: "advance" } → fait AVANCER le rythme (présentateur Marie) :
//        question → stats → answer → leaderboard → question suivante
//  - POST { action: "next" }    → saute directement à la question suivante
//  - POST { action: "end" }     → ended_at=now, status='finished'
//  - POST { action: "reset" }   → end active + DELETE ALL quiz_answers
//
// Toutes les opérations sont protégées par x-admin-secret (cf. /quiz-control).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUIZ_COUNTDOWN_MS } from "@/lib/scoring";
import { isAdminRequest } from "@/lib/auth/admin";

type Supa = ReturnType<typeof createAdminClient>;

// started_at posé dans le FUTUR (now + countdown) → compte à rebours visible +
// l'API answer refuse toute réponse avant. Anti-précharge du doigt.
function futureStartedAt(): string {
  return new Date(Date.now() + QUIZ_COUNTDOWN_MS).toISOString();
}

async function guard(req: Request): Promise<boolean> {
  return await isAdminRequest(req);
}

async function listQuestionIds(supabase: Supa) {
  const { data } = await supabase
    .from("quiz_questions")
    .select("id")
    .order("created_at", { ascending: true });
  return (data ?? []).map((q) => q.id as string);
}

async function endActiveSessions(supabase: Supa) {
  await supabase
    .from("quiz_session")
    .update({ ended_at: new Date().toISOString(), status: "finished" })
    .is("ended_at", null);
}

// Passe à la question suivante (ou termine le quiz). Remet stage='question'.
async function goToNextQuestion(
  supabase: Supa,
  sessionId: string,
  currentIndex: number
): Promise<{ finished?: boolean; session?: unknown; total: number }> {
  const ids = await listQuestionIds(supabase);
  const nextIndex = currentIndex + 1;
  if (nextIndex >= ids.length) {
    await supabase
      .from("quiz_session")
      .update({ ended_at: new Date().toISOString(), status: "finished", current_question_id: null })
      .eq("id", sessionId);
    return { finished: true, total: ids.length };
  }
  const { data } = await supabase
    .from("quiz_session")
    .update({
      current_question_id: ids[nextIndex],
      question_index: nextIndex,
      started_at: futureStartedAt(),
      status: "question",
      stage: "question",
    })
    .eq("id", sessionId)
    .select("*")
    .single();
  return { session: data, total: ids.length };
}

export async function POST(req: Request) {
  if (!(await guard(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string };
  try { body = await req.json(); } catch { body = {}; }
  const action = body.action;
  if (!action || !["start", "advance", "next", "end", "reset"].includes(action)) {
    return NextResponse.json(
      { error: "action requise (start|advance|next|end|reset)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (action === "start") {
    const ids = await listQuestionIds(supabase);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Aucune question quiz en base." }, { status: 400 });
    }
    await endActiveSessions(supabase);
    const { data, error } = await supabase
      .from("quiz_session")
      .insert({
        current_question_id: ids[0],
        question_index: 0,
        started_at: futureStartedAt(),
        status: "question",
        stage: "question",
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, session: data, total: ids.length });
  }

  // advance / next : on a besoin de la session active.
  if (action === "advance" || action === "next") {
    const { data: session } = await supabase
      .from("quiz_session")
      .select("id, question_index, stage")
      .is("ended_at", null)
      .maybeSingle();
    if (!session) {
      return NextResponse.json({ error: "Pas de session active." }, { status: 400 });
    }

    // next = saut direct à la question suivante (fallback admin).
    if (action === "next") {
      const r = await goToNextQuestion(supabase, session.id, session.question_index ?? 0);
      return NextResponse.json({ ok: true, ...r });
    }

    // advance = rythme présentateur : question → stats → answer → leaderboard → next
    const stage = (session.stage as string) ?? "question";
    const nextStage: Record<string, string> = {
      question: "stats",
      stats: "answer",
      answer: "leaderboard",
    };
    if (stage in nextStage) {
      const { data } = await supabase
        .from("quiz_session")
        .update({ stage: nextStage[stage] })
        .eq("id", session.id)
        .select("*")
        .single();
      return NextResponse.json({ ok: true, session: data, stage: nextStage[stage] });
    }
    // stage === 'leaderboard' → question suivante.
    const r = await goToNextQuestion(supabase, session.id, session.question_index ?? 0);
    return NextResponse.json({ ok: true, ...r });
  }

  if (action === "end") {
    await endActiveSessions(supabase);
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    await endActiveSessions(supabase);
    const { error } = await supabase.from("quiz_answers").delete().not("id", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action inconnue" }, { status: 400 });
}
