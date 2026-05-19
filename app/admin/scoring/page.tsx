// /admin/scoring — PREVIEW / DRY-RUN de la pondération.
//
// Protégée par app/admin/layout.tsx → requireRole("admin") (admin &
// super_admin ; user/event_admin bloqués au niveau layout — event_admin
// lecture seule n'est pas ajouté ici : le gate est partagé au layout, donc
// pas "simple" sans le remanier ; cohérent avec toutes les pages /admin).
//
// AUCUNE écriture DB. On rejoue computeTeamScores avec un override de config
// EN MÉMOIRE (expectedMaxRaw simulé) et on compare au classement officiel.
// Sert à FIGER les bons EXPECTED_MAX_RAW AVANT le coup d'envoi. Après
// lancement : ne plus toucher lib/scoring/config.ts (équité).

import { createClient } from "@/lib/supabase/server";
import { computeTeamScores } from "@/lib/data/teams";
import {
  DEFAULT_SCORING_CONFIG,
  weightPct,
  type Pillar,
} from "@/lib/scoring/config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PILLARS: { key: Exclude<Pillar, "votes">; label: string; field: string }[] = [
  { key: "pronostics", label: "Pronostics", field: "emp" },
  { key: "quiz", label: "Quiz", field: "emq" },
  { key: "babyfoot", label: "Babyfoot", field: "emb" },
  { key: "animations", label: "Animations", field: "ema" },
];

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : fallback;
}

