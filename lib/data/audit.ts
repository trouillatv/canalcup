// ─────────────────────────────────────────────────────────────────────────────
//  AUDIT UTILISATEURS — Phase 1 (100% données existantes, AUCUNE nouvelle table)
//
//  RGPD : ce n'est PAS un outil de surveillance RH. On n'expose ni temps passé,
//  ni productivité, ni comportement intrusif. Uniquement des compteurs et dates
//  utiles à la sécurité (qui est actif/bloqué), au support (qui est coincé) et à
//  l'animation (qui participe).
//
//  Tout est agrégé en mémoire depuis les tables de scoring/participation qui
//  portent déjà un user_id. "Dernière action" = MAX(created_at) sur ces tables
//  (on n'a pas d'historique de connexions → cf. Phase 2 user_activity_logs).
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";
import { SCORE_EVENT_CATEGORIES_IN_TOTAL } from "@/lib/scoring/config";
import type { UserRole } from "@/lib/supabase/types";

export type OnboardingStatus = "ok" | "incomplete" | "waiting_team";

export interface AuditUserRow {
  user_id: string | null; // users.id (null = invité jamais connecté)
  email: string;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  profile_completed: boolean;
  service_name: string | null;
  team_name: string | null;
  account_created_at: string | null;
  last_login_at: string | null;
  last_action_at: string | null;
  predictions: number;
  quiz: number;
  animations: number;
  votes: number;
  points_total: number;
  onboarding: OnboardingStatus;
  pending_team_name: string | null;
}

export interface AuditSummary {
  total_users: number;
  profiles_completed: number;
  without_team: number;
  active_24h: number;
  active_7d: number;
  total_predictions: number;
  total_animations: number;
  blocked_onboarding: number;
  top_active_teams: { team_id: string; name: string; active_members: number }[];
}

export interface AuditListResult {
  summary: AuditSummary;
  users: AuditUserRow[];
}

const DAY = 24 * 60 * 60 * 1000;

