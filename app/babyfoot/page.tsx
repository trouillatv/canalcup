"use client";

// /babyfoot — hub public du Tournoi Baby-foot : statut, inscription, classements
// de poule, tableau final, podium + mémoire des champions (éditions passées).

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Trophy, Users, ArrowRight, Swords, Camera, BarChart3, Loader2 } from "lucide-react";
import { BABYFOOT, championMaxPoints } from "@/lib/config/babyfoot";

// Onglet « Gestion » (organisateurs) — chargé à la demande : le code admin
// n'alourdit pas le bundle des joueurs, et n'est jamais rendu pour un non-admin.
const BabyfootAdmin = dynamic(() => import("@/components/babyfoot/BabyfootAdmin").then((m) => m.BabyfootAdmin), {
  ssr: false,
  loading: () => <div className="px-4 py-10 text-center text-canal-gray-muted"><Loader2 className="animate-spin inline" /></div>,
});

interface PublicMatch {
  id: string; phase: string | null; round: string | null; pool_label: string | null;
  table_no: number | null; rotation: number | null; starts_at: string | null;
  status: string; score_a: number | null; score_b: number | null;
  labelA: string; labelB: string;
}
interface ClassRow { rank: number; team_id: string; label: string; played: number; won: number; lost: number; gd: number; gf: number; qualified: boolean; forfeited: boolean; }
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
  const [tab, setTab] = useState<"tournoi" | "regles" | "gestion">("tournoi");
  const [isAdmin, setIsAdmin] = useState(false);

  // Test d'accès organisateur : on interroge l'API admin (gardée par
  // isAdminRequest). Si elle répond OK → on affiche l'onglet Gestion. La vraie
  // sécurité reste l'API ; ici on ne fait qu'afficher/masquer l'onglet.
  useEffect(() => {
    fetch("/api/admin/babyfoot/tournament", { credentials: "same-origin" })
      .then((r) => setIsAdmin(r.ok || r.status === 404)).catch(() => {}); // 403 = pas admin
    if (new URLSearchParams(window.location.search).get("tab") === "gestion") setTab("gestion");
  }, []);

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

      <BabyfootTabs tab={tab} setTab={setTab} isAdmin={isAdmin} />

      {tab === "gestion" && isAdmin && <BabyfootAdmin />}
      {tab === "regles" && <BabyfootRules />}
      {tab === "tournoi" && (<>

      {/* CTA inscription + mode d'emploi (contenu du mail d'annonce) */}
      {showRegister && (<>
        <div className="bg-canal-yellow text-canal-black font-black text-center text-sm rounded-lg px-4 py-2.5">
          ⏰ Inscriptions jusqu&apos;au {BABYFOOT.inscriptionsCloseLabel}
        </div>
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
        <HowToParticipate />
      </>)}

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
                  <tr key={r.team_id} className={`border-b border-canal-gray-mid ${r.forfeited ? "text-canal-gray-muted" : r.qualified ? "text-green-300" : "text-white"}`}>
                    <td className="py-1.5 font-black">{r.forfeited ? "—" : r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</td>
                    <td className="font-bold">
                      <Link href={`/babyfoot/binome/${r.team_id}`} className="hover:text-canal-yellow">{r.qualified ? "✓ " : ""}{r.label}</Link>
                      {r.forfeited && <span className="ml-1.5 text-[10px] uppercase font-black text-red-400">Forfait</span>}
                    </td>
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
      </>)}
    </div>
  );
}

