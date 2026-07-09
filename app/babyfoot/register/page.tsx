"use client";

// /babyfoot/register — inscription au tournoi. TROIS façons de participer :
//  👥 J'ai déjà mon binôme  → mon équipe CanalCup (2 joueurs), comme avant.
//  🙋 Je choisis quelqu'un  → demande à un collègue (accepter/refuser). S'il est
//     déjà inscrit, il peut accepter EN RENFORT (il dépanne, ne marque rien).
//  🔎 Je cherche un partenaire → je me déclare, liste publique des chercheurs.
// Une fois inscrit (binôme officiel OU paire), on gère ici ses disponibilités.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Check, Users, CalendarClock, Loader2, PartyPopper, Search, HandHeart, X } from "lucide-react";
import { CreateBabyfootTeamCard } from "@/components/babyfoot/CreateBabyfootTeamCard";

interface Slot { key: string; label: string; day: "thu" | "fri"; start: string; }
interface Ctx {
  tournament: {
    id: string; name: string; event_date: string | null;
    status: string; registration_open: boolean; target_teams: number;
  } | null;
  slots: Slot[];
  minSlots: number;
  recommendedSlots: number;
  slotCap: number;
  slotCounts: Record<string, number>;
  binome: { meName: string; teamId: string | null; teamName: string | null; partnerName: string | null; memberCount: number } | null;
  myEntry: { id: string; label: string; display_name: string | null; availability: string[] } | null;
  myOpenPair: { partnerName: string | null; helper: boolean } | null;
  registeredCount: number;
  entries: { id: string; label: string }[];
}
interface Candidate { id: string; name: string; status: "free" | "registered" | "seeking"; with: string | null; teamPartner: string | null; }
interface PCtx {
  tournament: { id: string; registration_open: boolean; status: string } | null;
  me: { id: string; name: string; registered: boolean; entryLabel: string | null } | null;
  incoming: { id: string; fromName: string } | null;
  outgoing: { id: string; toName: string } | null;
  iAmSeeking: boolean;
  seekers: { id: string; name: string }[];
  candidates: Candidate[];
}

type Mode = "binome" | "choose" | "seek";

async function postPartner(body: Record<string, unknown>) {
  const res = await fetch("/api/babyfoot/partner", {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body),
  });
  return { ok: res.ok, ...(await res.json().catch(() => ({}))) } as { ok: boolean; error?: string; paired?: boolean; renfort?: boolean };
}

