"use client";

// Écran TV du Tournoi Baby-foot. Mode AUTO (dérivé du statut = cérémonial) ou
// forcé via ?mode=bracket|matches|podium|inscriptions|tirage (une 2e TV peut
// afficher le tableau pendant que la 1re montre le live). Poll /api/babyfoot 15 s.

import { useEffect, useState } from "react";

interface PublicMatch {
  id: string; phase: string | null; round: string | null; pool_label: string | null;
  table_no: number | null; status: string; score_a: number | null; score_b: number | null;
  labelA: string; labelB: string;
}
interface ClassRow { rank: number; team_id: string; label: string; played: number; won: number; gd: number; qualified: boolean; }
interface State {
  tournament: {
    id: string; name: string; season: number; status: string; event_date: string | null;
    registration_open: boolean; target_teams: number; draw_at: string | null; kickoff_at: string | null;
  } | null;
  registeredCount?: number;
  entries?: { id: string; label: string; pool_label?: string | null }[];
  classement?: ClassRow[];
  matches?: PublicMatch[];
  podium?: { rank: number; label: string }[];
  highlights?: Highlights;
}
interface Highlights {
  biggestWin: { winner: string; loser: string; sa: number; sb: number; margin: number } | null;
  closest: { a: string; b: string; sa: number; sb: number } | null;
  highestScoring: { a: string; b: string; sa: number; sb: number; total: number } | null;
  undefeated: { label: string; won: number; played: number }[];
  bestStreak: { label: string; streak: number } | null;
  upset: { winner: string; loser: string; detail: string } | null;
}

const MEDAL = ["🥇", "🥈", "🥉"];
const PHASE_LABEL: Record<string, string> = { semi: "Demi-finales", final: "Finale", third: "Petite finale" };

export default function TvBabyfootPage() {
  const [s, setS] = useState<State | null>(null);
  const [mode, setMode] = useState("auto");
  const [cycle, setCycle] = useState(0);
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMode(params.get("mode") ?? "auto");
    const load = () => fetch("/api/babyfoot").then((r) => r.json()).then((d) => setS(d)).catch(() => {});
    load();
    const t = setInterval(() => { load(); setCycle((v) => v + 1); }, 15000);
    const c = setInterval(() => setTicks((v) => v + 1), 1000); // comptes à rebours + speaker
    return () => { clearInterval(t); clearInterval(c); };
  }, []);

  const shell = (children: React.ReactNode) => (
    <div className="w-full min-h-screen bg-canal-black text-white overflow-hidden flex flex-col p-10">
      <style>{"@keyframes pop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}"}</style>
      {children}
    </div>
  );

  if (!s?.tournament) return shell(<Center><h1 className="canal-headline text-7xl">🎮 Tournoi Baby-foot</h1><p className="text-3xl text-canal-gray-muted mt-4">Bientôt…</p></Center>);
  const t = s.tournament;
  const hasHighlights = !!s.highlights && (s.highlights.biggestWin || s.highlights.undefeated.length || s.highlights.bestStreak || s.highlights.upset);
  let eff = mode === "auto" ? autoMode(t.status) : mode;
  // Auto : pendant le jeu, on alterne le direct et les faits marquants (15 s).
  if (mode === "auto" && hasHighlights && (eff === "classement" || eff === "matches") && cycle % 2 === 1) eff = "faits";

  return shell(
    <>
      <header className="flex items-center justify-between mb-8">
        <h1 className="canal-headline text-6xl">🎮 Baby-foot CanalCup</h1>
        <p className="text-2xl text-canal-gray-muted">{t.name}</p>
      </header>
      <div className="flex-1 min-h-0">
        {eff === "inscriptions" && <Inscriptions s={s} t={t} />}
        {eff === "tirage" && <Tirage t={t} entries={s.entries ?? []} matches={s.matches ?? []} />}
        {eff === "classement" && <Classement s={s} />}
        {eff === "bracket" && <Bracket s={s} />}
        {eff === "matches" && <Matches s={s} />}
        {eff === "faits" && <Faits h={s.highlights} />}
        {eff === "podium" && <Podium s={s} t={t} />}
      </div>
      <Speaker s={s} ticks={ticks} />
      <footer className="mt-4 text-center text-2xl text-canal-yellow font-bold">
        {t.event_date ? new Date(t.event_date + "T00:00:00+11:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : ""}
      </footer>
    </>
  );
}

function autoMode(status: string): string {
  switch (status) {
    case "draft": case "registration": return "inscriptions";
    case "draw": return "tirage";
    case "pools": return "classement";
    case "knockout": return "matches";
    case "finished": return "podium";
    default: return "inscriptions";
  }
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex flex-col items-center justify-center text-center">{children}</div>;
}

function Inscriptions({ s, t }: { s: State; t: NonNullable<State["tournament"]> }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/babyfoot/register`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=20&data=${encodeURIComponent(url)}`;
  const remaining = Math.max(0, t.target_teams - (s.registeredCount ?? 0));
  const last = s.entries?.[s.entries.length - 1]?.label;
  return (
    <div className="grid grid-cols-2 gap-10 h-full items-center">
      <div className="flex flex-col items-center gap-4">
        <img src={qr} alt="QR inscription" className="rounded-2xl bg-white p-4 w-[420px] h-[420px]" />
        <p className="text-3xl font-bold text-canal-yellow">Scanne pour t&apos;inscrire</p>
      </div>
      <div className="space-y-6">
        <p className="canal-headline text-6xl leading-tight">Formez votre binôme&nbsp;!</p>
        <p className="text-8xl font-black text-canal-yellow">{s.registeredCount ?? 0}<span className="text-4xl text-canal-gray-muted"> binômes</span></p>
        {remaining > 0 && <p className="text-5xl font-black text-white">🎉 Plus que {remaining} à inscrire&nbsp;!</p>}
        {last && <p className="text-3xl text-canal-gray-muted">Dernier inscrit : <span className="text-white font-bold">{last}</span></p>}
      </div>
    </div>
  );
}

function countdownLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "imminent";
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return min > 0 ? `${min} min` : `${sec} s`;
}

