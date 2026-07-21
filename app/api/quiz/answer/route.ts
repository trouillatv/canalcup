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
import { competitionLock } from "@/lib/event/status";

export async function POST(req: Request) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
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
      .select("id, current_question_id, started_at, status, question_index")
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
    // Barème stocké tel quel ; le plafond de 60 questions/joueur est appliqué au recompute/lecture.
    const points = timedOut || tooFast ? 0 : quizPoints(is_correct, response_time_ms);

    // Quiz = individuel : on persiste même sans équipe (team_id null). Le score
    // compte au classement individuel, sans créditer d'équipe.

    // Modification autorisée TANT QUE LE CHRONO TOURNE : si une réponse existe
    // déjà, on la MET À JOUR (nouveau choix, temps recalculé). Deux garde-fous :
    //  - un timeout "" ne doit jamais écraser une réponse déjà donnée ;
    //  - une fois le temps écoulé, la réponse enregistrée est DÉFINITIVE.
    // ⚠️ On utilise le client ADMIN (bypass RLS) pour lire/écrire quiz_answers :
    // sinon la recherche de la réponse existante peut ne pas « voir » la ligne du
    // joueur → la modification créait une 2e ligne au lieu de remplacer la 1re,
    // et la répartition comptait l'ancienne réponse.
    const { data: existingRow } = await admin
      .from("quiz_answers")
      .select("id")
      .eq("user_id", profile.id)
      .eq("question_id", question_id)
      .maybeSingle();

    if (existingRow) {
      if (isTimeoutAnswer || timedOut) {
        return NextResponse.json({
          ok: true,
          persisted: false,
          alreadyAnswered: true,
          locked: timedOut,
          is_correct,
          points,
        });
      }
      // Chrono en cours + nouveau choix → on remplace.
      await admin
        .from("quiz_answers")
        .update({ answer, is_correct, response_time_ms, points_awarded: points })
        .eq("id", existingRow.id);
      return NextResponse.json(
        { ok: true, persisted: true, updated: true, is_correct, points, response_time_ms },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    await admin.from("quiz_answers").insert({
      user_id: profile.id,
      team_id: profile.team_id ?? null,
      question_id,
      answer,
      is_correct,
      response_time_ms,
      points_awarded: points,
      quiz_session_id: session.id,
      mode: "live",
    });

    return NextResponse.json(
      { ok: true, persisted: true, is_correct, points, response_time_ms },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
