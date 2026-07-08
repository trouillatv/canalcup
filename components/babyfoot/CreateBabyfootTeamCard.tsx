"use client";

// Carte "Crée ton équipe baby-foot" affichée sur /babyfoot/register quand
// l'utilisateur scanne le QR mais n'a PAS encore d'équipe. Objectif : créer
// son binôme SANS quitter la page d'inscription (avant, on renvoyait vers
// /profile). Après création, on affiche le code d'invitation à partager pour
// recruter le 2ᵉ joueur, puis on rafraîchit le contexte parent.
//
// Un binôme baby-foot = EXACTEMENT 2 joueurs. Ici on crée l'équipe (l'user
// devient capitaine, seul) ; il invite ensuite son coéquipier via le code.

import { useState } from "react";
import Link from "next/link";
import { Users, Plus, Loader2, Check, Share2, Ticket, PartyPopper } from "lucide-react";

interface CreatedTeam {
  name: string;
  invite_code: string | null;
}

export function CreateBabyfootTeamCard({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTeam | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: trimmed }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Création impossible.");
        return;
      }
      setCreated({ name: d.team?.name ?? trimmed, invite_code: d.team?.invite_code ?? null });
      // On prévient le parent : il re-fetch le contexte et enchaîne sur
      // l'étape « il te faut un coéquipier » / le formulaire d'inscription.
      onCreated();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  };

  const inviteLink =
    created?.invite_code && typeof window !== "undefined"
      ? `${window.location.origin}/onboarding?invite=${created.invite_code}`
      : "";

  const share = async () => {
    if (!inviteLink || !created) return;
    const text = `Rejoins mon équipe baby-foot « ${created.name} » : ${inviteLink}`;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({
          title: `Baby-foot CanalCup — ${created.name}`,
          text: `Rejoins mon équipe baby-foot « ${created.name} »`,
          url: inviteLink,
        });
        return;
      }
    } catch {
      /* annulé → pas une erreur */
    }
    try {
      const clip = typeof navigator !== "undefined" ? (navigator as Navigator).clipboard : undefined;
      if (clip) {
        await clip.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* clipboard KO silencieux */
    }
  };

  // État APRÈS création : on montre le code à partager pour recruter le binôme.
  if (created) {
    return (
      <div className="canal-card border border-green-600/40 bg-green-900/10 space-y-3">
        <p className="text-green-300 font-bold text-sm flex items-center gap-2">
          <PartyPopper size={16} /> Équipe « {created.name} » créée !
        </p>
        <p className="text-canal-gray-muted text-xs leading-snug">
          Il te reste à recruter <b className="text-white">1 coéquipier</b> — un
          binôme baby-foot compte exactement 2 joueurs. Partage-lui ce code pour
          qu&apos;il rejoigne ton équipe :
        </p>
        {created.invite_code && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(created.invite_code!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch { /* */ }
              }}
              className="flex-1 min-h-[44px] font-mono font-black text-canal-yellow text-lg tracking-widest text-center bg-canal-gray-mid border border-canal-gray-light rounded-xl hover:border-canal-yellow/40 transition-colors flex items-center justify-center gap-2"
              aria-label="Copier le code d'invitation"
            >
              {copied ? <Check size={16} /> : null}
              {copied ? "Copié" : created.invite_code}
            </button>
            <button
              type="button"
              onClick={share}
              className="min-h-[44px] px-4 rounded-xl bg-canal-yellow text-canal-black font-black flex items-center gap-1.5 hover:bg-canal-yellow-hover transition-colors"
            >
              <Share2 size={14} /> Partager
            </button>
          </div>
        )}
        <Link
          href="/binomes"
          className="inline-flex items-center gap-1.5 text-canal-yellow text-sm font-bold underline"
        >
          <Users size={14} /> Trouver un coéquipier dans l&apos;annuaire
        </Link>
      </div>
    );
  }

  // État INITIAL : formulaire de création.
  return (
    <div className="canal-card border border-canal-yellow/40 bg-canal-yellow/5 space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-canal-yellow/10 flex items-center justify-center text-2xl shrink-0">
          🏓
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-white font-bold text-sm">Tu n&apos;as pas encore d&apos;équipe</p>
          <p className="text-canal-gray-muted text-xs leading-snug">
            Crée ton équipe baby-foot ici — tu en deviens capitaine, puis tu
            invites ton coéquipier (binôme de 2). Les points iront sur ton équipe.
          </p>
        </div>
      </div>

      <form onSubmit={create} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de l'équipe (ex. Les Foudres)"
          maxLength={60}
          aria-label="Nom de l'équipe baby-foot à créer"
          className="flex-1 min-h-[44px] px-3 rounded-xl bg-canal-gray-mid text-white placeholder:text-canal-gray-muted text-sm border border-canal-gray-light focus:border-canal-yellow outline-none"
        />
        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="min-h-[44px] px-4 rounded-xl bg-canal-yellow text-canal-black font-black flex items-center gap-1.5 disabled:opacity-40 hover:bg-canal-yellow-hover transition-colors"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Créer
        </button>
      </form>

      {error && <p className="text-red-400 text-sm font-bold">{error}</p>}

      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-canal-gray-muted text-xs hover:text-white transition-colors"
      >
        <Ticket size={12} /> J&apos;ai déjà un code d&apos;invitation — rejoindre une équipe
      </Link>
    </div>
  );
}
