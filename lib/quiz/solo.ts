// Fenêtre du mode Solo — source unique partagée par /api/quiz/solo (état) et
// /api/quiz/solo/answer (enregistrement). Garantit que les deux routes ciblent
// EXACTEMENT la même session, ce qui rend le Reset multi-sessions sûr (les
// réponses Solo d'un quiz sont rattachées à CE quiz, pas au plus récent).
//
// Règles :
//   - aucun quiz lancé            → verrouillé (reason 'not_started')
//   - un quiz est EN DIRECT        → verrouillé (reason 'live_in_progress')
//   - le Live est terminé          → OUVERT, jusqu'à ended_at + soloOpenHours
//   - fenêtre dépassée             → verrouillé (reason 'window_closed')

import { createAdminClient } from "@/lib/supabase/admin";
import { QUIZ_CHAMPIONSHIP } from "@/lib/config/quiz-championship";

type Admin = ReturnType<typeof createAdminClient>;

export type SoloReason = "not_started" | "live_in_progress" | "window_closed" | null;

export interface SoloWindow {
  available: boolean;
  reason: SoloReason;
  /** Session ciblée par le Solo (la plus récente). */
  session: { id: string; status: string; ended_at: string | null } | null;
  /** Fermeture de la fenêtre (ISO) quand le Solo est ouvert. */
  closesAt: string | null;
}

export async function getSoloWindow(admin: Admin, now: number = Date.now()): Promise<SoloWindow> {
  const { data: session } = await admin
    .from("quiz_session")
    .select("id, status, ended_at, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return { available: false, reason: "not_started", session: null, closesAt: null };

  const s = { id: session.id as string, status: session.status as string, ended_at: (session.ended_at as string | null) ?? null };

  // Le Live n'est pas terminé → Solo verrouillé (anti-spoil des questions).
  if (s.status !== "finished") {
    return { available: false, reason: "live_in_progress", session: s, closesAt: null };
  }

  // Live terminé → fenêtre [ended_at, ended_at + soloOpenHours].
  const endedMs = s.ended_at ? new Date(s.ended_at).getTime() : null;
  const closeMs = endedMs != null ? endedMs + QUIZ_CHAMPIONSHIP.soloOpenHours * 3_600_000 : null;
  if (closeMs != null && now > closeMs) {
    return { available: false, reason: "window_closed", session: s, closesAt: new Date(closeMs).toISOString() };
  }
  return { available: true, reason: null, session: s, closesAt: closeMs != null ? new Date(closeMs).toISOString() : null };
}
