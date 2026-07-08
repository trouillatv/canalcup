"use client";

// /babyfoot — hub public du Tournoi Baby-foot : statut, inscription, classements
// de poule, tableau final, podium + mémoire des champions (éditions passées).

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Trophy, Users, ArrowRight, Swords, Camera, BarChart3, Loader2 } from "lucide-react";

interface PublicMatch {
  id: string; phase: string | null; round: string | null; pool_label: string | null;
  table_no: number | null; rotation: number | null; starts_at: string | null;
  status: string; score_a: number | null; score_b: number | null;
  labelA: string; labelB: string;
}
interface ClassRow { rank: number; team_id: string; label: string; played: number; won: number; lost: number; gd: number; gf: number; qualified: boolean; }
interface State {
  tournament: {
    id: string; name: string; season: number; status: string; event_date: string | null;
    registration_open: boolean; target_teams: number; format: string;
  } | null;
  registeredCount?: number;
  classement?: ClassRow[];
  matches?: PublicMatch[];
  podium?: { rank: number; label: string }[];
  stats?: { entry_id: string; team_id: string; label: string; played: number; won: number; lost: number; gf: number; ga: number; gd: number; final_rank: number | null }[];
  highlights?: Highlights;
  photos?: { id: string; photo_url: string; caption: string | null; author_name: string }[];
  champions?: { season: number; name: string; champion: string | null }[];
}
interface Highlights {
  biggestWin: { winner: string; loser: string; sa: number; sb: number; margin: number } | null;
  closest: { a: string; b: string; sa: number; sb: number } | null;
  highestScoring: { a: string; b: string; sa: number; sb: number; total: number } | null;
  undefeated: { label: string; won: number; played: number }[];
  bestStreak: { label: string; streak: number } | null;
  upset: { winner: string; loser: string; detail: string } | null;
}

