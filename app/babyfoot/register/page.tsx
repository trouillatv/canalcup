"use client";

// /babyfoot/register — inscription au tournoi. TROIS façons de participer :
//  👥 J'ai déjà mon binôme  → mon équipe CanalCup (2 joueurs), comme avant.
//  🙋 Je choisis quelqu'un  → demande à un collègue (accepter/refuser). S'il est
//     déjà inscrit, il peut accepter EN RENFORT (il dépanne, ne marque rien).
//  🔎 Je cherche un partenaire → je me déclare, liste publique des chercheurs.
// Une fois inscrit (binôme officiel OU paire), on gère ici ses disponibilités.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Check, Users, CalendarClock, Loader2, PartyPopper, Search, HandHeart, X, Pencil } from "lucide-react";
import { CreateBabyfootTeamCard } from "@/components/babyfoot/CreateBabyfootTeamCard";
import { BABYFOOT } from "@/lib/config/babyfoot";

interface Slot { key: string; label: string; day: "thu" | "fri"; start: string; }
interface BinomeCtx {
  entryId: string;
  kind: "official" | "open";
  creatorId: string | null;
  creatorName: string | null;
  iAmCreator: boolean;
  slotsAuthorId: string | null;
  slotsAuthorName: string | null;
  iAmSlotsAuthor: boolean;
  slotsUpdatedAt: string | null;
  partnerUserId: string | null;
  partnerName: string | null;
  partnerAuthId: string | null;
  iAmHelperPartner: boolean;
}
interface NextMatch { id: string; startsAt: string | null; opponentLabel: string; tableNo: number | null; }
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
  binomeCtx: BinomeCtx | null;
  homeState: "creating" | "registered" | "draw" | "live";
  nextMatch: NextMatch | null;
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