export default function BabyfootRegisterPage() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [pctx, setPctx] = useState<PCtx | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [slots, setSlots] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/babyfoot/register", { credentials: "same-origin" }).then((r) => r.json()),
      fetch("/api/babyfoot/partner", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, p]: [Ctx, PCtx | null]) => {
        setCtx(d); setPctx(p);
        if (d.myEntry) {
          setDisplayName(d.myEntry.display_name ?? "");
          setSlots(new Set(d.myEntry.availability ?? []));
        }
      })
      .catch(() => setError("Chargement impossible."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const toggle = (k: string) =>
    setSlots((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/babyfoot/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ display_name: displayName, slots: [...slots] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Inscription impossible."); return; }
      setDone(true); load();
    } catch { setError("Erreur réseau."); }
    finally { setSaving(false); }
  };

  const partnerAct = async (body: Record<string, unknown>, okMsg?: string) => {
    setSaving(true); setError(null); setNotice(null);
    const d = await postPartner(body);
    if (!d.ok) setError(d.error ?? "Action impossible.");
    else if (okMsg) setNotice(okMsg);
    setSaving(false); load();
    return d;
  };

  if (loading) {
    return <div className="px-4 py-10 text-center text-canal-gray-muted"><Loader2 className="animate-spin inline" /> </div>;
  }

  const t = ctx?.tournament;
  const remaining = t ? Math.max(0, t.target_teams - (ctx?.registeredCount ?? 0)) : 0;
  const registered = !!ctx?.myEntry;
  const isPair = !!ctx?.myOpenPair;

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl flex items-center gap-2">
          <span className="text-3xl">🎮</span> Tournoi Baby-foot
        </h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Inscription — {t?.event_date ? new Date(t.event_date + "T00:00:00+11:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "date à venir"}
        </p>
      </div>

      {/* Statut inscriptions */}
      <div className={`canal-card border ${t?.registration_open ? "border-green-600/40 bg-green-900/10" : "border-canal-gray-light"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${t?.registration_open ? "bg-green-400 animate-pulse" : "bg-canal-gray-muted"}`} />
            <span className="font-bold text-sm">{t?.registration_open ? "Inscriptions ouvertes" : "Inscriptions fermées"}</span>
          </div>
          <span className="text-xs text-canal-gray-muted">
            {ctx?.registeredCount ?? 0} binôme{(ctx?.registeredCount ?? 0) > 1 ? "s" : ""} inscrit{(ctx?.registeredCount ?? 0) > 1 ? "s" : ""}
          </span>
        </div>
        {t?.registration_open && remaining > 0 && (
          <p className="text-xs text-canal-yellow font-bold mt-2">🎉 Plus que {remaining} binôme{remaining > 1 ? "s" : ""} avant l&apos;objectif !</p>
        )}
      </div>

      {/* 🏓 Demande de partenaire reçue */}
      {pctx?.incoming && (
        <IncomingRequestCard fromName={pctx.incoming.fromName} busy={saving}
          onAccept={async () => { const d = await partnerAct({ action: "accept", request_id: pctx.incoming!.id }, "Binôme créé ! Choisissez vos créneaux ci-dessous 👇"); void d; }}
          onRefuse={() => partnerAct({ action: "refuse", request_id: pctx.incoming!.id })} />
      )}

      {notice && <p className="rounded-xl bg-green-900/20 border border-green-600/40 p-3 text-green-300 text-sm font-bold">{notice}</p>}
      {error && <p className="text-red-400 text-sm font-bold">{error}</p>}

      {/* Déjà inscrit → gestion des dispos. Sinon → les 3 façons de participer. */}
      {registered ? (
        <RegistrationForm
          ctx={ctx!} isPair={isPair} displayName={displayName} setDisplayName={setDisplayName}
          slots={slots} toggle={toggle} submit={submit} saving={saving} done={done}
        />
      ) : t?.registration_open ? (
        <>
          {/* Choix du mode */}
          <div className="grid gap-2">
            <ModeCard active={mode === "binome"} onClick={() => setMode("binome")} icon={<Users size={18} />}
              title="J'ai déjà mon binôme" desc="Vous êtes 2, prêts à jouer — inscrivez-vous ensemble." />
            <ModeCard active={mode === "choose"} onClick={() => setMode("choose")} icon={<HandHeart size={18} />}
              title="Je choisis mon partenaire" desc="Propose à un collègue — il accepte, le binôme est créé." />
            <ModeCard active={mode === "seek"} onClick={() => setMode("seek")} icon={<Search size={18} />}
              title="Je cherche un partenaire" desc="Déclare-toi : les autres chercheurs te trouveront." />
          </div>

          {mode === "binome" && (
            <>
              {ctx?.binome && !ctx.binome.teamId && <CreateBabyfootTeamCard onCreated={load} />}
              {ctx?.binome?.teamId && ctx.binome.memberCount !== 2 && (
                <div className="canal-card border border-canal-yellow/40 bg-canal-yellow/5 space-y-2">
                  <p className="text-white font-bold text-sm">Il te faut un coéquipier 👥</p>
                  <p className="text-canal-gray-muted text-xs">
                    Un binôme baby-foot compte <b className="text-white">exactement 2 joueurs</b>. Tu ne peux pas t&apos;inscrire seul —
                    ou utilise <b className="text-white">« Je choisis mon partenaire »</b> juste au-dessus.
                  </p>
                  <Link href="/binomes" className="inline-flex items-center gap-1.5 text-canal-black bg-canal-yellow font-black text-sm rounded-lg px-3 py-2">
                    <Users size={14} /> Trouver un coéquipier
                  </Link>
                </div>
              )}
              {ctx?.binome?.teamId && ctx.binome.memberCount === 2 && (
                <RegistrationForm
                  ctx={ctx} isPair={false} displayName={displayName} setDisplayName={setDisplayName}
                  slots={slots} toggle={toggle} submit={submit} saving={saving} done={done}
                />
              )}
            </>
          )}

          {mode === "choose" && pctx && (
            <PartnerPicker pctx={pctx} busy={saving} act={partnerAct} />
          )}

          {mode === "seek" && pctx && (
            <SeekPanel pctx={pctx} busy={saving} act={partnerAct} />
          )}
        </>
      ) : (
        <p className="text-center text-sm text-canal-gray-muted py-4">Les inscriptions sont closes — reviens plus tard.</p>
      )}

      {/* Liste des binômes inscrits */}
      {(ctx?.entries.length ?? 0) > 0 && (
        <div>
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-2">Binômes inscrits</h2>
          <div className="canal-card divide-y divide-canal-gray-light">
            {ctx!.entries.map((e, i) => (
              <div key={e.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="text-canal-gray-muted w-5 text-center">{i + 1}</span>
                <span className="font-bold text-white">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button onClick={onClick}
      className={`text-left canal-card border transition-colors ${active ? "border-canal-yellow bg-canal-yellow/10" : "border-canal-gray-light hover:border-canal-yellow/50"}`}>
      <div className="flex items-center gap-3">
        <span className={`shrink-0 ${active ? "text-canal-yellow" : "text-canal-gray-muted"}`}>{icon}</span>
        <div>
          <p className="font-black text-white text-sm">{title}</p>
          <p className="text-xs text-canal-gray-muted mt-0.5">{desc}</p>
        </div>
      </div>
    </button>
  );
}

// 🏓 « Vincent souhaite jouer avec toi »
function IncomingRequestCard({ fromName, busy, onAccept, onRefuse }: { fromName: string; busy: boolean; onAccept: () => void; onRefuse: () => void }) {
  return (
    <div className="canal-card border-2 border-canal-yellow bg-canal-yellow/10 space-y-3">
      <p className="text-center text-3xl">🏓</p>
      <p className="text-center font-black text-white text-lg leading-tight">Demande de partenaire</p>
      <p className="text-center text-sm text-canal-gray-muted"><b className="text-canal-yellow">{fromName}</b> souhaite jouer avec toi au tournoi Baby-foot.</p>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={onAccept} className="min-h-[46px] rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-50">✅ J&apos;accepte</button>
        <button disabled={busy} onClick={onRefuse} className="min-h-[46px] rounded-xl bg-canal-gray-mid border border-canal-gray-light text-white font-bold disabled:opacity-50">❌ Je refuse</button>
      </div>
    </div>
  );
}

// 🙋 Choisir un collègue (avec statut) et lui envoyer une demande.
function PartnerPicker({ pctx, busy, act }: { pctx: PCtx; busy: boolean; act: (b: Record<string, unknown>, ok?: string) => Promise<{ ok: boolean; paired?: boolean }> }) {
  const [pick, setPick] = useState("");
  const chosen = pctx.candidates.find((c) => c.id === pick) ?? null;
  if (pctx.me?.registered) return <p className="text-sm text-canal-gray-muted">Tu es déjà inscrit ({pctx.me.entryLabel}).</p>;

  if (pctx.outgoing) {
    return (
      <div className="canal-card space-y-3">
        <p className="text-sm text-white font-bold">⏳ Demande envoyée à <b className="text-canal-yellow">{pctx.outgoing.toName}</b></p>
        <p className="text-xs text-canal-gray-muted">Dès qu&apos;il/elle accepte, votre binôme est créé. Tu peux annuler pour demander à quelqu&apos;un d&apos;autre.</p>
        <button disabled={busy} onClick={() => act({ action: "cancel", request_id: pctx.outgoing!.id })}
          className="flex items-center gap-1.5 text-xs text-red-400 font-bold"><X size={13} /> Annuler ma demande</button>
      </div>
    );
  }

  return (
    <div className="canal-card space-y-3">
      <label className="text-xs font-bold uppercase text-canal-gray-muted">Avec qui veux-tu jouer ?</label>
      <select value={pick} onChange={(e) => setPick(e.target.value)}
        className="w-full px-2 py-2.5 rounded-lg bg-canal-gray-mid border border-canal-gray-light text-white text-sm">
        <option value="">— Choisis un collègue —</option>
        {pctx.candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.status === "registered" ? "· 🏓 déjà inscrit au tournoi"
              : c.status === "seeking" ? "· 🔎 cherche un partenaire"
              : c.teamPartner ? `· 👥 en binôme avec ${c.teamPartner}`
              : "· 🟢 disponible"}
          </option>
        ))}
      </select>
      {chosen?.status === "registered" && (
        <p className="text-xs text-canal-yellow bg-canal-yellow/10 border border-canal-yellow/30 rounded-lg p-2">
          🏓 <b>{chosen.name}</b> est déjà inscrit au tournoi ({chosen.with}). Il/elle peut accepter <b>en renfort</b> :
          il/elle joue avec toi pour te dépanner, mais <b>toi seul marqueras des points</b>.
        </p>
      )}
      {chosen?.status !== "registered" && chosen?.teamPartner && (
        <p className="text-xs text-canal-gray-muted bg-canal-gray-mid/40 border border-canal-gray-light rounded-lg p-2">
          👥 <b className="text-white">{chosen.name}</b> a déjà un binôme CanalCup avec <b className="text-white">{chosen.teamPartner}</b> —
          il se peut qu&apos;ils s&apos;inscrivent ensemble. Tu peux quand même lui proposer.
        </p>
      )}
      <button disabled={busy || !pick}
        onClick={() => act({ action: "send", to_user_id: pick }, "Demande envoyée ! 📨")}
        className="w-full min-h-[46px] rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-50">
        📨 Envoyer la demande
      </button>
      <p className="text-[11px] text-canal-gray-muted">Il/elle verra ta demande à l&apos;ouverture de l&apos;app et pourra accepter ou refuser.</p>
    </div>
  );
}

// 🔎 Se déclarer « cherche un partenaire » + liste publique des chercheurs.
function SeekPanel({ pctx, busy, act }: { pctx: PCtx; busy: boolean; act: (b: Record<string, unknown>, ok?: string) => Promise<{ ok: boolean; paired?: boolean }> }) {
  if (pctx.me?.registered) return <p className="text-sm text-canal-gray-muted">Tu es déjà inscrit ({pctx.me.entryLabel}).</p>;
  return (
    <div className="canal-card space-y-4">
      {pctx.iAmSeeking ? (
        <div className="rounded-xl bg-green-900/20 border border-green-600/40 p-3 space-y-1.5">
          <p className="text-green-300 text-sm font-bold">🔎 Tu es sur la liste des chercheurs !</p>
          <p className="text-xs text-canal-gray-muted">Les collègues te verront ici et pourront te proposer de jouer. Tu peux aussi en choisir un ci-dessous.</p>
          <button disabled={busy} onClick={() => act({ action: "unseek" })} className="text-xs text-red-400 font-bold">Me retirer de la liste</button>
        </div>
      ) : (
        <button disabled={busy} onClick={() => act({ action: "seek" }, "C'est noté — tu es visible des autres chercheurs ! 🔎")}
          className="w-full min-h-[46px] rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-50">
          🙋 Je me déclare « cherche un partenaire »
        </button>
      )}

      <div>
        <p className="text-xs font-bold uppercase text-canal-gray-muted mb-1.5">
          {pctx.seekers.length ? `${pctx.seekers.length} personne${pctx.seekers.length > 1 ? "s" : ""} cherche${pctx.seekers.length > 1 ? "nt" : ""} un partenaire` : "Personne d'autre ne cherche pour l'instant"}
        </p>
        <div className="divide-y divide-canal-gray-mid">
          {pctx.seekers.filter((s) => s.id !== pctx.me?.id).map((s) => (
            <div key={s.id} className="py-2 flex items-center gap-2 text-sm">
              <span className="flex-1 font-bold text-white">🔎 {s.name}</span>
              <button disabled={busy || !!pctx.outgoing}
                onClick={() => act({ action: "send", to_user_id: s.id }, "Proposition envoyée ! 📨")}
                className="text-xs font-black bg-canal-yellow text-canal-black rounded-lg px-2.5 py-1.5 disabled:opacity-40">
                Proposer de jouer
              </button>
            </div>
          ))}
        </div>
        {pctx.outgoing && <p className="text-[11px] text-canal-gray-muted mt-1.5">⏳ Demande en cours vers {pctx.outgoing.toName} — annule-la (mode « Je choisis ») pour en envoyer une autre.</p>}
      </div>
    </div>
  );
}

// Formulaire de dispos (binôme officiel OU paire ad-hoc déjà créée).
function RegistrationForm({ ctx, isPair, displayName, setDisplayName, slots, toggle, submit, saving, done }: {
  ctx: Ctx; isPair: boolean; displayName: string; setDisplayName: (v: string) => void;
  slots: Set<string>; toggle: (k: string) => void; submit: () => void; saving: boolean; done: boolean;
}) {
  const t = ctx.tournament;
  const meName = ctx.binome?.meName ?? "Moi";
  const partnerName = isPair ? (ctx.myOpenPair?.partnerName ?? "coéquipier") : (ctx.binome?.partnerName ?? "coéquipier");
  return (
    <div className="canal-card space-y-5">
      {done && (
        <div className="rounded-xl bg-green-900/20 border border-green-600/40 p-3 flex items-center gap-2 text-green-300 text-sm font-bold">
          <PartyPopper size={16} /> {ctx.myEntry ? "Inscription mise à jour !" : "Binôme inscrit !"}
        </div>
      )}

      {/* Le binôme */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase text-canal-gray-muted flex items-center gap-1.5">
            <Users size={12} /> Votre binôme {isPair && <span className="text-canal-yellow normal-case">· Paire Baby-foot</span>}
          </label>
          {ctx.myEntry && <span className="text-[11px] font-black text-green-400 flex items-center gap-1"><Check size={12} /> Inscrits</span>}
        </div>
        <div className="mt-2 flex items-center gap-2 text-white font-bold">
          <span className="px-3 py-3 rounded-xl bg-canal-gray-mid flex-1 text-center">{meName}</span>
          <span className="text-2xl">🤝</span>
          <span className="px-3 py-3 rounded-xl bg-canal-gray-mid flex-1 text-center">
            {partnerName}{isPair && ctx.myOpenPair?.helper ? <span className="block text-[10px] text-canal-yellow font-bold">en renfort</span> : null}
          </span>
        </div>
        {isPair && ctx.myOpenPair?.helper && (
          <p className="text-[11px] text-canal-gray-muted mt-1.5">Le renfort dépanne : il joue, mais seuls TES points comptent.</p>
        )}
      </div>

      {/* Nom de binôme optionnel */}
      <div>
        <label className="text-xs font-bold uppercase text-canal-gray-muted">Nom du binôme (optionnel)</label>
        <input
          value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60}
          placeholder={ctx.binome?.teamName ?? "Ex. Les Foudres"}
          className="mt-2 w-full px-3 py-2 rounded-xl bg-canal-gray-mid text-white text-sm border border-canal-gray-light focus:border-canal-yellow outline-none"
        />
      </div>

      {/* Disponibilités — créneaux de 30 min (1 seule table) */}
      <div>
        <label className="text-xs font-bold uppercase text-canal-gray-muted flex items-center gap-1.5"><CalendarClock size={12} /> Vos disponibilités</label>
        <p className="text-[11px] text-canal-gray-muted mt-1">
          🏓 <b>Une seule table.</b> Choisissez <b>au moins {ctx.minSlots}</b> créneaux de 30 min (recommandé : {ctx.recommendedSlots}+). <b className="text-white">Plus vous cochez de disponibilités, plus le tirage pourra équilibrer le tournoi</b>.
        </p>
        {(["thu", "fri"] as const).map((day) => (
          <div key={day} className="mt-3">
            <p className="text-[11px] font-black text-canal-yellow uppercase mb-1.5">{day === "thu" ? "Jeudi 16" : "Vendredi 17 (matin — l'aprèm est réservé aux finales)"}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ctx.slots.filter((s) => s.day === day).map((s) => {
                const on = slots.has(s.key);
                const count = ctx.slotCounts[s.key] ?? 0;
                const ratio = count / ctx.slotCap;
                const full = !on && count >= ctx.slotCap;
                const fill = full ? "text-canal-gray-muted" : ratio >= 0.85 ? "text-red-400" : ratio >= 0.5 ? "text-amber-400" : "text-green-400";
                return (
                  <button
                    key={s.key} disabled={full} onClick={() => toggle(s.key)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                      full ? "bg-canal-gray-mid/40 border-canal-gray-light text-canal-gray-muted opacity-60"
                      : on ? "bg-canal-yellow/15 border-canal-yellow text-canal-yellow" : "bg-canal-gray-mid border-canal-gray-light text-white"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">{s.start} {full ? <span className="text-[10px]">🔒 complet</span> : <span className={`text-[10px] ${fill}`}>{count}/{ctx.slotCap}</span>}</span>
                    <span className={`w-4 h-4 rounded flex items-center justify-center ${on ? "bg-canal-yellow text-canal-black" : "border border-canal-gray-light"}`}>{on && <Check size={11} />}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className={`text-[11px] mt-2 font-bold ${slots.size >= ctx.minSlots ? "text-green-400" : "text-canal-yellow"}`}>
          {slots.size} / {ctx.minSlots} créneaux minimum {slots.size >= ctx.minSlots ? "✓" : ""}
        </p>
      </div>

      <button
        onClick={submit}
        disabled={saving || !t?.registration_open || slots.size < ctx.minSlots}
        className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-50 hover:bg-canal-yellow-hover transition-colors"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
        {ctx.myEntry ? "Mettre à jour mon inscription" : "Inscrire mon binôme"}
      </button>
      {!t?.registration_open && (
        <p className="text-center text-xs text-canal-gray-muted">Les inscriptions sont closes — reviens plus tard.</p>
      )}
    </div>
  );
}
