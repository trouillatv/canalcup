// GET /api/admin/quiz/export?type=detail|summary — export CSV auditable du quiz.
//
//  - detail  : 1 ligne par (session × joueur × question), Live ET Solo, y compris
//              les questions NON répondues (0 pt) → audit question par question.
//  - summary : 1 ligne par joueur (bilan + points réels + point global capé à 50).
//
// Aucune donnée n'est recalculée : on relit quiz_answers via buildQuizAudit.
// Protégé admin (isAdminRequest). CSV UTF-8 (BOM) séparé par « ; » (Excel FR).

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth/admin";
import { buildQuizAudit, POINTS_TYPE_LABEL } from "@/lib/quiz/audit";

const SEP = ";";
const BOM = "﻿";

// Échappe un champ CSV : on entoure toujours de guillemets et on double les
// guillemets internes → robuste aux « ; », retours ligne et accents.
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}
function line(fields: unknown[]): string {
  return fields.map(cell).join(SEP);
}
function yn(b: boolean): string {
  return b ? "oui" : "non";
}
function secs(ms: number | null): string {
  return ms == null ? "" : (ms / 1000).toFixed(1).replace(".", ",");
}
function dateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = new URL(req.url).searchParams.get("type") === "summary" ? "summary" : "detail";
  const audit = await buildQuizAudit();

  let csv: string;
  let filename: string;

  if (type === "summary") {
    const header = [
      "display_name",
      "team_name",
      "questions_total",
      "questions_answered",
      "correct_count",
      "wrong_count",
      "no_answer_count",
      "fast_correct_count",
      "normal_correct_count",
      "solo_correct_count",
      "avg_response_time_ms",
      "avg_response_time_seconds",
      "fastest_ms",
      "best_streak",
      "raw_quiz_points",
      "championship_quiz_points",
      "quiz_rank",
      "participants_count",
      "global_quiz_points_weighted_by_rank",
    ];
    const body = audit.summaries.map((s) =>
      line([
        s.display_name,
        s.team_name,
        s.questions_total,
        s.questions_answered,
        s.correct_count,
        s.wrong_count,
        s.no_answer_count,
        s.fast_correct_count,
        s.normal_correct_count,
        s.solo_correct_count,
        s.avg_response_time_ms ?? "",
        secs(s.avg_response_time_ms),
        s.fastest_ms ?? "",
        s.best_streak,
        s.raw_quiz_points,
        s.championship_quiz_points,
        s.quiz_rank ?? "",
        s.participants_count,
        s.global_quiz_points,
      ])
    );
    csv = BOM + [line(header), ...body].join("\r\n");
    filename = "quiz-audit-resume.csv";
  } else {
    const header = [
      "quiz_session_id",
      "quiz_title",
      "quiz_date",
      "mode",
      "user_id",
      "display_name",
      "team_name",
      "question_index",
      "question_id",
      "question_text",
      "answer_a",
      "answer_b",
      "answer_c",
      "answer_d",
      "correct_answer",
      "user_answer",
      "is_correct",
      "answered",
      "response_time_ms",
      "response_time_seconds",
      "points_awarded_raw",
      "points_type",
      "points_type_label",
      "quiz_points_counted_for_championship",
      "was_speed_bonus",
      "was_solo",
      "solo_coefficient",
      "already_answered",
      "created_at",
    ];
    const body = audit.answers.map((r) =>
      line([
        r.quiz_session_id,
        r.quiz_title,
        dateOnly(r.quiz_date),
        r.mode,
        r.user_id,
        r.display_name,
        r.team_name,
        r.question_index,
        r.question_id,
        r.question_text,
        r.answer_a,
        r.answer_b,
        r.answer_c,
        r.answer_d,
        r.correct_answer,
        r.user_answer,
        yn(r.is_correct),
        yn(r.answered),
        r.response_time_ms ?? "",
        secs(r.response_time_ms),
        r.points_awarded_raw,
        r.points_type,
        POINTS_TYPE_LABEL[r.points_type],
        r.championship_points,
        yn(r.was_speed_bonus),
        yn(r.was_solo),
        r.solo_coefficient ?? "",
        yn(r.already_answered),
        r.created_at ?? "",
      ])
    );
    csv = BOM + [line(header), ...body].join("\r\n");
    filename = "quiz-audit-detail.csv";
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