// Onglets du hub. « Gestion » n'apparaît que pour les organisateurs.
function BabyfootTabs({ tab, setTab, isAdmin }: { tab: string; setTab: (t: "tournoi" | "regles" | "gestion") => void; isAdmin: boolean }) {
  const tabs: [("tournoi" | "regles" | "gestion"), string][] = [["tournoi", "🏆 Tournoi"], ["regles", "📖 Règles"]];
  if (isAdmin) tabs.push(["gestion", "⚙️ Gestion"]);
  return (
    <div className="flex gap-1 border-b border-canal-gray-light -mt-2">
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)}
          className={`px-3 py-2 text-sm font-black border-b-2 -mb-px transition-colors ${tab === k ? "border-canal-yellow text-canal-yellow" : "border-transparent text-canal-gray-muted hover:text-white"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

// Mode d'emploi affiché pendant les inscriptions — reprend le mail d'annonce
// (comment ça marche, inscription solo, créneaux) pour que personne ne soit perdu.
function HowToParticipate() {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold uppercase text-canal-yellow">📲 Comment participer</h2>
      <div className="canal-card space-y-3 text-sm leading-relaxed">
        <div>
          <p className="font-black text-white">👥 Vous êtes déjà 2 ?</p>
          <p className="text-canal-gray-muted">Un binôme = <b className="text-white">exactement 2 joueurs</b>. Inscrivez-vous <b className="text-white">ensemble</b> depuis la page d&apos;inscription — vous jouerez ensemble tout le tournoi.</p>
        </div>
        <div>
          <p className="font-black text-white">🙋 Tu es seul·e ? Tu joues quand même !</p>
          <p className="text-canal-gray-muted">Déclare-toi <b className="text-white">« je cherche un partenaire »</b> : ton nom apparaît dans la liste et n&apos;importe qui peut t&apos;inviter en un clic. Ou envoie directement une <b className="text-white">demande</b> à un·e collègue — il/elle accepte, et votre binôme est créé.</p>
        </div>
        <div>
          <p className="font-black text-white">📅 Cochez vos créneaux de dispo</p>
          <p className="text-canal-gray-muted">C&apos;est ce qui permet de construire un planning qui arrange tout le monde ({BABYFOOT.eventLabel}). Au moins {BABYFOOT.minSlots} créneaux — et plus vous en cochez, <b className="text-white">plus le tirage est équilibré</b>. Soyez généreux !</p>
        </div>
        <p className="text-canal-gray-muted text-xs">🏅 À la clé : de vrais points CanalCup pour toi <b className="text-white">et</b> ton équipe — jusqu&apos;à <b className="text-canal-yellow">{championMaxPoints()} points</b> pour le parcours parfait. Détail du barème dans l&apos;onglet <b className="text-white">Règles</b>.</p>
      </div>
    </section>
  );
}

// Règles du tournoi — visible par TOUS les joueurs.
function BabyfootRules() {
  const b = BABYFOOT.bareme;
  const Card = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
    <div className="canal-card space-y-2">
      <h2 className="text-sm font-black uppercase text-canal-yellow">{icon} {title}</h2>
      <div className="text-sm text-canal-gray-muted space-y-1.5 leading-relaxed">{children}</div>
    </div>
  );
  const Li = ({ children }: { children: React.ReactNode }) => (
    <p className="flex gap-2"><span className="text-canal-yellow">›</span><span>{children}</span></p>
  );
  return (
    <section className="space-y-4">
      <Card icon="🎯" title="Le format">
        <Li>Un binôme = <b className="text-white">2 joueurs</b>. Chaque binôme dispute <b className="text-white">{BABYFOOT.matchesPerTeam} matchs</b> de championnat.</Li>
        <Li>Un <b className="text-white">classement unique</b> aux victoires. Les <b className="text-white">{BABYFOOT.qualifiers} premiers</b> filent en phase finale.</Li>
        <Li>Demi-finales <b className="text-white">1ᵉ–4ᵉ</b> et <b className="text-white">2ᵉ–3ᵉ</b>, puis petite finale (3ᵉ place) et <b className="text-white">grande finale</b>.</Li>
      </Card>
      <Card icon="🏓" title="Un match">
        <Li>On joue sur <b className="text-white">une seule table</b>, par matchs de <b className="text-white">{BABYFOOT.matchMinutes} min max</b>.</Li>
        <Li>Le match se gagne <b className="text-white">à 10 buts</b> — le score est plafonné à 10.</Li>
        <Li><b className="text-white">Pas de match nul</b> : à égalité au bout de {BABYFOOT.matchMinutes} min, <b className="text-white">{BABYFOOT.overtimeMinutes} min de prolongation</b> (but en or) — il y a toujours un vainqueur.</Li>
      </Card>
      <Card icon="🏅" title="Les points CanalCup">
        <Li><b className="text-white">Chaque joueur du binôme</b> marque les points ci-dessous :</Li>
        <Li>Participation : <b className="text-white">+{b.participation}</b></Li>
        <Li>Chaque match joué (gagné ou perdu) : <b className="text-white">+{b.matchPlayed}</b></Li>
        <Li>Chaque victoire de championnat : <b className="text-white">+{b.matchWin}</b></Li>
        <Li>Qualifié en demi-finale : <b className="text-white">+{b.qualified}</b></Li>
        <Li>Demi-finale gagnée : <b className="text-white">+{b.semiWin}</b></Li>
        <Li>Champion : <b className="text-white">+{b.champion}</b> 🏆 — soit jusqu&apos;à <b className="text-canal-yellow">{championMaxPoints()} points</b> !</Li>
      </Card>
      <Card icon="📅" title="Quand">
        <Li>{BABYFOOT.eventLabel}.</Li>
        <Li>Les créneaux exacts de vos matchs s&apos;affichent dans l&apos;onglet <b className="text-white">Tournoi</b> une fois le tirage fait.</Li>
      </Card>
      <Card icon="📲" title="S'inscrire">
        <Li>Inscriptions ouvertes jusqu&apos;au <b className="text-white">{BABYFOOT.inscriptionsCloseLabel}</b>, tirage le {BABYFOOT.drawLabel}.</Li>
        <Li><b className="text-white">En binôme :</b> vous êtes déjà 2 → inscrivez-vous ensemble depuis la page d&apos;inscription.</Li>
        <Li><b className="text-white">En solo :</b> déclare-toi « je cherche un partenaire » ou envoie une demande à un·e collègue — l&apos;app s&apos;occupe de la mise en relation.</Li>
        <Li>Cochez vos <b className="text-white">créneaux de dispo</b> (au moins {BABYFOOT.minSlots}) : plus vous en cochez, plus le tirage est équilibré.</Li>
      </Card>
    </section>
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