const PHASE_ORDER = ["semi", "final", "third"];
const PHASE_LABEL: Record<string, string> = { semi: "Demi-finales", final: "Finale", third: "Petite finale" };
function timeLabel(iso: string | null): string { if (!iso) return ""; const d = new Date(iso); return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Noumea" }); }
function dayTimeLabel(iso: string | null): string { if (!iso) return ""; const day = new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", timeZone: "Pacific/Noumea" }); return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${timeLabel(iso)}`; }
const MEDAL = ["🥇", "🥈", "🥉"];

export default function BabyfootPage() {
  const [s, setS] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/babyfoot").then((r) => r.json()).then(setS).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
    // Poll léger seulement quand l'onglet est visible (leçon BreakingNews).
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(() => { if (!document.hidden) load(); }, 20000); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    start();
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    return stop;
  }, [load]);

  if (loading) return <div className="px-4 py-10 text-center text-canal-gray-muted">Chargement…</div>;

  const t = s?.tournament;
  const leagueMatches = (s?.matches ?? []).filter((m) => m.phase === "league");
  const koByPhase = PHASE_ORDER.map((ph) => ({ ph, list: (s?.matches ?? []).filter((m) => m.phase === ph) })).filter((g) => g.list.length);
  // Planning : matchs de championnat groupés par rotation.
  const rotations = [...new Set(leagueMatches.map((m) => m.rotation).filter((r): r is number => r != null))].sort((a, b) => a - b);
  const remaining = t ? Math.max(0, t.target_teams - (s?.registeredCount ?? 0)) : 0;
  const showRegister = t && (t.status === "draft" || t.status === "registration") && t.registration_open;

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl flex items-center gap-2"><span className="text-3xl">🎮</span> Tournoi Baby-foot</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          {t ? <>{t.name}{t.event_date ? ` · ${new Date(t.event_date + "T00:00:00+11:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}` : ""}</> : "Le football parallèle. Moins de VAR, plus de chaos."}
        </p>
      </div>

      {/* CTA inscription */}
      {showRegister && (
        <Link href="/babyfoot/register" className="block canal-card border border-canal-yellow/50 bg-canal-yellow/10 hover:bg-canal-yellow/15 transition-colors">
          <div className="flex items-center gap-3">
            <Users className="text-canal-yellow shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm">Inscris ton binôme !</p>
              <p className="text-xs text-canal-gray-muted">
                {s?.registeredCount ?? 0} inscrit{(s?.registeredCount ?? 0) > 1 ? "s" : ""}{remaining > 0 ? ` · plus que ${remaining} avant l'objectif` : ""}
              </p>
            </div>
            <ArrowRight className="text-canal-yellow shrink-0" />
          </div>
        </Link>
      )}

      {/* Podium */}
      {(s?.podium?.length ?? 0) > 0 && (
        <div className="canal-card border border-canal-yellow/30 bg-gradient-to-b from-canal-yellow/10 to-transparent">
          <h2 className="text-sm font-bold uppercase text-canal-yellow mb-3 flex items-center gap-1.5"><Trophy size={14} /> Podium</h2>
          <div className="space-y-2">
            {s!.podium!.map((p) => (
              <div key={p.rank} className="flex items-center gap-3">
                <span className="text-2xl">{MEDAL[p.rank - 1] ?? "🏅"}</span>
                <span className="font-black text-white">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classement du championnat (unique) */}
      {(s?.classement?.filter((r) => r.played > 0).length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase text-canal-yellow">Classement · Top 4 qualifié</h2>
          <div className="canal-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-canal-gray-muted border-b border-canal-gray-light">
                <th className="text-left py-1.5 w-6">#</th><th className="text-left">Binôme</th><th className="px-1">J</th><th className="px-1">V</th><th className="px-1">Diff</th>
              </tr></thead>
              <tbody>
                {s!.classement!.map((r) => (
                  <tr key={r.team_id} className={`border-b border-canal-gray-mid ${r.qualified ? "text-green-300" : "text-white"}`}>
                    <td className="py-1.5 font-black">{r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</td>
                    <td className="font-bold"><Link href={`/babyfoot/binome/${r.team_id}`} className="hover:text-canal-yellow">{r.qualified ? "✓ " : ""}{r.label}</Link></td>
                    <td className="text-center">{r.played}</td>
                    <td className="text-center font-bold">{r.won}</td>
                    <td className="text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Programme (rotations / horaires / tables) */}
      {rotations.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase text-canal-yellow">Programme</h2>
          {rotations.map((rot) => {
            const ms = leagueMatches.filter((m) => m.rotation === rot);
            const time = dayTimeLabel(ms[0]?.starts_at ?? null);
            return (
              <div key={rot} className="canal-card">
                <p className="text-[11px] font-bold text-canal-gray-muted uppercase mb-1.5">Rotation {rot}{time ? ` · ${time}` : ""}</p>
                <div className="space-y-1.5">
                  {ms.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm">
                      {m.table_no != null && <span className="text-[10px] font-black text-canal-black bg-canal-yellow rounded px-1.5 py-0.5">T{m.table_no}</span>}
                      <span className="flex-1 text-right font-bold truncate">{m.labelA}</span>
                      {m.status === "finished"
                        ? <span className="text-canal-yellow font-bold text-xs tabular-nums px-1 shrink-0">{m.score_a}-{m.score_b}</span>
                        : <span className="text-canal-gray-muted text-xs shrink-0">vs</span>}
                      <span className="flex-1 font-bold truncate">{m.labelB}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Tableau final */}
      {koByPhase.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase text-canal-yellow">Phase finale</h2>
          {koByPhase.map(({ ph, list }) => (
            <div key={ph}>
              <p className="text-xs font-bold text-canal-gray-muted uppercase mb-1.5">{PHASE_LABEL[ph]}</p>
              <div className="space-y-2">
                {list.map((m) => <MatchCard key={m.id} m={m} />)}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Faits marquants en direct */}
      <HighlightsSection h={s?.highlights} />

      {/* Stats par binôme */}
      {(s?.stats?.filter((x) => x.played > 0).length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase text-canal-yellow flex items-center gap-1.5"><BarChart3 size={14} /> Statistiques</h2>
          <div className="canal-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-canal-gray-muted border-b border-canal-gray-light">
                <th className="text-left py-1.5">Binôme</th><th className="px-1">J</th><th className="px-1">V</th><th className="px-1">D</th><th className="px-1">BP</th><th className="px-1">BC</th><th className="px-1">Diff</th>
              </tr></thead>
              <tbody>
                {s!.stats!.filter((x) => x.played > 0).sort((a, b) => b.won - a.won || b.gd - a.gd).map((r) => (
                  <tr key={r.entry_id} className="border-b border-canal-gray-mid">
                    <td className="py-1.5 font-bold text-white"><Link href={`/babyfoot/binome/${r.team_id}`} className="hover:text-canal-yellow">{r.label}</Link></td>
                    <td className="text-center">{r.played}</td>
                    <td className="text-center font-bold text-green-400">{r.won}</td>
                    <td className="text-center text-canal-gray-muted">{r.lost}</td>
                    <td className="text-center">{r.gf}</td>
                    <td className="text-center">{r.ga}</td>
                    <td className="text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Photos du tournoi */}
      <PhotoSection photos={s?.photos ?? []} onUploaded={load} />

      {/* Historique des champions */}
      {(s?.champions?.filter((c) => c.champion).length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase text-canal-yellow">🏆 Palmarès</h2>
          <div className="canal-card space-y-1">
            {s!.champions!.filter((c) => c.champion).map((c) => (
              <div key={c.season} className="flex items-center justify-between text-sm">
                <span className="text-canal-gray-muted">{c.season}</span>
                <span className="font-black text-white">{c.champion}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!t && <p className="text-canal-gray-muted text-sm text-center py-8">Le tournoi n&apos;est pas encore ouvert.</p>}
    </div>
  );
}

function HighlightsSection({ h }: { h?: Highlights }) {
  if (!h) return null;
  const cards: { icon: string; label: string; value: string }[] = [];
  if (h.biggestWin) cards.push({ icon: "🔥", label: "Plus grosse victoire", value: `${h.biggestWin.winner} ${h.biggestWin.sa}–${h.biggestWin.sb} ${h.biggestWin.loser}` });
  if (h.closest) cards.push({ icon: "😰", label: "Match le plus serré", value: `${h.closest.a} ${h.closest.sa}–${h.closest.sb} ${h.closest.b}` });
  if (h.highestScoring) cards.push({ icon: "⚽", label: "Le plus de buts", value: `${h.highestScoring.a} ${h.highestScoring.sa}–${h.highestScoring.sb} ${h.highestScoring.b} (${h.highestScoring.total})` });
  if (h.undefeated.length) cards.push({ icon: "🛡️", label: "Binôme invaincu", value: h.undefeated.slice(0, 3).map((u) => u.label).join(", ") });
  if (h.bestStreak) cards.push({ icon: "📈", label: "Série de victoires", value: `${h.bestStreak.label} — ${h.bestStreak.streak} d'affilée` });
  if (h.upset) cards.push({ icon: "🎭", label: "Surprise du tournoi", value: `${h.upset.winner} sort ${h.upset.loser}` });
  if (!cards.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold uppercase text-canal-yellow flex items-center gap-1.5"><span className="live-dot" /> En direct</h2>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="canal-card">
            <p className="text-[10px] text-canal-gray-muted uppercase font-bold flex items-center gap-1">{c.icon} {c.label}</p>
            <p className="text-white font-bold text-sm mt-1 leading-tight">{c.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhotoSection({ photos, onUploaded }: { photos: { id: string; photo_url: string; caption: string | null; author_name: string }[]; onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/babyfoot/photo", { method: "POST", credentials: "same-origin", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setErr(d.error ?? "Envoi impossible.");
      else onUploaded();
    } catch { setErr("Erreur réseau."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-canal-yellow flex items-center gap-1.5"><Camera size={14} /> Photos du tournoi</h2>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="text-xs font-black bg-canal-yellow text-canal-black rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />} Ajouter
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      </div>
      {err && <p className="text-red-400 text-xs">{err}</p>}
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.photo_url} alt={p.caption ?? "Photo baby-foot"} loading="lazy"
              className="w-full aspect-square object-cover rounded-lg bg-canal-gray-mid" />
          ))}
        </div>
      ) : (
        <p className="text-canal-gray-muted text-xs px-1">Sois le premier à immortaliser un moment 📸</p>
      )}
    </section>
  );
}

function MatchCard({ m }: { m: PublicMatch }) {
  const finished = m.status === "finished";
  const winA = finished && (m.score_a ?? 0) > (m.score_b ?? 0);
  const winB = finished && (m.score_b ?? 0) > (m.score_a ?? 0);
  return (
    <div className="canal-card flex items-center gap-2 py-2">
      {m.table_no != null && <span className="text-[10px] font-black text-canal-black bg-canal-yellow rounded px-1.5 py-0.5 shrink-0">T{m.table_no}</span>}
      <span className={`flex-1 text-sm font-bold text-right truncate ${winB ? "text-canal-gray-muted" : "text-white"}`}>{m.labelA}</span>
      {finished ? (
        <span className="score-display text-lg px-1">{m.score_a}<span className="text-canal-gray-muted mx-1">-</span>{m.score_b}</span>
      ) : (
        <Swords size={16} className="text-canal-yellow shrink-0" />
      )}
      <span className={`flex-1 text-sm font-bold truncate ${winA ? "text-canal-gray-muted" : "text-white"}`}>{m.labelB}</span>
    </div>
  );
}
