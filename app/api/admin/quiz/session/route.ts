// /api/admin/quiz/session — pilotage live show côté admin.
//  - POST { action: "start" }   → crée session, question 1, started_at=now
//  - POST { action: "next" }    → avance d'une question ; finished si plus
//  - POST { action: "end" }     → ended_at=now, status='finished'
//  - POST { action: "reset" }   → end active + DELETE ALL quiz_answers
//
// Toutes les opérations sont protégées par x-admin-secret.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function guard(req: Request): boolean {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

async function listQuestionIds(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from("quiz_questions")
    .select("id")
    .order("created_at", { ascending: true });
  return (data ?? []).map((q) => q.id as string);
}

async function endActiveSessions(supabase: ReturnType<typeof createAdminClient>) {
  await supabase
    .from("quiz_session")
    .update({ ended_at: new Date().toISOString(), status: "finished" })
    .is("ended_at", null);
}

export async function POST(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string };
  try { body = await req.json(); } catch { body = {}; }
  const action = body.action;
  if (!action || !["start", "next", "end", "reset"].includes(action)) {
    return NextResponse.json(
      { error: "action requise (start|next|end|reset)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (action === "start") {
    const ids = await listQuestionIds(supabase);
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Aucune question quiz en base." },
        { status: 400 }
      );
    }
    await endActiveSessions(supabase);
    const { data, error } = await supabase
      .from("quiz_session")
      .insert({
        current_question_id: ids[0],
        question_index: 0,
        started_at: new Date().toISOString(),
        status: "question",
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, session: data, total: ids.length });
  }

  if (action === "next") {
    const { data: session } = await supabase
      .from("quiz_session")
      .select("id, question_index")
      .is("ended_at", null)
      .maybeSingle();
    if (!session) {
      return NextResponse.json({ error: "Pas de session active." }, { status: 400 });
    }
    const ids = await listQuestionIds(supabase);
    const nextIndex = (session.question_index ?? 0) + 1;
    if (nextIndex >= ids.length) {
      // Fin du quiz.
      await supabase
        .from("quiz_session")
        .update({
          ended_at: new Date().toISOString(),
          status: "finished",
          current_question_id: null,
        })
        .eq("id", session.id);
      return NextResponse.json({ ok: true, finished: true });
    }
    const { data } = await supabase
      .from("quiz_session")
      .update({
        current_question_id: ids[nextIndex],
        question_index: nextIndex,
        started_at: new Date().toISOString(),
        status: "question",
      })
      .eq("id", session.id)
      .select("*")
      .single();
    return NextResponse.json({ ok: true, session: data, total: ids.length });
  }

  if (action === "end") {
    await endActiveSessions(supabase);
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    // 1. Termine toutes les sessions actives.
    await endActiveSessions(supabase);
    // 2. Efface TOUTES les réponses quiz (et donc tous les points quiz au
    //    classement, qui recompute via computeTeamScores).
    const { error } = await supabase.from("quiz_answers").delete().not("id", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action inconnue" }, { status: 400 });
}
