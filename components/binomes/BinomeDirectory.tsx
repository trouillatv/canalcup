"use client";

// Annuaire "Trouver un binôme" (client). Filtres + recherche + groupement par
// service. PAS de points : on aide à former les équipes, pas à comparer les
// joueurs avant qu'ils aient joué. L'email n'est jamais affiché — un bouton
// "copier l'email" le copie en silence pour permettre un contact.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users, Plus, Ticket, Check, Mail, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BinomeEntry, BinomeServiceGroup } from "@/lib/data/binomes";
import type { FootballLevel } from "@/lib/supabase/types";

const LEVEL_META: Record<FootballLevel, { label: string; emoji: string }> = {
  expert: { label: "Expert", emoji: "⚽" },
  amateur: { label: "Amateur", emoji: "📺" },
  ambiance: { label: "Ambiance", emoji: "🎉" },
};

type Availability = "all" | "looking" | "in_team";

interface Props {
  entries: BinomeEntry[];
  services: BinomeServiceGroup[];
  myUserId: string | null;
  myTeamName: string | null;
  myInTeam: boolean;
}

export function BinomeDirectory({ entries, services, myUserId, myTeamName, myInTeam }: Props) {
  const [query, setQuery] = useState("");
  const [serviceId, setServiceId] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [availability, setAvailability] = useState<Availability>("all");
  const [copied, setCopied] = useState<string | null>(null);

  const lookingCount = entries.filter((e) => !e.team_id).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (q && !e.display_name.toLowerCase().includes(q)) return false;
      if (serviceId !== "all" && e.service_id !== serviceId) return false;
      if (level !== "all" && e.football_level !== level) return false;
      if (availability === "looking" && e.team_id) return false;
      if (availability === "in_team" && !e.team_id) return false;
      return true;
    });
  }, [entries, query, serviceId, level, availability]);

  // Groupement par service. "Sans service" en dernier.
  const groups = useMemo(() => {
    const order = new Map(services.map((s, i) => [s.id, i]));
    const byService = new Map<string, BinomeEntry[]>();
    for (const e of filtered) {
      const key = e.service_id ?? "__none__";
      const arr = byService.get(key) ?? [];
      arr.push(e);
      byService.set(key, arr);
    }
    const keys = [...byService.keys()].sort((a, b) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return (order.get(a) ?? 999) - (order.get(b) ?? 999);
    });
    return keys.map((k) => ({
      id: k,
      name: k === "__none__" ? "Sans service" : services.find((s) => s.id === k)?.name ?? "Service",
      people: byService.get(k)!,
    }));
  }, [filtered, services]);

  const copyEmail = async (email: string, key: string) => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard KO silencieux */
    }
  };

  return (
    <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
      <header>
        <h1 className="canal-headline text-2xl">Trouver un binôme</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          {lookingCount > 0
            ? `${lookingCount} participant${lookingCount > 1 ? "s" : ""} cherche${lookingCount > 1 ? "nt" : ""} encore un binôme.`
            : "Tout le monde a son binôme. 🎉"}
        </p>
      </header>

      {/* Mon statut + actions */}
      {myInTeam ? (
        <div className="canal-card flex items-center gap-3 border border-canal-green/30 bg-canal-green/5">
          <span className="text-2xl">✅</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">
              Tu es déjà dans l&apos;équipe <span className="text-canal-yellow">{myTeamName ?? "—"}</span>
            </p>
            <p className="text-xs text-canal-gray-muted">
              Tu peux quand même aider un collègue à trouver son binôme.
            </p>
          </div>
          <Link
            href="/profile"
            className="shrink-0 text-xs font-bold text-canal-yellow hover:underline"
          >
            Mon équipe →
          </Link>
        </div>
      ) : (
        <div className="canal-card space-y-3 border border-canal-yellow/30 bg-canal-yellow/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👀</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Tu cherches un binôme ?</p>
              <p className="text-xs text-canal-gray-muted">
                Crée ton équipe et partage ton code, ou rejoins celle d&apos;un collègue.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/profile"
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 bg-canal-yellow text-canal-black font-black rounded-xl text-sm hover:bg-canal-yellow-hover transition-colors"
            >
              <Plus size={14} /> Créer mon équipe
            </Link>
            <Link
              href="/profile"
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 bg-canal-gray-mid border border-canal-gray-light text-white font-bold rounded-xl text-sm hover:border-canal-yellow/40 transition-colors"
            >
              <Ticket size={14} /> Rejoindre par code
            </Link>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-gray-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom / pseudo"
            aria-label="Rechercher un participant"
            className="w-full min-h-[44px] bg-canal-gray-mid border border-canal-gray-light rounded-xl pl-9 pr-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow"
          />
        </div>

        {/* Disponibilité — segmenté */}
        <div className="flex gap-1 bg-canal-gray-mid border border-canal-gray-light rounded-xl p-1">
          {([
            { v: "all", label: "Tous" },
            { v: "looking", label: "👀 Cherchent" },
            { v: "in_team", label: "✅ En équipe" },
          ] as { v: Availability; label: string }[]).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setAvailability(opt.v)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors",
                availability === opt.v ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            aria-label="Filtrer par service"
            className="flex-1 min-h-[40px] bg-canal-gray-mid border border-canal-gray-light rounded-xl px-2 text-white text-sm focus:outline-none focus:border-canal-yellow"
          >
            <option value="all">Tous les services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            aria-label="Filtrer par niveau foot"
            className="flex-1 min-h-[40px] bg-canal-gray-mid border border-canal-gray-light rounded-xl px-2 text-white text-sm focus:outline-none focus:border-canal-yellow"
          >
            <option value="all">Tous niveaux</option>
            <option value="expert">⚽ Expert</option>
            <option value="amateur">📺 Amateur</option>
            <option value="ambiance">🎉 Ambiance</option>
          </select>
        </div>
      </div>

      {/* Annuaire groupé par service */}
      {filtered.length === 0 ? (
        <p className="text-center text-canal-gray-muted text-sm py-12">
          Aucun participant ne correspond à ces filtres.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.id}>
              <h2 className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                {g.name} <span className="text-canal-gray-muted">({g.people.length})</span>
              </h2>
              <div className="space-y-2">
                {g.people.map((p) => (
                  <PersonCard
                    key={p.user_id}
                    person={p}
                    isMe={p.user_id === myUserId}
                    copied={copied === p.user_id}
                    onCopyEmail={() => copyEmail(p.email, p.user_id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-[11px] text-canal-gray-muted italic leading-snug pt-2">
        Cet annuaire sert à former les binômes. Pas de points ni d&apos;activité ici —
        ça, c&apos;est sur les fiches joueurs et les classements.
      </p>
    </div>
  );
}

function PersonCard({
  person, isMe, copied, onCopyEmail,
}: {
  person: BinomeEntry;
  isMe: boolean;
  copied: boolean;
  onCopyEmail: () => void;
}) {
  const lvl = person.football_level ? LEVEL_META[person.football_level] : null;
  const looking = !person.team_id;

  return (
    <div
      className={cn(
        "bg-canal-gray-mid rounded-xl px-3 py-2.5 flex items-center gap-3",
        isMe && "ring-1 ring-canal-yellow/50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold text-white truncate">
            {person.display_name}
            {isMe && <span className="text-canal-gray-muted font-normal"> (toi)</span>}
          </p>
          {person.is_captain && (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-canal-yellow text-canal-black flex items-center gap-1 shrink-0">
              <Crown size={9} /> Capitaine
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Statut équipe */}
          {looking ? (
            person.has_pending_request ? (
              <span className="text-[11px] font-bold text-canal-yellow flex items-center gap-1">
                ⏳ Demande en attente
              </span>
            ) : (
              <span className="text-[11px] font-bold text-canal-yellow flex items-center gap-1">
                👀 Cherche un binôme
              </span>
            )
          ) : (
            <span className="text-[11px] text-canal-gray-muted flex items-center gap-1 min-w-0">
              <Users size={11} className="shrink-0" />
              <span className="truncate">{person.team_name ?? "En équipe"}</span>
            </span>
          )}

          {/* Niveau foot */}
          {lvl && (
            <span className="text-[11px] text-canal-gray-muted">
              {lvl.emoji} {lvl.label}
            </span>
          )}
        </div>
      </div>

      {/* Contacter — copie l'email en silence (jamais affiché). Inutile sur soi. */}
      {!isMe && person.email && (
        <button
          type="button"
          onClick={onCopyEmail}
          aria-label={`Copier l'email de ${person.display_name}`}
          title="Copier l'email pour contacter"
          className="shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-canal-gray border border-canal-gray-light/40 text-canal-gray-muted hover:text-canal-yellow hover:border-canal-yellow/40 transition-colors"
        >
          {copied ? <Check size={15} className="text-canal-green" /> : <Mail size={15} />}
        </button>
      )}
    </div>
  );
}
