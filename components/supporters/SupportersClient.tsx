"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Upload, Check, Trophy, Vote, Clock, Users, Send, X, MessageCircle, EyeOff } from "lucide-react";
import { SUPPORTERS_REACTIONS, VAR_MANUAL_CATEGORIES, publishOpen } from "@/lib/supporters/access";

// Affiche une photo OU une vidéo selon le type de média.
function MediaView({ url, type, className, onZoom }: { url: string; type: "image" | "video"; className?: string; onZoom?: () => void }) {
  if (type === "video") {
    return <video src={url} className={className} controls playsInline preload="metadata" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`${className ?? ""}${onZoom ? " cursor-zoom-in" : ""}`} onClick={onZoom} />;
}

interface Comment {
  id: string;
  user_id: string | null;
  display_name: string;
  body: string;
  created_at: string;
}
interface GalleryItem {
  id: string;
  team_id: string;
  team_name: string;
  title: string | null;
  photo_url: string;
  photo_url_2: string | null;
  is_mine: boolean;
  media_type: "image" | "video";
  media_type_2: "image" | "video" | null;
  votes_count: number | null;
  comments: Comment[];
  reactions: Record<string, number>;
  my_reactions: string[];
}
interface ResultRow {
  rank: number;
  team_name: string;
  title: string | null;
  photo_url: string;
  votes_count: number;
  points: number;
}
interface Participant {
  name: string;
  teamName: string | null;
  voted: boolean;
}
interface VarAward {
  key: string;
  emoji: string;
  label: string;
  team_name: string;
  photo_url: string;
  title: string | null;
  count: number;
  jury?: boolean;
}
interface Data {
  settings: { votes_open: boolean; results_published: boolean; votes_closed: boolean; close_at: string };
  me: { userId: string; teamId: string | null; teamName: string | null };
  isOrganizer: boolean;
  myEntry: { id: string; title: string | null; photo_url: string; photo_url_2: string | null; status: string; media_type: "image" | "video"; media_type_2: "image" | "video" | null } | null;
  myVote: { entry_id: string } | null;
  gallery: GalleryItem[];
  results: ResultRow[] | null;
  totalVotes: number | null;
  participants: Participant[] | null;
  varAwards: VarAward[] | null;
  stats: { photos: number; teams: number; voters: number; participants: number; nonVoters: number; daysLeft: number };
  activity: ActivityEvent[];
  radar: {
    temperature: "faible" | "normale" | "tres_active";
    today: { photos: number; reactions: number; comments: number; votes: number };
    teamsTotal: number;
    postedCount: number;
    notPostedTeams: string[];
    nonVoters: number;
  } | null;
  manualVar?: Record<string, string>;
}
interface ActivityEvent {
  kind: "photo" | "reaction" | "comment";
  at: string;
  actor: string;
  team: string;
  emoji?: string;
}

const STATUS_LABEL: Record<string, string> = {
  approved: "✅ Publiée",
  hidden: "🚫 Masquée par un organisateur",
};
const MEDAL = ["🥇", "🥈", "🥉"];

