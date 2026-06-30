// POST /api/quiz/solo/answer — enregistre une réponse en mode SOLO.
//
// Score réduit (quizSoloPoints, pas de bonus rapidité → non triché en
// self-paced). Anti-rejeu : une question déjà répondue (Live OU Solo) ne
// rapporte rien. Rattaché à la session quiz la plus récente (cumul championnat).
// Le Solo dévoile la bonne réponse au joueur APRÈS sa réponse (un seul joueur).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { quizSoloPoints } from "@/lib/scoring";
import { getSoloWindow } from "@/lib/quiz/solo";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const question_id: unknown = body.question_id;
    const answer: string = typeof body.answer === "string" ? body.answer : "";
    const rawRt = Number(body.response_time_ms);
    const response_time_ms = Number.isFinite(rawRt) ? Math.max(0, Math.min(rawRt, 60_000)) : 0;
    if (typeof question_id !== "string" || !question_id) {
      return NextResponse.json({ ok: false, error: "question_id requis" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("users").select("id, team_id").eq("auth_id", user.id).single();
    if (!profile) return NextResponse.json({ ok: false, error: "Profil introuvable" }, { status: 404 });

    const admin = createAdminClient();

    // Verrou Solo : même fenêtre que /api/quiz/solo. On rattache la réponse à la
    // session CIBLÉE par le Solo (le Live terminé), pas au « plus récent » brut →
    // indispensable pour que le Reset d'un quiz ultérieur n'efface pas ce Solo.
    const win = await getSoloWindow(admin);
    if (!win.available || !win.session) {
      return NextResponse.json({ ok: false, error: "Le mode Solo n'est pas ouvert." }, { status: 400 });
    }
    const session = win.session;

    const { data: question } = await admin
      .from("quiz_questions")
      .select("correct_answer, explanation")
      .eq("id", question_id)
      .single();
    if (!question) return NextResponse.json({ ok: false, error: "Question introuvable" }, { status: 404 });

    // Anti-rejeu : déjà répondue (Live ou Solo) → on ne recompte pas.
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
        is_correct: answer === question.correct_answer,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        points: 0,
      });
    }

    const is_correct = answer !== "" && answer === question.correct_answer;
    const points = quizSoloPoints(is_correct);

    await admin.from("quiz_answers").insert({
      user_id: profile.id,
      team_id: profile.team_id ?? null,
      question_id,
      answer,
      is_correct,
      response_time_ms,
      points_awarded: points,
      quiz_session_id: session.id,
      mode: "solo",
    });

    return NextResponse.json(
      {
        ok: true,
        persisted: true,
        is_correct,
        points,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