type AlRow = { email: string; role: UserRole; is_active: boolean; created_at: string };
type UserRow = {
  id: string; email: string; display_name: string | null; name: string | null;
  service_id: string | null; team_id: string | null; profile_completed: boolean | null;
  last_login_at: string | null; created_at: string | null;
};
type PtRow = { user_id: string | null; points_awarded: number | null; created_at: string | null };
type EntryRow = { id: string; user_id: string | null; created_at: string | null };
type PartRow = { entry_id: string; user_id: string | null; created_at: string | null };
type VoteRow = { voter_user_id: string | null; created_at: string | null };
type EvRow = { user_id: string | null; category: string | null; raw_points: number | null; created_at: string | null };
type ReqRow = { user_id: string | null; team_id: string | null; status: string | null; created_at: string | null };

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** Liste d'audit + synthèse globale. Admin only (gating côté route). */
export async function getUserAuditList(): Promise<AuditListResult> {
  const admin = createAdminClient();
  const [
    { data: allowlist },
    { data: users },
    { data: services },
    { data: teams },
    { data: preds },
    { data: bonuses },
    { data: quizzes },
    { data: entries },
    { data: participants },
    { data: votes },
    { data: events },
    { data: joinReqs },
  ] = await Promise.all([
    admin.from("allowlist_users").select("email, role, is_active, created_at"),
    admin.from("users").select("id, email, display_name, name, service_id, team_id, profile_completed, last_login_at, created_at"),
    admin.from("services").select("id, name"),
    admin.from("teams").select("id, name"),
    admin.from("predictions").select("user_id, points_awarded, created_at"),
    admin.from("bonus_predictions").select("user_id, points_awarded, created_at"),
    admin.from("quiz_answers").select("user_id, points_awarded, created_at"),
    admin.from("challenge_entries").select("id, user_id, created_at"),
    admin.from("challenge_entry_participants").select("entry_id, user_id, created_at"),
    admin.from("votes").select("voter_user_id, created_at"),
    admin.from("score_events").select("user_id, category, raw_points, created_at"),
    admin.from("team_join_requests").select("user_id, team_id, status, created_at"),
  ]);

  const serviceName = new Map((services ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  const teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  const userByEmail = new Map<string, UserRow>();
  const userById = new Map<string, UserRow>();
  for (const u of (users ?? []) as UserRow[]) {
    userByEmail.set(u.email.toLowerCase(), u);
    userById.set(u.id, u);
  }

  // Agrégats par user_id.
  const predCount = new Map<string, number>();
  const quizCount = new Map<string, number>();
  const voteCount = new Map<string, number>();
  const points = new Map<string, number>();
  const lastAction = new Map<string, string | null>();
  const animEntryIds = new Map<string, Set<string>>(); // animations distinctes (auteur ∪ participant)

  const bump = (m: Map<string, number>, id: string | null, n = 1) => {
    if (!id) return;
    m.set(id, (m.get(id) ?? 0) + n);
  };
  const touch = (id: string | null, iso: string | null) => {
    if (!id) return;
    lastAction.set(id, maxIso(lastAction.get(id) ?? null, iso));
  };
  const allowed = new Set<string>(SCORE_EVENT_CATEGORIES_IN_TOTAL);

  for (const r of (preds ?? []) as PtRow[]) { bump(predCount, r.user_id); bump(points, r.user_id, r.points_awarded ?? 0); touch(r.user_id, r.created_at); }
  for (const r of (bonuses ?? []) as PtRow[]) { bump(points, r.user_id, r.points_awarded ?? 0); touch(r.user_id, r.created_at); }
  for (const r of (quizzes ?? []) as PtRow[]) { bump(quizCount, r.user_id); bump(points, r.user_id, r.points_awarded ?? 0); touch(r.user_id, r.created_at); }
  for (const r of (votes ?? []) as VoteRow[]) { bump(voteCount, r.voter_user_id); touch(r.voter_user_id, r.created_at); }
  for (const e of (events ?? []) as EvRow[]) {
    if (e.category && allowed.has(e.category)) bump(points, e.user_id, e.raw_points ?? 0);
    touch(e.user_id, e.created_at);
  }
  const addAnim = (uid: string | null, entryId: string, iso: string | null) => {
    if (!uid) return;
    if (!animEntryIds.has(uid)) animEntryIds.set(uid, new Set());
    animEntryIds.get(uid)!.add(entryId);
    touch(uid, iso);
  };
  for (const e of (entries ?? []) as EntryRow[]) addAnim(e.user_id, e.id, e.created_at);
  for (const p of (participants ?? []) as PartRow[]) addAnim(p.user_id, p.entry_id, p.created_at);

  // Demandes d'équipe en attente, par user.
  const pendingReqTeam = new Map<string, string | null>();
  for (const r of (joinReqs ?? []) as ReqRow[]) {
    if (r.status === "pending" && r.user_id) {
      pendingReqTeam.set(r.user_id, r.team_id ? teamName.get(r.team_id) ?? null : null);
    }
  }

  // Construction des lignes (master = allowlist_users).
  const rows: AuditUserRow[] = ((allowlist ?? []) as AlRow[]).map((al) => {
    const u = userByEmail.get(al.email.toLowerCase());
    const uid = u?.id ?? null;
    const animations = uid ? animEntryIds.get(uid)?.size ?? 0 : 0;
    const pending = uid ? pendingReqTeam.get(uid) ?? null : null;
    const completed = u?.profile_completed ?? false;
    const onboarding: OnboardingStatus = pending
      ? "waiting_team"
      : completed
      ? "ok"
      : "incomplete";
    return {
      user_id: uid,
      email: al.email,
      display_name: u?.display_name ?? null,
      role: al.role,
      is_active: al.is_active,
      profile_completed: completed,
      service_name: u?.service_id ? serviceName.get(u.service_id) ?? null : null,
      team_name: u?.team_id ? teamName.get(u.team_id) ?? null : null,
      account_created_at: u?.created_at ?? al.created_at ?? null,
      last_login_at: u?.last_login_at ?? null,
      last_action_at: uid ? lastAction.get(uid) ?? null : null,
      predictions: uid ? predCount.get(uid) ?? 0 : 0,
      quiz: uid ? quizCount.get(uid) ?? 0 : 0,
      animations,
      votes: uid ? voteCount.get(uid) ?? 0 : 0,
      points_total: uid ? Math.round(points.get(uid) ?? 0) : 0,
      onboarding,
      pending_team_name: pending,
    };
  });

  // ─── Synthèse globale ──────────────────────────────────────────────────────
  const now = Date.now();
  const activityIso = (r: AuditUserRow) => maxIso(r.last_login_at, r.last_action_at);
  const within = (r: AuditUserRow, ms: number) => {
    const iso = activityIso(r);
    return iso ? now - new Date(iso).getTime() <= ms : false;
  };

  // Équipes actives = nb de membres distincts avec activité < 7j.
  const teamActive = new Map<string, number>();
  for (const r of rows) {
    if (!r.user_id) continue;
    const u = userById.get(r.user_id);
    if (!u?.team_id) continue;
    if (within(r, 7 * DAY)) teamActive.set(u.team_id, (teamActive.get(u.team_id) ?? 0) + 1);
  }
  const top_active_teams = [...teamActive.entries()]
    .map(([team_id, active_members]) => ({ team_id, name: teamName.get(team_id) ?? "—", active_members }))
    .sort((a, b) => b.active_members - a.active_members)
    .slice(0, 5);

  const summary: AuditSummary = {
    total_users: rows.length,
    profiles_completed: rows.filter((r) => r.profile_completed).length,
    without_team: rows.filter((r) => r.profile_completed && !r.team_name).length,
    active_24h: rows.filter((r) => within(r, DAY)).length,
    active_7d: rows.filter((r) => within(r, 7 * DAY)).length,
    total_predictions: (preds ?? []).length,
    total_animations: (entries ?? []).length,
    blocked_onboarding: rows.filter((r) => r.is_active && !r.profile_completed).length,
    top_active_teams,
  };

  // Tri par défaut : dernière activité décroissante (les plus actifs en haut).
  rows.sort((a, b) => {
    const ai = activityIso(a), bi = activityIso(b);
    if (ai && bi) return ai > bi ? -1 : ai < bi ? 1 : 0;
    if (ai) return -1;
    if (bi) return 1;
    return a.email.localeCompare(b.email);
  });

  return { summary, users: rows };
}

// ─── Détail d'un utilisateur ───────────────────────────────────────────────────

export interface AuditTimelineItem {
  type: string;
  label: string;
  created_at: string;
}

export interface AuditDetail {
  user_id: string;
  email: string;
  display_name: string | null;
  role: UserRole | null;
  is_active: boolean;
  profile_completed: boolean;
  service_name: string | null;
  team_name: string | null;
  account_created_at: string | null;
  last_login_at: string | null;
  onboarding: OnboardingStatus;
  points_by_category: { predictions: number; bonus: number; quiz: number; animations: number };
  recent_predictions: { id: string; label: string; result: string | null; score: string; points: number; created_at: string }[];
  recent_quiz: { id: string; question: string; is_correct: boolean; points: number; created_at: string }[];
  animations: { entry_id: string; title: string; status: string | null; created_at: string; role: "author" | "participant" }[];
  votes: { count: number; recent: { created_at: string; target_type: string | null }[] };
  team_requests: { team_name: string | null; status: string | null; created_at: string | null; decided_at: string | null }[];
  timeline: AuditTimelineItem[];
  admin_logs_available: boolean;
}

export async function getUserAuditDetail(userId: string): Promise<AuditDetail | null> {
  const admin = createAdminClient();
  const { data: user } = await admin
    .from("users")
    .select("id, email, display_name, name, service_id, team_id, profile_completed, last_login_at, created_at")
    .eq("id", userId)
    .single();
  if (!user) return null;
  const u = user as UserRow;

  const [
    { data: al },
    serviceRes,
    teamRes,
    { data: preds },
    { data: bonuses },
    { data: quizzes },
    { data: entries },
    { data: parts },
    { data: votes },
    { data: events },
    { data: reqs },
    { data: matches },
    { data: questions },
    { data: challenges },
    { data: allEntries },
    { data: teams },
  ] = await Promise.all([
    admin.from("allowlist_users").select("role, is_active").eq("email", u.email).maybeSingle(),
    u.service_id ? admin.from("services").select("name").eq("id", u.service_id).maybeSingle() : Promise.resolve({ data: null }),
    u.team_id ? admin.from("teams").select("name").eq("id", u.team_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("predictions").select("id, match_id, prediction_result, predicted_score_a, predicted_score_b, points_awarded, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("bonus_predictions").select("points_awarded, created_at").eq("user_id", userId),
    admin.from("quiz_answers").select("id, question_id, is_correct, points_awarded, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("challenge_entries").select("id, challenge_id, status, points_awarded, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("challenge_entry_participants").select("entry_id, created_at").eq("user_id", userId),
    admin.from("votes").select("target_type, created_at").eq("voter_user_id", userId).order("created_at", { ascending: false }),
    admin.from("score_events").select("category, raw_points").eq("user_id", userId),
    admin.from("team_join_requests").select("team_id, status, created_at, decided_at").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("matches").select("id, team_a, team_b"),
    admin.from("quiz_questions").select("id, question"),
    admin.from("challenges").select("id, title"),
    admin.from("challenge_entries").select("id, challenge_id"),
    admin.from("teams").select("id, name"),
  ]);

  const matchLabel = new Map((matches ?? []).map((m: { id: string; team_a: string; team_b: string }) => [m.id, `${m.team_a} – ${m.team_b}`]));
  const qLabel = new Map((questions ?? []).map((q: { id: string; question: string }) => [q.id, q.question]));
  const cTitle = new Map((challenges ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));
  const entryChallenge = new Map((allEntries ?? []).map((e: { id: string; challenge_id: string }) => [e.id, e.challenge_id]));
  const teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));

  const allowed = new Set<string>(SCORE_EVENT_CATEGORIES_IN_TOTAL);
  const sum = (rows: { points_awarded: number | null }[] | null) =>
    Math.round((rows ?? []).reduce((s, r) => s + (r.points_awarded ?? 0), 0));

  const points_by_category = {
    predictions: sum((preds ?? []) as { points_awarded: number | null }[]),
    bonus: sum((bonuses ?? []) as { points_awarded: number | null }[]),
    quiz: sum((quizzes ?? []) as { points_awarded: number | null }[]),
    animations: Math.round(
      ((events ?? []) as EvRow[])
        .filter((e) => e.category && allowed.has(e.category))
        .reduce((s, e) => s + (e.raw_points ?? 0), 0)
    ),
  };

  type PredFull = { id: string; match_id: string | null; prediction_result: string | null; predicted_score_a: number | null; predicted_score_b: number | null; points_awarded: number | null; created_at: string };
  const recent_predictions = ((preds ?? []) as PredFull[]).slice(0, 15).map((p) => ({
    id: p.id,
    label: p.match_id ? matchLabel.get(p.match_id) ?? "Match" : "Match",
    result: p.prediction_result,
    score: p.predicted_score_a != null && p.predicted_score_b != null ? `${p.predicted_score_a}–${p.predicted_score_b}` : "—",
    points: p.points_awarded ?? 0,
    created_at: p.created_at,
  }));

  type QuizFull = { id: string; question_id: string | null; is_correct: boolean; points_awarded: number | null; created_at: string };
  const recent_quiz = ((quizzes ?? []) as QuizFull[]).slice(0, 15).map((q) => ({
    id: q.id,
    question: q.question_id ? qLabel.get(q.question_id) ?? "Question" : "Question",
    is_correct: q.is_correct,
    points: q.points_awarded ?? 0,
    created_at: q.created_at,
  }));

  type EntryFull = { id: string; challenge_id: string | null; status: string | null; points_awarded: number | null; created_at: string };
  const animMap = new Map<string, AuditDetail["animations"][number]>();
  for (const e of (entries ?? []) as EntryFull[]) {
    animMap.set(e.id, {
      entry_id: e.id,
      title: e.challenge_id ? cTitle.get(e.challenge_id) ?? "Animation" : "Animation",
      status: e.status,
      created_at: e.created_at,
      role: "author",
    });
  }
  for (const p of (parts ?? []) as { entry_id: string; created_at: string }[]) {
    if (animMap.has(p.entry_id)) continue;
    const chId = entryChallenge.get(p.entry_id);
    animMap.set(p.entry_id, {
      entry_id: p.entry_id,
      title: chId ? cTitle.get(chId) ?? "Animation" : "Animation",
      status: null,
      created_at: p.created_at,
      role: "participant",
    });
  }
  const animations = [...animMap.values()].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  type VoteFull = { target_type: string | null; created_at: string };
  const votesArr = (votes ?? []) as VoteFull[];

  type ReqFull = { team_id: string | null; status: string | null; created_at: string | null; decided_at: string | null };
  const reqArr = (reqs ?? []) as ReqFull[];
  const team_requests = reqArr.map((r) => ({
    team_name: r.team_id ? teamName.get(r.team_id) ?? null : null,
    status: r.status,
    created_at: r.created_at,
    decided_at: r.decided_at,
  }));
  const pending = reqArr.find((r) => r.status === "pending");
  const onboarding: OnboardingStatus = pending ? "waiting_team" : u.profile_completed ? "ok" : "incomplete";

  // Timeline (bornée) : événements principaux fusionnés et triés.
  const timeline: AuditTimelineItem[] = [];
  if (u.created_at) timeline.push({ type: "account_created", label: "Compte créé", created_at: u.created_at });
  for (const r of reqArr) {
    const tn = r.team_id ? teamName.get(r.team_id) ?? "" : "";
    if (r.created_at) timeline.push({ type: "team_join_requested", label: `Demande équipe${tn ? " " + tn : ""}`, created_at: r.created_at });
    if (r.status === "approved" && r.decided_at) timeline.push({ type: "team_join_approved", label: `Rejoint ${tn || "une équipe"}`, created_at: r.decided_at });
  }
  for (const p of recent_predictions.slice(0, 10)) timeline.push({ type: "prediction_submitted", label: `Prono ${p.label}`, created_at: p.created_at });
  for (const q of recent_quiz.slice(0, 10)) timeline.push({ type: "quiz_answered", label: `Quiz: ${q.question.slice(0, 50)}`, created_at: q.created_at });
  for (const a of animations) timeline.push({ type: "challenge_joined", label: `Animation: ${a.title}`, created_at: a.created_at });
  for (const v of votesArr.slice(0, 10)) timeline.push({ type: "vote_cast", label: "Vote émis", created_at: v.created_at });
  timeline.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  const alRow = al as { role: UserRole; is_active: boolean } | null;
  return {
    user_id: u.id,
    email: u.email,
    display_name: u.display_name ?? null,
    role: alRow?.role ?? null,
    is_active: alRow?.is_active ?? false,
    profile_completed: u.profile_completed ?? false,
    service_name: (serviceRes?.data as { name: string } | null)?.name ?? null,
    team_name: (teamRes?.data as { name: string } | null)?.name ?? null,
    account_created_at: u.created_at ?? null,
    last_login_at: u.last_login_at ?? null,
    onboarding,
    points_by_category,
    recent_predictions,
    recent_quiz,
    animations,
    votes: { count: votesArr.length, recent: votesArr.slice(0, 10).map((v) => ({ created_at: v.created_at, target_type: v.target_type })) },
    team_requests,
    timeline: timeline.slice(0, 50),
    admin_logs_available: false, // table admin_logs absente → Phase 2
  };
}
