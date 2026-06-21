"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Trophy, Star, Users, Medal, ChevronUp, ChevronDown, Minus } from "lucide-react";

type Player = {
  player_name: string;
  player_id?: string | null;
  team: string;
  matches: number;
  avg_rating: number | null;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  motm: number;
  position: "GK" | "DEF" | "MID" | "FWD" | null;
};

type TeamStat = {
  team: string;
  avg_rating: number | null;
  goals: number;
  player_count: number;
};

type BestXI = {
  gk: Player[];
  def: Player[];
  mid: Player[];
  fwd: Player[];
};

type TournamentStats = {
  players: Player[];
  teams: TeamStat[];
  best_xi: BestXI;
  total_matches: number;
};

type Tab = "players" | "xi" | "teams";
type SortKey = "avg_rating" | "goals" | "assists" | "motm" | "matches";

const POSITION_LABEL: Record<string, string> = { GK: "GB", DEF: "DEF", MID: "MIL", FWD: "ATT" };
const POSITION_COLOR: Record<string, string> = {
  GK: "bg-yellow-500/20 text-yellow-400",
  DEF: "bg-blue-500/20 text-blue-400",
  MID: "bg-green-500/20 text-green-400",
  FWD: "bg-red-500/20 text-red-400",
};

// Nom de joueur FIFA cliquable → fiche /football/players/[id] si l'id est connu.
function PlayerNameLink({ player, className, short }: { player: Player; className?: string; short?: boolean }) {
  const label = short ? player.player_name.split(" ").pop() : player.player_name;
  if (!player.player_id) return <span className={className}>{label}</span>;
  return (
    <Link href={`/football/players/${player.player_id}`} className={`${className ?? ""} hover:text-canal-yellow transition-colors`}>
      {label}
    </Link>
  );
}