// ─── Commentaires sous une photo (chambrage) ────────────────────────────────
function PhotoComments({
  entryId, comments, isOrganizer, onReload,
}: {
  entryId: string;
  comments: Comment[];
  isOrganizer: boolean;
  onReload: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch("/api/supporters/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entryId, body: t }),
      });
      if (res.ok) { setText(""); onReload(); }
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/supporters/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_comment", comment_id: id }),
      });
      if (res.ok) onReload();
    } finally { setBusy(false); }
  };

  return (
    <div className="border-t border-canal-gray-light/20 pt-2 space-y-2">
      {comments.length > 0 && (
        <div className="space-y-1.5">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-1.5 text-xs">
              <span className="font-bold text-canal-yellow shrink-0">{c.display_name}</span>
              <span className="text-canal-gray-light flex-1 break-words">{c.body}</span>
              {isOrganizer && (
                <button onClick={() => del(c.id)} disabled={busy} className="text-canal-gray-muted hover:text-red-400 shrink-0" title="Supprimer le commentaire">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }}
          placeholder="Un petit mot, un chambrage…"
          maxLength={280}
          className="flex-1 bg-canal-black border border-canal-gray-light rounded-lg px-2 py-1.5 text-xs"
        />
        <button
          onClick={post}
          disabled={busy || !text.trim()}
          className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-canal-gray-light text-white disabled:opacity-40 flex items-center gap-1"
          aria-label="Envoyer"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Réactions emoji rapides ─────────────────────────────────────────────────
// Optimiste : le compteur bouge AU TAP (récompense immédiate), puis on
// synchronise avec le serveur (et le polling resynchronise les autres).
function ReactionBar({
  entryId, reactions, mine, onReload,
}: {
  entryId: string;
  reactions: Record<string, number>;
  mine: string[];
  onReload: () => void;
}) {
  const [localCounts, setLocalCounts] = useState<Record<string, number>>(reactions);
  const [localMine, setLocalMine] = useState<string[]>(mine);

  // Resync quand les données serveur arrivent (chargement initial / polling).
  useEffect(() => { setLocalCounts(reactions); setLocalMine(mine); }, [reactions, mine]);

  const toggle = (emoji: string) => {
    const active = localMine.includes(emoji);
    // Mise à jour optimiste immédiate.
    setLocalMine(active ? localMine.filter((e) => e !== emoji) : [...localMine, emoji]);
    setLocalCounts({ ...localCounts, [emoji]: Math.max(0, (localCounts[emoji] ?? 0) + (active ? -1 : 1)) });
    fetch("/api/supporters/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_id: entryId, emoji }),
    }).then(() => onReload()).catch(() => onReload());
  };
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {SUPPORTERS_REACTIONS.map((e) => {
        const count = localCounts[e] ?? 0;
        const active = localMine.includes(e);
        return (
          <button
            key={e}
            onClick={() => toggle(e)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-base leading-none border transition-colors active:scale-95 ${
              active ? "bg-canal-yellow/20 border-canal-yellow/50" : "bg-canal-gray-mid border-transparent hover:border-canal-gray-light"
            }`}
          >
            <span>{e}</span>
            {count > 0 && <span className={`text-xs font-bold tabular-nums ${active ? "text-canal-yellow" : "text-canal-gray-muted"}`}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Flux d'activité (mur vivant) ────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}
function ActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  if (!activity.length) return null;
  const line = (a: ActivityEvent) => {
    if (a.kind === "photo") return <><span className="font-bold text-white">{a.actor}</span> a publié sa photo 📸</>;
    if (a.kind === "reaction") return <><span className="font-bold text-white">{a.actor}</span> a réagi {a.emoji} à la photo de <span className="text-canal-gray-light">{a.team}</span></>;
    return <><span className="font-bold text-white">{a.actor}</span> a commenté la photo de <span className="text-canal-gray-light">{a.team}</span> 💬</>;
  };
  return (
    <section className="canal-card">
      <h2 className="text-xs text-canal-yellow font-bold uppercase mb-2">🔴 En direct</h2>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {activity.map((a, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-canal-gray-muted min-w-0">{line(a)}</span>
            <span className="text-[10px] text-canal-gray-muted/60 shrink-0">{timeAgo(a.at)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Compteur de participation (pression sociale, visible par tous) ──────────
function StatBar({ stats }: { stats: Data["stats"] }) {
  const Item = ({ icon, value, label, accent }: { icon: string; value: number; label: string; accent?: boolean }) => (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <span className={`text-2xl font-black tabular-nums ${accent ? "text-red-300" : "text-canal-yellow"}`}>{value}</span>
      <span className="text-[10px] text-canal-gray-muted uppercase tracking-wide text-center leading-tight mt-0.5">{icon} {label}</span>
    </div>
  );
  return (
    <section className="canal-card flex items-stretch justify-around gap-1 py-3">
      <Item icon="📸" value={stats.photos} label="photos" />
      <Item icon="👥" value={stats.teams} label="binômes" />
      <Item icon="🗳️" value={stats.voters} label="ont voté" />
      <Item icon="⚠️" value={stats.nonVoters} label="pas encore" accent />
    </section>
  );
}

// ─── Compte à rebours jusqu'à la clôture des votes ───────────────────────────
function Countdown({ closeAt, closed }: { closeAt: string; closed: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = new Date(closeAt).getTime();
  const diff = target - now;

  if (closed || diff <= 0) {
    return (
      <section className="canal-card border border-red-500/40 bg-red-950/20 text-center">
        <p className="text-sm font-black text-red-300 uppercase tracking-wider">🔒 Votes clôturés</p>
        <p className="text-[11px] text-canal-gray-muted mt-1">Le verdict tombe bientôt. Merci d&apos;avoir voté !</p>
      </section>
    );
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const Box = ({ v, l }: { v: number; l: string }) => (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-black text-canal-yellow tabular-nums leading-none">{String(v).padStart(2, "0")}</span>
      <span className="text-[9px] text-canal-gray-muted uppercase tracking-wider mt-0.5">{l}</span>
    </div>
  );
  return (
    <section className="canal-card border border-canal-yellow/30 text-center">
      <p className="text-[11px] text-canal-gray-muted uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
        <Clock size={13} className="text-canal-yellow" /> Clôture des votes dans
      </p>
      <div className="flex items-center justify-center gap-3">
        <Box v={d} l="jours" />
        <span className="text-xl text-canal-gray-light">:</span>
        <Box v={h} l="h" />
        <span className="text-xl text-canal-gray-light">:</span>
        <Box v={m} l="min" />
        <span className="text-xl text-canal-gray-light">:</span>
        <Box v={s} l="sec" />
      </div>
      <p className="text-[10px] text-canal-gray-muted/70 mt-2">Jeudi 25 juin à 23:59:59 (heure NC)</p>
    </section>
  );
}

export function SupportersClient() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [tab, setTab] = useState<"galerie" | "nonvoters" | "radar">("galerie");
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<"main" | "bonus">("main");

  const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video" } | null>(null);

  const load = useCallback(() => {
    fetch("/api/supporters").then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  // Temps réel (léger) : on rafraîchit en fond toutes les 12 s quand l'onglet
  // est visible → réactions/commentaires/activité/compteur des autres
  // apparaissent sans recharger. (Optimiste côté tap pour la réaction propre.)
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 12000);
    return () => clearInterval(t);
  }, [load]);

  const upload = async (file: File, slot: "main" | "bonus" = "main") => {
    setBusy(true); setFlash(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slot", slot);
      if (slot === "main" && title.trim()) fd.append("title", title.trim());
      const res = await fetch("/api/supporters/entry", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) setFlash({ kind: "err", msg: d.error ?? "Échec de l'envoi." });
      else {
        setFlash({ kind: "ok", msg: slot === "bonus" ? "2e image ajoutée ! 📷" : "Publié ! C'est déjà dans la galerie. 📸" });
        load();
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deletePhoto = async () => {
    if (!confirm("Supprimer la photo de ton binôme ? Les votes, réactions et commentaires liés seront retirés. Tu pourras en reposter une.")) return;
    setBusy(true); setFlash(null);
    try {
      const res = await fetch("/api/supporters/entry", { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setFlash({ kind: "err", msg: d.error ?? "Suppression impossible." });
      else { setFlash({ kind: "ok", msg: "Photo supprimée. Tu peux en reposter une. 🗑️" }); load(); }
    } finally { setBusy(false); }
  };

  const vote = async (entryId: string) => {
    setBusy(true); setFlash(null);
    try {
      const res = await fetch("/api/supporters/vote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entryId }),
      });
      const d = await res.json();
      if (!res.ok) setFlash({ kind: "err", msg: d.error ?? "Vote impossible." });
      else { setFlash({ kind: "ok", msg: "Vote enregistré ! 🗳️" }); load(); }
    } finally { setBusy(false); }
  };

  if (!data) {
    return <div className="text-canal-gray-muted text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Chargement…</div>;
  }

  const { settings, me, myEntry, myVote, gallery, results, isOrganizer, participants, varAwards, stats, activity, radar, manualVar } = data;
  // Publication ouverte seulement à partir de mardi, et tant que les résultats
  // ne sont pas dévoilés.
  const canPublish = publishOpen() && !settings.results_published;
  const hasVoted = !!myVote;
  const nonVoters = (participants ?? []).filter((p) => !p.voted);

  return (
    <div className="space-y-5">
      {/* Lightbox plein écran (clic sur une photo pour l'agrandir) */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button aria-label="Fermer" className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <X size={28} />
          </button>
          {lightbox.type === "video" ? (
            <video src={lightbox.url} className="max-h-[90vh] max-w-full rounded-lg" controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.url} alt="" className="max-h-[90vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* Compte à rebours */}
      <Countdown closeAt={settings.close_at} closed={settings.votes_closed} />

      {/* Compteur de participation (pression sociale) */}
      <StatBar stats={stats} />

      {/* Flux d'activité en direct */}
      <ActivityFeed activity={activity} />

      {/* Onglets organisateurs (Marie & Vincent) */}
      {isOrganizer && (
        <div className="flex items-center gap-1.5 rounded-xl bg-canal-gray-mid/60 p-1">
          <button
            onClick={() => setTab("galerie")}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === "galerie" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"}`}
          >
            📸 Galerie & votes
          </button>
          <button
            onClick={() => setTab("nonvoters")}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${tab === "nonvoters" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"}`}
          >
            <Users size={13} /> Pas voté ({nonVoters.length})
          </button>
          <button
            onClick={() => setTab("radar")}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === "radar" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"}`}
          >
            📡 Radar
          </button>
        </div>
      )}

      {/* Vue organisateur : RADAR d'animation — données → décision */}
      {isOrganizer && tab === "radar" && radar && (() => {
        const TEMP = {
          faible: { label: "Calme", emoji: "🥶", cls: "border-blue-500/40 bg-blue-950/20 text-blue-200" },
          normale: { label: "Ça vit", emoji: "🙂", cls: "border-canal-yellow/40 bg-canal-yellow/10 text-canal-yellow" },
          tres_active: { label: "Ça chauffe !", emoji: "🔥", cls: "border-red-500/50 bg-red-950/20 text-red-200" },
        }[radar.temperature];
        // Action recommandée : on hiérarchise vers la relance la plus utile.
        const action =
          radar.notPostedTeams.length > 0
            ? { txt: `Relancer les ${radar.notPostedTeams.length} binôme${radar.notPostedTeams.length > 1 ? "s" : ""} sans photo`, hint: "Le concours a besoin de photos pour démarrer.", target: "no_photo" as const }
            : radar.nonVoters > 0
              ? { txt: `Envoyer un rappel aux ${radar.nonVoters} non-votant${radar.nonVoters > 1 ? "s" : ""}`, hint: "Push ciblé aux personnes concernées.", target: "no_vote" as const }
              : { txt: "Rien à faire — tout le monde joue le jeu 🎉", hint: "", target: null };
        return (
          <section className="canal-card space-y-4">
            <h2 className="text-xs text-canal-yellow font-bold uppercase flex items-center gap-1.5">📡 Radar d&apos;animation · organisateurs</h2>

            {/* Température */}
            <div className={`rounded-xl border p-4 text-center ${TEMP.cls}`}>
              <p className="text-4xl mb-1">{TEMP.emoji}</p>
              <p className="text-lg font-black uppercase tracking-wide">{TEMP.label}</p>
              <p className="text-[11px] opacity-80 mt-1">Température du concours (dernières 24 h)</p>
            </div>

            {/* Activité du jour */}
            <div>
              <p className="text-[11px] text-canal-gray-muted uppercase tracking-wide mb-2">Dernières 24 h</p>
              <div className="flex items-center justify-around text-center">
                <div><p className="text-xl font-black text-white tabular-nums">+{radar.today.photos}</p><p className="text-[10px] text-canal-gray-muted">📸 photos</p></div>
                <div><p className="text-xl font-black text-white tabular-nums">+{radar.today.reactions}</p><p className="text-[10px] text-canal-gray-muted">😂 réactions</p></div>
                <div><p className="text-xl font-black text-white tabular-nums">+{radar.today.comments}</p><p className="text-[10px] text-canal-gray-muted">💬 commentaires</p></div>
                <div><p className="text-xl font-black text-white tabular-nums">+{radar.today.votes}</p><p className="text-[10px] text-canal-gray-muted">🗳️ votes</p></div>
              </div>
            </div>

            {/* Points de friction */}
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white">📸 Binômes ayant posté</span>
                <span className="font-bold tabular-nums text-canal-gray-muted">{radar.postedCount}/{radar.teamsTotal}</span>
              </div>
              {radar.notPostedTeams.length > 0 && (
                <p className="text-[11px] text-red-300">Sans photo : {radar.notPostedTeams.join(", ")}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-white">🗳️ N&apos;ont pas voté</span>
                <span className={`font-bold tabular-nums ${radar.nonVoters > 0 ? "text-red-300" : "text-green-300"}`}>{radar.nonVoters}</span>
              </div>
            </div>

            {/* Action recommandée + relance en 1 clic (ferme la boucle) */}
            <div className="rounded-xl border border-canal-yellow/40 bg-canal-yellow/5 p-3">
              <p className="text-[11px] text-canal-yellow font-bold uppercase tracking-wide mb-1">Action recommandée</p>
              <p className="text-sm font-bold text-white">{action.txt}</p>
              {action.hint && <p className="text-[11px] text-canal-gray-muted mt-0.5">{action.hint}</p>}
              {action.target && (
                <button
                  onClick={async () => {
                    const label = action.target === "no_photo" ? "binômes sans photo" : "non-votants";
                    if (!confirm(`Envoyer un push de relance aux ${label} ?`)) return;
                    setBusy(true);
                    try {
                      const res = await fetch("/api/supporters/relance", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ target: action.target }),
                      });
                      const d = await res.json();
                      setFlash(res.ok
                        ? { kind: "ok", msg: `Relance envoyée à ${d.sent}/${d.targeted} personne(s). 📢` }
                        : { kind: "err", msg: d.error ?? "Relance impossible." });
                    } finally { setBusy(false); }
                  }}
                  disabled={busy}
                  className="mt-2.5 w-full text-sm font-bold px-3 py-2 rounded-lg bg-canal-yellow text-canal-black disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  📢 Relancer maintenant
                </button>
              )}
            </div>
          </section>
        );
      })()}

      {/* Vue organisateur : qui n'a pas voté */}
      {isOrganizer && tab === "nonvoters" && (
        <section className="canal-card">
          <h2 className="text-xs text-canal-yellow font-bold uppercase mb-1 flex items-center gap-1.5">
            <Users size={14} /> Suivi des votes
          </h2>
          <p className="text-[11px] text-canal-gray-muted mb-3">
            {participants?.length ?? 0} joueurs inscrits · {(participants?.length ?? 0) - nonVoters.length} ont voté · <span className="text-red-300 font-bold">{nonVoters.length} à relancer</span>
          </p>
          {nonVoters.length === 0 ? (
            <p className="text-sm text-green-300">🎉 Tout le monde a voté !</p>
          ) : (
            <ul className="divide-y divide-canal-gray-light/20">
              {nonVoters.map((p, i) => (
                <li key={i} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="font-semibold text-white truncate">{p.name}</span>
                  <span className="text-[11px] text-canal-gray-muted shrink-0 ml-2">{p.teamName ?? "Sans binôme"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(!isOrganizer || tab === "galerie") && (
      <>
      {/* Règles rapides */}
      <section className="canal-card border border-canal-yellow/30 bg-canal-yellow/5">
        <h2 className="text-xs text-canal-yellow font-bold uppercase mb-2">Règles</h2>
        <ul className="text-xs text-canal-gray-muted space-y-1">
          <li>• 1 photo par binôme — <span className="text-white font-bold">+10 pts</span>, visible aussitôt</li>
          <li>• Vote individuel : 1 voix chacun, jamais pour son propre binôme</li>
          <li>• Podium : <span className="text-white font-bold">+40 / +30 / +20</span> pts (1er / 2e / 3e)</li>
        </ul>
      </section>

      {flash && (
        <div className={`text-sm rounded-lg p-3 ${flash.kind === "ok" ? "bg-green-950/30 text-green-300 border border-green-500/30" : "bg-red-950/30 text-red-300 border border-red-500/30"}`}>
          {flash.msg}
        </div>
      )}

      {/* Mon binôme */}
      <section className="canal-card">
        <h2 className="text-xs text-canal-yellow font-bold uppercase mb-2">Mon binôme</h2>
        {!me.teamId ? (
          <p className="text-sm text-canal-gray-muted">Trouve ton binôme pour participer à la Journée Supporters. 🤝</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-bold text-white">{me.teamName ?? "Mon binôme"}</p>
            {myEntry && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <MediaView url={myEntry.photo_url} type={myEntry.media_type} onZoom={() => setLightbox({ url: myEntry.photo_url, type: myEntry.media_type })} className="w-full rounded-lg object-contain max-h-72 bg-canal-black" />
                  {myEntry.title && <p className="text-sm text-white">{myEntry.title}</p>}
                  <p className="text-xs text-canal-gray-muted">{STATUS_LABEL[myEntry.status] ?? myEntry.status} · photo principale (votée)</p>
                </div>
                {myEntry.photo_url_2 && (
                  <div className="space-y-1.5">
                    <MediaView url={myEntry.photo_url_2} type={myEntry.media_type_2 ?? "image"} onZoom={() => setLightbox({ url: myEntry.photo_url_2!, type: myEntry.media_type_2 ?? "image" })} className="w-full rounded-lg object-contain max-h-72 bg-canal-black" />
                    <p className="text-xs text-canal-gray-muted">📷 2e image (bonus, non votée)</p>
                  </div>
                )}
                {!settings.results_published && (
                  <button onClick={deletePhoto} disabled={busy} className="text-xs font-bold text-red-300 hover:text-red-200 disabled:opacity-50 flex items-center gap-1.5">
                    <X size={13} /> Supprimer la photo du binôme
                  </button>
                )}
              </div>
            )}
            {settings.results_published ? (
              <p className="text-xs text-canal-gray-muted border-t border-canal-gray-light pt-3">
                Concours terminé — la publication est figée.
              </p>
            ) : !canPublish ? (
              <p className="text-sm text-canal-yellow border-t border-canal-gray-light pt-3">
                📸 Les publications ouvrent <span className="font-bold">demain (mardi)</span>. Reviens pour poster ta photo ou ta vidéo de supporter !
              </p>
            ) : (
              <div className="space-y-2 border-t border-canal-gray-light pt-3">
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre / légende (optionnel)" maxLength={120}
                  className="w-full bg-canal-black border border-canal-gray-light rounded-lg px-2 py-2 text-sm"
                />
                <input
                  ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden"
                  onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) upload(f, slotRef.current); }}
                />
                <button
                  disabled={busy} onClick={() => { slotRef.current = "main"; fileRef.current?.click(); }}
                  className="w-full text-sm font-bold px-3 py-2 rounded-lg bg-canal-yellow text-canal-black disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload size={15} /> {busy ? "Envoi…" : myEntry ? "Remplacer la photo principale" : "Poster la photo du binôme"}
                </button>
                {myEntry && (
                  <button
                    disabled={busy} onClick={() => { slotRef.current = "bonus"; fileRef.current?.click(); }}
                    className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-canal-yellow/50 text-canal-yellow disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Upload size={15} /> {myEntry.photo_url_2 ? "Remplacer la 2e image (bonus)" : "Ajouter une 2e image (bonus)"}
                  </button>
                )}
                <p className="text-[11px] text-canal-gray-muted/70">2 images max par binôme (1 votée + 1 bonus). Photo (JPG/PNG/WebP, 8 Mo) ou vidéo (MP4/WebM/MOV, 60 Mo).</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Podium (après publication) */}
      {settings.results_published && results && results.length > 0 && (
        <section className="canal-card border border-canal-yellow/40">
          <h2 className="text-xs text-canal-yellow font-bold uppercase mb-3 flex items-center gap-1.5"><Trophy size={14} /> Podium</h2>
          <div className="space-y-3">
            {results.map((r) => (
              <div key={r.rank} className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{MEDAL[r.rank - 1]}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photo_url} alt={r.title ?? r.team_name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{r.team_name}</p>
                  <p className="text-xs text-canal-gray-muted">{r.votes_count} vote{r.votes_count > 1 ? "s" : ""} · +{r.points} pts</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Prix VAR (auto, dérivés des réactions/commentaires) */}
      {varAwards && varAwards.length > 0 && (
        <section className="canal-card border border-canal-yellow/40">
          <h2 className="text-xs text-canal-yellow font-bold uppercase mb-1 flex items-center gap-1.5"><Trophy size={14} /> Prix VAR</h2>
          {!settings.results_published && (
            <p className="text-[11px] text-canal-gray-muted mb-3">Aperçu provisoire {isOrganizer ? "(organisateur)" : ""} — dévoilé au reveal final.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {varAwards.map((a) => (
              <div key={a.key} className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{a.emoji}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.photo_url} alt={a.label} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-canal-yellow uppercase tracking-wide">
                    {a.label}
                    {a.jury && <span className="ml-1 text-canal-gray-muted">· Jury</span>}
                  </p>
                  <p className="text-sm font-bold text-white truncate">{a.team_name}</p>
                  {!a.jury && (
                    <p className="text-[11px] text-canal-gray-muted">
                      {a.count} {a.key === "plus_commentee" ? `commentaire${a.count > 1 ? "s" : ""}` : `réaction${a.count > 1 ? "s" : ""}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Galerie */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xs text-canal-yellow font-bold uppercase">Galerie ({gallery.length})</h2>
          <div className="flex items-center gap-2">
            {isOrganizer && data.totalVotes != null && (
              <span className="text-[11px] text-purple-300 font-bold">{data.totalVotes} vote{data.totalVotes > 1 ? "s" : ""} au total</span>
            )}
            {settings.votes_closed ? (
              <span className="text-[11px] text-red-300 font-bold">🔒 Votes clôturés</span>
            ) : settings.votes_open && !hasVoted ? (
              <span className="text-[11px] text-canal-yellow">Vote ouvert 🗳️</span>
            ) : null}
            {hasVoted && <span className="text-[11px] text-green-400 flex items-center gap-1"><Check size={12} /> Tu as voté</span>}
          </div>
        </div>

        {gallery.length === 0 && <p className="text-sm text-canal-gray-muted">Aucune photo publiée pour l&apos;instant.</p>}

        {gallery.map((g) => {
          const votedThis = myVote?.entry_id === g.id;
          const canVote = settings.votes_open && !settings.results_published && !hasVoted && !g.is_mine;
          return (
            <div key={g.id} className="canal-card space-y-2">
              <MediaView url={g.photo_url} type={g.media_type} onZoom={() => setLightbox({ url: g.photo_url, type: g.media_type })} className="w-full rounded-lg object-contain max-h-80 bg-canal-black" />
              {g.photo_url_2 && (
                <MediaView url={g.photo_url_2} type={g.media_type_2 ?? "image"} onZoom={() => setLightbox({ url: g.photo_url_2!, type: g.media_type_2 ?? "image" })} className="w-full rounded-lg object-contain max-h-64 bg-canal-black" />
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{g.team_name}{g.is_mine && <span className="text-canal-gray-muted font-normal"> · toi</span>}</p>
                  {g.title && <p className="text-xs text-canal-gray-muted truncate">{g.title}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-canal-gray-muted flex items-center gap-0.5"><MessageCircle size={12} /> {g.comments.length}</span>
                  {g.votes_count != null && <span className="text-xs text-purple-300 font-bold">{g.votes_count} 🗳️</span>}
                </div>
              </div>

              {/* Réactions rapides */}
              <ReactionBar entryId={g.id} reactions={g.reactions} mine={g.my_reactions} onReload={load} />

              {canVote && (
                <button
                  disabled={busy} onClick={() => vote(g.id)}
                  className="w-full text-sm font-bold px-3 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Vote size={15} /> Voter pour cette photo
                </button>
              )}
              {votedThis && <p className="text-xs text-green-400 flex items-center gap-1"><Check size={13} /> Ton vote</p>}
              {g.is_mine && settings.votes_open && <p className="text-[11px] text-canal-gray-muted">Pas de vote pour ton propre binôme.</p>}

              {/* Commentaires (chambrage) */}
              <PhotoComments entryId={g.id} comments={g.comments} isOrganizer={isOrganizer} onReload={load} />

              {/* Modération organisateur */}
              {isOrganizer && (
                <button
                  onClick={async () => {
                    if (!confirm("Masquer cette photo ? (retirée de la galerie et des points)")) return;
                    await fetch("/api/supporters/moderate", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "hide_photo", entry_id: g.id }),
                    });
                    load();
                  }}
                  className="text-[11px] text-canal-gray-muted hover:text-red-400 flex items-center gap-1"
                >
                  <EyeOff size={12} /> Masquer (organisateur)
                </button>
              )}

              {/* Attribution Prix VAR (jury) — organisateurs */}
              {isOrganizer && (
                <div className="border-t border-canal-gray-light/20 pt-2">
                  <p className="text-[10px] text-canal-gray-muted uppercase tracking-wide mb-1.5">🏆 Décerner un Prix VAR (jury)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {VAR_MANUAL_CATEGORIES.map((cat) => {
                      const active = manualVar?.[cat.key] === g.id;
                      return (
                        <button
                          key={cat.key}
                          onClick={async () => {
                            await fetch("/api/supporters/var", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ category_key: cat.key, entry_id: g.id }),
                            });
                            load();
                          }}
                          className={`px-2 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                            active ? "bg-canal-yellow/20 border-canal-yellow/50 text-canal-yellow" : "bg-canal-gray-mid border-transparent text-canal-gray-muted hover:text-white"
                          }`}
                        >
                          {cat.emoji} {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
      </>
      )}
    </div>
  );
}
