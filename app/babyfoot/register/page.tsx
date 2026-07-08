"use client";

// /babyfoot/register — inscription de MON binôme au tournoi + disponibilités.
// Le binôme = mon équipe CanalCup (résolue côté serveur). Si je n'ai pas
// d'équipe → NoTeamCTA. Une seule inscription par binôme (modifiable).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Check, Users, CalendarClock, Loader2, PartyPopper } from "lucide-react";
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
  registeredCount: number;
  entries: { id: string; label: string }[];
}

export default function BabyfootRegisterPage() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [slots, setSlots] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = () => {
    fetch("/api/babyfoot/register", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: Ctx) => {
        setCtx(d);
        if (d.myEntry) {
          setDisplayName(d.myEntry.display_name ?? "");
          setSlots(new Set(d.myEntry.availability ?? []));
        }
      })
      .catch(() => setError("Chargement impossible."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggle = (k: string) =>
    setSlots((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/babyfoot/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ display_name: displayName, slots: [...slots] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Inscription impossible."); return; }
      setDone(true);
      load();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="px-4 py-10 text-center text-canal-gray-muted"><Loader2 className="animate-spin inline" /> </div>;
  }

  const t = ctx?.tournament;
  const remaining = t ? Math.max(0, t.target_teams - (ctx?.registeredCount ?? 0)) : 0;

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl flex items-center gap-2">
          <span className="text-3xl">🎮</span> Tournoi Baby-foot
        </h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Inscription en binôme — {t?.event_date ? new Date(t.event_date + "T00:00:00+11:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "date à venir"}
        </p>
      </div>

      {/* Statut inscriptions */}
      <div className={`canal-card border ${t?.registration_open ? "border-green-600/40 bg-green-900/10" : "border-canal-gray-light"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${t?.registration_open ? "bg-green-400 animate-pulse" : "bg-canal-gray-muted"}`} />
            <span className="font-bold text-sm">
              {t?.registration_open ? "Inscriptions ouvertes" : "Inscriptions fermées"}
            </span>
          </div>
          <span className="text-xs text-canal-gray-muted">
            {ctx?.registeredCount ?? 0} binôme{(ctx?.registeredCount ?? 0) > 1 ? "s" : ""} inscrit{(ctx?.registeredCount ?? 0) > 1 ? "s" : ""}
          </span>
        </div>
        {t?.registration_open && remaining > 0 && (
          <p className="text-xs text-canal-yellow font-bold mt-2">🎉 Plus que {remaining} binôme{remaining > 1 ? "s" : ""} avant l&apos;objectif !</p>
        )}
      </div>

      {/* Pas d'équipe → création inline d'une équipe baby-foot (sans quitter la
          page). resolveUserBinome renvoie teamId=null quand l'user n'a pas encore
          d'équipe. */}
      {ctx?.binome && !ctx.binome.teamId && (
        <CreateBabyfootTeamCard onCreated={load} />
      )}

      {/* Binôme incomplet : inscription solo IMPOSSIBLE (règle : exactement 2 joueurs) */}
      {ctx?.binome?.teamId && ctx.binome.memberCount !== 2 && (
        <div className="canal-card border border-canal-yellow/40 bg-canal-yellow/5 space-y-2">
          <p className="text-white font-bold text-sm">Il te faut un coéquipier 👥</p>
          <p className="text-canal-gray-muted text-xs">
            Un binôme baby-foot compte <b className="text-white">exactement 2 joueurs</b>. Tu ne peux pas t&apos;inscrire seul.
          </p>
          <Link href="/binomes" className="inline-flex items-center gap-1.5 text-canal-black bg-canal-yellow font-black text-sm rounded-lg px-3 py-2">
            <Users size={14} /> Trouver un coéquipier
          </Link>
        </div>
      )}

      {/* Formulaire (seulement si binôme COMPLET = 2 joueurs) */}
      {ctx?.binome?.teamId && ctx.binome.memberCount === 2 ? (
        <div className="canal-card space-y-5">
          {done && (
            <div className="rounded-xl bg-green-900/20 border border-green-600/40 p-3 flex items-center gap-2 text-green-300 text-sm font-bold">
              <PartyPopper size={16} /> {ctx.myEntry ? "Inscription mise à jour !" : "Binôme inscrit !"}
            </div>
          )}

          {/* Le binôme */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-canal-gray-muted flex items-center gap-1.5"><Users size={12} /> Votre binôme</label>
              {ctx.myEntry && <span className="text-[11px] font-black text-green-400 flex items-center gap-1"><Check size={12} /> Inscrits</span>}
            </div>
            <div className="mt-2 flex items-center gap-2 text-white font-bold">
              <span className="px-3 py-3 rounded-xl bg-canal-gray-mid flex-1 text-center">{ctx.binome.meName}</span>
              <span className="text-2xl">🤝</span>
              <span className="px-3 py-3 rounded-xl bg-canal-gray-mid flex-1 text-center">{ctx.binome.partnerName ?? "coéquipier"}</span>
            </div>
          </div>

          {/* Nom de binôme optionnel */}
          <div>
            <label className="text-xs font-bold uppercase text-canal-gray-muted">Nom du binôme (optionnel)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              placeholder={ctx.binome.teamName ?? "Ex. Les Foudres"}
              className="mt-2 w-full px-3 py-2 rounded-xl bg-canal-gray-mid text-white text-sm border border-canal-gray-light focus:border-canal-yellow outline-none"
            />
          </div>

          {/* Disponibilités — créneaux de 30 min (1 seule table) */}
          <div>
            <label className="text-xs font-bold uppercase text-canal-gray-muted flex items-center gap-1.5"><CalendarClock size={12} /> Vos disponibilités</label>
            <p className="text-[11px] text-canal-gray-muted mt-1">
              🏓 <b>Une seule table.</b> Choisissez au minimum <b>{ctx.minSlots}</b> créneaux de 30 min (recommandé : {ctx.recommendedSlots}+). Le tirage et le planning sont construits à partir de ces disponibilités — plus vous en cochez, plus c&apos;est facile.
            </p>
            {(["thu", "fri"] as const).map((day) => (
              <div key={day} className="mt-3">
                <p className="text-[11px] font-black text-canal-yellow uppercase mb-1.5">{day === "thu" ? "Jeudi 16" : "Vendredi 17"}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ctx.slots.filter((s) => s.day === day).map((s) => {
                    const on = slots.has(s.key);
                    const count = ctx.slotCounts[s.key] ?? 0;
                    const full = !on && count >= ctx.slotCap;
                    return (
                      <button
                        key={s.key}
                        disabled={full}
                        onClick={() => toggle(s.key)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                          full ? "bg-canal-gray-mid/40 border-canal-gray-light text-canal-gray-muted opacity-60"
                          : on ? "bg-canal-yellow/15 border-canal-yellow text-canal-yellow" : "bg-canal-gray-mid border-canal-gray-light text-white"
                        }`}
                      >
                        <span>{s.start}{full ? " · complet" : count > 0 ? ` · ${count}/${ctx.slotCap}` : ""}</span>
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

          {error && <p className="text-red-400 text-sm font-bold">{error}</p>}

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
      ) : null}

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