function RatingBadge({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-canal-gray-muted text-xs">—</span>;
  const color =
    rating >= 8 ? "text-green-400" :
    rating >= 6.5 ? "text-canal-yellow" :
    rating >= 5 ? "text-orange-400" : "text-red-400";
  return <span className={`font-bold tabular-nums ${color}`}>{rating.toFixed(1)}</span>;
}

function FormationPitch({ xi }: { xi: BestXI }) {
  const rows = [
    { label: "ATT", players: xi.fwd },
    { label: "MIL", players: xi.mid },
    { label: "DEF", players: xi.def },
    { label: "GB",  players: xi.gk },
  ];

  return (
    <div className="relative rounded-xl overflow-hidden bg-green-950/60 border border-green-900/40 p-4">
      {/* Field lines */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-px bg-green-800/40" />
      </div>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
        <div className="w-28 h-28 rounded-full border border-green-800/40" />
      </div>

      <div className="relative space-y-4 py-2">
        {rows.map(({ label, players }) => (
          <div key={label} className="flex justify-around items-start gap-2">
            {players.map((p) => (
              <PlayerCard key={p.player_name} player={p} />
            ))}
            {players.length === 0 && (
              <div className="text-center text-canal-gray-muted text-xs py-4">Pas encore de données</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ player }: { player: Player }) {
  const pos = player.position ?? "FWD";
  return (
    <div className="flex flex-col items-center gap-1 min-w-0 w-16">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 border-canal-gray-light ${
        pos === "GK" ? "bg-yellow-500/30 text-yellow-300" :
        pos === "DEF" ? "bg-blue-500/30 text-blue-300" :
        pos === "MID" ? "bg-green-500/30 text-green-300" :
        "bg-red-500/30 text-red-300"
      }`}>
        {POSITION_LABEL[pos]}
      </div>
      <PlayerNameLink player={player} short className="text-white text-[10px] font-bold text-center leading-tight truncate w-full" />
      <RatingBadge rating={player.avg_rating} />
    </div>
  );
}

export default function Meilleur11Page() {
  const [data, setData] = useState<TournamentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("players");
  const [sortKey, setSortKey] = useState<SortKey>("avg_rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/tournament/stats")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sortedPlayers = useMemo(() => {
    if (!data) return [];
    let list = data.players;
    if (posFilter !== "ALL") list = list.filter((p) => p.position === posFilter);
    if (teamFilter !== "ALL") list = list.filter((p) => p.team === teamFilter);
    return [...list].sort((a, b) => {
      const va = (a[sortKey] as number | null) ?? -1;
      const vb = (b[sortKey] as number | null) ?? -1;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [data, sortKey, sortDir, posFilter, teamFilter]);

  const teams = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.players.map((p) => p.team).filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"));
  }, [data]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <Minus size={10} className="text-canal-gray-muted" />;
    return sortDir === "desc"
      ? <ChevronDown size={12} className="text-canal-yellow" />
      : <ChevronUp size={12} className="text-canal-yellow" />;
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "players", label: "Joueurs", icon: <Medal size={15} /> },
    { key: "xi",      label: "11 type", icon: <Star size={15} /> },
    { key: "teams",   label: "Équipes", icon: <Users size={15} /> },
  ];

  return (
    <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl flex items-center gap-2">
          <Trophy size={22} className="text-canal-yellow" />
          Stats Tournoi
        </h1>
        {data && (
          <p className="text-canal-gray-muted text-sm mt-1">
            {data.total_matches === 0
              ? "Les stats apparaîtront après le premier match"
              : `Basé sur ${data.total_matches} match${data.total_matches > 1 ? "s" : ""} joué${data.total_matches > 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-canal-gray rounded-xl p-1">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-bold transition-colors ${
              tab === key
                ? "bg-canal-yellow text-canal-black"
                : "text-canal-gray-muted hover:text-white"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="canal-card text-center py-12">
          <p className="text-canal-gray-muted animate-pulse">Chargement des stats…</p>
        </div>
      )}

      {!loading && data?.total_matches === 0 && (
        <div className="canal-card text-center py-12">
          <Trophy size={36} className="text-canal-gray-muted mx-auto mb-3" />
          <p className="text-white font-bold">Aucun match terminé</p>
          <p className="text-canal-gray-muted text-sm mt-1">Les stats apparaîtront ici après le premier match joué.</p>
        </div>
      )}

      {/* ── JOUEURS ── */}
      {!loading && tab === "players" && data && data.total_matches > 0 && (
        <div className="space-y-3">
          {/* Position filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {["ALL", "GK", "DEF", "MID", "FWD"].map((pos) => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  posFilter === pos
                    ? "bg-canal-yellow text-canal-black"
                    : "bg-canal-gray text-canal-gray-muted hover:text-white"
                }`}
              >
                {pos === "ALL" ? "Tous" : POSITION_LABEL[pos]}
              </button>
            ))}
          </div>
          <div>
            <label className="sr-only" htmlFor="team-filter">Filtrer par équipe</label>
            <select
              id="team-filter"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full rounded-lg border border-canal-gray-light bg-canal-gray px-3 py-2 text-sm font-bold text-white outline-none focus:border-canal-yellow"
            >
              <option value="ALL">Toutes les équipes</option>
              {teams.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          <div className="canal-card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-canal-gray-light">
                  <th className="text-left px-3 py-2.5 text-canal-gray-muted text-xs font-bold w-6">#</th>
                  <th className="text-left px-3 py-2.5 text-canal-gray-muted text-xs font-bold">Joueur</th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleSort("avg_rating")} className="flex items-center gap-0.5 ml-auto text-canal-gray-muted text-xs font-bold hover:text-white">
                      Note <SortIcon k="avg_rating" />
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleSort("goals")} className="flex items-center gap-0.5 ml-auto text-canal-gray-muted text-xs font-bold hover:text-white">
                      Buts <SortIcon k="goals" />
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleSort("assists")} className="flex items-center gap-0.5 ml-auto text-canal-gray-muted text-xs font-bold hover:text-white">
                      Passes <SortIcon k="assists" />
                    </button>
                  </th>
                  <th className="px-2 py-2.5 text-right">
                    <button onClick={() => toggleSort("motm")} className="flex items-center gap-0.5 ml-auto text-canal-gray-muted text-xs font-bold hover:text-white">
                      MOTM <SortIcon k="motm" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.slice(0, 50).map((p, i) => (
                  <tr key={`${p.player_name}-${p.team}`} className="border-b border-canal-gray-light/30 hover:bg-canal-gray-mid/30 transition-colors">
                    <td className="px-3 py-2.5 text-canal-gray-muted text-xs tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {p.position && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${POSITION_COLOR[p.position]}`}>
                            {POSITION_LABEL[p.position]}
                          </span>
                        )}
                        <div>
                          <PlayerNameLink player={p} className="block text-white font-bold text-xs leading-tight" />
                          <p className="text-canal-gray-muted text-[10px]">{p.team}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <RatingBadge rating={p.avg_rating} />
                    </td>
                    <td className="px-2 py-2.5 text-right text-canal-gray-muted text-xs tabular-nums">
                      {p.goals > 0 ? <span className="text-white font-bold">{p.goals}</span> : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right text-canal-gray-muted text-xs tabular-nums">
                      {p.assists > 0 ? <span className="text-white font-bold">{p.assists}</span> : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      {p.motm > 0 ? (
                        <span className="text-canal-yellow font-bold text-xs">★ {p.motm}</span>
                      ) : (
                        <span className="text-canal-gray-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {sortedPlayers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-canal-gray-muted text-sm">
                      Aucun joueur trouvé pour ce poste.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {sortedPlayers.length > 50 && (
            <p className="text-canal-gray-muted text-xs text-center">Affichage limité aux 50 premiers</p>
          )}
        </div>
      )}

      {/* ── 11 TYPE ── */}
      {!loading && tab === "xi" && data && data.total_matches > 0 && (
        <div className="space-y-3">
          <p className="text-canal-gray-muted text-xs text-center">Meilleurs joueurs par poste — formation 4-3-3</p>
          <FormationPitch xi={data.best_xi} />

          {/* Détails sous le terrain */}
          {(["fwd", "mid", "def", "gk"] as const).map((pos) => {
            const players = data.best_xi[pos];
            if (players.length === 0) return null;
            const labels: Record<string, string> = { fwd: "Attaquants", mid: "Milieux", def: "Défenseurs", gk: "Gardien" };
            return (
              <div key={pos} className="canal-card">
                <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider mb-2">{labels[pos]}</p>
                <div className="space-y-2">
                  {players.map((p) => (
                    <div key={p.player_name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${POSITION_COLOR[p.position ?? "FWD"]}`}>
                          {POSITION_LABEL[p.position ?? "FWD"]}
                        </span>
                        <div className="min-w-0">
                          <PlayerNameLink player={p} className="block text-white font-bold text-sm leading-tight truncate" />
                          <p className="text-canal-gray-muted text-xs">{p.team}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-right">
                        <div className="text-right">
                          <p className="text-canal-gray-muted text-[10px]">Moy.</p>
                          <RatingBadge rating={p.avg_rating} />
                        </div>
                        {p.goals > 0 && (
                          <div className="text-right">
                            <p className="text-canal-gray-muted text-[10px]">Buts</p>
                            <p className="text-white font-bold text-sm">{p.goals}</p>
                          </div>
                        )}
                        {p.motm > 0 && (
                          <div className="text-right">
                            <p className="text-canal-gray-muted text-[10px]">MOTM</p>
                            <p className="text-canal-yellow font-bold text-sm">★{p.motm}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ÉQUIPES ── */}
      {!loading && tab === "teams" && data && data.total_matches > 0 && (
        <div className="canal-card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-canal-gray-light">
                <th className="text-left px-3 py-2.5 text-canal-gray-muted text-xs font-bold w-6">#</th>
                <th className="text-left px-3 py-2.5 text-canal-gray-muted text-xs font-bold">Équipe</th>
                <th className="px-3 py-2.5 text-right text-canal-gray-muted text-xs font-bold">Note moy.</th>
                <th className="px-3 py-2.5 text-right text-canal-gray-muted text-xs font-bold">Buts</th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((t, i) => (
                <tr key={t.team} className="border-b border-canal-gray-light/30 hover:bg-canal-gray-mid/30 transition-colors">
                  <td className="px-3 py-3">
                    {i === 0 ? <span className="text-canal-yellow font-black">🥇</span> :
                     i === 1 ? <span className="text-gray-300 font-black">🥈</span> :
                     i === 2 ? <span className="text-amber-700 font-black">🥉</span> :
                     <span className="text-canal-gray-muted text-xs tabular-nums">{i + 1}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-white font-bold">{t.team}</p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <RatingBadge rating={t.avg_rating} />
                  </td>
                  <td className="px-3 py-3 text-right text-canal-gray-muted text-xs tabular-nums">
                    {t.goals > 0 ? <span className="text-white font-bold">{t.goals}</span> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
