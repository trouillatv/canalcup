// POST /api/quiz/answer → enregistre une réponse de quiz dans quiz_answers.
// Live show : le serveur fait autorité. Il :
//  - vérifie qu'une session quiz est ACTIVE (sinon refuse).
//  - vérifie que question_id == session.current_question_id (sinon refuse).
//  - calcule response_time_ms = now - session.started_at côté SERVEUR
//    (anti-triche : le client ne peut pas mentir sur sa rapidité).
//  - clamp : si > QUIZ_TIMER_SECONDS, points forcés à 0 (timeout).
// Une seule prise en compte par question/joueur — rejouer ne refarme pas.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { quizPoints, QUIZ_TIMER_SECONDS, QUIZ_MIN_RESPONSE_MS } from "@/lib/scoring";

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

    // Anti-triche : on récupère la session active + on calcule le temps
    // côté serveur. Le response_time_ms du client est ignoré.
    const admin = createAdminClient();
    const { data: session } = await admin
      .from("quiz_session")
      .select("id, current_question_id, started_at, status")
      .is("ended_at", null)
      .maybeSingle();

    if (!session || session.status !== "question") {
      return NextResponse.json(
        { ok: false, error: "Aucune session quiz active." },
        { status: 400 }
      );
    }
    if (session.current_question_id !== question_id) {
      return NextResponse.json(
        { ok: false, error: "Cette question n'est plus la question active." },
        { status: 400 }
      );
    }

    const startedAt = new Date(session.started_at).getTime();
    const nowMs = Date.now();
    const rawElapsed = nowMs - startedAt; // peut être NÉGATIF pendant le countdown
    const isTimeoutAnswer = answer === "";

    // Anti-précharge : refuse les réponses arrivées avant started_at
    // (countdown encore en cours côté joueur).
    if (rawElapsed < 0 && !isTimeoutAnswer) {
      return NextResponse.json(
        { ok: false, error: "Le compte à rebours n'est pas terminé." },
        { status: 400 }
      );
    }

    // Anti-bot / anti-clic instantané : un humain ne peut pas lire +
    // cliquer en moins de QUIZ_MIN_RESPONSE_MS. On accepte la réponse
    // (UX : pas d'erreur visible) mais on l'enregistre avec 0 pt.
    const tooFast = rawElapsed >= 0 && rawElapsed < QUIZ_MIN_RESPONSE_MS && !isTimeoutAnswer;

    const elapsedMs = Math.max(0, rawElapsed);
    // Petite tolérance : +500ms pour absorber la latence réseau
    // (sinon un click à 19.9s pourrait arriver à 20.1s côté serveur).
    const TIMEOUT_MS = QUIZ_TIMER_SECONDS * 1000 + 500;
    const timedOut = elapsedMs > TIMEOUT_MS;
    const response_time_ms = Math.min(elapsedMs, QUIZ_TIMER_SECONDS * 1000);
    void rawRt; // ignore le client (anti-triche)

    const is_correct = !isTimeoutAnswer && answer === question.correct_answer;
    const points = timedOut || tooFast ? 0 : quizPoints(is_correct, response_time_ms);

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
