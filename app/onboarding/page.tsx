"use client";

// Onboarding (commit B du pivot équipes) :
// - Pseudo + service + niveau foot (inchangé)
// - Étape équipe REFONTE : Créer SON équipe, OU rejoindre via un CODE
//   d'invitation. Pas de liste publique des équipes existantes.
// - Lien partageable supporté : /onboarding?invite=ABC123 pré-remplit
//   le mode "Rejoindre" + le code.
// - Si l'user a déjà une demande pending au chargement → écran d'attente
//   (pas de form). Le middleware le ramène ici tant que profile_completed
//   reste false (ce qui est le cas tant qu'aucune équipe n'est validée).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Service, FootballLevel } from "@/lib/supabase/types";
import {
  User, Briefcase, ChevronRight, Users, Plus, Ticket, Check, RefreshCw, AlertCircle, Globe,
} from "lucide-react";
import { cn, DEFAULT_TZ, TZ_OPTIONS, detectTimezone, normalizeTimezone } from "@/lib/utils";

const WC_TEAMS_SORTED = [
  "Afrique du Sud","Algérie","Allemagne","Angola","Arabie Saoudite","Argentine","Australie",
  "Belgique","Bosnie-Herzégovine","Brésil","Canada","Cap-Vert","Colombie","Corée du Sud",
  "Côte d'Ivoire","Croatie","Curaçao","Égypte","Équateur","Espagne","États-Unis","France",
  "Haïti","Honduras","Iran","Italie","Japon","Maroc","Mexique","Nigéria","Panama","Paraguay",
  "Pays-Bas","Pérou","Portugal","Qatar","République Tchèque","Sénégal","Suède","Suisse",
  "Tunisie","Turquie","Uruguay","Venezuela",
].sort((a, b) => a.localeCompare(b, "fr"));

const FOOTBALL_LEVELS: { value: FootballLevel; label: string; desc: string; emoji: string }[] = [
  { value: "expert", label: "Expert", desc: "Je connais le hors-jeu, le faux pivot et les stats xG", emoji: "⚽" },
  { value: "amateur", label: "Amateur", desc: "Je regarde les grands matchs et je connais les équipes", emoji: "📺" },
  { value: "ambiance", label: "Je viens pour l'ambiance", desc: "Le foot ? Je viens pour les petits fours et l'équipe", emoji: "🎉" },
];

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