// Libellé d'horaire du prochain match : relatif si imminent (« dans 20 min »),
// sinon jour + heure (fuseau NC).
function kickoffLabel(iso: string): string {
  const target = new Date(iso).getTime();
  const diffMin = Math.round((target - Date.now()) / 60000);
  if (diffMin >= 0 && diffMin <= 120) return diffMin <= 1 ? "dans 1 min" : `dans ${diffMin} min`;
  const d = new Date(iso);
  const day = d.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "Pacific/Noumea" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Noumea" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${time}`;
}

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
  const [celebrate, setCelebrate] = useState(false); // écran « Parfait ! » après la 1re inscription
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false); // page binôme : édition explicite des créneaux

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
      setDone(true);
      if (!d.updated) setCelebrate(true); // 1re inscription → écran de célébration
      else setEditing(false); // mise à jour depuis la page binôme → on referme l'éditeur
      load();
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

      {/* 🏓 Demande de partenaire reçue. Si je suis DÉJÀ inscrit, c'est une demande
          de dépannage (renfort) → carte dédiée qui explique les règles de score. */}
      {pctx?.incoming && (
        registered ? (
          <HelpRequestCard fromName={pctx.incoming.fromName} withName={ctx?.binomeCtx?.partnerName ?? ctx?.binome?.partnerName ?? null} busy={saving}
            onAccept={() => partnerAct({ action: "accept", request_id: pctx.incoming!.id }, "Merci ! Tu dépannes — ton inscription officielle est intacte. 🤝")}
            onRefuse={() => partnerAct({ action: "refuse", request_id: pctx.incoming!.id })} />
        ) : (
          <IncomingRequestCard fromName={pctx.incoming.fromName} busy={saving}
            onAccept={async () => { const d = await partnerAct({ action: "accept", request_id: pctx.incoming!.id }, "Binôme créé ! Choisissez vos créneaux ci-dessous 👇"); void d; }}
            onRefuse={() => partnerAct({ action: "refuse", request_id: pctx.incoming!.id })} />
        )
      )}

      {notice && <p className="rounded-xl bg-green-900/20 border border-green-600/40 p-3 text-green-300 text-sm font-bold">{notice}</p>}
      {error && <p className="text-red-400 text-sm font-bold">{error}</p>}

      {/* Déjà inscrit → PAGE BINÔME (qui joue, qui a créé, quels créneaux) +
          dépannage. Sinon → les 3 façons de participer. */}
      {registered ? (
        celebrate && ctx?.myEntry ? (
          <SuccessScreen label={ctx.myEntry.label} slotsCount={slots.size} onEdit={() => { setCelebrate(false); setEditing(false); }} />
        ) : editing ? (
          <RegistrationForm
            ctx={ctx!} isPair={isPair} displayName={displayName} setDisplayName={setDisplayName}
            slots={slots} toggle={toggle} submit={submit} saving={saving} done={done}
            onCancel={ctx?.myEntry ? () => { setEditing(false); setDone(false); } : undefined}
          />
        ) : (
          <BinomeHome ctx={ctx!} isPair={isPair} onEdit={() => { setDone(false); setEditing(true); }} />
        )
      ) : t?.registration_open ? (
        <>
          {/* 🔎 Chercheurs visibles DIRECTEMENT (pas besoin de changer de mode) */}
          {pctx && <SeekersList pctx={pctx} busy={saving} act={partnerAct} />}

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
        <div id="inscrits">
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

// 🏓 « Parfait ! » — écran d'engagement après la 1re inscription : on n'est plus
// juste « enregistré », on est DANS l'événement (prochaine étape : le tirage).
function SuccessScreen({ label, slotsCount, onEdit }: { label: string; slotsCount: number; onEdit: () => void }) {
  return (
    <div className="canal-card border-2 border-canal-yellow bg-canal-yellow/10 text-center space-y-4 py-8">
      <p className="text-6xl" style={{ animation: "pop .5s ease-out both" }}>🏓</p>
      <div>
        <p className="canal-headline text-3xl text-canal-yellow">Parfait !</p>
        <p className="text-white font-bold mt-1">Ton binôme est inscrit.</p>
      </div>
      <p className="text-xl font-black text-white px-4 leading-tight">{label}</p>
      <p className="text-green-400 text-sm font-bold">✓ {slotsCount} créneau{slotsCount > 1 ? "x" : ""} enregistré{slotsCount > 1 ? "s" : ""}</p>
      <div className="rounded-xl bg-canal-gray-mid/50 p-3 mx-4">
        <p className="text-[10px] uppercase font-bold text-canal-gray-muted">Prochaine étape</p>
        <p className="text-white font-black mt-0.5">🎲 Tirage au sort en direct</p>
        <p className="text-canal-yellow font-bold text-sm">{BABYFOOT.drawLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4">
        <button
          onClick={() => { onEdit(); setTimeout(() => document.getElementById("inscrits")?.scrollIntoView({ behavior: "smooth" }), 50); }}
          className="min-h-[44px] rounded-xl bg-canal-yellow text-canal-black font-black text-sm">
          Voir les inscrits
        </button>
        <button onClick={onEdit} className="min-h-[44px] rounded-xl bg-canal-gray-mid border border-canal-gray-light text-white font-bold text-sm">
          Modifier
        </button>
      </div>
    </div>
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

// 🔎 Liste des chercheurs — TOUJOURS visible (pas besoin de changer de mode).
function SeekersList({ pctx, busy, act }: { pctx: PCtx; busy: boolean; act: (b: Record<string, unknown>, ok?: string) => Promise<{ ok: boolean; paired?: boolean }> }) {
  const list = pctx.seekers.filter((s) => s.id !== pctx.me?.id);
  if (!list.length || pctx.me?.registered) return null;
  return (
    <div className="canal-card border border-canal-yellow/30">
      <p className="text-xs font-bold uppercase text-canal-yellow mb-1">🔎 Cherchent un partenaire</p>
      <div className="divide-y divide-canal-gray-mid">
        {list.map((s) => (
          <div key={s.id} className="py-2.5 flex items-center gap-2 text-sm">
            <span className="flex-1 font-bold text-white">{s.name}</span>
            <button disabled={busy || !!pctx.outgoing}
              onClick={() => act({ action: "send", to_user_id: s.id }, `Invitation envoyée à ${s.name} ! 📨`)}
              className="text-xs font-black bg-canal-yellow text-canal-black rounded-lg px-3.5 py-1.5 disabled:opacity-40">
              Inviter
            </button>
          </div>
        ))}
      </div>
      {pctx.outgoing && <p className="text-[11px] text-canal-gray-muted mt-1.5">⏳ Invitation en cours vers {pctx.outgoing.toName} — annule-la (mode « Je choisis mon partenaire ») pour en envoyer une autre.</p>}
    </div>
  );
}

// 🙋 Se déclarer « cherche un partenaire » (la liste, elle, est toujours affichée au-dessus).
function SeekPanel({ pctx, busy, act }: { pctx: PCtx; busy: boolean; act: (b: Record<string, unknown>, ok?: string) => Promise<{ ok: boolean; paired?: boolean }> }) {
  if (pctx.me?.registered) return <p className="text-sm text-canal-gray-muted">Tu es déjà inscrit ({pctx.me.entryLabel}).</p>;
  return (
    <div className="canal-card space-y-3">
      {pctx.iAmSeeking ? (
        <div className="rounded-xl bg-green-900/20 border border-green-600/40 p-3 space-y-1.5">
          <p className="text-green-300 text-sm font-bold">🔎 Tu es sur la liste des chercheurs !</p>
          <p className="text-xs text-canal-gray-muted">Les collègues te voient en haut de cette page et peuvent t&apos;inviter en un clic.</p>
          <button disabled={busy} onClick={() => act({ action: "unseek" })} className="text-xs text-red-400 font-bold">Me retirer de la liste</button>
        </div>
      ) : (
        <>
          <button disabled={busy} onClick={() => act({ action: "seek" }, "C'est noté — tu es visible des autres chercheurs ! 🔎")}
            className="w-full min-h-[46px] rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-50">
            🙋 Je me déclare « cherche un partenaire »
          </button>
          <p className="text-[11px] text-canal-gray-muted">Ton nom apparaîtra dans la liste « 🔎 Cherchent un partenaire » avec un bouton Inviter.</p>
        </>
      )}
    </div>
  );
}

// 🏓 PAGE BINÔME — quand je suis inscrit. Sépare l'INSCRIPTION officielle (qui
// joue, qui l'a créée, quels créneaux) du rôle de RENFORT (dépanner un autre).
function BinomeHome({ ctx, isPair, onEdit }: { ctx: Ctx; isPair: boolean; onEdit: () => void }) {
  const bc = ctx.binomeCtx;
  const meName = ctx.binome?.meName ?? "Moi";
  const partnerName = bc?.partnerName ?? (isPair ? ctx.myOpenPair?.partnerName : ctx.binome?.partnerName) ?? "coéquipier";
  const helper = isPair && !!ctx.myOpenPair?.helper; // MON coéquipier est un renfort
  const avail = [...(ctx.myEntry?.availability ?? [])].sort(
    (a, b) => ctx.slots.findIndex((s) => s.key === a) - ctx.slots.findIndex((s) => s.key === b)
  );
  const slotLabel = (k: string) => ctx.slots.find((s) => s.key === k)?.label ?? k;
  const creatorLabel = bc?.iAmCreator ? "toi" : bc?.creatorName ?? partnerName;
  const authorLabel = bc?.iAmSlotsAuthor ? "toi" : bc?.slotsAuthorName ?? creatorLabel;

  return (
    <div className="space-y-4">
      <StatusBanner ctx={ctx} partnerName={partnerName} />

      {/* Qui joue + qui a créé l'inscription */}
      <div className="canal-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase text-canal-yellow flex items-center gap-1.5"><Users size={14} /> Votre binôme</h2>
          <span className="text-[11px] font-black text-green-400 flex items-center gap-1"><Check size={12} /> Inscrits</span>
        </div>
        <div className="flex items-center gap-2 text-white font-bold">
          <span className="px-3 py-3 rounded-xl bg-canal-gray-mid flex-1 text-center">{meName}</span>
          <span className="text-2xl">🤝</span>
          <span className="px-3 py-3 rounded-xl bg-canal-gray-mid flex-1 text-center">
            {partnerName}{helper && <span className="block text-[10px] text-canal-yellow font-bold">en renfort</span>}
          </span>
        </div>
        <p className="text-xs text-canal-gray-muted">
          Inscription créée par <b className="text-white">{creatorLabel}</b>
          {ctx.myEntry?.display_name ? <> · nom du binôme : <b className="text-white">{ctx.myEntry.display_name}</b></> : null}
        </p>
        {helper && (
          <p className="text-[11px] text-canal-gray-muted">{partnerName} te dépanne : il/elle joue, mais seuls TES points comptent.</p>
        )}
      </div>

      {/* Les créneaux — un seul éditeur à la fois, modification explicite */}
      <div className="canal-card space-y-3">
        <h2 className="text-sm font-black uppercase text-canal-yellow flex items-center gap-1.5"><CalendarClock size={14} /> Vos créneaux</h2>
        {avail.length ? (
          <div className="flex flex-wrap gap-1.5">
            {avail.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 text-xs font-bold text-canal-yellow bg-canal-yellow/10 border border-canal-yellow/30 rounded-lg px-2.5 py-1.5">
                <Check size={11} /> {slotLabel(k)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-canal-gray-muted">Aucun créneau sélectionné pour l&apos;instant.</p>
        )}
        <p className="text-[11px] text-canal-gray-muted">
          {bc?.iAmSlotsAuthor
            ? <>Créneaux sélectionnés par <b className="text-white">toi</b>.</>
            : <>Créneaux sélectionnés par <b className="text-white">{authorLabel}</b>.</>}
          {" "}Un seul membre les saisit pour éviter les conflits.
        </p>
        <button onClick={onEdit}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-canal-gray-mid border border-canal-gray-light text-white font-bold text-sm hover:border-canal-yellow/50 transition-colors">
          <Pencil size={14} /> Modifier mes disponibilités
        </button>
        {!bc?.iAmSlotsAuthor && (
          <p className="text-[11px] text-canal-gray-muted text-center">Si tu modifies, {authorLabel} en sera informé·e.</p>
        )}
      </div>

      {/* 🤝 Rôle de RENFORT — distinct de l'inscription officielle */}
      <DepannageInfoCard partnerName={partnerName} />
    </div>
  );
}

// Bandeau d'état du binôme : raconte où on en est (création → inscrit → tirage →
// prochain match) plutôt qu'un simple « inscrit ».
function StatusBanner({ ctx, partnerName }: { ctx: Ctx; partnerName: string }) {
  const nm = ctx.nextMatch;
  let icon = "🏓", title = "", sub: React.ReactNode = null;
  switch (ctx.homeState) {
    case "live":
      icon = "⚽";
      if (nm) {
        const when = nm.startsAt ? kickoffLabel(nm.startsAt) : "à venir";
        title = "Votre prochain match";
        sub = <>{nm.tableNo ? `Table ${nm.tableNo} · ` : ""}contre <b className="text-white">{nm.opponentLabel}</b> — {when}</>;
      } else {
        title = "Tournoi en cours"; sub = "Votre parcours est terminé ou vos matchs sont joués.";
      }
      break;
    case "draw":
      icon = "🎲"; title = "Tirage au sort en cours";
      sub = <>Votre premier match sera bientôt connu. Restez connecté·e !</>;
      break;
    default:
      icon = "🏓"; title = `Vous êtes inscrit avec ${partnerName}`;
      sub = <>Prochaine étape : le tirage au sort · <b className="text-white">{BABYFOOT.drawLabel}</b></>;
  }
  return (
    <div className="canal-card border-2 border-canal-yellow bg-canal-yellow/10">
      <div className="flex items-center gap-3">
        <span className="text-3xl shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="font-black text-white">{title}</p>
          {sub && <p className="text-xs text-canal-yellow font-bold mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// Carte informative : je reste dispo pour DÉPANNER quelqu'un, sans toucher à mon
// inscription. La demande, elle, arrive via HelpRequestCard (règles de score).
function DepannageInfoCard({ partnerName }: { partnerName: string }) {
  return (
    <div className="canal-card border border-canal-gray-light space-y-2">
      <h2 className="text-sm font-black uppercase text-white flex items-center gap-1.5"><HandHeart size={14} className="text-canal-yellow" /> Dépanner un autre joueur</h2>
      <p className="text-xs text-canal-gray-muted leading-relaxed">
        Ton binôme est absent, ou un·e collègue cherche un partenaire ? Tu peux <b className="text-white">jouer exceptionnellement</b> avec quelqu&apos;un d&apos;autre —
        ton inscription officielle avec <b className="text-white">{partnerName}</b> reste <b className="text-white">inchangée</b>.
      </p>
      <p className="text-[11px] text-canal-gray-muted">
        Comment ça marche : le joueur à dépanner t&apos;envoie une demande depuis <b className="text-white">« Je choisis mon partenaire »</b>.
        À l&apos;acceptation, tu joues en <b className="text-white">renfort</b> : seuls <b className="text-white">ses</b> points comptent.
      </p>
    </div>
  );
}

// 🤝 Demande de DÉPANNAGE reçue par un joueur DÉJÀ inscrit — règles de score
// explicites : l'inscription reste intacte, le renfort ne marque rien.
function HelpRequestCard({ fromName, withName, busy, onAccept, onRefuse }: {
  fromName: string; withName: string | null; busy: boolean; onAccept: () => void; onRefuse: () => void;
}) {
  return (
    <div className="canal-card border-2 border-canal-yellow bg-canal-yellow/10 space-y-3">
      <p className="text-center text-3xl">🤝</p>
      <p className="text-center font-black text-white text-lg leading-tight">Jouer exceptionnellement avec quelqu&apos;un d&apos;autre</p>
      <p className="text-center text-sm text-canal-gray-muted"><b className="text-canal-yellow">{fromName}</b> te demande de le/la dépanner au tournoi Baby-foot.</p>
      {withName && <p className="text-center text-xs text-canal-gray-muted">Tu es déjà inscrit avec <b className="text-white">{withName}</b>.</p>}
      <div className="rounded-xl bg-canal-gray-mid/50 p-3 space-y-1 text-sm">
        <p className="text-green-400 font-bold">✅ ton inscription actuelle reste inchangée</p>
        <p className="text-canal-gray-muted">❌ tu ne gagnes aucun point individuel</p>
        <p className="text-canal-gray-muted">❌ aucun point équipe n&apos;est attribué</p>
        <p className="text-white font-bold">🎯 seuls les points du joueur dépanné comptent</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={onAccept} className="min-h-[46px] rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-50">Accepter</button>
        <button disabled={busy} onClick={onRefuse} className="min-h-[46px] rounded-xl bg-canal-gray-mid border border-canal-gray-light text-white font-bold disabled:opacity-50">Refuser</button>
      </div>
    </div>
  );
}

// Formulaire de dispos (binôme officiel OU paire ad-hoc déjà créée).
function RegistrationForm({ ctx, isPair, displayName, setDisplayName, slots, toggle, submit, saving, done, onCancel }: {
  ctx: Ctx; isPair: boolean; displayName: string; setDisplayName: (v: string) => void;
  slots: Set<string>; toggle: (k: string) => void; submit: () => void; saving: boolean; done: boolean;
  onCancel?: () => void;
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

      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} disabled={saving}
            className="min-h-[48px] px-4 rounded-xl bg-canal-gray-mid border border-canal-gray-light text-white font-bold text-sm disabled:opacity-50">
            Annuler
          </button>
        )}
        <button
          onClick={submit}
          disabled={saving || !t?.registration_open || slots.size < ctx.minSlots}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-50 hover:bg-canal-yellow-hover transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
          {ctx.myEntry ? "Enregistrer les créneaux" : "Inscrire mon binôme"}
        </button>
      </div>
      {ctx.myEntry && !ctx.binomeCtx?.iAmCreator && (
        <p className="text-center text-[11px] text-canal-gray-muted">
          {ctx.binomeCtx?.partnerName ?? "Ton coéquipier"} sera prévenu de la modification.
        </p>
      )}
      {!t?.registration_open && (
        <p className="text-center text-xs text-canal-gray-muted">Les inscriptions sont closes — reviens plus tard.</p>
      )}
    </div>
  );
}
