// POST /api/quiz/answer → enregistre une réponse de quiz dans quiz_answers.
// Le serveur fait autorité : il relit la bonne réponse en base et recalcule
// is_correct + points (jamais de confiance au client). Une seule prise en
// compte par question/joueur — rejouer ne refarme pas de points au classement.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { quizPoints, QUIZ_TIMER_SECONDS } from "@/lib/scoring";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const question_id: unknown = body.question_id;
    const answer: string = typeof body.answer === "string" ? body.answer : "";
    const rawRt: unknown = body.response_time_ms;
    if (typeof question_id !== "string" || !question_id) {
      return NextResponse.json({ ok: false, error: "question_id requis" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id, team_id")
      .eq("auth_id", user.id)
      .single();
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Profil introuvable" }, { status: 404 });
    }

    const { data: question } = await supabase
      .from("quiz_questions")
      .select("correct_answer")
      .eq("id", question_id)
      .single();
    if (!question) {
      return NextResponse.json({ ok: false, error: "Question introuvable" }, { status: 404 });
    }

    const response_time_ms =
      typeof rawRt === "number" && Number.isFinite(rawRt)
        ? Math.max(0, Math.round(rawRt))
        : QUIZ_TIMER_SECONDS * 1000;
    const is_correct = answer !== "" && answer === question.correct_answer;
    const points = quizPoints(is_correct, response_time_ms);

    // Joueur sans équipe : on le laisse jouer mais rien n'est compté au classement.
    if (!profile.team_id) {
      return NextResponse.json({ ok: true, persisted: false, is_correct, points });
    }

    // Anti-farming : si la question a déjà été répondue, on ne réinsère rien.
    const { count: existing } = await supabase
      .from("quiz_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("question_id", question_id);
    if ((existing ?? 0) > 0) {
      return NextResponse.json({
        ok: true,
        persisted: false,
        alreadyAnswered: true,
        is_correct,
        points,
      });
    }

    await supabase.from("quiz_answers").insert({
      user_id: profile.id,
      team_id: profile.team_id,
      question_id,
      answer,
      is_correct,
      response_time_ms,
      points_awarded: points,
    });

    return NextResponse.json(
      { ok: true, persisted: true, is_correct, points },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