// Tirage au sort : compte à rebours PUIS révélation animée des binômes dans les
// poules, un par un (round-robin entre poules), avec un pop sur le dernier tiré.
// Tirage au sort du championnat : on révèle, binôme par binôme, ses 3 adversaires.
function Tirage({ t, entries, matches }: { t: NonNullable<State["tournament"]>; entries: NonNullable<State["entries"]>; matches: PublicMatch[] }) {
  const cd = countdownLabel(t.draw_at);
  const league = matches.filter((m) => m.phase === "league");
  const oppByTeam = new Map<string, string[]>();
  for (const e of entries) oppByTeam.set(e.label, []);
  for (const m of league) {
    if (oppByTeam.has(m.labelA)) oppByTeam.get(m.labelA)!.push(m.labelB);
    if (oppByTeam.has(m.labelB)) oppByTeam.get(m.labelB)!.push(m.labelA);
  }
  const teams = entries.map((e) => e.label).filter((l) => (oppByTeam.get(l)?.length ?? 0) > 0);
  // Étapes de révélation : pour chaque binôme, l'entête puis ses adversaires 1,2,3.
  const steps: { team: string; opp: number }[] = [];
  for (const tm of teams) { steps.push({ team: tm, opp: -1 }); (oppByTeam.get(tm) ?? []).forEach((_, i) => steps.push({ team: tm, opp: i })); }

  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (!teams.length) return;
    setRevealed(0);
    const iv = setInterval(() => setRevealed((v) => (v >= steps.length ? v : v + 1)), 1300);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.length]);

  if (!teams.length) {
    return <Center>
      <p className="text-9xl mb-6">🎲</p>
      <h2 className="canal-headline text-7xl">Tirage au sort</h2>
      {cd ? <p className="text-5xl text-canal-yellow font-black mt-6">dans {cd}</p> : <p className="text-4xl text-canal-gray-muted mt-6">Préparez-vous&nbsp;!</p>}
    </Center>;
  }

  const cur = steps[Math.min(revealed, steps.length - 1)];
  const done = revealed >= steps.length;
  const revealedCount = (tm: string) => steps.slice(0, revealed).filter((s) => s.team === tm && s.opp >= 0).length;

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-5">
        <h2 className="canal-headline text-6xl">🎲 Tirage — championnat</h2>
        {!done ? <p key={revealed} className="text-4xl text-canal-yellow font-black mt-3 animate-[pop_0.5s_ease]">{cur.team}{cur.opp >= 0 ? ` affronte ${oppByTeam.get(cur.team)?.[cur.opp] ?? ""} !` : "…"}</p>
               : <p className="text-4xl text-green-400 font-black mt-3">Le championnat est prêt — que le meilleur gagne&nbsp;! 👏</p>}
      </div>
      <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden content-start">
        {teams.map((tm) => {
          const opps = oppByTeam.get(tm) ?? [];
          const rc = revealedCount(tm);
          const active = cur.team === tm && !done;
          return (
            <div key={tm} className={`canal-card ${active ? "bg-canal-yellow/15 border border-canal-yellow" : "bg-canal-gray-dark/40"}`}>
              <p className="text-2xl font-black text-white">{tm}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {opps.map((o, i) => (
                  <span key={i} className={`text-lg font-bold rounded px-2 py-0.5 ${i < rc ? "bg-canal-gray-mid text-white" : "bg-canal-gray-mid/30 text-transparent"}`}>{i < rc ? o : "•••"}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Classement({ s }: { s: State }) {
  const rows = s.classement ?? [];
  return (
    <div className="h-full overflow-hidden">
      <h2 className="text-4xl font-black text-canal-yellow mb-4">Classement · Top 4 qualifié</h2>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.team_id} className={`flex items-center gap-4 text-3xl py-1.5 border-b border-white/5 ${r.qualified ? "text-green-300" : "text-white"}`}>
            <span className="w-10 font-black">{r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</span>
            <span className="flex-1 font-bold truncate">{r.qualified ? "✓ " : ""}{r.label}</span>
            <span className="text-canal-gray-muted">{r.won} V</span>
            <span className="text-canal-gray-muted w-16 text-right">{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bracket({ s }: { s: State }) {
  const byPhase = ["semi", "final", "third"].map((ph) => ({ ph, list: (s.matches ?? []).filter((m) => m.phase === ph) })).filter((g) => g.list.length);
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${byPhase.length || 1}, minmax(0,1fr))` }}>
      {byPhase.map(({ ph, list }) => (
        <div key={ph}>
          <p className="text-2xl font-black text-canal-yellow uppercase mb-3">{PHASE_LABEL[ph]}</p>
          <div className="space-y-3">
            {list.map((m) => <TvMatch key={m.id} m={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Matches({ s }: { s: State }) {
  const all = s.matches ?? [];
  const live = all.filter((m) => m.status !== "finished" && m.labelA !== "à venir" && m.labelB !== "à venir");
  const withTable = live.filter((m) => m.table_no != null).sort((a, b) => (a.table_no ?? 0) - (b.table_no ?? 0));
  const shown = withTable.length ? withTable : live.slice(0, 2);
  const recent = all.filter((m) => m.status === "finished").slice(-4).reverse();
  return (
    <div className="grid grid-cols-2 gap-8 h-full">
      <div className="space-y-6">
        <h3 className="text-3xl font-black text-canal-yellow uppercase">En cours</h3>
        {shown.length ? shown.map((m) => (
          <div key={m.id} className="canal-card bg-canal-gray-dark/40 py-6">
            {m.table_no != null && <p className="text-2xl font-black text-canal-black bg-canal-yellow inline-block px-3 py-1 rounded mb-3">Table {m.table_no}</p>}
            <div className="flex items-center justify-between text-4xl font-black">
              <span className="flex-1 text-right truncate">{m.labelA}</span>
              <span className="mx-4 text-canal-yellow">VS</span>
              <span className="flex-1 truncate">{m.labelB}</span>
            </div>
          </div>
        )) : <p className="text-3xl text-canal-gray-muted">Prochain match imminent…</p>}
      </div>
      <div className="space-y-3">
        <h3 className="text-3xl font-black text-canal-gray-muted uppercase">Derniers résultats</h3>
        {recent.map((m) => <TvMatch key={m.id} m={m} />)}
      </div>
    </div>
  );
}

function Podium({ s, t }: { s: State; t: NonNullable<State["tournament"]> }) {
  const p = s.podium ?? [];
  const champ = p.find((x) => x.rank === 1);
  return (
    <Center>
      <p className="text-7xl mb-2">🏆</p>
      <h2 className="canal-headline text-6xl">Champions {t.season}</h2>
      {champ && <p className="text-8xl font-black text-canal-yellow my-6">{champ.label}</p>}
      <div className="flex gap-12 mt-4">
        {p.map((x) => (
          <div key={x.rank} className="text-center">
            <p className="text-6xl">{MEDAL[x.rank - 1] ?? "🏅"}</p>
            <p className="text-3xl font-bold mt-2">{x.label}</p>
          </div>
        ))}
      </div>
    </Center>
  );
}

function Faits({ h }: { h?: Highlights }) {
  if (!h) return null;
  const cards: { icon: string; label: string; value: string }[] = [];
  if (h.biggestWin) cards.push({ icon: "🔥", label: "Plus grosse victoire", value: `${h.biggestWin.winner}  ${h.biggestWin.sa}–${h.biggestWin.sb}  ${h.biggestWin.loser}` });
  if (h.closest) cards.push({ icon: "😰", label: "Le plus serré", value: `${h.closest.a}  ${h.closest.sa}–${h.closest.sb}  ${h.closest.b}` });
  if (h.highestScoring) cards.push({ icon: "⚽", label: "Le plus de buts", value: `${h.highestScoring.a}  ${h.highestScoring.sa}–${h.highestScoring.sb}  ${h.highestScoring.b}` });
  if (h.undefeated.length) cards.push({ icon: "🛡️", label: "Invaincu", value: h.undefeated.slice(0, 2).map((u) => u.label).join("  ·  ") });
  if (h.bestStreak) cards.push({ icon: "📈", label: "Série de victoires", value: `${h.bestStreak.label} — ${h.bestStreak.streak} d'affilée` });
  if (h.upset) cards.push({ icon: "🎭", label: "Surprise du tournoi", value: `${h.upset.winner} sort ${h.upset.loser}` });
  return (
    <div className="h-full flex flex-col">
      <h2 className="canal-headline text-5xl mb-6 flex items-center gap-3"><span className="live-dot" /> Faits marquants</h2>
      <div className="grid grid-cols-2 gap-6 flex-1">
        {cards.map((c) => (
          <div key={c.label} className="canal-card bg-canal-gray-dark/40 flex flex-col justify-center">
            <p className="text-3xl text-canal-gray-muted font-bold">{c.icon} {c.label}</p>
            <p className="text-5xl font-black text-white mt-3 leading-tight">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Le "speaker" : lignes d'animation dérivées de l'état, qui défilent en bas de
// l'écran pour donner le côté ÉVÉNEMENT (« Nouveau binôme ! », « Table 1… »,
// « Qualifié pour les demies ! », « Champions ! »).
function computeSpeakerLines(s: State): string[] {
  const t = s.tournament;
  if (!t) return [];
  const lines: string[] = [];
  const entries = s.entries ?? [];
  const matches = s.matches ?? [];
  const labelByTeamMatch = (m: PublicMatch, which: "A" | "B") => (which === "A" ? m.labelA : m.labelB);

  if (t.status === "draft" || t.status === "registration") {
    lines.push(`🎉 ${s.registeredCount ?? 0} binômes déjà inscrits !`);
    const last = entries[entries.length - 1]?.label;
    if (last) lines.push(`🆕 Nouveau binôme : ${last} !`);
    const remaining = Math.max(0, t.target_teams - (s.registeredCount ?? 0));
    if (remaining > 0) lines.push(`📣 Plus que ${remaining} binômes — formez la vôtre !`);
    lines.push("📲 Scannez le QR pour vous inscrire");
  } else if (t.status === "draw") {
    lines.push("🎲 Le tirage au sort va commencer — tout le monde regarde !");
  } else if (t.status === "pools" || t.status === "knockout") {
    const played = matches.filter((m) => m.status === "finished").length;

    // Matchs en cours (avec table) — on convoque les joueurs.
    for (const m of matches) {
      if (m.status !== "finished" && m.table_no != null && m.labelA !== "à venir" && m.labelB !== "à venir") {
        lines.push(`🔔 Table ${m.table_no} — ${m.labelA} et ${m.labelB} sont attendus !`);
      }
    }

    // Le récit : on raconte, on ne liste pas.
    const h = s.highlights;
    if (h?.upset) lines.push(`🔥 Première surprise de la journée : ${h.upset.winner} éliminent ${h.upset.loser} !`);
    if (h?.biggestWin && h.biggestWin.margin >= 5) lines.push(`💥 Quelle démonstration ! ${h.biggestWin.winner} l'emportent ${h.biggestWin.sa}-${h.biggestWin.sb}.`);
    if (h?.bestStreak && h.bestStreak.streak >= 3) lines.push(`📈 ${h.bestStreak.label} enchaînent : ${h.bestStreak.streak} victoires d'affilée, personne ne les arrête !`);
    if (played >= 4) lines.push(`👏 Déjà ${played} matchs disputés — la tension monte dans la salle !`);

    // Demi-finales : combien de places restent ?
    const semiSlots = matches.filter((m) => m.phase === "semi").flatMap((m) => [m.labelA, m.labelB]);
    if (semiSlots.length) {
      const filled = semiSlots.filter((l) => l !== "à venir").length;
      const left = semiSlots.length - filled;
      if (filled > 0 && left === 1) lines.push("🏆 Plus qu'une place à prendre pour les demi-finales !");
      else if (filled >= 1) {
        const names = [...new Set(semiSlots.filter((l) => l !== "à venir"))];
        for (const n of names) lines.push(`🎟️ ${n} sont en demi-finale !`);
      }
    }

    const finalLive = matches.some((m) => m.phase === "final" && m.labelA !== "à venir" && m.labelB !== "à venir" && m.status !== "finished");
    if (finalLive) lines.push("🤫 La finale est lancée — silence dans la salle !");

    if (!lines.length) lines.push("🔥 Ça chauffe sur les tables — que le meilleur binôme gagne !");
  } else if (t.status === "finished") {
    const champ = (s.podium ?? []).find((p) => p.rank === 1);
    if (champ) lines.push(`🏆 Champions : ${champ.label} ! 👏👏👏`);
    lines.push("🎉 Merci à tous les binômes — rendez-vous l'an prochain !");
  }
  void labelByTeamMatch;
  return lines;
}

function Speaker({ s, ticks }: { s: State; ticks: number }) {
  const lines = computeSpeakerLines(s);
  if (!lines.length) return null;
  const line = lines[Math.floor(ticks / 5) % lines.length]; // change toutes les 5 s
  return (
    <div className="shrink-0 bg-canal-yellow text-canal-black rounded-2xl px-6 py-3 mt-2">
      <p key={line} className="text-3xl font-black text-center truncate animate-[pop_0.5s_ease]">🎤 {line}</p>
    </div>
  );
}

function TvMatch({ m }: { m: PublicMatch }) {
  const finished = m.status === "finished";
  return (
    <div className="canal-card bg-canal-gray-dark/40 flex items-center gap-3 py-3">
      <span className="flex-1 text-right text-2xl font-bold truncate">{m.labelA}</span>
      {finished ? <span className="text-3xl font-black text-canal-yellow">{m.score_a}-{m.score_b}</span> : <span className="text-2xl text-canal-gray-muted">vs</span>}
      <span className="flex-1 text-2xl font-bold truncate">{m.labelB}</span>
    </div>
  );
}