export default async function AdminScoringPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const g = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const def = DEFAULT_SCORING_CONFIG.expectedMaxRaw;

  const simExpected = {
    pronostics: num(g("emp"), def.pronostics),
    quiz: num(g("emq"), def.quiz),
    babyfoot: num(g("emb"), def.babyfoot),
    animations: num(g("ema"), def.animations),
  };
  const simulated = Object.entries(simExpected).some(
    ([k, v]) => v !== def[k as Pillar]
  );

  const supabase = await createClient();
  const { data: teamsRaw } = await supabase.from("teams").select("id, name");
  const teams = teamsRaw ?? [];
  const ids = teams.map((t) => t.id);

  // Officiel (config par défaut) vs simulé (override expectedMaxRaw). Aucune
  // écriture — computeTeamScores ne fait que LIRE.
  const [official, sim] = await Promise.all([
    computeTeamScores(supabase, ids),
    computeTeamScores(supabase, ids, { expectedMaxRaw: simExpected }),
  ]);

  const byTotal = (
    m: ReadonlyMap<string, { total: number }>
  ): Map<string, number> =>
    new Map(
      [...m.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([id], i) => [id, i + 1] as [string, number])
    );
  const rankOff = byTotal(official);
  const rankSim = byTotal(sim);

  const rows = teams
    .map((t) => {
      const o = official.get(t.id);
      const s = sim.get(t.id);
      const oTotal = o?.total ?? 0;
      const sTotal = s?.total ?? 0;
      const w = s?.weighted ?? { pronostics: 0, quiz: 0, babyfoot: 0, animations: 0 };
      const dominant = (
        ["pronostics", "quiz", "babyfoot", "animations"] as const
      ).reduce((a, b) => (w[b] > w[a] ? b : a), "pronostics" as const);
      return {
        id: t.id,
        name: t.name,
        rankOff: rankOff.get(t.id) ?? 0,
        rankSim: rankSim.get(t.id) ?? 0,
        oTotal,
        sTotal,
        diff: sTotal - oTotal,
        w,
        dominant,
      };
    })
    .sort((a, b) => a.rankOff - b.rankOff);

  // Plus forte montée / descente (par delta de rang ; tie → delta score).
  const movers = [...rows].sort(
    (a, b) =>
      b.rankOff - b.rankSim - (a.rankOff - a.rankSim) ||
      b.diff - a.diff
  );
  const climber = movers[0];
  const faller = movers[movers.length - 1];

  // Alerte écrasement : part de chaque pilier dans le total simulé global.
  const pillarSum = { pronostics: 0, quiz: 0, babyfoot: 0, animations: 0 };
  for (const r of rows) {
    pillarSum.pronostics += r.w.pronostics;
    pillarSum.quiz += r.w.quiz;
    pillarSum.babyfoot += r.w.babyfoot;
    pillarSum.animations += r.w.animations;
  }
  const grand =
    pillarSum.pronostics + pillarSum.quiz + pillarSum.babyfoot + pillarSum.animations;
  const ALERT = 0.5;
  const crushed = (
    ["pronostics", "quiz", "babyfoot", "animations"] as const
  ).find((p) => grand > 0 && pillarSum[p] / grand > ALERT);

  return (
    <div className="px-4 py-4 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Scoring — Preview / Dry-run</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Tester <code>EXPECTED_MAX_RAW</code> avant le coup d&apos;envoi.
          <span className="text-canal-yellow font-bold"> Lecture seule</span> —
          aucune écriture, le classement officiel n&apos;est pas modifié.
        </p>
      </div>

      {/* Pondération officielle (lecture seule) */}
      <section className="canal-card">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2">
          Pondération officielle (figée — non modifiable ici)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
          {(["pronostics", "quiz", "babyfoot", "animations", "votes"] as Pillar[]).map(
            (p) => (
              <div key={p} className="bg-canal-gray-mid rounded-lg px-3 py-2 text-center">
                <p className="text-white font-bold capitalize">{p}</p>
                <p className="text-canal-yellow font-black">{weightPct(p)}%</p>
              </div>
            )
          )}
        </div>
        <p className="text-xs text-canal-gray-muted mt-2">
          Votes = 0 % (métrique sociale, hors classement). Modifie les poids
          dans <code>lib/scoring/config.ts</code> si vraiment nécessaire, avant
          lancement.
        </p>
      </section>

      {/* Formulaire : override expectedMaxRaw (GET, server round-trip) */}
      <section className="canal-card">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-3">
          EXPECTED_MAX_RAW à simuler
        </p>
        <form method="GET" className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PILLARS.map((p) => (
              <label key={p.key} className="block">
                <span className="text-xs text-canal-gray-muted">
                  {p.label}{" "}
                  <span className="text-canal-gray-light">
                    (officiel : {def[p.key]})
                  </span>
                </span>
                <input
                  type="number"
                  name={p.field}
                  min={1}
                  defaultValue={simExpected[p.key]}
                  className="mt-1 w-full bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-canal-yellow"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="px-4 py-2.5 bg-canal-yellow text-canal-black font-black text-sm rounded-xl hover:bg-canal-yellow-hover transition-colors"
            >
              Simuler le classement
            </button>
            <a
              href="/admin/scoring"
              className="text-xs text-canal-gray-muted hover:text-white"
            >
              Réinitialiser (valeurs officielles)
            </a>
          </div>
        </form>
      </section>

      {/* Alertes / synthèse */}
      <section className="space-y-2">
        {grand === 0 && (
          <p className="canal-card text-canal-gray-muted text-sm">
            Aucun point distribué pour l&apos;instant — la simulation devient
            parlante quand des points existent (pendant la CdM). Tu peux déjà
            figer des estimations, à revérifier en live (preview only).
          </p>
        )}
        {crushed && (
          <p className="canal-card border border-red-700/50 text-red-300 text-sm font-bold">
            ⚠️ Sous cette config, le pilier <b>{crushed}</b> représente{" "}
            {Math.round((pillarSum[crushed] / grand) * 100)}% du total global —
            il écrase les autres. Augmente son <code>expectedMaxRaw</code> ou
            baisse celui des piliers à valoriser.
          </p>
        )}
        {grand > 0 && !crushed && (
          <p className="canal-card border border-green-800/40 text-green-400 text-sm">
            ✅ Équilibre OK : aucun pilier &gt; {Math.round(ALERT * 100)}% du
            total global sous cette config.
          </p>
        )}
        {simulated && climber && faller && climber.id !== faller.id && (
          <div className="grid grid-cols-2 gap-2">
            <div className="canal-card text-sm">
              <p className="text-canal-gray-muted text-xs">Plus forte montée</p>
              <p className="text-white font-bold">{climber.name}</p>
              <p className="text-green-400 text-xs">
                rang {climber.rankOff} → {climber.rankSim} ({climber.diff >= 0 ? "+" : ""}
                {climber.diff} pts)
              </p>
            </div>
            <div className="canal-card text-sm">
              <p className="text-canal-gray-muted text-xs">Plus forte descente</p>
              <p className="text-white font-bold">{faller.name}</p>
              <p className="text-red-400 text-xs">
                rang {faller.rankOff} → {faller.rankSim} ({faller.diff >= 0 ? "+" : ""}
                {faller.diff} pts)
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Tableau comparatif */}
      <section className="canal-card overflow-x-auto">
        <table className="w-full text-sm tabular-nums min-w-[640px]">
          <thead>
            <tr className="text-canal-gray-muted text-xs border-b border-canal-gray-light">
              <th className="text-left py-1.5 pr-2">#</th>
              <th className="text-left py-1.5">Équipe</th>
              <th className="text-right py-1.5 px-2">Officiel</th>
              <th className="text-right py-1.5 px-2">Simulé</th>
              <th className="text-right py-1.5 px-2">Δ</th>
              <th className="text-right py-1.5 px-1">Pron</th>
              <th className="text-right py-1.5 px-1">Quiz</th>
              <th className="text-right py-1.5 px-1">Baby</th>
              <th className="text-right py-1.5 px-1">Anim</th>
              <th className="text-left py-1.5 pl-2">Dominant</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-canal-gray-light/20 text-white"
              >
                <td className="py-1.5 pr-2 font-black">{r.rankOff}</td>
                <td className="py-1.5 truncate max-w-[140px]">{r.name}</td>
                <td className="text-right px-2">{r.oTotal}</td>
                <td className="text-right px-2 font-bold text-canal-yellow">
                  {r.sTotal}
                </td>
                <td
                  className={cn(
                    "text-right px-2",
                    r.diff > 0 && "text-green-400",
                    r.diff < 0 && "text-red-400",
                    r.diff === 0 && "text-canal-gray-muted"
                  )}
                >
                  {r.diff > 0 ? "+" : ""}
                  {r.diff}
                </td>
                <td className="text-right px-1 text-canal-gray-muted">{r.w.pronostics}</td>
                <td className="text-right px-1 text-canal-gray-muted">{r.w.quiz}</td>
                <td className="text-right px-1 text-canal-gray-muted">{r.w.babyfoot}</td>
                <td className="text-right px-1 text-canal-gray-muted">{r.w.animations}</td>
                <td className="py-1.5 pl-2 capitalize text-canal-yellow">
                  {r.dominant}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-canal-gray-muted py-4">
                  Aucune équipe.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
