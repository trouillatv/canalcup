"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Upload, Check, Trophy, Vote, Clock, Users, Send, X, MessageCircle, EyeOff } from "lucide-react";
import { SUPPORTERS_REACTIONS } from "@/lib/supporters/access";

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
  is_mine: boolean;
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
interface Data {
  settings: { votes_open: boolean; results_published: boolean; votes_closed: boolean; close_at: string };
  me: { userId: string; teamId: string | null; teamName: string | null };
  isOrganizer: boolean;
  myEntry: { id: string; title: string | null; photo_url: string; status: string } | null;
  myVote: { entry_id: string } | null;
  gallery: GalleryItem[];
  results: ResultRow[] | null;
  totalVotes: number | null;
  participants: Participant[] | null;
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
function ReactionBar({
  entryId, reactions, mine, onReload,
}: {
  entryId: string;
  reactions: Record<string, number>;
  mine: string[];
  onReload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toggle = async (emoji: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/supporters/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entryId, emoji }),
      });
      if (res.ok) onReload();
    } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {SUPPORTERS_REACTIONS.map((e) => {
        const count = reactions[e] ?? 0;
        const active = mine.includes(e);
        return (
          <button
            key={e}
            onClick={() => toggle(e)}
            disabled={busy}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-base leading-none border transition-colors disabled:opacity-50 ${
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
      <p className="text-[10px] text-canal-gray-muted/70 mt-2">Jeudi 25 juin à 23h59</p>
    </section>
  );
}

export function SupportersClient() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [tab, setTab] = useState<"galerie" | "nonvoters">("galerie");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch("/api/supporters").then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  const upload = async (file: File) => {
    setBusy(true); setFlash(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (title.trim()) fd.append("title", title.trim());
      const res = await fetch("/api/supporters/entry", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) setFlash({ kind: "err", msg: d.error ?? "Échec de l'envoi." });
      else { setFlash({ kind: "ok", msg: "Photo publiée ! Elle est déjà dans la galerie. 📸" }); load(); }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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

  const { settings, me, myEntry, myVote, gallery, results, isOrganizer, participants } = data;
  // Plus de validation préalable : on peut publier/remplacer tant que les
  // résultats ne sont pas dévoilés.
  const canEdit = !settings.results_published;
  const hasVoted = !!myVote;
  const nonVoters = (participants ?? []).filter((p) => !p.voted);

  return (
    <div className="space-y-5">
      {/* Compte à rebours */}
      <Countdown closeAt={settings.close_at} closed={settings.votes_closed} />

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
            <Users size={13} /> N&apos;ont pas voté ({nonVoters.length})
          </button>
        </div>
      )}

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
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={myEntry.photo_url} alt={myEntry.title ?? "Ma photo"} className="w-full rounded-lg object-cover max-h-56" />
                {myEntry.title && <p className="text-sm text-white">{myEntry.title}</p>}
                <p className="text-xs text-canal-gray-muted">{STATUS_LABEL[myEntry.status] ?? myEntry.status}</p>
              </div>
            )}
            {canEdit ? (
              <div className="space-y-2 border-t border-canal-gray-light pt-3">
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre / légende (optionnel)" maxLength={120}
                  className="w-full bg-canal-black border border-canal-gray-light rounded-lg px-2 py-2 text-sm"
                />
                <input
                  ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) upload(f); }}
                />
                <button
                  disabled={busy} onClick={() => fileRef.current?.click()}
                  className="w-full text-sm font-bold px-3 py-2 rounded-lg bg-canal-yellow text-canal-black disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload size={15} /> {busy ? "Envoi…" : myEntry ? "Remplacer la photo" : "Poster ma photo"}
                </button>
                <p className="text-[11px] text-canal-gray-muted/70">JPG, PNG ou WebP — 8 Mo max.</p>
              </div>
            ) : (
              <p className="text-xs text-canal-gray-muted border-t border-canal-gray-light pt-3">
                Concours terminé — la photo est figée.
              </p>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.photo_url} alt={g.title ?? g.team_name} className="w-full rounded-lg object-cover max-h-64" />
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
            </div>
          );
        })}
      </section>
      </>
      )}
    </div>
  );
}