type TeamMode = "create" | "join";

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteFromUrl = (searchParams.get("invite") ?? "").trim().toUpperCase();

  const [services, setServices] = useState<Service[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [footballLevel, setFootballLevel] = useState<FootballLevel | "">("");
  const [timezone, setTimezone] = useState<string>(DEFAULT_TZ);
  const [bonusWinner, setBonusWinner] = useState("");
  const [bonusTopScorer, setBonusTopScorer] = useState("");
  const [teamMode, setTeamMode] = useState<TeamMode>(inviteFromUrl ? "join" : "create");
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [pending, setPending] = useState<{ team_name: string } | null>(null);
  const [returning, setReturning] = useState(false);
  // État équipe actuelle de l'user (pour adapter l'UI : un user déjà
  // en équipe ne doit plus voir "Créer", juste "Rejoindre une autre").
  const [currentTeam, setCurrentTeam] = useState<{ name: string; isCaptain: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Section équipe collapsable : visible UNIQUEMENT si l'user a un
  // ?invite=xxx dans l'URL (cas QR code partagé) ou s'il clique
  // explicitement "Je veux choisir une équipe maintenant". Sinon
  // l'équipe est invisible et le user passe direct.
  const [showTeamSection, setShowTeamSection] = useState(
    !!inviteFromUrl || !!currentTeam
  );

  // Charge services + pré-remplit le profil + détecte une demande pending.
  useEffect(() => {
    // Pré-sélection du fuseau via détection navigateur (NC par défaut).
    setTimezone(detectTimezone());

    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setServices(d); })
      .catch(() => {});

    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: row, error: rowErr } = await supabase
          .from("users")
          .select("id, display_name, name, service_id, football_level, timezone, team_id, team_role, profile_completed, team:teams(id, name, created_by_user_id)")
          .eq("auth_id", user.id)
          .maybeSingle();
        if (rowErr || !row) return;
        if (row.display_name || row.name) setDisplayName(row.display_name ?? row.name ?? "");
        if (row.service_id) setServiceId(row.service_id);
        if (row.football_level) setFootballLevel(row.football_level as FootballLevel);
        if (row.timezone) setTimezone(normalizeTimezone(row.timezone));
        if (!row.profile_completed && (row.display_name || row.name || row.service_id)) {
          setReturning(true);
        }
        // L'user a déjà une équipe ? On adapte l'UI : pas de "Créer",
        // seulement "Rejoindre une autre équipe par code" (sauf captain).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const team = (row as any).team;
        if (row.team_id && team) {
          const isCaptain = team.created_by_user_id === row.id;
          setCurrentTeam({ name: team.name, isCaptain });
          setTeamMode("join"); // on force le mode join visuellement
          setShowTeamSection(true);
        }

        // Demande pending → écran d'attente (lecture directe via supabase
        // côté client : RLS doit autoriser le user à voir SES propres
        // demandes. On reste tolérant si ça échoue, l'écran de saisie
        // s'affichera et le user pourra retenter.)
        const { data: pendingRow } = await supabase
          .from("team_join_requests")
          .select("id, team_id, status, team:teams(name)")
          .eq("user_id", row.id)
          .eq("status", "pending")
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pendingTeam = pendingRow && (pendingRow as any).team?.name;
        if (pendingTeam) setPending({ team_name: pendingTeam });
      } catch (e) {
        console.warn("[onboarding prefill] KO", e);
      }
    })();
  }, []);

  // L'équipe est désormais FACULTATIVE. Le formulaire est valide dès
  // que les 3 champs perso sont remplis. Si l'user remplit la section
  // équipe en plus, elle sera traitée — sinon il atterrit sur l'accueil
  // et pourra créer/rejoindre une équipe plus tard depuis /profile.
  const isValid =
    displayName.trim().length >= 2 && !!serviceId && !!footballLevel;
  const captainLocked = !!currentTeam?.isCaptain;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);

    // Helper : fetch avec timeout 15s, surfacing toute erreur réseau
    // (sinon un endpoint qui hang fait croire que rien ne se passe).
    const fetchOrFail = async (url: string, body: unknown): Promise<{ ok: true; data: unknown } | { ok: false; msg: string }> => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = (data as { error?: string })?.error ?? `HTTP ${res.status}`;
          return { ok: false, msg: errMsg };
        }
        return { ok: true, data };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "erreur réseau";
        return { ok: false, msg: msg === "The operation was aborted." ? "Délai dépassé — réessaie." : msg };
      }
    };

    // 1. Sauvegarde le profil via UPSERT serveur.
    const baseRes = await fetchOrFail("/api/profile/onboard", {
      display_name: displayName.trim(),
      service_id: serviceId,
      football_level: footballLevel,
      timezone,
    });
    if (!baseRes.ok) {
      setError(`Profil : ${baseRes.msg}`);
      setSaving(false);
      return;
    }

    // 2. Pronos bonus (facultatifs — pas bloquants si ça échoue).
    const bonusSaves: Promise<unknown>[] = [];
    if (bonusWinner.trim()) {
      bonusSaves.push(fetch("/api/predictions/bonus", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction_type: "winner", predicted_value: bonusWinner.trim() }),
      }).catch(() => {}));
    }
    if (bonusTopScorer.trim()) {
      bonusSaves.push(fetch("/api/predictions/bonus", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction_type: "top_scorer", predicted_value: bonusTopScorer.trim() }),
      }).catch(() => {}));
    }
    if (bonusSaves.length) await Promise.all(bonusSaves);

    // 3. Équipe = FACULTATIVE.
    const wantsCreate = teamMode === "create" && teamName.trim().length >= 2 && !currentTeam;
    const wantsJoin = teamMode === "join" && inviteCode.trim().length >= 4;

    if (wantsCreate) {
      const r = await fetchOrFail("/api/teams/create", { name: teamName.trim() });
      if (!r.ok) {
        setError(`Équipe : ${r.msg} (tu peux la créer plus tard depuis ton profil)`);
        setSaving(false);
        return;
      }
    } else if (wantsJoin) {
      const r = await fetchOrFail("/api/teams/join", { invite_code: inviteCode.trim().toUpperCase() });
      if (!r.ok) {
        setError(`Code invalide : ${r.msg} (tu peux rejoindre plus tard depuis ton profil)`);
        setSaving(false);
        return;
      }
      const d = r.data as { team?: { name?: string } };
      setPending({ team_name: d?.team?.name ?? "ton équipe" });
      setSaving(false);
      return;
    }

    // Navigation hard : window.location évite les soucis de router.push
    // qui ne reflète pas immédiatement le nouvel état d'auth.
    window.location.href = "/";
  };

  // ─── Écran d'attente (demande pending) ─────────────────────────────────────
  if (pending) {
    return (
      <div className="min-h-screen bg-canal-black flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="text-6xl">⏳</div>
          <h1 className="canal-headline text-xl">Demande envoyée</h1>
          <p className="text-canal-gray-muted text-sm leading-relaxed">
            Tu attends l&apos;approbation du créateur de{" "}
            <span className="text-white font-bold">{pending.team_name}</span>.
            Tu pourras pronostiquer dès qu&apos;il/elle aura validé.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.refresh()}
              className="w-full py-3 bg-canal-yellow text-canal-black font-black rounded-xl flex items-center justify-center gap-2 hover:bg-canal-yellow-hover transition-colors"
            >
              <RefreshCw size={14} /> Vérifier mon statut
            </button>
            <p className="text-[11px] text-canal-gray-muted italic">
              Astuce : recharge la page après que le créateur t&apos;ait validé.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Formulaire d'onboarding ───────────────────────────────────────────────
  // Le bouton de déconnexion est désormais dans la TopBar (en permanence
  // visible à droite de l'avatar), inutile de le dupliquer ici.

  return (
    <div className="min-h-screen bg-canal-black flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-canal-yellow font-black text-3xl tracking-tight">CANAL</span>
            <span className="text-white font-black text-3xl tracking-tight">CUP</span>
          </div>
          <h1 className="canal-headline text-xl mb-1">Bienvenue ! 👋</h1>
          <p className="text-canal-gray-muted text-sm">
            Une dernière étape avant de jouer.
          </p>
        </div>

        {returning && (
          <div className="rounded-xl border border-canal-yellow/40 bg-canal-yellow/10 px-4 py-3 text-center">
            <p className="text-canal-yellow font-bold text-sm">Profil incomplet</p>
            <p className="text-canal-gray-muted text-xs mt-0.5">
              Termine la création/jointure d&apos;équipe pour pronostiquer.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pseudo */}
          <div>
            <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User size={12} /> Ton pseudo Canal Cup
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder='Ex : "Vincent", "Didier du VAR"'
              maxLength={30}
              required
              className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
            />
            {displayName.length >= 2 && (
              <p className="text-canal-gray-muted text-xs mt-1.5">
                Profil : /u/{slugify(displayName)}
              </p>
            )}
          </div>

          {/* Service */}
          <div>
            <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Briefcase size={12} /> Ton service
            </label>
            <div className="grid grid-cols-3 gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServiceId(s.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all",
                    serviceId === s.id
                      ? "bg-canal-yellow text-canal-black border-canal-yellow"
                      : "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light hover:text-white"
                  )}
                >
                  {s.emoji && <span className="text-lg">{s.emoji}</span>}
                  <span className="text-center leading-tight">{s.name}</span>
                </button>
              ))}
              {services.length === 0 && (
                <p className="col-span-3 text-canal-gray-muted text-xs">Chargement…</p>
              )}
            </div>
          </div>

          {/* Niveau foot */}
          <div>
            <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 block">
              Ton niveau foot
            </label>
            <div className="space-y-2">
              {FOOTBALL_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFootballLevel(level.value)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                    footballLevel === level.value
                      ? "bg-canal-yellow/10 border-canal-yellow text-white"
                      : "bg-canal-gray-mid border-canal-gray-light text-canal-gray-muted hover:text-white"
                  )}
                >
                  <span className="text-xl flex-shrink-0">{level.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{level.label}</p>
                    <p className="text-xs opacity-70 leading-tight truncate">{level.desc}</p>
                  </div>
                  {footballLevel === level.value && (
                    <span className="ml-auto text-canal-yellow font-black text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Pronos bonus — fermés au coup d'envoi du tournoi (11 juin 2026) */}
          {Date.now() < new Date("2026-06-11T00:00:00Z").getTime() && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-1 block">
                  🏆 Qui va gagner la Coupe du Monde ? <span className="text-canal-gray-muted font-normal normal-case">(+20 pts si correct)</span>
                </label>
                <select
                  value={bonusWinner}
                  onChange={(e) => setBonusWinner(e.target.value)}
                  className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-canal-yellow transition-colors"
                  style={{ color: bonusWinner ? "white" : "#6b7280" }}
                >
                  <option value="">— Sélectionner une équipe —</option>
                  {WC_TEAMS_SORTED.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-1 block">
                  ⚽ Qui sera le meilleur buteur ? <span className="text-canal-gray-muted font-normal normal-case">(+10 pts si correct)</span>
                </label>
                <input
                  type="text"
                  value={bonusTopScorer}
                  onChange={(e) => setBonusTopScorer(e.target.value)}
                  placeholder="Ex : Mbappé, Vinicius Jr…"
                  maxLength={60}
                  className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
                />
              </div>
              <p className="text-[11px] text-canal-gray-muted -mt-2 leading-snug">
                Facultatif — modifiable depuis&nbsp;<span className="text-canal-yellow">Mes pronos</span>&nbsp;jusqu'au début du tournoi.
              </p>
            </div>
          )}

          {/* Région / fuseau — pré-rempli par détection navigateur. Les
              abonnés Pacifique sont sur des fuseaux très différents
              (NC/Vanuatu UTC+11, Polynésie UTC-10) : ce choix détermine
              dans quel fuseau l'abonné voit les horaires de match. */}
          <div>
            <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Globe size={12} /> Ta région
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TZ_OPTIONS.map((o) => (
                <button
                  key={o.tz}
                  type="button"
                  onClick={() => setTimezone(o.tz)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all",
                    timezone === o.tz
                      ? "bg-canal-yellow text-canal-black border-canal-yellow"
                      : "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light hover:text-white"
                  )}
                >
                  <span className="text-lg">{o.flag}</span>
                  <span className="text-center leading-tight">{o.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-canal-gray-muted mt-1.5 leading-snug">
              Les horaires de match s&apos;afficheront dans ce fuseau. Modifiable plus tard dans ton profil.
            </p>
          </div>

          {/* Équipe — FACULTATIVE. Repliée par défaut. L'user peut la
              configurer plus tard depuis /profile ; elle ne devient
              obligatoire qu'au moment où il veut s'inscrire à une
              animation ou pronostiquer. */}
          {!showTeamSection ? (
            <div className="rounded-xl border border-dashed border-canal-gray-light bg-canal-gray-mid/40 px-4 py-3 space-y-1.5">
              <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Users size={12} /> Équipe — facultatif
              </p>
              <p className="text-[11px] text-canal-gray-muted leading-snug">
                Tu peux entrer dans l&apos;app sans équipe. Tu auras besoin
                d&apos;en avoir une UNIQUEMENT pour pronostiquer ou t&apos;inscrire
                à une animation. Tu peux la créer plus tard depuis ton
                profil.
              </p>
              <button
                type="button"
                onClick={() => setShowTeamSection(true)}
                className="text-xs text-canal-yellow underline mt-1"
              >
                Configurer mon équipe maintenant
              </button>
            </div>
          ) : (
          <div>
            <label className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users size={12} /> Ton équipe Canal Cup
              {!currentTeam && (
                <button
                  type="button"
                  onClick={() => { setShowTeamSection(false); setTeamName(""); setInviteCode(""); }}
                  className="ml-auto text-[10px] font-normal text-canal-gray-muted underline normal-case"
                >
                  passer
                </button>
              )}
            </label>

            {currentTeam ? (
              currentTeam.isCaptain ? (
                <div className="rounded-xl border border-canal-yellow/30 bg-canal-yellow/5 px-4 py-3 text-center">
                  <p className="text-canal-yellow font-bold text-sm">
                    Tu es capitaine de {currentTeam.name}
                  </p>
                  <p className="text-canal-gray-muted text-xs mt-1 leading-snug">
                    Une capitaine ne peut pas changer d&apos;équipe (sinon elle se retrouve orpheline).
                    Va sur ton profil pour gérer ton équipe (code d&apos;invitation, demandes).
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-canal-gray-mid/60 border border-canal-gray-light px-3 py-2 mb-3 text-center">
                    <p className="text-xs text-canal-gray-muted">
                      Tu es dans <span className="text-white font-bold">{currentTeam.name}</span>.
                    </p>
                    <p className="text-[11px] text-canal-gray-muted mt-0.5 leading-snug">
                      Pour changer d&apos;équipe, saisis le code d&apos;une autre équipe.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Code d'invitation (ex : ABC123)"
                    maxLength={12}
                    className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-white placeholder:text-canal-gray-muted text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:border-canal-yellow transition-colors"
                  />
                  <p className="text-[11px] text-canal-gray-muted mt-1.5 leading-snug">
                    Le code vient d&apos;une autre capitaine. Tu seras déplacé(e) dans la nouvelle équipe une fois la demande validée.
                  </p>
                </>
              )
            ) : (
              <>
                <div className="flex gap-1 bg-canal-gray-mid border border-canal-gray-light rounded-xl p-1 mb-3">
                  <button
                    type="button"
                    onClick={() => setTeamMode("create")}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5",
                      teamMode === "create" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
                    )}
                  >
                    <Plus size={12} /> Créer
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamMode("join")}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5",
                      teamMode === "join" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
                    )}
                  >
                    <Ticket size={12} /> Rejoindre
                  </button>
                </div>

                {teamMode === "create" ? (
                  <>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder='Nom de ton équipe (ex : "Les Frites")'
                      maxLength={60}
                      className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow transition-colors"
                    />
                    <p className="text-[11px] text-canal-gray-muted mt-1.5 leading-snug">
                      Tu deviens capitaine. Tu pourras inviter 1 coéquipier avec ton code d&apos;invitation (équipe = binôme).
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="Code d'invitation (ex : ABC123)"
                      maxLength={12}
                      className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-white placeholder:text-canal-gray-muted text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:border-canal-yellow transition-colors"
                    />
                    <p className="text-[11px] text-canal-gray-muted mt-1.5 leading-snug">
                      Le code vient du créateur de l&apos;équipe. Demande validée par la capitaine avant que tu puisses pronostiquer.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
          )}

          {error && (
            <p className="text-red-400 text-xs text-center flex items-center justify-center gap-1.5">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          {/* Diagnostic : pourquoi le bouton est grisé ? */}
          {!isValid && (
            <p className="text-canal-gray-muted text-[11px] text-center italic">
              {displayName.trim().length < 2
                ? "Renseigne ton pseudo (2 caractères min)"
                : !serviceId
                  ? "Choisis ton service"
                  : !footballLevel
                    ? "Choisis ton niveau foot"
                    : "—"}
            </p>
          )}

          {captainLocked ? (
            <Link
              href="/profile"
              className="w-full py-4 bg-canal-yellow text-canal-black font-black text-base rounded-xl flex items-center justify-center gap-2 hover:bg-canal-yellow-hover transition-colors"
            >
              Aller à mon profil →
            </Link>
          ) : (
            <button
              type="submit"
              disabled={!isValid || saving}
              className="w-full py-4 bg-canal-yellow text-canal-black font-black text-base rounded-xl flex items-center justify-center gap-2 hover:bg-canal-yellow-hover transition-colors disabled:opacity-40"
            >
              {saving
                ? "Enregistrement…"
                : !showTeamSection
                  ? "C'est parti !"
                  : currentTeam
                    ? "Demander à rejoindre 🎟"
                    : teamMode === "create"
                      ? "Créer mon équipe ⚽"
                      : "Envoyer ma demande 🎟"}
              {!saving && <ChevronRight size={18} />}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canal-black" />}>
      <OnboardingInner />
    </Suspense>
  );
}
